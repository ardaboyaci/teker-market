/**
 * ZET GÖRSEL SCRAPER v1
 *
 * zet-teker.com sitesindeki tüm kategorileri tarar,
 * her ürün kartından SKU kodu + görsel URL çeker,
 * DB'deki ZET ürünleriyle eşleştirip görseli yükler.
 *
 * Eşleşme stratejisi (multi-tier):
 *   Tier 1 — Exact: DB SKU normalize = Site SKU normalize
 *   Tier 2 — Kod+Model: "3001 POR" prefix eşleşmesi
 *   Tier 3 — Token: en az %70 token örtüşmesi
 *
 * Flags:
 *   --dry-run   Storage/DB'ye yazmadan log
 *   --limit=N   İlk N site ürününü işle (test için)
 *   --resume    Checkpoint'ten devam et
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { BOT_CONFIG, withRetry } from './config/bot-config';
import { downloadAndProcess, uploadToStorage, linkToProduct } from './lib/image-pipeline';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN  = process.argv.includes('--dry-run');
const RESUME   = process.argv.includes('--resume');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const BASE_URL      = 'https://www.zet-teker.com';
const OUTPUT_DIR    = path.resolve(__dirname, 'output');
const IMAGES_DIR    = path.join(OUTPUT_DIR, 'zet-images');
const LOG_FILE      = path.join(OUTPUT_DIR, 'zet-images-log.json');
const CHECKPOINT    = path.join(OUTPUT_DIR, 'zet-images-checkpoint.json');

const CATEGORIES = [
    '/tr/urunler/mobilya-tekerlekleri',
    '/tr/urunler/market-tekerlekleri',
    '/tr/urunler/endustriyel-tekerlekler/hafif-yukler',
    '/tr/urunler/endustriyel-tekerlekler/orta-yukler',
    '/tr/urunler/endustriyel-tekerlekler/agir-yukler',
    '/tr/urunler/hastane-tipi-tekerlekler',
    '/tr/urunler/paslanmaz-celik-inox-tekerlekler',
    '/tr/urunler/isiya-dayanikli-tekerlekler-max270°',
    '/tr/urunler/cop-konteyner-tekerlekleri',
    '/tr/urunler/transpalet-tekerlekleri',
    '/tr/urunler/yedek-tekerler',
];

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: BOT_CONFIG.http.timeout,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Checkpoint ────────────────────────────────────────────────────────────────
interface ZetCheckpoint { doneSku: string[]; startedAt: string; }

async function loadCheckpoint(): Promise<Set<string>> {
    if (!RESUME) return new Set();
    try {
        const cp = JSON.parse(await fs.readFile(CHECKPOINT, 'utf-8')) as ZetCheckpoint;
        console.log(`[Checkpoint] ${cp.doneSku.length} SKU tamamlandı (${cp.startedAt})`);
        return new Set(cp.doneSku);
    } catch { return new Set(); }
}

async function saveCheckpoint(done: Set<string>): Promise<void> {
    await fs.writeFile(CHECKPOINT, JSON.stringify({ startedAt: new Date().toISOString(), doneSku: [...done] }, null, 2));
}

// ── SKU Normalize ─────────────────────────────────────────────────────────────
// "3001 POR 100*32 F4" → "3001POR100X32F4"
// "ADB 055x25"         → "ADB055X25"
function normalizeSku(sku: string): string {
    return sku.toUpperCase()
        .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
        .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
        .replace(/[*×x]/gi, 'X')
        .replace(/[^A-Z0-9X]/g, '');
}

// Prefix: "3001 POR 100*32 F4" → "3001POR"
function skuPrefix(sku: string): string {
    const norm = normalizeSku(sku);
    const m = norm.match(/^([A-Z0-9]+[A-Z]{2,})/);
    return m ? m[1] : norm.slice(0, 6);
}

// Boyutsal eşleşme: "055X25" veya "100X32" gibi parçaları karşılaştır
// "3001 POR 100*32 F4" → ["100", "32"]
// "ADB 055x25"         → ["055", "25"] veya ["55", "25"]
function extractDims(sku: string): string[] {
    const norm = normalizeSku(sku);
    // "100X32", "055X25" gibi boyut çiftlerini çek
    const dims: string[] = [];
    const m = norm.match(/(\d{2,3})X(\d{2,3})/);
    if (m) {
        // Leading zero'suz normalize et: "055" → "55"
        dims.push(String(parseInt(m[1])));
        dims.push(String(parseInt(m[2])));
    }
    return dims;
}

// Model kodu eşleşmesi: "ADB", "POR", "MOB" gibi 2-4 harf kodları
function extractModel(sku: string): string {
    const norm = normalizeSku(sku);
    // Sayı olmayan 2-4 harf bloğu
    const m = norm.match(/(?<![A-Z])([A-Z]{2,4})(?![A-Z])/g);
    return m ? m[0] : '';
}

function tokenScore(a: string, b: string): number {
    const ta = a.toUpperCase().match(/[A-Z]+|\d+/g) ?? [];
    const tb = new Set(b.toUpperCase().match(/[A-Z]+|\d+/g) ?? []);
    if (!ta.length) return 0;
    return ta.filter(t => t.length >= 2 && tb.has(t)).length / ta.length;
}

// ── Site Ürün Interface ───────────────────────────────────────────────────────
interface SiteProduct {
    siteSku:    string;   // "1001 MEB 050"
    normSku:    string;   // "1001MEB050"
    prefix:     string;   // "1001MEB"
    imageUrl:   string;   // tam URL
    detailUrl?: string;
}

// ── Kategori sayfası scrape ───────────────────────────────────────────────────
async function scrapeCategory(catPath: string): Promise<SiteProduct[]> {
    const products: SiteProduct[] = [];
    const seen = new Set<string>();

    async function scrapePage(url: string): Promise<string | null> {
        const { data: html } = await withRetry(
            () => http.get(url, { validateStatus: () => true }),
            { label: `zet ${url}` }
        );
        const $ = cheerio.load(html);

        // Her ürün kartı: .productItem
        // - Görsel: .productPic img[src*="upload"]
        // - SKU satırları: .tableRow → ilk .tableCol = "ADB 055x25"
        $('.productItem').each((_, card) => {
            const imgSrc = $(card).find('.productPic img[src*="upload"]').attr('src');
            if (!imgSrc) return;

            const fullImg = BASE_URL + imgSrc;

            // Her tablo satırı = bir SKU varyantı (aynı görseli paylaşır)
            $(card).find('a.tableRow').each((_, row) => {
                const siteSku = $(row).find('.tableCol').first().text().trim();
                if (!siteSku || seen.has(siteSku)) return;
                seen.add(siteSku);

                const detailHref = $(row).attr('href') || '';

                products.push({
                    siteSku,
                    normSku:   normalizeSku(siteSku),
                    prefix:    skuPrefix(siteSku),
                    imageUrl:  fullImg,
                    detailUrl: detailHref.startsWith('http') ? detailHref : BASE_URL + detailHref,
                });
            });
        });

        // Pagination
        let nextTarget: string | null = null;
        $('a').each((_, a) => {
            const href = $(a).attr('href') || '';
            const txt  = $(a).text().trim();
            if (/^[>›»]$/.test(txt) && href.includes('__doPostBack')) {
                const m = href.match(/doPostBack\('([^']+)'/);
                if (m) nextTarget = m[1];
            }
        });

        return nextTarget;
    }

    // İlk sayfa
    const fullUrl = BASE_URL + catPath;
    let nextTarget = await scrapePage(fullUrl);

    // Sayfalama (ASP.NET postback)
    let pageNum = 1;
    while (nextTarget && pageNum < 30) {
        pageNum++;
        await sleep(600);
        try {
            // Postback için ilk sayfanın VIEWSTATE'ini almak gerekiyor
            // ZET basit link pagination kullanıyor — deneme
            const nextUrl = `${fullUrl}?page=${pageNum}`;
            nextTarget = await scrapePage(nextUrl);
        } catch { break; }
    }

    console.log(`  ${catPath}: ${products.length} ürün`);
    return products;
}

// ── DB → Map oluştur ──────────────────────────────────────────────────────────
interface DbProduct { id: string; sku: string; norm: string; prefix: string; }

async function loadDbProducts(): Promise<DbProduct[]> {
    const result: DbProduct[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('id, sku')
            .contains('meta', { source: 'zet_2026' })
            .is('deleted_at', null)
            .is('image_url', null)
            .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        for (const p of data) {
            result.push({
                id:     p.id,
                sku:    p.sku,
                norm:   normalizeSku(p.sku),
                prefix: skuPrefix(p.sku),
            });
        }
        if (data.length < 1000) break;
        from += 1000;
    }
    return result;
}

// ── Eşleştirme — tüm model eşleşmeleri ──────────────────────────────────────
// ZET sitesi model bazlı görsel paylaşıyor:
// Görsel URL: /uploads/resim/2001-1/ADB.jpg → model = "ADB"
// DB SKU: "3001 POR 100*32 F4" → model kodu "POR"
// Boyut: site "ADB 055x25" → 55x25 / DB "3001 POR 100*32" → 100x32
//
// Eşleştirme önceliği:
//   Tier 1 — Boyut + Model: hem boyut hem model kodu eşleşiyor
//   Tier 2 — Sadece boyut eşleşmesi (çap x genişlik)
//   Tier 3 — Sadece model kodu eşleşmesi
//   Tier 4 — Token score >= 0.50
function matchAllProducts(site: SiteProduct, dbProducts: DbProduct[]): DbProduct[] {
    const siteDims  = extractDims(site.siteSku);
    const siteModel = extractModel(site.siteSku);

    // Tier 1: Boyut + model birlikte eşleşiyor
    if (siteDims.length === 2 && siteModel) {
        const t1 = dbProducts.filter(p => {
            const pDims  = extractDims(p.sku);
            const pModel = extractModel(p.sku);
            return pDims.length === 2 &&
                   pDims[0] === siteDims[0] && pDims[1] === siteDims[1] &&
                   pModel === siteModel;
        });
        if (t1.length) return t1;
    }

    // Tier 2: Sadece boyut eşleşmesi (aynı çap x genişlik)
    if (siteDims.length === 2) {
        const t2 = dbProducts.filter(p => {
            const pDims = extractDims(p.sku);
            return pDims.length === 2 &&
                   pDims[0] === siteDims[0] && pDims[1] === siteDims[1];
        });
        if (t2.length) return t2;
    }

    // Tier 3: Sadece model kodu eşleşmesi
    if (siteModel && siteModel.length >= 2) {
        const t3 = dbProducts.filter(p => extractModel(p.sku) === siteModel);
        if (t3.length) return t3;
    }

    // Tier 4: token score >= 0.50
    const t4 = dbProducts
        .map(p => ({ p, score: tokenScore(p.sku, site.siteSku) }))
        .filter(x => x.score >= 0.50)
        .sort((a, b) => b.score - a.score)
        .map(x => x.p);

    return t4;
}

// Backward compat için tekil eşleşme
function matchProduct(site: SiteProduct, dbProducts: DbProduct[]): DbProduct | null {
    return matchAllProducts(site, dbProducts)[0] ?? null;
}

// ── bot_runs log ──────────────────────────────────────────────────────────────
async function startBotRun(): Promise<string | null> {
    if (DRY_RUN) return null;
    const { data, error } = await supabase.from('bot_runs').insert({
        bot_name: 'scrape-zet-images', started_at: new Date().toISOString(), status: 'running',
    }).select('id').single();
    if (error) { console.warn('[bot_runs]', error.message); return null; }
    return data.id;
}

async function finishBotRun(id: string | null, processed: number, errors: number): Promise<void> {
    if (!id || DRY_RUN) return;
    await supabase.from('bot_runs').update({
        finished_at: new Date().toISOString(), status: 'completed',
        processed_count: processed, error_count: errors,
    }).eq('id', id);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ ZET GÖRSEL SCRAPER v1 ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN\n');
    if (RESUME)  console.log('  ↺  RESUME modu\n');

    await fs.mkdir(IMAGES_DIR, { recursive: true });

    const doneSet = await loadCheckpoint();
    const runId   = await startBotRun();

    // 1. Tüm kategorileri tara
    console.log('[Adım 1] Kategoriler taranıyor...');
    const allSiteProducts: SiteProduct[] = [];
    for (const cat of CATEGORIES) {
        const products = await scrapeCategory(cat);
        allSiteProducts.push(...products);
        await sleep(800);
    }
    console.log(`\nToplam site ürünü: ${allSiteProducts.length}\n`);

    // 2. DB'den görselsiz ZET ürünleri
    console.log('[Adım 2] DB\'den görselsiz ZET ürünleri yükleniyor...');
    const dbProducts = await loadDbProducts();
    console.log(`DB: ${dbProducts.length} görselsiz ürün\n`);

    // Limit uygula
    const toProcess = LIMIT ? allSiteProducts.slice(0, LIMIT) : allSiteProducts;

    // 3. Eşleştir ve yükle
    console.log('[Adım 3] Eşleştirme ve yükleme...\n');
    const log: { siteSku: string; dbSku?: string; status: string; tier?: string }[] = [];
    let matched = 0, skipped = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const site = toProcess[i];

        if (doneSet.has(site.normSku)) { skipped++; continue; }

        const dbMatches = matchAllProducts(site, dbProducts);
        if (!dbMatches.length) {
            log.push({ siteSku: site.siteSku, status: 'no_match' });
            skipped++;
            continue;
        }

        const tier = dbMatches[0].norm === site.normSku ? 'T1' :
                     dbMatches[0].prefix === site.prefix ? 'T2' : 'T3';

        process.stdout.write(`\r  [${i+1}/${toProcess.length}] ${site.siteSku} → ${dbMatches.length} ürün [${tier}]`);

        if (DRY_RUN) {
            dbMatches.forEach(p => log.push({ siteSku: site.siteSku, dbSku: p.sku, status: 'dry-run', tier }));
            doneSet.add(site.normSku);
            matched += dbMatches.length;
            continue;
        }

        // Görseli bir kez indir
        const safeSku    = site.normSku.toLowerCase();
        const outputPath = path.join(IMAGES_DIR, `${safeSku}.webp`);

        const localPath = await downloadAndProcess(site.imageUrl, outputPath);
        if (!localPath) {
            console.error(`\n  ✗ İndirme: ${site.siteSku}`);
            log.push({ siteSku: site.siteSku, status: 'download_error', tier });
            errors++;
            await sleep(500);
            continue;
        }

        // Tüm eşleşen ürünlere uygula
        let uploadedUrl: string | null = null;
        for (const dbProd of dbMatches) {
            if (!uploadedUrl) {
                uploadedUrl = await uploadToStorage(supabase, localPath, dbProd.sku);
                if (!uploadedUrl) {
                    log.push({ siteSku: site.siteSku, dbSku: dbProd.sku, status: 'upload_error', tier });
                    errors++;
                    break;
                }
            } else {
                // Aynı görsel farklı SKU ile de kaydet
                const sku2 = dbProd.sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const path2 = path.join(IMAGES_DIR, `${sku2}.webp`);
                await fs.copyFile(localPath, path2).catch(() => {});
                const url2 = await uploadToStorage(supabase, path2, dbProd.sku);
                if (!url2) { errors++; continue; }
                uploadedUrl = url2;
            }

            const ok = await linkToProduct(supabase, dbProd.id, uploadedUrl);
            if (ok) {
                log.push({ siteSku: site.siteSku, dbSku: dbProd.sku, status: 'ok', tier });
                const idx = dbProducts.findIndex(p => p.id === dbProd.id);
                if (idx !== -1) dbProducts.splice(idx, 1);
                matched++;
            } else {
                log.push({ siteSku: site.siteSku, dbSku: dbProd.sku, status: 'db_error', tier });
                errors++;
            }
        }

        doneSet.add(site.normSku);
        if ((i + 1) % 20 === 0) await saveCheckpoint(doneSet);
        await sleep(200);
    }

    await saveCheckpoint(doneSet);
    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2));
    await finishBotRun(runId, matched, errors);

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Eşleşti + Yüklendi': { Adet: matched },
        'Atlandı / Eşleşmedi': { Adet: skipped },
        'Hata': { Adet: errors },
        'Site Ürün Sayısı': { Adet: allSiteProducts.length },
        'DB Bekleyen': { Adet: dbProducts.length + matched },
    });
    console.log(`[Log] ${LOG_FILE}`);
}

main().catch(err => {
    console.error('[FATAL]', err instanceof Error ? err.message : err);
    process.exit(1);
});

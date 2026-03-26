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
// "1001 MEB 050"       → "1001MEB050"
// "3000 POR 125*40 (İnox)" → "3000POR125X40INOX"
function normalizeSku(sku: string): string {
    return sku.toUpperCase()
        .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
        .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
        .replace(/\*/g, 'X')
        .replace(/[^A-Z0-9X]/g, '');
}

// Prefix: "3001 POR 100*32 F4" → "3001POR"
function skuPrefix(sku: string): string {
    const norm = normalizeSku(sku);
    const m = norm.match(/^([A-Z0-9]+[A-Z]{2,})/);
    return m ? m[1] : norm.slice(0, 6);
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

        // Ürün kartları: img[src*=upload] + yakın KOD NO text
        $('img[src*="upload"]').each((_, el) => {
            const src = $(el).attr('src');
            if (!src || src.includes('filtre') || src.includes('baglanti')) return;

            const fullImg = BASE_URL + src;
            const container = $(el).closest('div, li, tr, td, article');
            const text = container.text().replace(/\s+/g, ' ').trim();

            // "KOD NO 1001 MEB 050 50 20 ..." formatından SKU çek
            const kodMatch = text.match(/KOD\s*NO\s+([\w\s*]+?)(?:\d{2,3}\s+\d{2,3}|\d+\s+kg|\s{2,}|$)/i);
            // veya görsel dosya adından çek: 1001MEB.jpg → 1001MEB
            const fileMatch = src.match(/\/([A-Z0-9_-]+)\.(jpg|jpeg|png|webp)$/i);

            let siteSku = '';
            if (kodMatch) {
                siteSku = kodMatch[1].trim();
            } else if (fileMatch) {
                siteSku = fileMatch[1].replace(/_/g, ' ');
            }

            if (!siteSku || seen.has(fullImg)) return;
            seen.add(fullImg);

            const detailLink = container.find('a[href*="/tr/"]').first().attr('href');

            products.push({
                siteSku,
                normSku:  normalizeSku(siteSku),
                prefix:   skuPrefix(siteSku),
                imageUrl: fullImg,
                detailUrl: detailLink ? BASE_URL + detailLink : undefined,
            });
        });

        // Pagination: sonraki sayfa linki
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
// "MAB" görseli → DB'deki tüm "MAB" içeren ürünlere uygulanır
function matchAllProducts(site: SiteProduct, dbProducts: DbProduct[]): DbProduct[] {
    const results: DbProduct[] = [];

    // Tier 1: exact normalize (tam eşleşme)
    const t1 = dbProducts.filter(p => p.norm === site.normSku);
    if (t1.length) return t1;

    // Tier 2a: prefix eşleşmesi
    const t2a = dbProducts.filter(p => p.prefix === site.prefix);
    if (t2a.length) return t2a;

    // Tier 2b: site normSku içerme
    const t2b = dbProducts.filter(p =>
        p.norm.includes(site.normSku) || site.normSku.includes(p.norm)
    );
    if (t2b.length) return t2b;

    // Tier 2c: tek model kodu → tüm DB ürünleri içinde ara
    if (/^[A-Z]{2,8}$/.test(site.normSku)) {
        const t2c = dbProducts.filter(p => p.norm.includes(site.normSku));
        if (t2c.length) return t2c;
    }

    // Tier 3: token score ≥ 0.60 olan tüm ürünler
    const t3 = dbProducts
        .map(p => ({ p, score: tokenScore(p.sku, site.siteSku) }))
        .filter(x => x.score >= 0.60)
        .sort((a, b) => b.score - a.score)
        .map(x => x.p);

    return t3;
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

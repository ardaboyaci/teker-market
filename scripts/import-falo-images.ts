/**
 * FALO MAKARA GÖRSEL SCRAPER v2
 *
 * Strateji:
 * - falometal.com kategori sayfalarını doğrudan tara (wheel-group + diğerleri)
 * - Her ürün kartından: model kodu (alt attr) + görsel URL al
 * - DB'deki falo_2026 ürünleriyle model kodu / isim bazlı eşleştir
 * - İndir → WebP + watermark → Supabase Storage → image_url güncelle
 * - Checkpoint/resume sistemi + bot_runs logging
 *
 * Site yapısı: div.l-product__search-list-item
 *   Görsel: img[src*="storage/products"]  (alt = model kodu, "PT 0081")
 *   Link:   a.l-product__search-list-item-image[href]
 *   Ad:     a.l-product__search-list-item-code
 *
 * Flags:
 *   --dry-run   Storage/DB'ye yazmadan log
 *   --limit=N   İlk N site ürününü işle
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
import { downloadAndProcess, uploadToStorage, linkToProduct, sleep } from './lib/image-pipeline';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Supabase credentials eksik (.env.local)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DRY_RUN    = process.argv.includes('--dry-run');
const RESUME     = process.argv.includes('--resume');
const REPROCESS  = process.argv.includes('--reprocess'); // Mevcut görselleri de yeniden işle
const limitArg   = process.argv.find(a => a.startsWith('--limit='));
const LIMIT      = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const FALO_BASE       = 'https://falometal.com';
const OUTPUT_DIR      = path.resolve(__dirname, 'output', 'falo-images');
const LOG_FILE        = path.resolve(__dirname, 'output', 'falo-images-log.json');
const CHECKPOINT_FILE = path.resolve(__dirname, 'output', 'falo-checkpoint.json');

const CATEGORY_SLUGS = [
    'wheel-group',
    'hinge-group',
    'latch%20group',
    'guide-roller-group',
    'karsor-ekipmanlar',
];

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: BOT_CONFIG.http.timeout,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
});

// ── Checkpoint ────────────────────────────────────────────────────────────────
interface FaloCheckpoint { startedAt: string; doneKeys: string[]; }

async function loadCheckpoint(): Promise<FaloCheckpoint | null> {
    if (!RESUME) return null;
    try {
        const cp = JSON.parse(await fs.readFile(CHECKPOINT_FILE, 'utf-8')) as FaloCheckpoint;
        console.log(`[Checkpoint] ${cp.doneKeys.length} kayıt tamamlandı (${cp.startedAt})`);
        return cp;
    } catch { return null; }
}

async function saveCheckpoint(doneKeys: string[]): Promise<void> {
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify({ startedAt: new Date().toISOString(), doneKeys }, null, 2), 'utf-8');
}

// ── Site modeli ───────────────────────────────────────────────────────────────
interface SiteItem {
    imageUrl: string;
    detailUrl: string;
    modelCode: string;
    categoryName: string;
    category: string;
}

// ── Kategori sayfası tarama ───────────────────────────────────────────────────
async function scrapeCategoryPage(slug: string): Promise<SiteItem[]> {
    const url = `${FALO_BASE}/urunlerimiz/${slug}`;
    process.stdout.write(`\n  [Kategori] ${url} taranıyor...`);
    try {
        const { data } = await withRetry(
            () => http.get(url, { validateStatus: () => true }),
            { label: `kategori ${slug}` }
        );
        const $ = cheerio.load(data);
        const items: SiteItem[] = [];

        $('.l-product__search-list-item').each((_, el) => {
            const $el    = $(el);
            const imgEl  = $el.find('img').first();
            const imgSrc = imgEl.attr('src') ?? '';
            if (!imgSrc.includes('/storage/products/')) return;

            const imageUrl     = imgSrc.startsWith('http') ? imgSrc : `${FALO_BASE}${imgSrc}`;
            const modelCode    = (imgEl.attr('alt') ?? '').trim();
            const href         = $el.find('a.l-product__search-list-item-image').first().attr('href') ?? '';
            const detailUrl    = href.startsWith('http') ? href : `${FALO_BASE}${href}`;
            const categoryName = $el.find('a.l-product__search-list-item-code').first().text().trim();

            if (imageUrl && detailUrl) {
                items.push({ imageUrl, detailUrl, modelCode, categoryName, category: slug });
            }
        });

        console.log(` ${items.length} ürün`);
        return items;
    } catch (err) {
        console.error(`\n  [Hata] ${slug}: ${err instanceof Error ? err.message : err}`);
        return [];
    }
}

async function collectAllSiteItems(): Promise<SiteItem[]> {
    const all: SiteItem[] = [];
    const seen = new Set<string>();
    for (const slug of CATEGORY_SLUGS) {
        const items = await scrapeCategoryPage(slug);
        for (const item of items) {
            if (!seen.has(item.imageUrl)) { seen.add(item.imageUrl); all.push(item); }
        }
        await sleep(BOT_CONFIG.ciftel.pageDelayMs);
    }
    console.log(`\n  [Toplam] ${all.length} unique site ürünü`);
    return all;
}

// ── Normalize ─────────────────────────────────────────────────────────────────
function normalizeName(s: string): string {
    const map: Record<string, string> = {
        'İ': 'i', 'ı': 'i', 'Ç': 'c', 'ç': 'c', 'Ş': 's', 'ş': 's',
        'Ğ': 'g', 'ğ': 'g', 'Ü': 'u', 'ü': 'u', 'Ö': 'o', 'ö': 'o',
    };
    return s.toLowerCase()
        .replace(/[İıÇçŞşĞğÜüÖö]/g, c => map[c] ?? c)
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeModelCode(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Ana akış ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ FALO GÖRSEL SCRAPER v2 ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN — Storage/DB\'ye yazılmıyor\n');
    if (RESUME)  console.log('  ↺  RESUME modu aktif\n');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const cp      = await loadCheckpoint();
    const doneSet = new Set<string>(cp?.doneKeys ?? []);

    console.log('\n[Adım 1] falometal.com kategori sayfaları taranıyor...');
    const siteItems = await collectAllSiteItems();
    if (siteItems.length === 0) {
        console.error('[Fatal] Siteden hiç ürün toplanamadı.');
        process.exit(1);
    }

    console.log('\n[Adım 2] DB\'den falo_2026 ürünleri çekiliyor...');
    const { data: dbProducts, error: dbErr } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .eq('meta->>source', 'falo_2026')
        .is('deleted_at', null);

    if (dbErr) { console.error('[Fatal] DB sorgu hatası:', dbErr.message); process.exit(1); }

    type DbProduct = { id: string; sku: string; name: string; image_url: string | null };
    const allDb          = (dbProducts ?? []) as DbProduct[];
    const dbWithoutImage = REPROCESS ? allDb : allDb.filter(p => !p.image_url);

    console.log(`[DB] ${allDb.length} falo_2026 ürünü toplam`);
    console.log(`[DB] ${dbWithoutImage.length} ürün ${REPROCESS ? '(--reprocess: tümü yeniden)' : 'görsel bekliyor'}\n`);

    const dbByNormSku  = new Map<string, DbProduct>();
    const dbByNormName = new Map<string, DbProduct>();
    for (const p of dbWithoutImage) {
        dbByNormSku.set(normalizeModelCode(p.sku), p);
        dbByNormName.set(normalizeName(p.name), p);
    }

    const toProcess = (LIMIT ? siteItems.slice(0, LIMIT) : siteItems)
        .filter(item => !doneSet.has(item.imageUrl));

    console.log(`[Adım 3] ${toProcess.length} site ürünü işlenecek (${doneSet.size} zaten tamamlandı)\n`);

    const log: { siteItem: string; sku?: string; status: string; url?: string; matchType?: string }[] = [];
    let matched = 0, skipped = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const item = toProcess[i];

        let dbProd: DbProduct | undefined;
        let matchType = '';

        // Tier 1: model kodu → SKU
        if (item.modelCode) {
            dbProd = dbByNormSku.get(normalizeModelCode(item.modelCode));
            if (dbProd) matchType = 'model_code';
        }
        // Tier 2: kategori adı → isim
        if (!dbProd && item.categoryName) {
            dbProd = dbByNormName.get(normalizeName(item.categoryName));
            if (dbProd) matchType = 'name_exact';
        }
        // Tier 3: URL slug → isim
        if (!dbProd) {
            const slug = item.detailUrl.split('/').pop() ?? '';
            dbProd = dbByNormName.get(normalizeName(slug.replace(/-/g, ' ')));
            if (dbProd) matchType = 'url_slug';
        }

        const label = item.modelCode || item.categoryName || '?';
        process.stdout.write(`\r  [${i + 1}/${toProcess.length}] ${label.substring(0, 40)}`);

        if (!dbProd) {
            log.push({ siteItem: item.imageUrl, status: 'no_db_match' });
            skipped++;
            continue;
        }

        if (DRY_RUN) {
            console.log(`\n  ✓ [DRY] ${dbProd.sku} (${matchType}) → ${item.imageUrl}`);
            log.push({ siteItem: item.imageUrl, sku: dbProd.sku, status: 'dry-run', url: item.imageUrl, matchType });
            doneSet.add(item.imageUrl);
            matched++;
            continue;
        }

        const localPath = path.join(OUTPUT_DIR, `${dbProd.sku.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.webp`);
        const processed = await downloadAndProcess(item.imageUrl, localPath);
        if (!processed) {
            log.push({ siteItem: item.imageUrl, sku: dbProd.sku, status: 'download_error' });
            errors++;
            await sleep(BOT_CONFIG.ciftel.errorDelayMs);
            continue;
        }

        const publicUrl = await uploadToStorage(supabase, localPath, dbProd.sku);
        if (!publicUrl) {
            log.push({ siteItem: item.imageUrl, sku: dbProd.sku, status: 'upload_error' });
            errors++;
            await sleep(BOT_CONFIG.ciftel.errorDelayMs);
            continue;
        }

        const linked = await linkToProduct(supabase, dbProd.id, publicUrl);
        if (linked) {
            log.push({ siteItem: item.imageUrl, sku: dbProd.sku, status: 'ok', url: publicUrl, matchType });
            doneSet.add(item.imageUrl);
            matched++;
            dbByNormSku.delete(normalizeModelCode(dbProd.sku));
            dbByNormName.delete(normalizeName(dbProd.name));
        } else {
            log.push({ siteItem: item.imageUrl, sku: dbProd.sku, status: 'link_error' });
            errors++;
        }

        if ((i + 1) % 10 === 0) await saveCheckpoint([...doneSet]);
        await sleep(BOT_CONFIG.ciftel.itemDelayMs);
    }

    await saveCheckpoint([...doneSet]);
    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklendi':      { Adet: matched },
        'DB Eşleşme Yok':      { Adet: skipped },
        'Hata':                { Adet: errors },
        'Site Ürün Sayısı':    { Adet: siteItems.length },
        'DB Bekleyen (önce)':  { Adet: dbWithoutImage.length },
    });
    console.log(`[Log]        ${LOG_FILE}`);
    console.log(`[Checkpoint] ${CHECKPOINT_FILE}`);
}

main().catch((err: unknown) => {
    if (err instanceof Error) console.error('[FATAL]', err.message);
    else console.error('[FATAL]', err);
    process.exit(1);
});

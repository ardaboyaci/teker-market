/**
 * ÇİFTEL GÖRSEL SCRAPER v3
 *
 * Strateji:
 * - ciftel.com.tr/shop/ listesini sayfa sayfa tara
 * - Her ürün kartından: siteSku (URL'den) + thumbUrl (img src) al
 * - thumbUrl'den "-420x503" gibi boyut suffix'ini kaldır → orijinal PNG URL
 * - DB'de sku = siteSku olan ürünü bul → image_url boşsa işle
 * - Görseli indir → WebP + watermark → Supabase Storage → image_url güncelle
 *
 * Detay sayfasına gitmeye GEREK YOK — listing'den yeterli veri geliyor.
 *
 * v3 değişiklikleri:
 *   - Checkpoint/resume sistemi: kesintide kaldığı yerden devam eder
 *   - fetchWithRetry: geçici ağ hatalarında 3 deneme
 *   - Başarısız görseller sessizce yutulmaz, loglanır
 *   - Tüm magic number'lar BOT_CONFIG'den okunur
 *
 * Flags:
 *   --dry-run    Storage/DB'ye yazmadan log
 *   --limit=N    İlk N site ürününü işle (test için)
 *   --resume     Checkpoint'ten kaldığı yerden devam et
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { BOT_CONFIG, withRetry } from './config/bot-config';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Supabase credentials eksik (.env.local)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DRY_RUN  = process.argv.includes('--dry-run');
const RESUME   = process.argv.includes('--resume');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const CIFTEL_BASE     = 'https://ciftel.com.tr';
const BUCKET          = 'product-media';
const WATERMARK       = path.resolve(__dirname, 'watermark-logo-transparent.png');
const OUTPUT_DIR      = path.resolve(__dirname, 'output');
const IMAGES_DIR      = path.join(OUTPUT_DIR, 'ciftel-images');
const LOG_FILE        = path.join(OUTPUT_DIR, 'ciftel-images-log.json');
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'ciftel-checkpoint.json');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: BOT_CONFIG.http.timeout,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

// ── Checkpoint helpers ────────────────────────────────────────────────────────
interface CiftelCheckpoint {
    startedAt: string;
    doneSku: string[];   // başarıyla tamamlanan SKU'lar
}

async function loadCheckpoint(): Promise<CiftelCheckpoint | null> {
    if (!RESUME) return null;
    try {
        const raw = await fs.readFile(CHECKPOINT_FILE, 'utf-8');
        const cp = JSON.parse(raw) as CiftelCheckpoint;
        console.log(`[Checkpoint] ${cp.doneSku.length} SKU zaten tamamlandı (${cp.startedAt})`);
        return cp;
    } catch {
        return null;
    }
}

async function saveCheckpoint(doneSku: string[]): Promise<void> {
    const cp: CiftelCheckpoint = { startedAt: new Date().toISOString(), doneSku };
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
}

// ── URL helpers ───────────────────────────────────────────────────────────────
function toOriginalUrl(thumbUrl: string): string {
    return thumbUrl.replace(/-\d+x\d+(\.\w+)$/, '$1');
}

function extractSiteSku(href: string): string | null {
    const m = href.match(/-(\w+)\/?$/);
    return m ? m[1] : null;
}

// ── Site tarama ───────────────────────────────────────────────────────────────
interface SiteItem {
    siteSku:     string;
    originalUrl: string;
    thumbUrl:    string;
    name:        string;
}

async function collectAllSiteItems(): Promise<SiteItem[]> {
    const items = new Map<string, SiteItem>();
    let page = 1;

    while (true) {
        const url = page === 1
            ? `${CIFTEL_BASE}/shop/`
            : `${CIFTEL_BASE}/shop/page/${page}/`;

        process.stdout.write(`\r  [Shop] Sayfa ${page} taranıyor... (${items.size} ürün)`);

        try {
            await withRetry(() => http.get(url, { validateStatus: () => true }).then(({ data }) => {
                const $ = cheerio.load(data);
                const productEls = $('li.product');
                if (productEls.length === 0) { page = -1; return; }

                productEls.each((_, el) => {
                    const $el    = $(el);
                    const href   = $el.find('a').first().attr('href') ?? '';
                    const thumb  = $el.find('img').first().attr('src') ?? '';
                    const name   = $el.find('.woocommerce-loop-product__title, h3').first().text().trim();
                    const siteSku = extractSiteSku(href);
                    if (!siteSku || !thumb) return;
                    if (!items.has(siteSku)) {
                        items.set(siteSku, { siteSku, originalUrl: toOriginalUrl(thumb), thumbUrl: thumb, name });
                    }
                });

                const hasNext = $('a.next.page-numbers').length > 0;
                if (!hasNext) page = -1;
            }), { label: `shop sayfa ${page}` });
        } catch (err) {
            console.error(`\n  [Shop] Sayfa ${page} başarısız: ${err instanceof Error ? err.message : err}`);
            break;
        }

        if (page === -1) break;
        page++;
        await sleep(BOT_CONFIG.ciftel.pageDelayMs);
    }

    console.log(`\n  [Shop] Tamamlandı: ${items.size} unique ürün`);
    return [...items.values()];
}

// ── Görsel işleme ─────────────────────────────────────────────────────────────
async function downloadAndProcess(imageUrl: string, sku: string): Promise<string | null> {
    const safeSku    = sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outputPath = path.join(IMAGES_DIR, `${safeSku}.webp`);

    try {
        const { data } = await withRetry(
            () => http.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 }),
            { label: `görsel ${sku}` }
        );
        const buf = Buffer.from(data as ArrayBuffer);

        let pipeline = sharp(buf).resize(BOT_CONFIG.image.maxWidthPx, null, { withoutEnlargement: true });

        try {
            const wmBuf     = await fs.readFile(WATERMARK);
            const wmMeta    = await sharp(wmBuf).metadata();
            const wmWidth   = Math.min(wmMeta.width ?? 200, BOT_CONFIG.image.wmMaxWidthPx);
            const wmResized = await sharp(wmBuf).resize(wmWidth).toBuffer();
            pipeline = pipeline.composite([{ input: wmResized, gravity: 'southeast', blend: 'over' }]) as typeof pipeline;
        } catch {
            // Watermark yoksa suskunca devam — ama logla
            console.warn(`\n  [Watermark] ${WATERMARK} bulunamadı — watermarksız devam ediliyor`);
        }

        await pipeline.webp({ quality: BOT_CONFIG.image.quality }).toFile(outputPath);
        return outputPath;
    } catch (err) {
        console.error(`\n  [İndirme Hata] ${sku}: ${err instanceof Error ? err.message : err}`);
        return null;
    }
}

async function uploadToStorage(localPath: string, sku: string): Promise<string | null> {
    const safeSku     = sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const storagePath = `products/${safeSku}.webp`;

    try {
        const buf = await fs.readFile(localPath);
        const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
            upsert: true, contentType: 'image/webp',
        });
        if (error) { console.error(`\n  [Storage] ${sku}: ${error.message}`); return null; }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        return data.publicUrl;
    } catch (err) {
        console.error(`\n  [Storage Hata] ${sku}: ${err instanceof Error ? err.message : err}`);
        return null;
    }
}

// ── Ana akış ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ ÇİFTEL GÖRSEL SCRAPER v3 ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN — Storage/DB\'ye yazılmıyor\n');
    if (RESUME)  console.log('  ↺  RESUME modu aktif\n');

    await fs.mkdir(IMAGES_DIR, { recursive: true });

    // Checkpoint yükle
    const cp = await loadCheckpoint();
    const doneSet = new Set<string>(cp?.doneSku ?? []);

    // 1. Shop'tan tüm ürünleri topla
    console.log('[Adım 1] ciftel.com.tr/shop/ taranıyor...');
    const siteItems = await collectAllSiteItems();

    const toProcess = (LIMIT ? siteItems.slice(0, LIMIT) : siteItems)
        .filter(item => !doneSet.has(item.siteSku));

    console.log(`\n[Adım 2] ${toProcess.length} ürün işlenecek (${doneSet.size} zaten tamamlandı)\n`);

    // 2. DB'den ÇİFTEL ürünlerini çek
    const { data: dbProducts } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .eq('meta->>source', 'ciftel_2026')
        .is('deleted_at', null)
        .is('image_url', null);

    const dbMap = new Map<string, { id: string; name: string }>();
    for (const p of dbProducts ?? []) {
        dbMap.set(p.sku, { id: p.id, name: p.name });
    }
    console.log(`[DB] ${dbMap.size} ÇİFTEL ürünü görsel bekliyor\n`);

    // 3. Her site ürünü için işle
    const log: { sku: string; status: string; url?: string }[] = [];
    let matched = 0, skipped = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const item   = toProcess[i];
        const dbProd = dbMap.get(item.siteSku);

        if (!dbProd) { skipped++; continue; }

        process.stdout.write(`\r  [${i + 1}/${toProcess.length}] SKU: ${item.siteSku} — ${item.name.substring(0, 40)}`);

        if (DRY_RUN) {
            console.log(`\n  ✓ [DRY] ${item.siteSku} → ${item.originalUrl}`);
            log.push({ sku: item.siteSku, status: 'dry-run', url: item.originalUrl });
            doneSet.add(item.siteSku);
            matched++;
            continue;
        }

        const localPath = await downloadAndProcess(item.originalUrl, item.siteSku);
        if (!localPath) {
            log.push({ sku: item.siteSku, status: 'download_error' });
            errors++;
            await sleep(BOT_CONFIG.ciftel.errorDelayMs);
            continue;
        }

        const publicUrl = await uploadToStorage(localPath, item.siteSku);
        if (!publicUrl) {
            log.push({ sku: item.siteSku, status: 'upload_error' });
            errors++;
            await sleep(BOT_CONFIG.ciftel.errorDelayMs);
            continue;
        }

        const { error } = await supabase
            .from('products')
            .update({ image_url: publicUrl })
            .eq('id', dbProd.id);

        if (error) {
            console.error(`\n  ✗ DB hatası: ${item.siteSku}: ${error.message}`);
            log.push({ sku: item.siteSku, status: 'db_error' });
            errors++;
        } else {
            log.push({ sku: item.siteSku, status: 'ok', url: publicUrl });
            doneSet.add(item.siteSku);
            matched++;
        }

        // Her 10 üründe bir checkpoint kaydet
        if ((i + 1) % 10 === 0) {
            await saveCheckpoint([...doneSet]);
        }

        await sleep(BOT_CONFIG.ciftel.itemDelayMs);
    }

    // Final checkpoint + log kaydet
    await saveCheckpoint([...doneSet]);
    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklendi':       { Adet: matched },
        'DB\'de Yok / Atlanan': { Adet: skipped },
        'Hata':                 { Adet: errors },
        'Site Ürün Sayısı':     { Adet: siteItems.length },
        'DB Bekleyen':          { Adet: dbMap.size },
    });
    console.log(`[Log] ${LOG_FILE}`);
    console.log(`[Checkpoint] ${CHECKPOINT_FILE}`);
}

main().catch((err: unknown) => {
    if (err instanceof Error) console.error('[FATAL]', err.message);
    process.exit(1);
});

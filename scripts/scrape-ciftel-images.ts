/**
 * ÇİFTEL GÖRSEL SCRAPER v2
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
 * Flags:
 *   --dry-run    Storage/DB'ye yazmadan log
 *   --limit=N    İlk N site ürününü işle (test için)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Supabase credentials eksik (.env.local)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DRY_RUN  = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const CIFTEL_BASE  = 'https://ciftel.com.tr';
const BUCKET       = 'product-media';
const WATERMARK    = path.resolve(__dirname, 'watermark-logo.png');
const OUTPUT_DIR   = path.resolve(__dirname, 'output');
const IMAGES_DIR   = path.join(OUTPUT_DIR, 'ciftel-images');
const LOG_FILE     = path.join(OUTPUT_DIR, 'ciftel-images-log.json');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

// ── Thumbnail URL'den orijinal büyük URL üret ─────────────────────────────────
// "https://ciftel.com.tr/wp-content/uploads/2024/07/1336-420x503.png"
// → "https://ciftel.com.tr/wp-content/uploads/2024/07/1336.png"
function toOriginalUrl(thumbUrl: string): string {
    return thumbUrl.replace(/-\d+x\d+(\.\w+)$/, '$1');
}

// ── URL slug'dan site SKU çıkart ──────────────────────────────────────────────
// "/urun/100x20x12-celik-jantli-beyaz-lastik-1336/" → "1336"
function extractSiteSku(href: string): string | null {
    const m = href.match(/-(\w+)\/?$/);
    return m ? m[1] : null;
}

// ── Tüm shop sayfalarından {siteSku, originalImgUrl} topla ───────────────────
interface SiteItem {
    siteSku:      string;
    originalUrl:  string;
    thumbUrl:     string;
    name:         string;
}

async function collectAllSiteItems(): Promise<SiteItem[]> {
    const items = new Map<string, SiteItem>(); // siteSku → item (deduplicate)
    let page = 1;

    while (true) {
        const url = page === 1
            ? `${CIFTEL_BASE}/shop/`
            : `${CIFTEL_BASE}/shop/page/${page}/`;

        process.stdout.write(`\r  [Shop] Sayfa ${page} taranıyor... (${items.size} ürün)`);

        try {
            const { data } = await http.get(url, { validateStatus: () => true });
            const $ = cheerio.load(data);

            const productEls = $('li.product');
            if (productEls.length === 0) break;

            productEls.each((_, el) => {
                const $el    = $(el);
                const href   = $el.find('a').first().attr('href') ?? '';
                const thumb  = $el.find('img').first().attr('src') ?? '';
                const name   = $el.find('.woocommerce-loop-product__title, h3').first().text().trim();

                const siteSku = extractSiteSku(href);
                if (!siteSku || !thumb) return;

                const originalUrl = toOriginalUrl(thumb);
                if (!items.has(siteSku)) {
                    items.set(siteSku, { siteSku, originalUrl, thumbUrl: thumb, name });
                }
            });

            // Sonraki sayfa var mı?
            const hasNext = $('a.next.page-numbers').length > 0;
            if (!hasNext) break;

            page++;
            await sleep(400);
        } catch {
            console.error(`\n  [Shop] Sayfa ${page} hatası, durduruluyor.`);
            break;
        }
    }

    console.log(`\n  [Shop] Tamamlandı: ${items.size} unique ürün, ${page} sayfa`);
    return [...items.values()];
}

// ── Görsel indir, WebP dönüştür, watermark ekle ───────────────────────────────
async function downloadAndProcess(imageUrl: string, sku: string): Promise<string | null> {
    const safeSku    = sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outputPath = path.join(IMAGES_DIR, `${safeSku}.webp`);

    try {
        const { data } = await http.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const buf = Buffer.from(data as ArrayBuffer);

        let pipeline = sharp(buf).resize(800, null, { withoutEnlargement: true });

        try {
            const wmBuf     = await fs.readFile(WATERMARK);
            const wmMeta    = await sharp(wmBuf).metadata();
            const wmWidth   = Math.min(wmMeta.width ?? 200, 180);
            const wmResized = await sharp(wmBuf).resize(wmWidth).toBuffer();
            pipeline = pipeline.composite([{
                input:   wmResized,
                gravity: 'southeast',
                blend:   'over',
            }]) as typeof pipeline;
        } catch {
            // Watermark dosyası yoksa suskunca devam
        }

        await pipeline.webp({ quality: 85 }).toFile(outputPath);
        return outputPath;
    } catch {
        return null;
    }
}

// ── Supabase Storage'a yükle, public URL döndür ───────────────────────────────
async function uploadToStorage(localPath: string, sku: string): Promise<string | null> {
    const safeSku     = sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const storagePath = `products/${safeSku}.webp`;

    try {
        const buf = await fs.readFile(localPath);
        const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
            upsert:      true,
            contentType: 'image/webp',
        });
        if (error) { console.error(`\n  [Storage] ${sku}: ${error.message}`); return null; }

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        return data.publicUrl;
    } catch {
        return null;
    }
}

// ── Ana akış ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ ÇİFTEL GÖRSEL SCRAPER v2 ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN — Storage/DB\'ye yazılmıyor\n');

    await fs.mkdir(IMAGES_DIR, { recursive: true });

    // 1. Shop'tan tüm ürünleri topla
    console.log('[Adım 1] ciftel.com.tr/shop/ taranıyor...');
    const siteItems = await collectAllSiteItems();

    if (LIMIT) {
        console.log(`[Limit] İlk ${LIMIT} ürün işlenecek`);
    }

    const toProcess = LIMIT ? siteItems.slice(0, LIMIT) : siteItems;
    console.log(`\n[Adım 2] ${toProcess.length} ürün işlenecek\n`);

    // 2. DB'den ÇİFTEL ürünlerini çek (image_url boş olanlar)
    const { data: dbProducts } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .eq('meta->>source', 'ciftel_2026')
        .is('deleted_at', null)
        .is('image_url', null); // sadece görseli olmayanlar

    const dbMap = new Map<string, { id: string; name: string }>();
    for (const p of dbProducts ?? []) {
        dbMap.set(p.sku, { id: p.id, name: p.name });
    }
    console.log(`[DB] ${dbMap.size} ÇİFTEL ürünü görsel bekliyor\n`);

    // 3. Her site ürünü için işle
    const log: { sku: string; status: string; url?: string }[] = [];
    let matched = 0, skipped = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const item = toProcess[i];
        const dbProd = dbMap.get(item.siteSku);

        if (!dbProd) {
            // DB'de bu SKU yok veya zaten görseli var
            skipped++;
            continue;
        }

        process.stdout.write(`\r  [${i + 1}/${toProcess.length}] SKU: ${item.siteSku} — ${item.name.substring(0, 40)}`);

        if (DRY_RUN) {
            console.log(`\n  ✓ [DRY] ${item.siteSku} → ${item.originalUrl}`);
            log.push({ sku: item.siteSku, status: 'dry-run', url: item.originalUrl });
            matched++;
            continue;
        }

        // Görseli indir + işle
        const localPath = await downloadAndProcess(item.originalUrl, item.siteSku);
        if (!localPath) {
            console.error(`\n  ✗ İndirme hatası: ${item.siteSku} (${item.originalUrl})`);
            log.push({ sku: item.siteSku, status: 'download_error' });
            errors++;
            await sleep(300);
            continue;
        }

        // Storage'a yükle
        const publicUrl = await uploadToStorage(localPath, item.siteSku);
        if (!publicUrl) {
            log.push({ sku: item.siteSku, status: 'upload_error' });
            errors++;
            await sleep(300);
            continue;
        }

        // DB güncelle
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
            matched++;
        }

        await sleep(150);
    }

    // Log kaydet
    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklendi':   { Adet: matched },
        'DB\'de Yok / Atlanan': { Adet: skipped },
        'Hata':             { Adet: errors },
        'Site Ürün Sayısı': { Adet: siteItems.length },
        'DB Bekleyen':      { Adet: dbMap.size },
    });
    console.log(`[Log] ${LOG_FILE} yazıldı`);
}

main().catch((err: unknown) => {
    if (err instanceof Error) console.error('[FATAL]', err.message);
    process.exit(1);
});

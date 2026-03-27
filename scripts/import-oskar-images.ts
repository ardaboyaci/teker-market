/**
 * OSKAR GÖRSEL SCRAPER
 *
 * DB'deki oskar_2026 kaynaklı ürünler için oskar.com.tr sitesini tarayıp görsel bulur.
 * SKU ile site araması yapar, görsel indirir, watermark ekler, Storage'a yükler.
 *
 * Flags:
 *   --dry-run    Storage/DB'ye yazmadan loglar
 *   --limit=N    İlk N ürünü işle
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { downloadAndProcess, uploadToStorage, linkToProduct, sleep } from './lib/image-pipeline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output/oskar-images');
const LOG_FILE = path.resolve(process.cwd(), 'scripts/output/oskar-images-log.json');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

// oskar.com.tr'de SKU ile arama yap, ilk ürünün görsel URL'sini döndür
async function findOskarImage(sku: string, name: string): Promise<string | null> {
    const OSKAR_SEARCH_URLS = [
        `https://www.oskar.com.tr/arama?q=${encodeURIComponent(sku)}`,
        `https://www.oskar.com.tr/search?q=${encodeURIComponent(sku)}`,
        `https://oskar.com.tr/arama/${encodeURIComponent(sku)}`,
    ];

    for (const url of OSKAR_SEARCH_URLS) {
        try {
            const { data, status } = await http.get(url, { validateStatus: () => true });
            if (status !== 200) continue;

            const $ = cheerio.load(data);

            // Çeşitli görsel seçicilerini dene
            const imgSelectors = [
                '.product-image img',
                '.product-item img',
                '.product-card img',
                '[class*="product"] img',
                '.col-sm-6 img',
                'img[src*="product"]',
                'img[src*="urun"]',
            ];

            for (const sel of imgSelectors) {
                const img = $(sel).first();
                const src = img.attr('data-src') || img.attr('src') || '';
                if (src && !src.includes('placeholder') && !src.includes('no-image')) {
                    return src.startsWith('http') ? src : `https://www.oskar.com.tr${src}`;
                }
            }
        } catch {
            continue;
        }
    }
    return null;
}

async function main() {
    console.log('━━━ OSKAR GÖRSEL SCRAPER ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN — Storage/DB\'ye yazılmıyor\n');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // DB'den oskar ürünlerini çek (image_url boş olanlar)
    const { data: dbProducts } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .eq('meta->>source', 'oskar_2026')
        .is('deleted_at', null)
        .is('image_url', null);

    console.log(`[DB] ${dbProducts?.length ?? 0} OSKAR ürünü görsel bekliyor\n`);
    const toProcess = LIMIT ? (dbProducts ?? []).slice(0, LIMIT) : (dbProducts ?? []);

    const log: { sku: string; status: string; url?: string }[] = [];
    let matched = 0, notFound = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const product = toProcess[i];
        process.stdout.write(`\r[${i + 1}/${toProcess.length}] ${product.sku.slice(0, 40)}...`);

        const imageUrl = await findOskarImage(product.sku, product.name);

        if (!imageUrl) {
            log.push({ sku: product.sku, status: 'not_found' });
            notFound++;
            await sleep(200);
            continue;
        }

        if (DRY_RUN) {
            console.log(`\n  ✓ [DRY] ${product.sku} → ${imageUrl}`);
            log.push({ sku: product.sku, status: 'dry-run', url: imageUrl });
            matched++;
            continue;
        }

        const localPath = path.join(OUTPUT_DIR, `${product.sku.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.webp`);
        const processed = await downloadAndProcess(imageUrl, localPath);
        if (!processed) {
            log.push({ sku: product.sku, status: 'download_error' });
            errors++;
            await sleep(300);
            continue;
        }

        const publicUrl = await uploadToStorage(supabase, localPath, product.sku);
        if (!publicUrl) {
            log.push({ sku: product.sku, status: 'upload_error' });
            errors++;
            continue;
        }

        const linked = await linkToProduct(supabase, product.id, publicUrl);
        if (linked) {
            log.push({ sku: product.sku, status: 'ok', url: publicUrl });
            matched++;
        } else {
            log.push({ sku: product.sku, status: 'link_error' });
            errors++;
        }

        await sleep(300);
    }

    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklendi': { Adet: matched },
        'Sitede Bulunamadı': { Adet: notFound },
        'Hata': { Adet: errors },
        'Toplam': { Adet: toProcess.length },
    });
    console.log(`[Log] ${LOG_FILE}`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

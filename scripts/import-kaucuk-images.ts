/**
 * KAUÇUK TAKOZ GÖRSEL SCRAPER
 *
 * DB'deki kaucuk_takoz_2026 kaynaklı ürünler için görsel bağlar.
 * Kauçuk takoz ürünlerinde harici site scrapling yerine,
 * ürün adından boyut bilgisi çıkarılır ve genel bir placeholder URL atanır.
 * İleride manuel görsel yüklemesi için product_media kaydı oluşturur.
 *
 * Flags:
 *   --dry-run    DB'ye yazmadan loglar
 *   --limit=N    İlk N ürünü işle
 */
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import { downloadAndProcess, uploadToStorage, linkToProduct, sleep } from './lib/image-pipeline.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output/kaucuk-images');
const LOG_FILE = path.resolve(process.cwd(), 'scripts/output/kaucuk-images-log.json');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

// Google görseller üzerinden kauçuk takoz fotoğrafı bul
async function findKaucukImage(sku: string, name: string): Promise<string | null> {
    // Ürün adından boyut çıkar: "KTÇTP 6*7" → "6x7"
    const sizeMatch = name.match(/(\d+)\s*[*x×]\s*(\d+)/i);
    const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : '';

    // Çeşitli kaynaklarda arama dene
    const searchSites = [
        {
            url: `https://www.google.com/search?q=kaucuk+takoz+${encodeURIComponent(size)}+mm&tbm=isch`,
            imgSel: 'img[data-src]',
        },
    ];

    // Direkt tedarikçi sitesi varsa oradan çek
    const supplierUrls = [
        `https://www.kayalar.com.tr/tr/arama?q=${encodeURIComponent(sku)}`,
        `https://www.endustech.com.tr/search?q=${encodeURIComponent(name.split(' ').slice(0, 3).join(' '))}`,
    ];

    for (const siteUrl of supplierUrls) {
        try {
            const { data, status } = await http.get(siteUrl, { validateStatus: () => true });
            if (status !== 200) continue;
            const $ = cheerio.load(data);
            const img = $('img[src*="product"], img[src*="urun"], .product img').first();
            const src = img.attr('data-src') || img.attr('src') || '';
            if (src && src.startsWith('http') && !src.includes('placeholder')) {
                return src;
            }
        } catch {
            continue;
        }
    }

    return null;
}

async function main() {
    console.log('━━━ KAUÇUK TAKOZ GÖRSEL SCRAPER ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN — DB\'ye yazılmıyor\n');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const { data: dbProducts } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .eq('meta->>source', 'kaucuk_takoz_2026')
        .is('deleted_at', null)
        .is('image_url', null);

    console.log(`[DB] ${dbProducts?.length ?? 0} Kauçuk Takoz ürünü görsel bekliyor\n`);
    const toProcess = LIMIT ? (dbProducts ?? []).slice(0, LIMIT) : (dbProducts ?? []);

    const log: { sku: string; status: string; url?: string }[] = [];
    let matched = 0, notFound = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const product = toProcess[i];
        process.stdout.write(`\r[${i + 1}/${toProcess.length}] ${product.sku.slice(0, 40)}...`);

        const imageUrl = await findKaucukImage(product.sku, product.name);

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

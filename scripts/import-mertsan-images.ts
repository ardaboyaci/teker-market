/**
 * MERTSAN GÖRSEL SCRAPER
 *
 * mertsanteker.com sitesinden 8 rulmanlı sanayi tekeri için görsel çeker.
 * Tüm ürünler "rulmanlı" kategorisinde, site görseli images/urunler/ klasöründe.
 * Boyut eşleştirme: DB SKU'sundan boyut çıkar → site görselini ata.
 * Bulunamazsa 1.jpg (genel rulmanlı görsel) kullan.
 *
 * Flags: --dry-run
 */
import path from 'path';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { downloadAndProcess, uploadToStorage, linkToProduct } from './lib/image-pipeline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes('--dry-run');
const BASE = 'https://www.mertsanteker.com';
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output/mertsan-images');
const LOG_FILE   = path.resolve(process.cwd(), 'scripts/output/mertsan-images-log.json');

// Boyut → görsel eşleştirme (site incelemesinden)
// Sitede büyük (>250mm) rulmanlı tekerlekler için 1.jpg/2.jpg kullanılıyor
const SIZE_TO_IMG: Record<string, string> = {
    '200x50':  'images/urunler/3.jpg',
    '200x80':  'images/urunler/2.jpg',
    '250x50':  'images/urunler/3.jpg',
    '250x80':  'images/urunler/2.jpg',
    '300x50':  'images/urunler/1.jpg',
    '300x60':  'images/urunler/1.jpg',
    '350x60':  'images/urunler/1.jpg',
};
const FALLBACK_IMG = 'images/urunler/1.jpg';

function extractSize(sku: string): string {
    // "MERTSAN-200-x-50-rulmanli" → "200x50"
    // "MERTSAN-200x80-rulmanli"   → "200x80"
    // "MERTSAN-350-x-60-25-rulmanli" → "350x60"
    const m = sku.match(/(\d{2,3})-?[xX]-?(\d{2,3})/i);
    if (!m) return '';
    return `${m[1]}x${m[2]}`;
}

async function main() {
    console.log('━━━ MERTSAN GÖRSEL SCRAPER ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN\n');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name')
        .contains('meta', { source: 'mertsan_2026' })
        .is('image_url', null)
        .is('deleted_at', null);

    if (error) { console.error('[DB]', error.message); process.exit(1); }
    console.log(`[DB] ${products?.length ?? 0} MERTSAN ürünü görsel bekliyor\n`);

    const log: { sku: string; status: string; url?: string }[] = [];
    let matched = 0, errors = 0;

    for (const p of (products ?? [])) {
        const size   = extractSize(p.sku);
        const imgPath = SIZE_TO_IMG[size] ?? FALLBACK_IMG;
        const imgUrl  = `${BASE}/${imgPath}`;

        console.log(`  ${p.sku} (${size || '?'}) → ${imgPath}`);

        if (DRY_RUN) {
            log.push({ sku: p.sku, status: 'dry-run', url: imgUrl });
            matched++;
            continue;
        }

        const localPath = path.join(OUTPUT_DIR, `${p.sku.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.webp`);
        const processed = await downloadAndProcess(imgUrl, localPath);
        if (!processed) {
            console.error(`  ✗ İndirme hatası: ${imgUrl}`);
            log.push({ sku: p.sku, status: 'download_error' });
            errors++;
            continue;
        }

        const publicUrl = await uploadToStorage(supabase, localPath, p.sku);
        if (!publicUrl) {
            log.push({ sku: p.sku, status: 'upload_error' });
            errors++;
            continue;
        }

        const linked = await linkToProduct(supabase, p.id, publicUrl);
        if (linked) {
            console.log(`  ✅ ${p.name}`);
            log.push({ sku: p.sku, status: 'ok', url: publicUrl });
            matched++;
        } else {
            log.push({ sku: p.sku, status: 'link_error' });
            errors++;
        }
    }

    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');

    console.log('\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklendi': { Adet: matched },
        'Hata':           { Adet: errors },
        'Toplam':         { Adet: (products ?? []).length },
    });
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

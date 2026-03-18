/**
 * ÇİFTEL GÖRSEL SCRAPER
 *
 * ciftel.com.tr'den ürün görselleri çeker, watermark ekler,
 * Supabase Storage'a yükler ve DB'deki ÇİFTEL ürünlerinin
 * image_url alanını günceller.
 *
 * Strateji:
 * 1. Shop listesinden tüm ürün detay URL'lerini çek
 * 2. Her detay sayfasından SKU + name + yüksek çözünürlüklü görsel al
 * 3. DB'deki meta.source='ciftel_2026' ürünleriyle isim fuzzy eşleştir
 * 4. Görsel indir → WebP + watermark → Storage'a yükle → image_url güncelle
 *
 * Flags:
 *   --dry-run   Storage/DB'ye yazmadan log
 *   --limit=N   İlk N ürünü işle
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

const CIFTEL_BASE   = 'https://ciftel.com.tr';
const BUCKET        = 'product-media';
const WATERMARK     = path.resolve(__dirname, 'watermark-logo.png');
const OUTPUT_DIR    = path.resolve(__dirname, 'output');
const IMAGES_DIR    = path.join(OUTPUT_DIR, 'ciftel-images');
const UNMATCHED_OUT = path.join(OUTPUT_DIR, 'unmatched-ciftel-images.json');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

// ── Token tabanlı eşleşme skoru ──────────────────────────────────────────────
function tokenMatchScore(a: string, b: string): number {
    const tokens = a.toUpperCase().match(/[A-ZÇĞİÖŞÜ]+|\d+/g) ?? [];
    const nameUp = b.toUpperCase();
    if (!tokens.length) return 0;
    let hits = 0;
    for (const t of tokens) {
        if (t.length >= 2 && nameUp.includes(t)) hits++;
    }
    return hits / tokens.length;
}

// ── Boyut token'larını çıkar: "100x25x12" → ["100", "25", "12"] ─────────────
function extractDimensions(name: string): string[] {
    return name.match(/\d+/g) ?? [];
}

// ── Boyut örtüşme skoru (sayısal token kesişimi) ──────────────────────────────
function dimensionScore(dbName: string, siteName: string): number {
    const dbDims   = extractDimensions(dbName);
    const siteDims = extractDimensions(siteName);
    if (!dbDims.length || !siteDims.length) return 0;
    const intersection = dbDims.filter(d => siteDims.includes(d));
    // Her iki tarafın max boyutuna göre normalize et
    return intersection.length / Math.max(dbDims.length, siteDims.length);
}

// ── Tip token'larını eşleştir (Lastik, Poliüretan, PVC, Kauçuk...) ───────────
const TYPE_ALIASES: Record<string, string[]> = {
    'LASTİK':     ['lastik', 'lastig', 'rubber'],
    'POLİÜRETAN': ['poliüretan', 'pu', 'pol.', 'polj'],
    'PVC':        ['pvc'],
    'KAUÇUK':     ['kauçuk', 'kauc'],
    'DEMİR':      ['çelik', 'demir', 'metal', 'celik'],
};

function typeScore(dbName: string, siteName: string): number {
    const dbUpper   = dbName.toUpperCase();
    const siteUpper = siteName.toUpperCase();
    for (const [canonical, aliases] of Object.entries(TYPE_ALIASES)) {
        const dbHas   = dbUpper.includes(canonical) || aliases.some(a => dbUpper.includes(a.toUpperCase()));
        const siteHas = siteUpper.includes(canonical) || aliases.some(a => siteUpper.includes(a.toUpperCase()));
        if (dbHas && siteHas) return 1;
        if (dbHas !== siteHas) return -0.5; // tip çelişkisi — ceza
    }
    return 0;
}

// ── Birleşik eşleşme skoru ───────────────────────────────────────────────────
function combinedScore(dbName: string, siteName: string): number {
    const dimS  = dimensionScore(dbName, siteName); // 0-1, en kritik
    const typeS = typeScore(dbName, siteName);       // -0.5 veya 0 veya 1
    const tokS  = tokenMatchScore(dbName, siteName); // 0-1
    // Ağırlıklar: boyut %60, tip %25, token %15
    return dimS * 0.60 + Math.max(0, typeS) * 0.25 + tokS * 0.15;
}

// ── ÇİFTEL shop'tan tüm ürün URL'lerini çek ──────────────────────────────────
interface CiftelProduct {
    url:      string;
    imageUrl: string;
    name:     string;
    sku:      string;
}

async function scrapeAllProductUrls(): Promise<string[]> {
    const urls = new Set<string>();
    let page = 1;

    while (true) {
        const pageUrl = page === 1
            ? `${CIFTEL_BASE}/shop/`
            : `${CIFTEL_BASE}/shop/page/${page}/`;

        console.log(`  [Shop] Sayfa ${page}: ${pageUrl}`);

        try {
            const { data } = await http.get(pageUrl, { validateStatus: () => true });
            const $ = cheerio.load(data);

            const links = $('li.product a.woocommerce-loop-product__link, li.product a').map((_, el) => $(el).attr('href')).get();
            const productLinks = links.filter(l => l && l.includes('/urun/'));

            if (productLinks.length === 0) break;

            productLinks.forEach(l => urls.add(l));
            console.log(`    → ${productLinks.length} ürün bulundu (toplam: ${urls.size})`);

            // Sonraki sayfa var mı?
            const hasNext = $('a.next.page-numbers').length > 0;
            if (!hasNext) break;

            page++;
            await sleep(600);
        } catch {
            console.error(`  [Shop] Sayfa ${page} hatası, durduruluyor.`);
            break;
        }
    }

    return [...urls];
}

// ── Ürün detay sayfasından veri çek ─────────────────────────────────────────
async function scrapeProductDetail(url: string): Promise<CiftelProduct | null> {
    try {
        const { data } = await http.get(url, { validateStatus: () => true });
        const $ = cheerio.load(data);

        const name = $('h1.product_title').text().trim();
        const sku  = $('.sku').text().trim();

        // Yüksek çözünürlüklü görsel: data-large_image varsa onu al
        const imgEl = $('.woocommerce-product-gallery__image img').first();
        const imageUrl =
            imgEl.attr('data-large_image') ||
            imgEl.attr('src') || '';

        if (!name || !imageUrl) return null;

        return { url, imageUrl, name, sku };
    } catch {
        return null;
    }
}

// ── Görsel indir, WebP dönüştür, watermark ekle ───────────────────────────────
async function downloadAndProcess(imageUrl: string, filename: string): Promise<string | null> {
    const outputPath = path.join(IMAGES_DIR, `${filename}.webp`);

    try {
        const { data } = await http.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const buf = Buffer.from(data as ArrayBuffer);

        let pipeline = sharp(buf).resize(800, null, { withoutEnlargement: true });

        try {
            const wmBuf = await fs.readFile(WATERMARK);
            const wmMeta = await sharp(wmBuf).metadata();
            const wmWidth = Math.min(wmMeta.width ?? 200, 200);
            const wmResized = await sharp(wmBuf).resize(wmWidth).toBuffer();
            pipeline = pipeline.composite([{ input: wmResized, gravity: 'southeast', blend: 'over' }]) as typeof pipeline;
        } catch {
            // Watermark dosyası yoksa suskunca devam et
        }

        await pipeline.webp({ quality: 85 }).toFile(outputPath);
        return outputPath;
    } catch {
        return null;
    }
}

// ── Supabase Storage'a yükle ─────────────────────────────────────────────────
async function uploadToStorage(localPath: string, sku: string): Promise<string | null> {
    const safeSku   = sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const storagePath = `products/${safeSku}.webp`;

    try {
        const buf = await fs.readFile(localPath);
        const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
            upsert: true,
            contentType: 'image/webp',
        });
        if (error) { console.error(`  [Storage] ${sku}: ${error.message}`); return null; }

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        return data.publicUrl;
    } catch {
        return null;
    }
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ ÇİFTEL GÖRSEL SCRAPER ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN — Storage/DB\'ye yazılmıyor\n');

    await fs.mkdir(IMAGES_DIR, { recursive: true });

    // 1. DB'den ÇİFTEL ürünlerini çek
    console.log('[DB] ÇİFTEL ürünleri çekiliyor...');
    const { data: dbProducts } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .eq("meta->>source", 'ciftel_2026')
        .is('deleted_at', null);

    const products = dbProducts ?? [];
    console.log(`[DB] ${products.length} ÇİFTEL ürünü bulundu\n`);

    // 2. ÇİFTEL sitesinden tüm ürün URL'lerini topla
    console.log('[Scrape] ÇİFTEL shop taranıyor...');
    const productUrls = await scrapeAllProductUrls();
    console.log(`[Scrape] ${productUrls.length} ürün URL'si bulundu\n`);

    // 3. Her URL'den detay çek (rate limit: 800ms arası)
    console.log('[Scrape] Detay sayfaları işleniyor...');
    const scraped: CiftelProduct[] = [];
    const urlsToProcess = LIMIT ? productUrls.slice(0, LIMIT) : productUrls;

    for (let i = 0; i < urlsToProcess.length; i++) {
        const detail = await scrapeProductDetail(urlsToProcess[i]);
        if (detail) {
            scraped.push(detail);
            process.stdout.write(`\r  [${i + 1}/${urlsToProcess.length}] ${detail.name.substring(0, 50)}`);
        }
        await sleep(500);
    }
    console.log(`\n[Scrape] ${scraped.length} ürün detayı alındı\n`);

    // 4. DB ürünleriyle fuzzy eşleştir
    let matched = 0, skipped = 0, errors = 0;
    const unmatched: { sku: string; name: string }[] = [];

    for (const dbProd of products) {
        // Daha önce görseli varsa atla
        if (dbProd.image_url) { skipped++; continue; }

        // En iyi eşi bul — boyut + tip + token kombinasyonu
        let bestItem: CiftelProduct | null = null;
        let bestScore = 0;

        for (const item of scraped) {
            const score = combinedScore(dbProd.name, item.name);
            if (score >= 0.55 && score > bestScore) {
                bestScore = score;
                bestItem  = item;
            }
        }

        if (!bestItem) {
            unmatched.push({ sku: dbProd.sku, name: dbProd.name });
            continue;
        }

        console.log(`  ✓ ${dbProd.sku} → "${bestItem.name}" (skor: ${bestScore.toFixed(2)})`);

        if (DRY_RUN) { matched++; continue; }

        // 5. Görsel indir + işle
        const safeName   = dbProd.sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const localPath  = await downloadAndProcess(bestItem.imageUrl, safeName);
        if (!localPath) { errors++; continue; }

        // 6. Storage'a yükle
        const publicUrl = await uploadToStorage(localPath, dbProd.sku);
        if (!publicUrl) { errors++; continue; }

        // 7. DB'yi güncelle
        const { error } = await supabase
            .from('products')
            .update({ image_url: publicUrl })
            .eq('id', dbProd.id);

        if (error) { console.error(`  [DB] ${dbProd.sku}: ${error.message}`); errors++; }
        else matched++;

        await sleep(200);
    }

    // Eşleşemeyenleri yaz
    await fs.writeFile(UNMATCHED_OUT, JSON.stringify(unmatched, null, 2), 'utf-8');

    console.log('\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklenen':  { Adet: matched },
        'Zaten Görselli':  { Adet: skipped },
        'Eşleşmeyen':      { Adet: unmatched.length },
        'Hata':            { Adet: errors },
    });
    console.log(`[Çıktı] ${UNMATCHED_OUT} yazıldı`);
}

main().catch((err: unknown) => {
    if (err instanceof Error) console.error('[FATAL]', err.message);
    process.exit(1);
});

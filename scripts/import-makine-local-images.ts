/**
 * MAKİNE EKİPMANLARI GÖRSEL YÜKLEYICI
 *
 * Makine Ekipmanları.rar'dan çıkartılan TIF/JPG dosyalarını Supabase Storage'a yükler.
 * Eşleştirme: ürün adının ilk kelimesi (tip kodu) → TIF dosya adı
 *
 * Flags: --dry-run, --limit=N, --reset
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import mysql2 from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DRY_RUN  = process.argv.includes('--dry-run');
const RESET    = process.argv.includes('--reset');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const RAW_DIR         = path.resolve(process.cwd(), 'scripts/output/makine-raw');
const OUTPUT_DIR      = path.resolve(process.cwd(), 'scripts/output/makine-local-webp');
const LOG_FILE        = path.resolve(process.cwd(), 'scripts/output/makine-local-log.json');
const CHECKPOINT_FILE = path.resolve(process.cwd(), 'scripts/output/makine-local-checkpoint.json');
const WATERMARK_PATH  = path.resolve(process.cwd(), 'scripts/watermark-logo-transparent.png');
const BUCKET          = 'product-media';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function normTR(s: string): string {
    return s.toLowerCase()
        .replace(/i̇/g, 'i').replace(/İ/g, 'i').replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/Ü/g, 'u').replace(/ş/g, 's').replace(/Ş/g, 's')
        .replace(/ö/g, 'o').replace(/Ö/g, 'o').replace(/ç/g, 'c').replace(/Ç/g, 'c')
        .replace(/ı/g, 'i');
}

// ── Watermark ─────────────────────────────────────────────────────────────────
async function buildWatermark(targetWidth: number): Promise<Buffer | null> {
    try {
        const logoSize = Math.min(Math.round(targetWidth * 0.15), 120);
        const { data, info } = await sharp(WATERMARK_PATH)
            .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const pixels = new Uint8ClampedArray(data);
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i + 3] = Math.round(pixels[i + 3] * 0.40);
        }
        return sharp(Buffer.from(pixels), {
            raw: { width: info.width, height: info.height, channels: 4 },
        })
            .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png().toBuffer();
    } catch { return null; }
}

async function processImage(imgPath: string, outputPath: string): Promise<boolean> {
    try {
        const buf  = await fs.readFile(imgPath);
        const meta = await sharp(buf).metadata();
        const targetW = Math.min(Math.max(meta.width ?? 800, 400), 800);
        const watermark = await buildWatermark(targetW);
        const img = sharp(buf)
            .resize(targetW, null, { withoutEnlargement: false })
            .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.1 });
        const pipeline = watermark
            ? img.composite([{ input: watermark, gravity: 'southeast', blend: 'over' }])
            : img;
        await pipeline.webp({ quality: 85 }).toFile(outputPath);
        return true;
    } catch (err) {
        console.error(`  [Process] ${path.basename(imgPath)}: ${(err as Error).message}`);
        return false;
    }
}

async function uploadWebp(localPath: string, storageKey: string): Promise<string | null> {
    try {
        const buf = await fs.readFile(localPath);
        const { error } = await supabase.storage.from(BUCKET).upload(storageKey, buf, {
            upsert: true, contentType: 'image/webp',
        });
        if (error) { console.error(`  [Storage] ${storageKey}: ${error.message}`); return null; }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(storageKey);
        return data.publicUrl;
    } catch (err) {
        console.error(`  [Storage] ${(err as Error).message}`); return null;
    }
}

// ── TIF kataloğu: normalize(stem) → dosya yolu ───────────────────────────────
async function buildCatalog(): Promise<Map<string, string>> {
    const catalog = new Map<string, string>();
    const files = await fs.readdir(RAW_DIR);
    for (const f of files) {
        if (!/\.(tif|tiff|jpg|jpeg|png)$/i.test(f)) continue;
        const stem = f.replace(/\.[^.]+$/, '');
        // Ana normalize anahtar
        const key = normTR(stem).replace(/[^a-z0-9]/g, '');
        if (!catalog.has(key)) catalog.set(key, path.join(RAW_DIR, f));
        // Tire/alt çizgi varyantları da ekle
        const key2 = normTR(stem).replace(/[-_\s]+/g, '').replace(/[^a-z0-9]/g, '');
        if (!catalog.has(key2)) catalog.set(key2, path.join(RAW_DIR, f));
    }
    return catalog;
}

// ── Ürün adından anahtar çıkar ────────────────────────────────────────────────
function extractKey(name: string, sku: string): string[] {
    const src = name || sku;
    // İlk kelime tip kodudur: "PKB 7812 ..." → "PKB", "MAİM 602020 ..." → "MAIM"
    const firstWord = src.trim().split(/\s+/)[0];
    const norm = normTR(firstWord).replace(/[^a-z0-9]/g, '');

    // SKU da dene
    const skuNorm = normTR(sku).replace(/[^a-z0-9]/g, '');

    const keys = [norm];
    if (skuNorm && skuNorm !== norm) keys.push(skuNorm);

    // İlk 2-3 karakter prefix fallback (çok kısa kodlar için)
    if (norm.length > 3) keys.push(norm.slice(0, 3));

    return [...new Set(keys)];
}

interface Checkpoint {
    uploadedKeys: string[];
    stats: { matched: number; notFound: number; errors: number };
}

async function loadCheckpoint(): Promise<Checkpoint> {
    if (RESET) { try { await fs.unlink(CHECKPOINT_FILE); } catch { /* */ } }
    try {
        const cp = JSON.parse(await fs.readFile(CHECKPOINT_FILE, 'utf-8')) as Checkpoint;
        console.log(`[Checkpoint] Devam — ${cp.uploadedKeys.length} anahtar işlendi`);
        return cp;
    } catch {
        return { uploadedKeys: [], stats: { matched: 0, notFound: 0, errors: 0 } };
    }
}

async function main() {
    console.log('━━━ MAKİNE EKİPMANLARI GÖRSEL YÜKLEYICI ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    console.log('\n[1] Görsel kataloğu oluşturuluyor...');
    const catalog = await buildCatalog();
    console.log(`    ${catalog.size} anahtar`);

    console.log('[2] MySQL bağlantısı...');
    const db = await mysql2.createConnection({
        host:     process.env.MYSQL_HOST     || '127.0.0.1',
        port:     parseInt(process.env.MYSQL_PORT || '3306'),
        user:     process.env.MYSQL_USER     || 'teker',
        password: process.env.MYSQL_PASSWORD || 'teker123',
        database: process.env.MYSQL_DATABASE || 'teker_market',
        charset:  'utf8mb4',
    });
    console.log('    Bağlandı');

    console.log('[3] Eksik görsel ürünler çekiliyor...');
    const [rows] = await db.execute<mysql2.RowDataPacket[]>(`
        SELECT id, sku, name
        FROM products
        WHERE deleted_at IS NULL
          AND (image_url IS NULL OR image_url = '' OR image_url LIKE '%placeholder%')
          AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.source')) IN
              ('emes_kulp_2026','emes_2026','yedek_emes_2026','kaucuk_takoz_2026','ciftel_2026','oskar_2026','zet_2026')
        ORDER BY JSON_UNQUOTE(JSON_EXTRACT(meta, '$.source')), name
    `);
    let products = rows as Array<{ id: string; sku: string; name: string }>;
    if (LIMIT) products = products.slice(0, LIMIT);
    console.log(`    ${products.length} ürün`);

    // Katalog → ürün eşleştirmesi
    const catalogToProducts = new Map<string, Array<{ id: string; sku: string; name: string }>>();
    const notFoundList: Array<{ sku: string; name: string }> = [];

    for (const p of products) {
        const keys = extractKey(p.name, p.sku);
        let matched = false;
        for (const key of keys) {
            if (catalog.has(key)) {
                if (!catalogToProducts.has(key)) catalogToProducts.set(key, []);
                catalogToProducts.get(key)!.push(p);
                matched = true;
                break;
            }
        }
        if (!matched) notFoundList.push({ sku: p.sku, name: p.name });
    }

    const matchedCount = products.length - notFoundList.length;
    console.log(`\n[Eşleştirme] ${matchedCount} eşleşti  |  ${notFoundList.length} eşleşme yok`);
    console.log(`[Upload] ${catalogToProducts.size} benzersiz görsel\n`);

    if (DRY_RUN) {
        console.log('── DRY-RUN EŞLEŞMELERİ (ilk 40) ──');
        let i = 0;
        for (const [key, prods] of catalogToProducts) {
            const f = path.basename(catalog.get(key)!);
            console.log(`  ${key.padEnd(18)} ← ${f.padEnd(30)} → ${prods.length} ürün`);
            if (++i >= 40) { console.log(`  ... ve ${catalogToProducts.size - 40} tane daha`); break; }
        }
        if (notFoundList.length > 0) {
            console.log(`\n── EŞLEŞMEYEN (ilk 20) ──`);
            notFoundList.slice(0, 20).forEach(p => console.log(`  [${p.sku}] ${p.name}`));
        }
        await db.end();
        return;
    }

    const cp = await loadCheckpoint();
    const processedKeys = new Set(cp.uploadedKeys);
    let { matched, notFound, errors } = cp.stats;
    notFound += notFoundList.length;

    const log: object[] = [];
    const total = catalogToProducts.size;
    let idx = 0;

    for (const [key, prods] of catalogToProducts) {
        idx++;
        if (processedKeys.has(key)) continue;

        const imgPath = catalog.get(key)!;
        const fname   = path.basename(imgPath);
        process.stdout.write(`\r[${idx}/${total}] ↻ ${key.padEnd(18)} (${fname.slice(0,28)}) ...`);

        const webpPath   = path.join(OUTPUT_DIR, `${key}.webp`);
        const storageKey = `makine/${key}.webp`;

        const ok = await processImage(imgPath, webpPath);
        if (!ok) {
            console.log(`\n  ✗ [${key}] işlenemedi`);
            errors++;
            cp.uploadedKeys.push(key);
            cp.stats = { matched, notFound, errors };
            continue;
        }

        const publicUrl = await uploadWebp(webpPath, storageKey);
        if (!publicUrl) {
            errors++;
            cp.uploadedKeys.push(key);
            cp.stats = { matched, notFound, errors };
            continue;
        }

        const ids = prods.map(p => p.id);
        const placeholders = ids.map(() => '?').join(',');
        await db.execute(`UPDATE products SET image_url = ? WHERE id IN (${placeholders})`, [publicUrl, ...ids]);

        for (const p of prods) {
            const [existing] = await db.execute<mysql2.RowDataPacket[]>(
                'SELECT id FROM product_media WHERE product_id = ? AND url = ? LIMIT 1',
                [p.id, publicUrl]
            );
            if ((existing as mysql2.RowDataPacket[]).length === 0) {
                await db.execute(
                    'INSERT INTO product_media (id, product_id, url, is_primary, sort_order) VALUES (UUID(), ?, ?, 1, 0)',
                    [p.id, publicUrl]
                );
            }
        }

        // Supabase PostgreSQL
        await supabase.from('products').update({ image_url: publicUrl }).in('id', ids);

        matched += prods.length;
        console.log(`\r  ✅ [${key}] ${fname.slice(0,28).padEnd(28)} → ${prods.length} ürün`);
        log.push({ key, file: fname, publicUrl, productCount: prods.length });

        processedKeys.add(key);
        cp.uploadedKeys.push(key);
        cp.stats = { matched, notFound, errors };

        try { await fs.unlink(webpPath); } catch { /* */ }
    }

    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2));
    await db.end();

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklenen Ürün': { Adet: matched },
        'Eşleşme Yok':         { Adet: notFound },
        'Hata':                { Adet: errors },
        'Toplam':              { Adet: products.length },
    });
    if (notFoundList.length > 0) {
        console.log('\n━━━ EŞLEŞMEYEN (ilk 30) ━━━');
        notFoundList.slice(0, 30).forEach(p => console.log(`  [${p.sku}] ${p.name}`));
    }
    console.log('━━━ TAMAMLANDI ━━━');
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });
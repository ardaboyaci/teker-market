/**
 * EMES LOCAL GÖRSEL YÜKLEYICI
 *
 * WeTransfer'dan indirilen TIF dosyalarını Supabase Storage'a yükler.
 * Her benzersiz TIF bir kez işlenir; eşleşen tüm ürünler aynı URL'e güncellenir.
 *
 * Adımlar:
 *   1. emes-raw/ altındaki TIF'leri tara → seri+tip → dosya haritası
 *   2. Her benzersiz TIF: sharp ile WebP+watermark → Supabase Storage
 *   3. MySQL'deki placeholder/null görsel Emes ürünlerini eşleştir
 *   4. Hem MySQL hem Supabase PostgreSQL'i güncelle
 *
 * Flags:
 *   --dry-run   Storage/DB'ye yazmadan eşleşmeleri logla
 *   --limit=N   İlk N ürünü işle
 *   --reset     Checkpoint'i sıfırla
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

const RAW_DIR         = path.resolve(process.cwd(), 'scripts/output/emes-raw');
const OUTPUT_DIR      = path.resolve(process.cwd(), 'scripts/output/emes-local-webp');
const LOG_FILE        = path.resolve(process.cwd(), 'scripts/output/emes-local-log.json');
const CHECKPOINT_FILE = path.resolve(process.cwd(), 'scripts/output/emes-local-checkpoint.json');
const WATERMARK_PATH  = path.resolve(process.cwd(), 'scripts/watermark-logo-transparent.png');
const BUCKET          = 'product-media';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
    } catch {
        return null;
    }
}

// ── TIF → WebP dönüştür ──────────────────────────────────────────────────────
async function processTif(tifPath: string, outputPath: string): Promise<boolean> {
    try {
        const buf  = await fs.readFile(tifPath);
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
        console.error(`  [Process] ${path.basename(tifPath)}: ${(err as Error).message}`);
        return false;
    }
}

// ── Supabase Storage'a yükle ─────────────────────────────────────────────────
async function uploadWebp(localPath: string, storageKey: string): Promise<string | null> {
    try {
        const buf = await fs.readFile(localPath);
        const { error } = await supabase.storage.from(BUCKET).upload(storageKey, buf, {
            upsert: true,
            contentType: 'image/webp',
        });
        if (error) { console.error(`  [Storage] ${storageKey}: ${error.message}`); return null; }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(storageKey);
        return data.publicUrl;
    } catch (err) {
        console.error(`  [Storage catch] ${storageKey}: ${(err as Error).message}`);
        return null;
    }
}

// ── TIF dosya adını normalize et → katalog anahtarı ──────────────────────────
function normTR(s: string): string {
    return s.toUpperCase()
        .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
        .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
}

function parseTifStem(stem: string): { key: string; frenli: boolean } | null {
    const norm = normTR(stem);

    // Yön/görüş varyantlarını atla: " K", " S", " Y" suffix (renkli yay serisi)
    if (/ [KSY]$/.test(norm)) return null;
    if (/[-_ ]YK$/.test(norm)) return null;
    if (/KIRMIZI|YESIL|BEYAZ|MAVI/.test(norm)) return null;
    // "-Y" veya "_Y" suffix (yan görüş)
    if (/[-_]Y$/.test(norm)) return null;

    const tokens = norm.split(/[-_\s]+/).filter(t => t.length > 0);
    if (tokens.length < 2) return null;

    // Seri+No birleştir
    let seri = tokens[0];
    let tipStart = 1;
    if (/^[A-Z]+$/.test(seri) && tokens[1] && /^\d{2}$/.test(tokens[1])) {
        seri = seri + tokens[1];
        tipStart = 2;
    } else if (!/\d/.test(seri)) {
        return null; // seri numarası yok
    }

    if (tipStart >= tokens.length) return null;

    let tip = '';
    let frenli = false;

    for (let i = tipStart; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === 'F') { frenli = true; continue; }
        if (/^\d/.test(t)) continue;      // boyut
        if (['INOX', 'G', 'ED', 'T', 'B'].includes(t)) continue;
        if (!tip) { tip = t; }
        else break;
    }

    if (!tip) return null;
    return { key: seri + tip, frenli };
}

// ── TIF katalog haritası ──────────────────────────────────────────────────────
interface TifEntry {
    path: string;
    storageKey: string;
    publicUrl: string | null;
}

async function buildTifCatalog(): Promise<Map<string, TifEntry>> {
    const catalog = new Map<string, TifEntry>();

    async function walk(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) await walk(full);
            else if (e.name.toLowerCase().endsWith('.tif')) {
                const stem   = path.basename(e.name, '.tif');
                const parsed = parseTifStem(stem);
                if (!parsed) continue;

                const { key, frenli } = parsed;
                const normStem = stem.toLowerCase()
                    .replace(/i̇/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
                    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
                    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                const storageKey = `emes/${normStem}.webp`;
                const entry: TifEntry = { path: full, storageKey, publicUrl: null };

                const catalogKey = frenli ? key + 'F' : key;
                if (!catalog.has(catalogKey)) catalog.set(catalogKey, entry);
                // Frenli → fallback olarak frenli-olmayan key'e de yaz
                if (!frenli && !catalog.has(key)) catalog.set(key, entry);
            }
        }
    }
    await walk(RAW_DIR);
    return catalog;
}

// ── DB ürün adından anahtar çıkar ────────────────────────────────────────────
function extractProductKey(name: string, sku: string): string[] {
    const src = normTR((name || sku).trim());

    // Seri: EA01, EAY01, EM02, EZ03, EB01 vb.
    const seriMatch = src.match(/^([A-Z]+\s*\d{2})\b/);
    if (!seriMatch) return [];
    const seri = seriMatch[1].replace(/\s+/g, '');

    // Sonraki token: tip kodu (VBP, HBZ, ZBP, MBT vb.)
    const after   = src.slice(seriMatch[0].length).trim();
    const tipMatch = after.match(/^([A-Z]{2,6})\b/);
    if (!tipMatch) return [];
    const tip = tipMatch[1];

    // Frenli mi? İsimde "F" geçiyor mu (boyuttan sonra)
    const frenli = /\bF\b/.test(after) || /[0-9]F\b/.test(after) || after.endsWith('F');

    const baseKey  = seri + tip;
    const frenliKey = baseKey + 'F';

    if (frenli) return [frenliKey, baseKey]; // frenli varsa önce frenliyi dene
    return [baseKey, frenliKey];             // yoksa önce frensiz, sonra frenli
}

// ── Supabase PostgreSQL'de güncelle ──────────────────────────────────────────
async function updateSupabase(productIds: string[], publicUrl: string): Promise<void> {
    if (!productIds.length) return;
    // products.image_url güncelle
    const { error } = await supabase.from('products').update({ image_url: publicUrl }).in('id', productIds);
    if (error) console.error(`  [Supabase products] ${error.message}`);

    // product_media insert (zaten varsa atla)
    for (const id of productIds) {
        const { count } = await supabase.from('product_media')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', id).eq('url', publicUrl);
        if ((count ?? 0) === 0) {
            const { error: me } = await supabase.from('product_media').insert({
                product_id: id, url: publicUrl, is_primary: true, sort_order: 0,
            });
            if (me) console.error(`  [Supabase product_media] ${id}: ${me.message}`);
        }
    }
}

// ── Checkpoint ───────────────────────────────────────────────────────────────
interface Checkpoint {
    uploadedKeys: string[];       // catalog key'leri (işlendi)
    stats: { matched: number; notFound: number; errors: number };
}

async function loadCheckpoint(): Promise<Checkpoint> {
    if (RESET) {
        try { await fs.unlink(CHECKPOINT_FILE); } catch { /* yok */ }
        return { uploadedKeys: [], stats: { matched: 0, notFound: 0, errors: 0 } };
    }
    try {
        const cp = JSON.parse(await fs.readFile(CHECKPOINT_FILE, 'utf-8')) as Checkpoint;
        console.log(`[Checkpoint] Devam — ${cp.uploadedKeys.length} katalog anahtarı işlendi`);
        return cp;
    } catch {
        return { uploadedKeys: [], stats: { matched: 0, notFound: 0, errors: 0 } };
    }
}

async function saveCheckpoint(cp: Checkpoint) {
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ EMES LOCAL GÖRSEL YÜKLEYICI ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN — Storage/DB\'ye yazılmıyor');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 1. TIF kataloğu oluştur
    console.log('\n[1] TIF kataloğu taranıyor...');
    const catalog = await buildTifCatalog();
    console.log(`    ${catalog.size} benzersiz görsel anahtarı bulundu`);

    // 2. MySQL bağlantısı
    console.log('[2] MySQL bağlantısı kuruluyor...');
    const db = await mysql2.createConnection({
        host:     process.env.MYSQL_HOST     || '127.0.0.1',
        port:     parseInt(process.env.MYSQL_PORT || '3306'),
        user:     process.env.MYSQL_USER     || 'teker',
        password: process.env.MYSQL_PASSWORD || 'teker123',
        database: process.env.MYSQL_DATABASE || 'teker_market',
        charset:  'utf8mb4',
    });
    console.log('    Bağlandı');

    // 3. Eksik görsel Emes ürünlerini çek
    console.log('[3] Eksik görsel Emes ürünleri çekiliyor...');
    const [rows] = await db.execute<mysql2.RowDataPacket[]>(`
        SELECT id, sku, name
        FROM products
        WHERE deleted_at IS NULL
          AND (
            image_url IS NULL OR image_url = ''
            OR image_url LIKE '%placeholder%'
          )
          AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.source')) IN
              ('emes_2026','emes_kulp_2026','yedek_emes_2026')
        ORDER BY name
    `);

    let products = rows as Array<{ id: string; sku: string; name: string }>;
    if (LIMIT) products = products.slice(0, LIMIT);
    console.log(`    ${products.length} ürün işlenecek`);

    // 4. Ürün → katalog eşleştirmesi yap
    const catalogToProducts = new Map<string, Array<{ id: string; sku: string; name: string }>>();
    let notFoundCount = 0;
    const notFoundList: Array<{ sku: string; name: string }> = [];

    for (const p of products) {
        const keys = extractProductKey(p.name, p.sku);
        let matched = false;
        for (const key of keys) {
            if (catalog.has(key)) {
                if (!catalogToProducts.has(key)) catalogToProducts.set(key, []);
                catalogToProducts.get(key)!.push(p);
                matched = true;
                break;
            }
        }
        if (!matched) {
            notFoundCount++;
            notFoundList.push({ sku: p.sku, name: p.name });
        }
    }

    const matchedCount = products.length - notFoundCount;
    console.log(`\n[Eşleştirme] ${matchedCount} eşleşti  |  ${notFoundCount} eşleşme yok`);
    console.log(`[Upload] ${catalogToProducts.size} benzersiz görsel yüklenecek\n`);

    if (DRY_RUN) {
        console.log('── DRY-RUN EŞLEŞMELERİ (ilk 30) ──');
        let i = 0;
        for (const [key, prods] of catalogToProducts) {
            const tif = path.basename(catalog.get(key)!.path);
            console.log(`  ${key.padEnd(20)} ← ${tif.padEnd(35)} → ${prods.length} ürün`);
            if (++i >= 30) { console.log(`  ... ve ${catalogToProducts.size - 30} katalog anahtarı daha`); break; }
        }
        if (notFoundCount > 0) {
            console.log(`\n── EŞLEŞMEYEN ÜRÜNLER (ilk 20) ──`);
            notFoundList.slice(0, 20).forEach(p => console.log(`  [${p.sku}] ${p.name}`));
        }
        await db.end();
        return;
    }

    // 5. Checkpoint yükle
    const cp = await loadCheckpoint();
    const processedKeys = new Set(cp.uploadedKeys);
    let { matched, notFound, errors } = cp.stats;
    notFound += notFoundCount;

    const log: object[] = [];
    const totalKeys = catalogToProducts.size;
    let keyIdx = 0;

    for (const [key, prods] of catalogToProducts) {
        keyIdx++;
        const entry = catalog.get(key)!;
        const tifBase = path.basename(entry.path);

        if (processedKeys.has(key)) {
            process.stdout.write(`\r[${keyIdx}/${totalKeys}] ⏭ ${key.padEnd(20)} (atlandı - checkpoint)`);
            continue;
        }

        process.stdout.write(`\r[${keyIdx}/${totalKeys}] ↻ ${key.padEnd(20)} (${tifBase.slice(0, 30)}) ...`);

        // WebP'ye dönüştür
        const webpPath = path.join(OUTPUT_DIR, `${key.toLowerCase()}.webp`);
        const processed = await processTif(entry.path, webpPath);
        if (!processed) {
            console.log(`\n  ✗ [${key}] TIF işlenemedi`);
            errors++;
            cp.uploadedKeys.push(key);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        // Storage'a yükle
        const publicUrl = await uploadWebp(webpPath, entry.storageKey);
        if (!publicUrl) {
            console.log(`\n  ✗ [${key}] Yükleme başarısız`);
            errors++;
            cp.uploadedKeys.push(key);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        entry.publicUrl = publicUrl;

        // MySQL'i güncelle
        const ids = prods.map(p => p.id);
        const placeholders = ids.map(() => '?').join(',');
        await db.execute(
            `UPDATE products SET image_url = ? WHERE id IN (${placeholders})`,
            [publicUrl, ...ids]
        );

        // product_media insert
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

        // Supabase PostgreSQL'i güncelle
        await updateSupabase(ids, publicUrl);

        matched += prods.length;
        console.log(`\r  ✅ [${key}] ${tifBase.slice(0, 30).padEnd(30)} → ${prods.length} ürün güncellendi`);

        log.push({ key, tif: tifBase, publicUrl, productCount: prods.length, skus: prods.map(p => p.sku) });

        processedKeys.add(key);
        cp.uploadedKeys.push(key);
        cp.stats = { matched, notFound, errors };
        await saveCheckpoint(cp);

        // Temp WebP sil
        try { await fs.unlink(webpPath); } catch { /* önemsiz */ }
    }

    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2));
    await db.end();

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklenen Ürün':  { Adet: matched },
        'Eşleşme Yok':          { Adet: notFound },
        'Hata':                 { Adet: errors },
        'Toplam İşlenen':       { Adet: products.length },
    });

    if (notFoundList.length > 0) {
        console.log('\n━━━ EŞLEŞMEYEN ÜRÜNLER (İlk 30) ━━━');
        notFoundList.slice(0, 30).forEach(p => console.log(`  [${p.sku}] ${p.name}`));
        if (notFoundList.length > 30) console.log(`  ... ve ${notFoundList.length - 30} tane daha`);
    }

    console.log(`\n[Log] ${LOG_FILE}`);
    console.log('━━━ TAMAMLANDI ━━━');
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });
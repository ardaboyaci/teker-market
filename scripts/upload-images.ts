import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY eksik');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET = 'product-media';
const DATA_FILE = path.resolve(__dirname, 'output/products.json');
const LOGO_PATH = path.resolve(__dirname, 'watermark-logo.png');
const CHUNK_SIZE = 20;
const REPROCESS = process.argv.includes('--reprocess'); // mevcut dosyaların üzerine yaz

// ── Logo hazırlama ────────────────────────────────────────────────────────────
// Beyaz/açık arka planı kaldır → alfa kanalına dönüştür, %40 saydamlık uygula
async function buildWatermark(targetWidth: number): Promise<Buffer> {
    const logoSize = Math.round(targetWidth * 0.22); // görselin %22'si kadar logo

    const logoRaw = await sharp(LOGO_PATH)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { data, info } = logoRaw;
    const pixels = new Uint8ClampedArray(data);

    // Beyaz/açık arka planı şeffaf yap (threshold: >230 → alpha=0)
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 230) {
            pixels[i + 3] = 0; // tamamen şeffaf
        } else {
            // Geri kalan piksellere %40 saydamlık uygula
            pixels[i + 3] = Math.round(pixels[i + 3] * 0.40);
        }
    }

    return sharp(Buffer.from(pixels), {
        raw: { width: info.width, height: info.height, channels: 4 },
    })
        .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
}

// ── Görsel işleme + watermark ─────────────────────────────────────────────────
async function processImage(localPath: string): Promise<Buffer> {
    const img = sharp(localPath);
    const meta = await img.metadata();
    const w = meta.width ?? 400;

    const watermark = await buildWatermark(w);

    return img
        .webp({ quality: 85 })
        .composite([{
            input: watermark,
            gravity: 'southeast',   // sağ alt
        }])
        .toBuffer();
}

// ── Storage'daki mevcut dosyaları çek (sayfalama ile) ─────────────────────
async function fetchExistingFiles(): Promise<Set<string>> {
    const existing = new Set<string>();
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list('products', { limit: batchSize, offset });

        if (error) {
            console.error('[Storage] Mevcut dosyalar alınamadı:', error.message);
            break;
        }
        if (!data || data.length === 0) break;
        for (const f of data) existing.add(f.name);
        if (data.length < batchSize) break;
        offset += batchSize;
    }

    return existing;
}

// ── Tek görsel yükleme ────────────────────────────────────────────────────
interface UploadResult {
    sku: string;
    fileName: string;
    status: 'uploaded' | 'skipped' | 'error';
    error?: string;
}

async function uploadOne(
    sku: string,
    localPath: string,
    existing: Set<string>,
): Promise<UploadResult> {
    const safeSku = sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${safeSku}.webp`;
    const filePath = `products/${fileName}`;

    // Zaten yüklüyse atla (--reprocess flag yoksa)
    if (!REPROCESS && existing.has(fileName)) {
        return { sku, fileName, status: 'skipped' };
    }

    // Yerel dosya erişim kontrolü
    try { await fs.access(localPath); }
    catch {
        return { sku, fileName, status: 'error', error: `Dosya bulunamadı: ${localPath}` };
    }

    // Görsel işle
    let buffer: Buffer;
    try {
        buffer = await processImage(localPath);
    } catch (e: unknown) {
        return {
            sku, fileName, status: 'error',
            error: `İşleme hatası: ${e instanceof Error ? e.message : String(e)}`,
        };
    }

    // Supabase'e yükle
    const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, { upsert: true, contentType: 'image/webp' });

    if (uploadErr) {
        return { sku, fileName, status: 'error', error: `Upload hatası: ${uploadErr.message}` };
    }

    // DB'de image_url güncelle
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    await supabase.from('products').update({ image_url: urlData.publicUrl }).eq('sku', sku);

    return { sku, fileName, status: 'uploaded' };
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ TEKER MARKET — GÖRSEL YÜKLEYICI ━━━');
    console.log(`Chunk boyutu: ${CHUNK_SIZE}  |  Mod: ${REPROCESS ? '--reprocess (üzerine yaz)' : 'incremental (mevcutları atla)'}\n`);

    const rawData = await fs.readFile(DATA_FILE, 'utf-8');
    const products: Array<{ sku: string; localImagePath?: string }> = JSON.parse(rawData);
    const withImage = products.filter(p => p.localImagePath);

    console.log(`Toplam ürün: ${products.length}  |  Görseli olan: ${withImage.length}`);
    console.log('[Storage] Mevcut dosyalar alınıyor...');

    const existing = await fetchExistingFiles();
    console.log(`[Storage] ${existing.size} dosya zaten yüklü — atlanacak\n`);

    const allResults: UploadResult[] = [];
    const totalChunks = Math.ceil(withImage.length / CHUNK_SIZE);

    for (let i = 0; i < withImage.length; i += CHUNK_SIZE) {
        const chunk = withImage.slice(i, i + CHUNK_SIZE);
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
        const rangeEnd = Math.min(i + CHUNK_SIZE, withImage.length);

        process.stdout.write(`[Chunk ${chunkNum}/${totalChunks}] ${i + 1}–${rangeEnd} işleniyor... `);

        const results = await Promise.all(
            chunk.map(p => uploadOne(p.sku, p.localImagePath!, existing))
        );

        const uploaded = results.filter(r => r.status === 'uploaded').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        const errored = results.filter(r => r.status === 'error').length;

        console.log(`✓ ${uploaded} yüklendi  ⏭ ${skipped} atlandı  ✗ ${errored} hata`);

        // Hata detaylarını anında logla
        for (const r of results) {
            if (r.status === 'error') {
                console.log(`   ⚠ [${r.sku}] ${r.error}`);
            }
        }

        allResults.push(...results);
    }

    // ── Final Rapor ───────────────────────────────────────────────────────
    const uploaded = allResults.filter(r => r.status === 'uploaded').length;
    const skipped = allResults.filter(r => r.status === 'skipped').length;
    const errored = allResults.filter(r => r.status === 'error').length;

    console.log('\n━━━ YÜKLEME RAPORU ━━━');
    console.table({
        'Toplam İşlenen': { Adet: allResults.length },
        'Yüklendi': { Adet: uploaded },
        'Atlandı (mevcuttu)': { Adet: skipped },
        'Hata': { Adet: errored },
    });

    if (errored > 0) {
        const errorList = allResults.filter(r => r.status === 'error');
        console.log('\n━━━ HATA LİSTESİ ━━━');
        console.table(
            errorList.slice(0, 50).map(e => ({
                SKU: e.sku,
                Hata: (e.error ?? '').slice(0, 90),
            }))
        );
        if (errorList.length > 50) {
            console.log(`  ... ve ${errorList.length - 50} hata daha (yukarıda gösterilmedi)`);
        }
    }

    console.log('\n━━━ TAMAMLANDI ━━━');
}

main().catch(err => {
    console.error('[Fatal]', err);
    process.exit(1);
});

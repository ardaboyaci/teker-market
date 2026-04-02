/**
 * IMAGE PIPELINE — Paylaşımlı görsel işleme ve yükleme util'i
 *
 * Tüm tedarikçi scraper'ların kullandığı ortak fonksiyonlar:
 *  - downloadAndProcess: URL'den görsel indir, 800px resize, watermark ekle, WebP'ye çevir
 *  - uploadToStorage: Supabase Storage'a yükle, public URL döndür
 *  - linkToProduct: products.image_url güncelle + product_media tablosuna ekle
 */
import axios from 'axios';
import https from 'https';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';

const WATERMARK_PATH = path.resolve(process.cwd(), 'scripts', 'watermark-logo-transparent.png');
const BUCKET = 'product-media';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

// ── Watermark buffer oluştur ────────────────────────────────────────────────
async function buildWatermark(targetWidth: number): Promise<Buffer | null> {
    try {
        // %15 genişlik, max 120px — çok büyük veya kadraj dışı çıkmasın
        const logoSize = Math.min(Math.round(targetWidth * 0.15), 120);
        // Transparent PNG kullandığımız için beyaz piksel temizleme gerekmez
        // Sadece opacity uygula (%40) ve boyutlandır
        const logoRaw = await sharp(WATERMARK_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const { data, info } = logoRaw;
        const pixels = new Uint8ClampedArray(data);

        // Sadece mevcut alpha değerini %40'a indir, beyaz temizleme yapma
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i + 3] = Math.round(pixels[i + 3] * 0.40);
        }

        return sharp(Buffer.from(pixels), {
            raw: { width: info.width, height: info.height, channels: 4 },
        })
            .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
    } catch {
        return null; // watermark dosyası yoksa suskunca devam
    }
}

// ── Görsel indir, watermark ekle, WebP'ye çevir ─────────────────────────────
export async function downloadAndProcess(
    imageUrl: string,
    outputPath: string,
): Promise<string | null> {
    try {
        const { data } = await http.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const buf = Buffer.from(data as ArrayBuffer);

        const meta = await sharp(buf).metadata();
        const origW = meta.width ?? 800;
        const origH = meta.height ?? 800;

        // Küçük görseller için büyütme + keskinleştirme uygula (Mertsan gibi low-res kaynaklar)
        const targetW = Math.max(origW, 400); // en az 400px genişlik
        const img = sharp(buf)
            .resize(Math.min(targetW, 800), null, { withoutEnlargement: false })
            .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.1 }); // bulanıklığı azalt

        // Gerçek çıktı genişliği — watermark boyutunu buna göre hesapla
        const actualW = Math.min(targetW, 800);
        const watermark = await buildWatermark(actualW);

        const pipeline = watermark
            ? img.composite([{ input: watermark, gravity: 'southeast', blend: 'over' }])
            : img;

        await pipeline.webp({ quality: 85 }).toFile(outputPath);
        return outputPath;
    } catch {
        return null;
    }
}

// ── Supabase Storage'a yükle ─────────────────────────────────────────────────
export async function uploadToStorage(
    supabase: SupabaseClient,
    localPath: string,
    sku: string,
): Promise<string | null> {
    const safeSku = sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
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

// ── DB'ye link: image_url güncelle + product_media insert ──────────────────
export async function linkToProduct(
    supabase: SupabaseClient,
    productId: string,
    publicUrl: string,
): Promise<boolean> {
    // product_media tablosuna ekle (zaten varsa skip)
    const { count } = await supabase
        .from('product_media')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('url', publicUrl);

    if ((count ?? 0) === 0) {
        const { error: mediaErr } = await supabase.from('product_media').insert({
            product_id: productId,
            url: publicUrl,
            is_primary: true,
            sort_order: 0,
        });
        if (mediaErr) {
            console.error(`  [product_media] insert hata: ${mediaErr.message}`);
            return false;
        }
    }

    // products.image_url güncelle
    await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', productId);

    return true;
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export { BUCKET };

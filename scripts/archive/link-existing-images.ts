/**
 * MEVCUT GÖRSELLERİ DB'YE BAĞLA
 *
 * Storage'da zaten var olan EMES ve Çiftel görsellerini
 * DB'deki ürünlerle SKU bazlı eşleştirip image_url + product_media günceller.
 *
 * EMES dosya adı formatı : e__01_abp_100.webp  → SKU: "E  01 ABP 100" → normalize
 * Çiftel dosya adı formatı: 0017.webp           → SKU: "0017"
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = 'product-media';

// Storage dosya adından SKU'ya normalize et
function filenameToSku(filename: string): string {
    // "e__01_abp_100.webp" → "E  01 ABP 100"
    // önce .webp kaldır, sonra _ yerine boşluk, büyük harf
    return filename.replace('.webp', '').replace(/_/g, ' ').toUpperCase().trim();
}

// SKU'dan storage dosya adına normalize et (uploadToStorage ile aynı mantık)
function skuToFilename(sku: string): string {
    return sku.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.webp';
}

async function listAllStorageFiles(): Promise<string[]> {
    const files: string[] = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list('products', { limit: 1000, offset });
        if (error || !data || data.length === 0) break;
        files.push(...data.map(f => f.name));
        offset += data.length;
        if (data.length < 1000) break;
    }
    return files;
}

function getPublicUrl(filename: string): string {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`products/${filename}`);
    return data.publicUrl;
}

async function main() {
    console.log('━━━ MEVCUT GÖRSELLERİ DB\'YE BAĞLA ━━━\n');

    // 1. Storage'daki tüm dosyaları listele
    console.log('[1/4] Storage dosyaları listeleniyor...');
    const allFiles = await listAllStorageFiles();
    console.log(`  ${allFiles.length} dosya bulundu`);

    const ciftelFiles = allFiles.filter(f => /^\d{4}\.webp$/.test(f));
    const emesFiles = allFiles.filter(f => !/^\d{4}\.webp$/.test(f));
    console.log(`  EMES formatı: ${emesFiles.length} | Çiftel formatı: ${ciftelFiles.length}\n`);

    // 2. DB'den görselsiz ürünleri çek
    console.log('[2/4] DB\'den görselsiz ürünler çekiliyor...');

    const { data: emesProducts } = await supabase
        .from('products')
        .select('id, sku, image_url')
        .is('image_url', null)
        .is('deleted_at', null)
        .in('meta->>source', ['emes_2026', 'emes_kulp_2026', 'yedek_emes_2026']);

    const { data: ciftelProducts } = await supabase
        .from('products')
        .select('id, sku, image_url')
        .is('image_url', null)
        .is('deleted_at', null)
        .eq('meta->>source', 'ciftel_2026');

    console.log(`  EMES görselsiz: ${emesProducts?.length ?? 0}`);
    console.log(`  Çiftel görselsiz: ${ciftelProducts?.length ?? 0}\n`);

    // 3. EMES eşleştirmesi
    // Storage dosya adı = skuToFilename(sku) ile birebir eşleşmeli
    console.log('[3/4] EMES görselleri eşleştiriliyor...');
    const emesFileSet = new Set(emesFiles);
    let emesLinked = 0;
    let emesNotFound = 0;

    const emesToProcess = emesProducts ?? [];
    for (let i = 0; i < emesToProcess.length; i++) {
        const product = emesToProcess[i];
        const expectedFilename = skuToFilename(product.sku);

        if (!emesFileSet.has(expectedFilename)) {
            emesNotFound++;
            continue;
        }

        const publicUrl = getPublicUrl(expectedFilename);
        await linkProduct(product.id, publicUrl);
        emesLinked++;

        if ((i + 1) % 500 === 0) {
            process.stdout.write(`\r  İşlendi: ${i + 1}/${emesToProcess.length} | Bağlandı: ${emesLinked}`);
        }
    }
    console.log(`\n  ✅ EMES: ${emesLinked} görsel bağlandı | ${emesNotFound} eşleşme yok\n`);

    // 4. Çiftel eşleştirmesi
    console.log('[4/4] Çiftel görselleri eşleştiriliyor...');
    const ciftelFileSet = new Set(ciftelFiles);
    let ciftelLinked = 0;
    let ciftelNotFound = 0;

    const ciftelToProcess = ciftelProducts ?? [];
    for (const product of ciftelToProcess) {
        const expectedFilename = skuToFilename(product.sku);

        if (!ciftelFileSet.has(expectedFilename)) {
            ciftelNotFound++;
            continue;
        }

        const publicUrl = getPublicUrl(expectedFilename);
        await linkProduct(product.id, publicUrl);
        ciftelLinked++;
    }
    console.log(`  ✅ Çiftel: ${ciftelLinked} görsel bağlandı | ${ciftelNotFound} eşleşme yok\n`);

    console.log('━━━ ÖZET ━━━');
    console.table({
        'EMES Bağlandı': { Adet: emesLinked },
        'EMES Eşleşme Yok (scraper çalışmalı)': { Adet: emesNotFound },
        'Çiftel Bağlandı': { Adet: ciftelLinked },
        'Çiftel Eşleşme Yok': { Adet: ciftelNotFound },
    });
}

async function linkProduct(productId: string, publicUrl: string): Promise<void> {
    // product_media tablosuna ekle (zaten varsa skip)
    const { count } = await supabase
        .from('product_media')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId);

    if ((count ?? 0) === 0) {
        await supabase.from('product_media').insert({
            product_id: productId,
            url: publicUrl,
            is_primary: true,
            sort_order: 0,
        });
    }

    // products.image_url güncelle
    await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', productId);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

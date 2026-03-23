/**
 * FIX-IMAGES — Storage'daki görselleri product_media tablosuna ve image_url'ye bağla
 *
 * Storage'da product-media/products/ klasöründe .webp dosyaları var ama
 * product_media tablosunda 0 kayıt ve products.image_url boş.
 * Bu script dosya adından SKU çıkarıp ürünü bulur, doğru tablolara yazar.
 *
 * Flags:
 *   --dry-run   DB'ye yazmadan eşleşmeleri loglar
 *   --limit=N   İlk N dosyayla test
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DRY_RUN = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null

const BUCKET = 'product-media'
const FOLDER = 'products'

async function run() {
    console.log('━━━ FIX-IMAGES — Storage → product_media + image_url ━━━')
    if (DRY_RUN) console.log('⚠  DRY-RUN — DB\'ye yazılmıyor\n')

    // 1. Storage'daki tüm dosyaları çek (sayfalama)
    const allFiles: { name: string }[] = []
    let offset = 0
    while (true) {
        const { data, error } = await supabase.storage.from(BUCKET).list(FOLDER, {
            limit: 1000,
            offset,
        })
        if (error) { console.error('Storage listesi alınamadı:', error.message); break }
        if (!data || data.length === 0) break
        const images = data.filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f.name))
        allFiles.push(...images)
        if (data.length < 1000) break
        offset += 1000
    }

    console.log(`[Storage] ${allFiles.length} görsel dosyası bulundu`)

    const toProcess = LIMIT ? allFiles.slice(0, LIMIT) : allFiles

    let matched = 0, alreadyLinked = 0, skipped = 0, errors = 0

    for (let i = 0; i < toProcess.length; i++) {
        const file = toProcess[i]
        // Dosya adından SKU çıkar: "ea_01_abp_150.webp" → "ea_01_abp_150"
        const rawSku = file.name.replace(/\.[^/.]+$/, '')
        // Alt çizgileri boşluğa dönüştür → "ea 01 abp 150" (ilike araması için)
        const skuPattern = rawSku.replace(/_/g, ' ')

        process.stdout.write(`\r[${i + 1}/${toProcess.length}] ${file.name}...`)

        // Ürünü bul (SKU ilike ile)
        const { data: products } = await supabase
            .from('products')
            .select('id, sku, image_url')
            .or(`sku.ilike.%${rawSku}%,sku.ilike.%${skuPattern}%`)
            .is('deleted_at', null)
            .limit(1)

        const product = products?.[0]
        if (!product) {
            skipped++
            continue
        }

        // Public URL oluştur
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${file.name}`)
        const publicUrl = urlData.publicUrl

        // product_media'da zaten var mı?
        const { count: existingCount } = await supabase
            .from('product_media')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', product.id)
            .eq('url', publicUrl)

        if ((existingCount ?? 0) > 0) {
            alreadyLinked++
            continue
        }

        if (DRY_RUN) {
            console.log(`\n  ✓ [DRY] ${product.sku} → ${publicUrl}`)
            matched++
            continue
        }

        // product_media tablosuna kaydet
        const { error: mediaErr } = await supabase
            .from('product_media')
            .insert({
                product_id: product.id,
                url: publicUrl,
                is_primary: true,
                sort_order: 0,
            })

        if (mediaErr) {
            console.error(`\n  ✗ product_media insert hata (${product.sku}): ${mediaErr.message}`)
            errors++
            continue
        }

        // products.image_url güncelle (boşsa)
        if (!product.image_url) {
            await supabase
                .from('products')
                .update({ image_url: publicUrl })
                .eq('id', product.id)
        }

        matched++
    }

    console.log('\n\n━━━ ÖZET ━━━')
    console.table({
        'Eşleştirildi': { Adet: matched },
        'Zaten bağlı (atlandı)': { Adet: alreadyLinked },
        'DB\'de SKU yok (atlandı)': { Adet: skipped },
        'Hata': { Adet: errors },
        'Toplam dosya': { Adet: toProcess.length },
    })
}

run().catch(err => {
    console.error('[Fatal]', err)
    process.exit(1)
})

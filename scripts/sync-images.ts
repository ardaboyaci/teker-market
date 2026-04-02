/**
 * image_url ↔ product_media senkronizasyonu
 * İki yönlü düzeltme:
 *   A) product_media kaydı var, image_url boş → image_url'i doldur
 *   B) image_url var, product_media kaydı yok → product_media insert et
 *
 * Çalıştır: npx tsx scripts/sync-images.ts --dry-run
 *           npx tsx scripts/sync-images.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
    console.log('\n══════════════════════════════════════════════')
    console.log('  IMAGE SYNC' + (DRY_RUN ? ' [DRY-RUN]' : ''))
    console.log('══════════════════════════════════════════════\n')

    // ── A) product_media → image_url backfill ─────────────────────────────────
    // product_media'da primary resim var ama products.image_url boş
    const { data: mediaWithoutUrl } = await supabase
        .from('product_media')
        .select('product_id, url')
        .eq('is_primary', true)
        .limit(20000)

    if (!mediaWithoutUrl || mediaWithoutUrl.length === 0) {
        console.log('A) Kontrol edilecek product_media kaydı yok.')
    } else {
        const productIds = [...new Set(mediaWithoutUrl.map(m => m.product_id))]

        // Bu ürünlerin image_url durumunu kontrol et
        const { data: productsCheck } = await supabase
            .from('products')
            .select('id, image_url')
            .in('id', productIds)
            .is('image_url', null)

        const needsBackfill = productsCheck ?? []
        console.log(`A) product_media → image_url: ${needsBackfill.length} ürün güncellenecek`)

        if (!DRY_RUN && needsBackfill.length > 0) {
            let updated = 0
            for (const product of needsBackfill) {
                const media = mediaWithoutUrl.find(m => m.product_id === product.id)
                if (!media) continue

                const { error } = await supabase
                    .from('products')
                    .update({ image_url: media.url })
                    .eq('id', product.id)

                if (!error) updated++
                process.stdout.write(`\r  ${updated}/${needsBackfill.length}...`)
            }
            console.log(`\n  ✅ ${updated} ürünün image_url'si güncellendi`)
        }
    }

    // ── B) image_url → product_media backfill ─────────────────────────────────
    // products.image_url dolu ama product_media kaydı yok
    const { data: productsWithUrl } = await supabase
        .from('products')
        .select('id, image_url')
        .not('image_url', 'is', null)
        .is('deleted_at', null)
        .limit(20000)

    if (!productsWithUrl || productsWithUrl.length === 0) {
        console.log('\nB) image_url olan ürün bulunamadı.')
    } else {
        // Tüm product_media primary kayıtlarını sayfalı çek
        const withMediaIds = new Set<string>()
        let mediaPage = 0
        while (true) {
            const { data: media } = await supabase
                .from('product_media')
                .select('product_id')
                .eq('is_primary', true)
                .range(mediaPage * 1000, (mediaPage + 1) * 1000 - 1)
            if (!media || media.length === 0) break
            media.forEach(m => withMediaIds.add(m.product_id))
            if (media.length < 1000) break
            mediaPage++
        }
        console.log(`\nB) Mevcut primary media: ${withMediaIds.size} ürün`)

        const needsMedia = productsWithUrl.filter(p => !withMediaIds.has(p.id))
        console.log(`   image_url → product_media eklenecek: ${needsMedia.length} ürün`)

        if (!DRY_RUN && needsMedia.length > 0) {
            const BATCH = 200
            let inserted = 0, errors = 0

            for (let i = 0; i < needsMedia.length; i += BATCH) {
                const batch = needsMedia.slice(i, i + BATCH)
                process.stdout.write(`\r  [${Math.min(i + BATCH, needsMedia.length)}/${needsMedia.length}]...`)

                const { error } = await supabase
                    .from('product_media')
                    .insert(batch.map(p => ({
                        product_id: p.id,
                        url:        p.image_url!,
                        is_primary: true,
                        sort_order: 0,
                        source:     'backfill',
                    })))

                if (error) { errors += batch.length }
                else { inserted += batch.length }
            }
            console.log(`\n  ✅ ${inserted} product_media kaydı oluşturuldu | Hata: ${errors}`)
        } else if (DRY_RUN) {
            console.log(`  [DRY-RUN] ${needsMedia.length} kayıt eklenecekti`)
        }
    }

    // ── Sonuç ──────────────────────────────────────────────────────────────────
    const { count: totalMedia }  = await supabase.from('product_media').select('*', { count: 'exact', head: true })
    const { count: totalImgUrl } = await supabase.from('products').select('*', { count: 'exact', head: true }).not('image_url', 'is', null)

    console.log('\n── Sonuç ─────────────────────────────────────')
    console.log(`  image_url olan ürün   : ${totalImgUrl}`)
    console.log(`  product_media kayıtları: ${totalMedia}`)
    console.log('\n══════════════════════════════════════════════\n')
}

main().catch(console.error)

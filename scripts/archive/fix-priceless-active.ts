import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
    // Önce say
    const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('sale_price', null)
        .eq('status', 'active')
        .is('deleted_at', null)

    console.log(`\nEtkilenecek ürün: ${count}`)
    console.log('Devam etmek için "evet" yazıldı — UPDATE başlıyor...\n')

    // UPDATE — sayfalı yap (Supabase row cap aşmamak için)
    let updated = 0
    let page = 0
    const pageSize = 500

    while (true) {
        // Her iterasyonda page=0'dan çek — UPDATE sonrası offset kaymasını önle
        const { data: batch } = await supabase
            .from('products')
            .select('id')
            .is('sale_price', null)
            .eq('status', 'active')
            .is('deleted_at', null)
            .limit(pageSize)

        if (!batch || batch.length === 0) break

        const ids = batch.map(r => r.id)
        const { error } = await supabase
            .from('products')
            .update({ status: 'draft' })
            .in('id', ids)

        if (error) {
            console.error(`Hata: ${error.message}`)
            break
        }

        updated += ids.length
        console.log(`  ✓ ${updated} ürün draft'a alındı...`)
    }

    // Doğrula
    const { count: remaining } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('sale_price', null)
        .eq('status', 'active')
        .is('deleted_at', null)

    console.log(`\nTamamlandı:`)
    console.log(`  Draft'a alınan : ${updated}`)
    console.log(`  Hâlâ active+fiyatsız: ${remaining ?? 0} (0 olmalı)`)
}

main().catch(console.error)

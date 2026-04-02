/**
 * Demo verisi — rakip fiyatlar + stok hareketi geçmişi
 * Çalıştır: npx tsx scripts/seed-demo-data.ts          → gerçek
 *           npx tsx scripts/seed-demo-data.ts --dry-run → sadece seçilen ürünleri listele
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
    console.log('\n══════════════════════════════════════════')
    console.log('  DEMO VERİSİ SEED' + (DRY_RUN ? ' [DRY-RUN]' : ''))
    console.log('══════════════════════════════════════════\n')

    // ── 1. EMES tedarikçisinden görsel + fiyat + stoklu 5 ürün seç ───────────
    const { data: candidates } = await supabase
        .from('products')
        .select('id, sku, name, sale_price, image_url, slug')
        .eq('status', 'active')
        .is('deleted_at', null)
        .not('sale_price', 'is', null)
        .not('image_url', 'is', null)
        .gt('quantity_on_hand', 0)
        .ilike('meta->>source', '%emes%')
        .order('created_at', { ascending: false })
        .limit(5)

    if (!candidates || candidates.length === 0) {
        console.log('❌ Uygun EMES ürünü bulunamadı.')
        return
    }

    console.log(`Seçilen 5 demo ürünü:\n`)
    candidates.forEach((p, i) => {
        console.log(`  ${i + 1}. SKU  : ${p.sku}`)
        console.log(`     İsim : ${p.name}`)
        console.log(`     Fiyat: ₺${p.sale_price}`)
        console.log(`     URL  : http://localhost:3000/products/${p.slug}\n`)
    })

    if (DRY_RUN) {
        console.log('─── DRY-RUN — DB\'ye hiçbir şey yazılmadı ───')
        console.log('Onaylamak için: npx tsx scripts/seed-demo-data.ts\n')
        return
    }
    // ── 2. Rakip fiyat ekle (sale_price'ın %5-%15 altında) ───────────────────
    console.log('\n🏷  Rakip fiyatlar yazılıyor...')
    for (const product of candidates) {
        const salePrice = parseFloat(String(product.sale_price))
        // Rakip fiyat: %8-12 aşağıda
        const discount = 0.08 + Math.random() * 0.04
        const competitorPrice = Math.round(salePrice * (1 - discount) * 100) / 100

        const { error } = await supabase
            .from('products')
            .update({
                competitor_price:      competitorPrice,
                competitor_source:     'e-tekerlek.com',
                competitor_scraped_at: new Date().toISOString(),
            })
            .eq('id', product.id)

        if (error) {
            console.log(`   ❌ ${product.sku}: ${error.message}`)
        } else {
            console.log(`   ✅ ${product.sku}: ₺${salePrice} → rakip ₺${competitorPrice}`)
        }
    }

    // ── 3. Stok hareketi geçmişi ekle ─────────────────────────────────────────
    console.log('\n📦 Stok hareketi geçmişi ekleniyor...')

    // Her ürün için 3 geçmiş hareket
    const movements: object[] = []
    const now = Date.now()

    for (const product of candidates) {
        // 3 gün önce — giriş
        movements.push({
            product_id:      product.id,
            movement_type:   'in',
            quantity:        50,
            quantity_before: 0,
            quantity_after:  50,
            reference_type:  'purchase',
            reference_note:  'Tedarikçi sevkiyatı',
            created_at:      new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        })
        // 2 gün önce — satış
        movements.push({
            product_id:      product.id,
            movement_type:   'out',
            quantity:        -8,
            quantity_before: 50,
            quantity_after:  42,
            reference_type:  'sale',
            reference_note:  'Müşteri siparişi',
            created_at:      new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        })
        // Dün — düzeltme
        movements.push({
            product_id:      product.id,
            movement_type:   'adjustment',
            quantity:        -2,
            quantity_before: 42,
            quantity_after:  40,
            reference_type:  'manual',
            reference_note:  'Sayım düzeltmesi',
            created_at:      new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
        })
    }

    const { error: smError, data: smData } = await supabase
        .from('stock_movements')
        .insert(movements)
        .select('id')

    if (smError) {
        console.log(`   ❌ stock_movements: ${smError.message}`)
    } else {
        console.log(`   ✅ ${smData?.length ?? 0} stok hareketi kaydedildi`)
    }

    // ── 4. Doğrulama ──────────────────────────────────────────────────────────
    console.log('\n🔍 Doğrulama...')

    const { count: compCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .not('competitor_price', 'is', null)

    const { count: smCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })

    console.log(`   Rakip fiyatlı ürün: ${compCount}`)
    console.log(`   Toplam stok hareketi: ${smCount}`)

    // ── 5. Demo URL'leri ──────────────────────────────────────────────────────
    console.log('\n🔗 Demo URL\'leri:')
    const { data: demoProd } = await supabase
        .from('products')
        .select('sku, slug, name')
        .in('id', candidates.map(c => c.id))

    demoProd?.forEach(p => {
        console.log(`   http://localhost:3000/products/${p.slug}`)
    })

    console.log('\n══════════════════════════════════════════\n')
}

main().catch(console.error)

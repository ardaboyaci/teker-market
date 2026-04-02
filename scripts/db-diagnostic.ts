import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now()
    const result = await fn()
    const ms = Date.now() - start
    console.log(`  ⏱  ${label}: ${ms}ms`)
    return result
}

async function main() {
    console.log('\n══════════════════════════════════════════════')
    console.log('  TEKER MARKET — DB DIAGNOSTIC')
    console.log('══════════════════════════════════════════════\n')

    // 1. Total products
    const t1 = Date.now()
    const { count: totalCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
    const q1ms = Date.now() - t1
    console.log(`📦 Total products       : ${totalCount ?? 'ERR'}`)

    // 2. Status breakdown
    const t2 = Date.now()
    const { data: statusRows } = await supabase
        .from('products')
        .select('status')
        .is('deleted_at', null)
    const q2ms = Date.now() - t2

    const statusMap: Record<string, number> = {}
    for (const r of statusRows ?? []) {
        statusMap[r.status] = (statusMap[r.status] ?? 0) + 1
    }
    console.log(`   ├─ active             : ${statusMap['active'] ?? 0}`)
    console.log(`   ├─ draft              : ${statusMap['draft'] ?? 0}`)
    console.log(`   ├─ inactive           : ${statusMap['inactive'] ?? 0}`)
    console.log(`   └─ archived           : ${statusMap['archived'] ?? 0}`)

    // 3. image_url column existence check
    const t3 = Date.now()
    const { data: colCheck } = await supabase
        .rpc('rpc_search_products', { p_search: '__DIAGNOSTIC__', p_limit: 1 })
        .maybeSingle()
    // Direct column check via select
    const { data: sampleRow } = await supabase
        .from('products')
        .select('id, image_url')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
    const q3ms = Date.now() - t3

    const hasImageUrlColumn = sampleRow !== null && 'image_url' in (sampleRow ?? {})
    console.log(`\n🖼  image_url column exists: ${hasImageUrlColumn ? 'YES ✅' : 'NO ❌ — phantom field'}`)

    // 4. Products with image (via product_media)
    const t4 = Date.now()
    const { count: withImageCount } = await supabase
        .from('product_media')
        .select('product_id', { count: 'exact', head: true })
    const q4ms = Date.now() - t4

    // Distinct product_id count (product_media may have multiple per product)
    const { data: distinctImages } = await supabase
        .from('product_media')
        .select('product_id')
    const distinctProductsWithImage = new Set((distinctImages ?? []).map(r => r.product_id)).size

    console.log(`\n🖼  Products with image (product_media):`)
    console.log(`   ├─ total media rows   : ${withImageCount ?? 0}`)
    console.log(`   └─ distinct products  : ${distinctProductsWithImage}`)

    if (totalCount && totalCount > 0) {
        const pct = Math.round((distinctProductsWithImage / totalCount) * 100)
        console.log(`   └─ coverage %         : ${pct}%`)
    }

    // 5. Products without description
    const t5 = Date.now()
    const { count: noDescCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .or('description.is.null,description.eq.')
    const q5ms = Date.now() - t5

    console.log(`\n📝 Products without description: ${noDescCount ?? 'ERR'}`)
    if (totalCount && noDescCount != null) {
        const pct = Math.round((noDescCount / totalCount) * 100)
        console.log(`   └─ missing %          : ${pct}%`)
    }

    // 6. Supplier distribution
    const t6 = Date.now()
    const { data: allMeta } = await supabase
        .from('products')
        .select('meta, status')
        .is('deleted_at', null)
    const q6ms = Date.now() - t6

    const supplierMap: Record<string, { total: number; active: number; draft: number }> = {}
    for (const row of allMeta ?? []) {
        const src = (row.meta as Record<string, string>)?.source ?? 'unknown'
        if (!supplierMap[src]) supplierMap[src] = { total: 0, active: 0, draft: 0 }
        supplierMap[src].total++
        if (row.status === 'active') supplierMap[src].active++
        if (row.status === 'draft')  supplierMap[src].draft++
    }

    console.log(`\n🏭 Supplier distribution:`)
    Object.entries(supplierMap)
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([supplier, s]) => {
            console.log(`   ├─ ${supplier.padEnd(25)} total:${String(s.total).padStart(5)}  active:${String(s.active).padStart(5)}  draft:${String(s.draft).padStart(5)}`)
        })

    // 7. Avg query time summary
    const times = [q1ms, q2ms, q3ms, q4ms, q5ms, q6ms]
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    const max = Math.max(...times)

    console.log(`\n⏱  Query performance:`)
    console.log(`   ├─ count (head:true) : ${q1ms}ms`)
    console.log(`   ├─ status breakdown  : ${q2ms}ms`)
    console.log(`   ├─ column check      : ${q3ms}ms`)
    console.log(`   ├─ media count       : ${q4ms}ms`)
    console.log(`   ├─ no-description    : ${q5ms}ms`)
    console.log(`   ├─ supplier meta     : ${q6ms}ms`)
    console.log(`   ├─ avg              : ${avg}ms`)
    console.log(`   └─ max              : ${max}ms`)

    // 8. Dashboard full-scan simulation
    console.log(`\n🚨 Dashboard full-scan simulation:`)
    const tDash = Date.now()
    const { data: dashData, count: dashCount } = await supabase
        .from('products')
        .select('id, sku, name, status, quantity_on_hand, min_stock_level, sale_price, cost_price, meta, created_at', { count: 'exact' })
        .is('deleted_at', null)
    const dashMs = Date.now() - tDash
    console.log(`   ├─ rows returned     : ${dashData?.length ?? 0}`)
    console.log(`   ├─ total count       : ${dashCount ?? 0}`)
    console.log(`   └─ query time        : ${dashMs}ms ${dashMs > 2000 ? '🔴 CRITICAL' : dashMs > 500 ? '🟡 SLOW' : '🟢 OK'}`)

    console.log('\n══════════════════════════════════════════════\n')
}

main().catch(console.error)

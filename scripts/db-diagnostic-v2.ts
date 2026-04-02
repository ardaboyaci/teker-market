/**
 * DB DIAGNOSTIC v2 — Tam sistem sağlığı
 * Çalıştır: npx tsx scripts/db-diagnostic-v2.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ms = (start: number) => `${Date.now() - start}ms`
const pct = (n: number, total: number) =>
    total === 0 ? 'N/A' : `${Math.round((n / total) * 100)}%`
const bar = (n: number, total: number, width = 20) => {
    const filled = total === 0 ? 0 : Math.round((n / total) * width)
    return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// ─── section header ──────────────────────────────────────────────────────────
const section = (title: string) =>
    console.log(`\n${'─'.repeat(52)}\n  ${title}\n${'─'.repeat(52)}`)

async function main() {
    console.log('\n╔══════════════════════════════════════════════════╗')
    console.log('║   TEKER MARKET — FULL SYSTEM DIAGNOSTIC v2       ║')
    console.log(`║   ${new Date().toLocaleString('tr-TR').padEnd(46)}║`)
    console.log('╚══════════════════════════════════════════════════╝')

    // ── 1. CRUD SUCCESS RATE ──────────────────────────────────────────────────
    section('1. CRUD SUCCESS RATE  (audit_log)')

    const t1 = Date.now()
    const { data: auditRows, error: auditErr } = await supabase
        .from('audit_log')
        .select('action, table_name, created_at')
        .order('created_at', { ascending: false })
        .limit(1000)

    if (auditErr) {
        console.log(`  ⚠  audit_log erişilemedi: ${auditErr.message}`)
        console.log(`     → Muhtemelen tablo yok veya RLS kapalı`)
    } else {
        const total = auditRows?.length ?? 0
        const byAction: Record<string, number> = {}
        const byTable:  Record<string, number> = {}
        for (const r of auditRows ?? []) {
            byAction[r.action] = (byAction[r.action] ?? 0) + 1
            byTable[r.table_name] = (byTable[r.table_name] ?? 0) + 1
        }
        console.log(`  Son ${total} audit kaydı (max 1000):`)
        Object.entries(byAction).sort((a,b) => b[1]-a[1]).forEach(([action, count]) =>
            console.log(`   ├─ ${action.padEnd(12)} ${count.toString().padStart(5)}`)
        )
        console.log(`  Tablo dağılımı:`)
        Object.entries(byTable).sort((a,b) => b[1]-a[1]).forEach(([table, count]) =>
            console.log(`   ├─ ${table.padEnd(20)} ${count.toString().padStart(5)}`)
        )
        // Son aktivite zamanı
        if ((auditRows?.length ?? 0) > 0) {
            const last = auditRows![0].created_at
            console.log(`  Son aktivite: ${new Date(last).toLocaleString('tr-TR')}`)
        }
    }
    console.log(`  ⏱  ${ms(t1)}`)

    // ── 2. VALIDATION ERROR RATE ──────────────────────────────────────────────
    section('2. VERİ KALİTESİ / VALIDATION HATALARI')

    const t2 = Date.now()

    // Fiyat tutarsızlıkları: sale_price > base_price
    const { data: priceAnomaly } = await supabase
        .from('products')
        .select('sku, sale_price, base_price')
        .is('deleted_at', null)
        .not('sale_price', 'is', null)
        .not('base_price', 'is', null)

    let salePriceHigher = 0
    let negativePrice   = 0
    let zeroPrice       = 0

    for (const p of priceAnomaly ?? []) {
        const sale = parseFloat(String(p.sale_price))
        const base = parseFloat(String(p.base_price))
        if (!isNaN(sale) && !isNaN(base) && sale > base * 1.5) salePriceHigher++
        if (!isNaN(sale) && sale < 0) negativePrice++
        if (!isNaN(sale) && sale === 0) zeroPrice++
    }

    const totalPriced = priceAnomaly?.length ?? 0
    console.log(`  Fiyat anomalisi (fiyatlı ${totalPriced} üründen):`)
    console.log(`   ├─ sale_price > base_price*1.5 : ${salePriceHigher} (${pct(salePriceHigher, totalPriced)})`)
    console.log(`   ├─ negatif fiyat               : ${negativePrice}`)
    console.log(`   └─ sıfır fiyat                 : ${zeroPrice}`)

    // Fiyatsız ürün oranı (active)
    const { count: activeTotalCount } = await supabase
        .from('products').select('*', { count: 'exact', head: true })
        .eq('status', 'active').is('deleted_at', null)

    const { count: activeNoPriceCount } = await supabase
        .from('products').select('*', { count: 'exact', head: true })
        .eq('status', 'active').is('deleted_at', null).is('sale_price', null)

    const activeTotal   = activeTotalCount ?? 0
    const activeNoPrice = activeNoPriceCount ?? 0
    console.log(`\n  Active ürünlerde fiyat durumu:`)
    console.log(`   ├─ Toplam active                : ${activeTotal}`)
    console.log(`   ├─ Fiyatsız active              : ${activeNoPrice} (${pct(activeNoPrice, activeTotal)})`)
    console.log(`   └─ Fiyatlı active               : ${activeTotal - activeNoPrice} (${pct(activeTotal - activeNoPrice, activeTotal)})`)

    // Slug boş veya geçersiz
    const { count: emptySlug } = await supabase
        .from('products').select('*', { count: 'exact', head: true })
        .is('deleted_at', null).or('slug.is.null,slug.eq.')
    console.log(`\n  Slug sorunları:`)
    console.log(`   └─ Boş/null slug                : ${emptySlug ?? 0}`)

    // VAT rate anormal
    const { data: vatAnomaly } = await supabase
        .from('products')
        .select('vat_rate')
        .is('deleted_at', null)
        .not('vat_rate', 'in', '("0","0.18","0.20","18","20")')
        .limit(10)
    console.log(`   └─ Anormal vat_rate (örnek 10)  : ${vatAnomaly?.length ?? 0}`)

    console.log(`  ⏱  ${ms(t2)}`)

    // ── 3. DUPLICATE DATA RATE ────────────────────────────────────────────────
    section('3. DUPLICATE DATA')

    const t3 = Date.now()

    // SKU duplicate
    const { data: allSkus } = await supabase
        .from('products')
        .select('sku')
        .is('deleted_at', null)

    const skuMap: Record<string, number> = {}
    for (const r of allSkus ?? []) {
        skuMap[r.sku] = (skuMap[r.sku] ?? 0) + 1
    }
    const dupSkus = Object.entries(skuMap).filter(([, v]) => v > 1)
    console.log(`  SKU duplicate:`)
    console.log(`   ├─ Toplam SKU                   : ${Object.keys(skuMap).length}`)
    console.log(`   ├─ Duplicate SKU sayısı          : ${dupSkus.length}`)
    if (dupSkus.length > 0) {
        console.log(`   └─ Örnekler (ilk 5):`)
        dupSkus.slice(0, 5).forEach(([sku, count]) =>
            console.log(`        ${sku.padEnd(30)} ×${count}`)
        )
    }

    // Slug duplicate
    const { data: allSlugs } = await supabase
        .from('products')
        .select('slug')
        .is('deleted_at', null)

    const slugMap: Record<string, number> = {}
    for (const r of allSlugs ?? []) {
        if (r.slug) slugMap[r.slug] = (slugMap[r.slug] ?? 0) + 1
    }
    const dupSlugs = Object.entries(slugMap).filter(([, v]) => v > 1)
    console.log(`\n  Slug duplicate:`)
    console.log(`   ├─ Duplicate slug sayısı         : ${dupSlugs.length}`)
    if (dupSlugs.length > 0) {
        console.log(`   └─ Örnekler (ilk 5):`)
        dupSlugs.slice(0, 5).forEach(([slug, count]) =>
            console.log(`        ${slug.padEnd(40)} ×${count}`)
        )
    }

    // İsim duplicate (tam eşleşme)
    const { data: allNames } = await supabase
        .from('products')
        .select('name')
        .is('deleted_at', null)

    const nameMap: Record<string, number> = {}
    for (const r of allNames ?? []) {
        const norm = r.name.trim().toLowerCase()
        nameMap[norm] = (nameMap[norm] ?? 0) + 1
    }
    const dupNames = Object.entries(nameMap).filter(([, v]) => v > 1)
    console.log(`\n  İsim duplicate (tam eşleşme):`)
    console.log(`   ├─ Duplicate isim sayısı         : ${dupNames.length}`)
    if (dupNames.length > 0) {
        const topDups = dupNames.sort((a,b) => b[1]-a[1]).slice(0, 5)
        console.log(`   └─ En çok tekrarlananlar:`)
        topDups.forEach(([name, count]) =>
            console.log(`        "${name.substring(0, 35)}" ×${count}`)
        )
    }

    // product_media duplicate (aynı product_id için aynı URL)
    const { data: allMedia } = await supabase
        .from('product_media')
        .select('product_id, url')

    const mediaKey: Record<string, number> = {}
    for (const m of allMedia ?? []) {
        const key = `${m.product_id}::${m.url}`
        mediaKey[key] = (mediaKey[key] ?? 0) + 1
    }
    const dupMedia = Object.values(mediaKey).filter(v => v > 1).length
    console.log(`\n  product_media duplicate URL:`)
    console.log(`   └─ Aynı ürün+URL çifti           : ${dupMedia}`)

    console.log(`  ⏱  ${ms(t3)}`)

    // ── 4. BOT / IMPORT BAŞARI ORANLARI ──────────────────────────────────────
    section('4. BOT / IMPORT BAŞARI ORANLARI')

    const t4 = Date.now()

    // bot_runs tablosu var mı?
    const { data: botRuns, error: botRunsErr } = await supabase
        .from('bot_runs')
        .select('bot_name, status, processed_count, error_count, started_at, finished_at')
        .order('started_at', { ascending: false })
        .limit(50)

    if (botRunsErr) {
        console.log(`  ⚠  bot_runs tablosu: ${botRunsErr.message}`)
        console.log(`     → Migration çalıştırılmamış: scripts/migrations/create-bot-runs.sql`)
    } else {
        const runs = botRuns ?? []
        const completed = runs.filter(r => r.status === 'completed')
        const failed    = runs.filter(r => r.status === 'failed')
        const running   = runs.filter(r => r.status === 'running')

        console.log(`  Son ${runs.length} bot çalışması:`)
        console.log(`   ├─ completed : ${completed.length}`)
        console.log(`   ├─ failed    : ${failed.length}`)
        console.log(`   └─ running   : ${running.length}`)

        const botMap: Record<string, { total: number; ok: number; processed: number; errors: number }> = {}
        for (const r of runs) {
            if (!botMap[r.bot_name]) botMap[r.bot_name] = { total: 0, ok: 0, processed: 0, errors: 0 }
            botMap[r.bot_name].total++
            if (r.status === 'completed') botMap[r.bot_name].ok++
            botMap[r.bot_name].processed += r.processed_count ?? 0
            botMap[r.bot_name].errors    += r.error_count ?? 0
        }

        if (Object.keys(botMap).length > 0) {
            console.log(`\n  Bot başarı oranları:`)
            Object.entries(botMap).sort((a,b) => b[1].total - a[1].total).forEach(([name, s]) => {
                const rate = pct(s.ok, s.total)
                const errRate = s.processed > 0 ? pct(s.errors, s.processed) : 'N/A'
                console.log(`   ├─ ${name.padEnd(30)} ${rate.padStart(5)} başarı | ${s.processed} işlendi | %${errRate} hata`)
            })
        }
    }

    // Import başarısını price_history + products oluşturma tarihinden ters mühendislik
    const { data: recentImports } = await supabase
        .from('products')
        .select('meta, created_at, status, sale_price')
        .is('deleted_at', null)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500)

    if ((recentImports?.length ?? 0) > 0) {
        const withPrice  = recentImports!.filter(p => p.sale_price !== null).length
        const withStatus = recentImports!.filter(p => p.status === 'active').length
        console.log(`\n  Son 30 günde eklenen ${recentImports!.length} ürün:`)
        console.log(`   ├─ Fiyatlı import              : ${withPrice} (${pct(withPrice, recentImports!.length)})`)
        console.log(`   └─ Active olarak import         : ${withStatus} (${pct(withStatus, recentImports!.length)})`)
    }

    console.log(`  ⏱  ${ms(t4)}`)

    // ── 5. SİSTEM KIRILMA NOKTALARI ───────────────────────────────────────────
    section('5. SİSTEM KIRILMA NOKTALARI')

    const t5 = Date.now()

    // 5a. Dashboard query — tam yük
    const tDash = Date.now()
    const { count: dashTotal } = await supabase
        .from('products')
        .select('id, sku, name, status, quantity_on_hand, min_stock_level, sale_price, cost_price, meta, created_at',
            { count: 'exact', head: true })
        .is('deleted_at', null)
    const dashCountMs = Date.now() - tDash

    console.log(`  Dashboard count sorgusu:`)
    console.log(`   ├─ Toplam satır (deleted_at=null): ${dashTotal}`)
    console.log(`   ├─ COUNT süresi                  : ${dashCountMs}ms ${dashCountMs > 2000 ? '🔴 KRİTİK' : dashCountMs > 500 ? '🟡 YAVAŞ' : '🟢 OK'}`)

    // 5b. Supabase default row cap testi
    const tCap = Date.now()
    const { data: capData } = await supabase
        .from('products')
        .select('id')
        .is('deleted_at', null)
    const capMs = Date.now() - tCap
    const actualReturned = capData?.length ?? 0
    console.log(`\n  Row cap testi (limit verilmeden):`)
    console.log(`   ├─ Gerçekte dönen satır          : ${actualReturned}`)
    console.log(`   ├─ DB'deki toplam                 : ${dashTotal}`)
    console.log(`   ├─ Cap aktif mi?                  : ${actualReturned < (dashTotal ?? 0) ? `EVET — ${dashTotal! - actualReturned} satır kesildi` : 'Hayır'}`)
    console.log(`   └─ Sorgu süresi                   : ${capMs}ms`)

    // 5c. Search sorgusu ile ILIKE performansı
    const tSearch = Date.now()
    const { count: searchCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .or('name.ilike.%teker%,sku.ilike.%teker%')
    const searchMs = Date.now() - tSearch
    console.log(`\n  ILIKE arama performansı ('%teker%'):`)
    console.log(`   ├─ Sonuç sayısı                  : ${searchCount ?? 0}`)
    console.log(`   └─ Süre                           : ${searchMs}ms ${searchMs > 1000 ? '🔴 KRİTİK' : searchMs > 300 ? '🟡 YAVAŞ' : '🟢 OK'}`)

    // 5d. JSONB meta->source ILIKE performansı
    const tMeta = Date.now()
    const { count: metaCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .ilike('meta->>source', '%emes%')
    const metaMs = Date.now() - tMeta
    console.log(`\n  JSONB meta->>source ILIKE performansı:`)
    console.log(`   ├─ Eşleşen                       : ${metaCount ?? 0}`)
    console.log(`   └─ Süre                           : ${metaMs}ms ${metaMs > 1000 ? '🔴 KRİTİK — GIN index yok' : metaMs > 300 ? '🟡 YAVAŞ' : '🟢 OK'}`)

    // 5e. price_history boyutu
    const { count: phCount } = await supabase
        .from('price_history').select('*', { count: 'exact', head: true })
    const tPH = Date.now()
    const { data: phSample } = await supabase
        .from('price_history')
        .select('product_id, price_type, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
    const phMs = Date.now() - tPH
    console.log(`\n  price_history tablosu:`)
    console.log(`   ├─ Toplam kayıt                  : ${phCount ?? 0}`)
    console.log(`   ├─ Son kayıt sorgusu (5 row)      : ${phMs}ms`)
    if ((phSample?.length ?? 0) > 0) {
        console.log(`   └─ Son aktivite: ${new Date(phSample![0].created_at).toLocaleString('tr-TR')}`)
    }

    // 5f. stock_movements boyutu
    const { count: smCount } = await supabase
        .from('stock_movements').select('*', { count: 'exact', head: true })
    console.log(`\n  stock_movements tablosu:`)
    console.log(`   └─ Toplam kayıt                  : ${smCount ?? 0}`)

    // 5g. Supabase Storage bucket durumu
    const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets()
    console.log(`\n  Supabase Storage bucket'ları:`)
    if (bucketsErr) {
        console.log(`   └─ ⚠  ${bucketsErr.message}`)
    } else {
        for (const b of buckets ?? []) {
            const { data: files } = await supabase.storage.from(b.name).list('products', { limit: 1 })
            console.log(`   ├─ ${b.name.padEnd(20)} public:${b.public} | products/ erişimi: ${files ? 'OK' : 'ERR'}`)
        }
    }

    // 5h. Kritik stok (DB seviyesinde)
    const { count: critCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null)
        .eq('quantity_on_hand', 0)
    console.log(`\n  Stok durumu (active ürünler):`)
    console.log(`   ├─ quantity_on_hand = 0          : ${critCount ?? 0}`)

    console.log(`  ⏱  ${ms(t5)}`)

    // ── 6. GENEL ÖZET ────────────────────────────────────────────────────────
    section('6. ÖZET PUAN KARTI')

    const issues: { label: string; status: string }[] = []

    if (dupSkus.length > 0)      issues.push({ label: `${dupSkus.length} duplicate SKU`, status: '🔴' })
    if (dupSlugs.length > 0)     issues.push({ label: `${dupSlugs.length} duplicate slug`, status: '🔴' })
    if (dupNames.length > 0)     issues.push({ label: `${dupNames.length} duplicate ürün adı`, status: '🟡' })
    if (activeNoPrice > 0)       issues.push({ label: `${activeNoPrice} active ürün fiyatsız`, status: '🟡' })
    if (salePriceHigher > 0)     issues.push({ label: `${salePriceHigher} anormal fiyat`, status: '🟡' })
    if (dashCountMs > 2000)      issues.push({ label: `Dashboard COUNT ${dashCountMs}ms`, status: '🔴' })
    if (actualReturned < (dashTotal ?? 0))
                                  issues.push({ label: `Row cap: ${dashTotal!-actualReturned} satır kesildi`, status: '🔴' })
    if (searchMs > 1000)         issues.push({ label: `ILIKE search ${searchMs}ms`, status: '🔴' })
    if (metaMs > 1000)           issues.push({ label: `JSONB ILIKE ${metaMs}ms — GIN index eksik`, status: '🔴' })
    if (dupMedia > 0)            issues.push({ label: `${dupMedia} duplicate product_media`, status: '🟡' })

    if (issues.length === 0) {
        console.log(`  ✅ Ciddi sorun tespit edilmedi.`)
    } else {
        issues.forEach(i => console.log(`  ${i.status} ${i.label}`))
    }

    console.log(`\n  Toplam sorun: ${issues.length} (${issues.filter(i=>i.status==='🔴').length} kritik)`)
    console.log('\n══════════════════════════════════════════════════\n')
}

main().catch(console.error)

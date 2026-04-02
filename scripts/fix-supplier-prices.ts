/**
 * OSKAR + MERTSAN fiyat güncelleme scripti
 * Mevcut ürünlerin sale_price'ını Excel'deki değerle günceller.
 * Çalıştır: npx tsx scripts/fix-supplier-prices.ts --dry-run
 *           npx tsx scripts/fix-supplier-prices.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')
const EXCEL   = path.resolve(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx')

// ─── Excel'den fiyat listesi oku ──────────────────────────────────────────────
function readOskarPrices(): Map<string, number> {
    const wb   = XLSX.readFile(EXCEL)
    const rows = XLSX.utils.sheet_to_json<any[]>(
        wb.Sheets['OSKAR2026'], { defval: '', header: 1 }
    ) as any[][]

    const map = new Map<string, number>()
    for (let i = 9; i < rows.length; i++) {
        const r    = rows[i]
        const col1 = String(r[1] ?? '').trim()   // SKU
        const col4 = r[4]                         // Fiyat
        if (col1 && typeof col4 === 'number' && col4 > 0) {
            // DB'deki OSKAR SKU'ları prefix'siz (örn: "302.3.7"), OSKAR- öneki yok
            map.set(col1, Math.round(col4 * 100) / 100)
        }
    }
    return map
}

function readMertsanPrices(): Map<string, number> {
    const wb   = XLSX.readFile(EXCEL)
    const ws   = wb.Sheets['MERTSAN 2026']
    if (!ws) { console.log('  ⚠  MERTSAN 2026 sheet bulunamadı'); return new Map() }

    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { defval: '', header: 1 }) as any[][]
    const map  = new Map<string, number>()

    // Col0: isim, Col1: PERAKENDE, Col2: TOPTAN — toptan fiyatı kullan
    for (const row of rows) {
        const name  = String(row[0] ?? '').trim()
        const toptan = row[2]
        if (!name || typeof toptan !== 'number' || toptan <= 0) continue
        if (name.toUpperCase() === 'KDV HARİÇ' || name.toUpperCase() === 'TOPTAN') continue

        // "200 X 50  RULMANLI" → "200-x-50-rulmanli" slug ile eşleştir
        const slug = 'MERTSAN-' + name.toLowerCase()
            .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
            .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        map.set(slug, Math.round(toptan * 100) / 100)
    }
    return map
}

// ─── Ana mantık ───────────────────────────────────────────────────────────────
async function fixSupplierPrices(
    sourceName: string,
    priceMap: Map<string, number>
) {
    if (priceMap.size === 0) {
        console.log(`  ⚠  ${sourceName}: fiyat listesi boş, atlanıyor`)
        return
    }

    console.log(`\n[${sourceName}] Excel'de ${priceMap.size} fiyatlı ürün`)

    // DB'den bu tedarikçinin draft ürünlerini çek (paginated)
    const dbProducts: { id: string; sku: string; sale_price: string | null }[] = []
    let page = 0
    while (true) {
        const { data } = await supabase
            .from('products')
            .select('id, sku, sale_price')
            .ilike('meta->>source', `%${sourceName.toLowerCase().replace('-', '_')}%`)
            .is('deleted_at', null)
            .range(page * 1000, (page + 1) * 1000 - 1)

        if (!data || data.length === 0) break
        dbProducts.push(...data)
        if (data.length < 1000) break
        page++
    }

    console.log(`  DB'de ${dbProducts.length} ${sourceName} ürünü bulundu`)

    // Eşleştir ve güncelle
    const toUpdate: { id: string; sku: string; newPrice: number; oldPrice: string | null }[] = []

    for (const p of dbProducts) {
        const newPrice = priceMap.get(p.sku)
        if (!newPrice) continue
        if (p.sale_price && Math.abs(parseFloat(p.sale_price) - newPrice) < 0.01) continue
        toUpdate.push({ id: p.id, sku: p.sku, newPrice, oldPrice: p.sale_price })
    }

    const noMatch = dbProducts.filter(p => !priceMap.has(p.sku)).length
    console.log(`  Güncellenecek: ${toUpdate.length} | Eşleşme yok: ${noMatch} | Zaten doğru: ${dbProducts.length - toUpdate.length - noMatch}`)

    if (toUpdate.length === 0) { console.log(`  Güncellenecek ürün yok.`); return }
    if (DRY_RUN) {
        toUpdate.slice(0, 10).forEach(u =>
            console.log(`  [DRY] ${u.sku}: ₺${u.oldPrice ?? 'null'} → ₺${u.newPrice}`)
        )
        if (toUpdate.length > 10) console.log(`  ... ve ${toUpdate.length - 10} ürün daha`)
        return
    }

    // Batch update + draft → active
    let updated = 0, errors = 0
    const BATCH = 200

    for (let i = 0; i < toUpdate.length; i += BATCH) {
        const batch = toUpdate.slice(i, i + BATCH)
        process.stdout.write(`\r  [${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length}] güncelleniyor...`)

        for (const item of batch) {
            const { error } = await supabase
                .from('products')
                .update({
                    sale_price: item.newPrice,
                    base_price: item.newPrice,
                    status: 'active',   // fiyatı olan draft ürünü aktifleştir
                })
                .eq('id', item.id)

            if (error) { errors++; continue }
            updated++
        }
    }

    console.log(`\n  ✅ Güncellendi: ${updated} | Hata: ${errors}`)
}

async function main() {
    console.log('\n══════════════════════════════════════════════')
    console.log('  TEDARİKÇİ FİYAT GÜNCELLEME' + (DRY_RUN ? ' [DRY-RUN]' : ''))
    console.log('══════════════════════════════════════════════\n')

    // ── OSKAR ────────────────────────────────────────────────────────────────
    console.log('── OSKAR ────────────────────────────────────')
    const oskarPrices = readOskarPrices()
    await fixSupplierPrices('oskar', oskarPrices)

    // ── MERTSAN ──────────────────────────────────────────────────────────────
    console.log('\n── MERTSAN (yapı analizi) ───────────────────')
    const mertsanPrices = readMertsanPrices()
    if (mertsanPrices.size === 0) {
        console.log('  MERTSAN sheet yapısı yukarıda, manuel fiyat girişi gerekiyor')
    } else {
        await fixSupplierPrices('mertsan', mertsanPrices)
    }

    // ── Sonuç ─────────────────────────────────────────────────────────────────
    console.log('\n── Sonuç ────────────────────────────────────')
    const { count: stillDraftNP } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'draft').is('deleted_at', null).is('sale_price', null)

    const { count: newActive } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active').is('deleted_at', null)

    console.log(`  Fiyatsız draft ürün: ${stillDraftNP}`)
    console.log(`  Toplam active ürün : ${newActive}`)
    console.log('\n══════════════════════════════════════════════\n')
}

main().catch(console.error)

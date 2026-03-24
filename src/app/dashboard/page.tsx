import { createAdminClient } from "@/lib/supabase/admin"
import { AlertBand } from "@/components/dashboard/alert-band"
import { OperationalKPIs } from "@/components/dashboard/operational-kpis"
import { StockUpdateWidget } from "@/components/dashboard/stock-update-widget"
import { LowStockPanel } from "@/components/dashboard/low-stock-panel"
import { ImageCoverage } from "@/components/dashboard/image-coverage"
import { DescriptionCoverage } from "@/components/dashboard/description-coverage"

export const revalidate = 0

export default async function DashboardPage() {
    const supabase = createAdminClient()

    // ── Paralel veri çekimi ────────────────────────────────────────────────────
    const [
        { data: allProducts },
        { data: criticalProducts },
        { data: supplierRaw },
        { data: draftProducts },
    ] = await Promise.all([
        // Genel sayımlar
        supabase
            .from('products')
            .select('id, status, quantity_on_hand, min_stock_level')
            .is('deleted_at', null),

        // Kritik stok — aşağıda criticalRaw olarak ayrıca çekiluyor
        supabase
            .from('products')
            .select('id')
            .limit(1),

        // Tedarikçi bazlı dağılım
        supabase
            .from('products')
            .select('status, meta')
            .is('deleted_at', null),

        // Son 30 draft ürün
        supabase
            .from('products')
            .select('id, sku, name, sale_price, meta, created_at')
            .is('deleted_at', null)
            .eq('status', 'draft')
            .order('created_at', { ascending: false })
            .limit(30),
    ])

    // Kritik stok için doğru filtre — quantity_on_hand <= min_stock_level
    const { data: criticalRaw } = await supabase
        .from('products')
        .select('id, sku, name, quantity_on_hand, min_stock_level, meta')
        .is('deleted_at', null)
        .eq('status', 'active')
        .filter('quantity_on_hand', 'lte', 'min_stock_level')
        .order('quantity_on_hand', { ascending: true })
        .limit(50)

    // ── Sayımlar ──────────────────────────────────────────────────────────────
    const products = allProducts ?? []
    const totalProducts  = products.length
    const activeCount    = products.filter(p => p.status === 'active').length
    const draftCount     = products.filter(p => p.status === 'draft').length
    const inStockCount   = products.filter(p => (p.quantity_on_hand ?? 0) > 0).length
    const zeroStockCount = products.filter(
        p => p.status === 'active' && (p.quantity_on_hand ?? 0) === 0
    ).length
    const criticalStockCount = products.filter(
        p => p.status === 'active' &&
            (p.quantity_on_hand ?? 0) > 0 &&
            (p.quantity_on_hand ?? 0) <= (p.min_stock_level ?? 0)
    ).length

    // ── Kritik ürün listesi ───────────────────────────────────────────────────
    const criticalList = (criticalRaw ?? []).map(p => ({
        id:               p.id,
        sku:              p.sku,
        name:             p.name,
        quantity_on_hand: p.quantity_on_hand ?? 0,
        min_stock_level:  p.min_stock_level ?? 0,
        supplier:         (p.meta as any)?.source ?? null,
    }))

    // ── Tedarikçi istatistikleri ──────────────────────────────────────────────
    const supplierMap: Record<string, { active: number; draft: number }> = {}
    const KNOWN_SOURCES = ['ciftel_2026', 'oskar_2026', 'kaucuk_takoz_2026', 'falo_2026']

    for (const p of supplierRaw ?? []) {
        const meta = p.meta as any
        const source: string = KNOWN_SOURCES.includes(meta?.source) ? meta.source : 'emes'
        if (!supplierMap[source]) supplierMap[source] = { active: 0, draft: 0 }
        if (p.status === 'active') supplierMap[source].active++
        else if (p.status === 'draft') supplierMap[source].draft++
    }

    // Tedarikçi sırası
    const supplierOrder = ['emes', 'ciftel_2026', 'oskar_2026', 'kaucuk_takoz_2026', 'falo_2026']
    const supplierStats = supplierOrder
        .filter(s => supplierMap[s])
        .map(s => ({
            supplier: s,
            active:   supplierMap[s].active,
            draft:    supplierMap[s].draft,
            total:    supplierMap[s].active + supplierMap[s].draft,
        }))

    // ── Draft ürün listesi ───────────────────────────────────────────────────
    const draftList = (draftProducts ?? []).map(p => ({
        id:         p.id,
        sku:        p.sku,
        name:       p.name,
        sale_price: p.sale_price,
        supplier:   (p.meta as any)?.source ?? null,
        created_at: p.created_at,
    }))

    return (
        <div className="flex flex-col space-y-6">

            {/* Başlık */}
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Operasyonel Durum
                </h1>
                <p className="text-slate-500 mt-0.5 text-sm font-medium">
                    Anlık stok ve katalog görünümü · {new Date().toLocaleDateString('tr-TR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                </p>
            </div>

            {/* Kırmızı uyarı bandı — sadece kritik varsa görünür */}
            <AlertBand
                zeroStockCount={zeroStockCount}
                criticalStockCount={criticalStockCount}
            />

            {/* KPI Kartlar */}
            <OperationalKPIs
                totalProducts={totalProducts}
                inStockCount={inStockCount}
                zeroStockCount={zeroStockCount}
                criticalStockCount={criticalStockCount}
                draftCount={draftCount}
                activeCount={activeCount}
            />

            {/* Hızlı Stok Güncelleme Widget'ı */}
            <div className="pt-4">
                <StockUpdateWidget />
            </div>

            {/* Yeni Eklenecek: Low Stock ve Coverage Panelleri */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-2">
                {/* Sol Taraf (2 Kolon) - Düşük Stok */}
                <div className="xl:col-span-2">
                    <LowStockPanel />
                </div>
                
                {/* Sağ Taraf (1 Kolon) - Doluluk Oranları */}
                <div className="space-y-6">
                    <ImageCoverage />
                    <DescriptionCoverage />
                </div>
            </div>

        </div>
    )
}

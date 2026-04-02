import { createAdminClient } from "@/lib/supabase/admin"
import { AlertBand } from "@/components/dashboard/alert-band"
import { OperationalKPIs } from "@/components/dashboard/operational-kpis"
import { StockUpdateWidget } from "@/components/dashboard/stock-update-widget"
import { LowStockPanel } from "@/components/dashboard/low-stock-panel"
import { ImageCoverage } from "@/components/dashboard/image-coverage"
import { DescriptionCoverage } from "@/components/dashboard/description-coverage"
import { DraftApprovalQueue } from "@/components/dashboard/draft-approval-queue"
import { SupplierBreakdown } from "@/components/dashboard/supplier-breakdown"
import { DashboardCharts } from "@/components/dashboard/charts"
import { CriticalStockTable } from "@/components/dashboard/critical-stock-table"
import { ReorderPanel } from "@/components/dashboard/reorder-panel"

export const revalidate = 60

const SUPPLIER_LABELS: Record<string, string> = {
    emes_2026:         'EMES',
    emes_kulp_2026:    'EMES KULP',
    yedek_emes_2026:   'YDK EMES',
    zet_2026:          'ZET',
    ciftel_2026:       'ÇİFTEL',
    oskar_2026:        'OSKAR',
    kaucuk_takoz_2026: 'KAUÇUK',
    falo_2026:         'FALO',
    mertsan_2026:      'MERTSAN',
}

export default async function DashboardPage() {
    const supabase = createAdminClient()

    // ── 1. KPI sayımları — head:true, sıfır satır transfer edilir ────────────
    const [
        { count: totalProducts },
        { count: activeCount },
        { count: draftCount },
        { count: inStockCount },
        { count: zeroStockCount },
    ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'draft').is('deleted_at', null),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null).gt('quantity_on_hand', 0),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null).eq('quantity_on_hand', 0),
    ])

    // ── 2. Kritik stok listesi — sadece gerekli kolonlar, limit 200 ──────────
    const { data: criticalRaw } = await supabase
        .from('products')
        .select('id, sku, name, quantity_on_hand, min_stock_level, meta')
        .eq('status', 'active')
        .is('deleted_at', null)
        .gt('min_stock_level', 0)
        .order('quantity_on_hand', { ascending: true })
        .limit(200)

    const criticalProducts = (criticalRaw ?? [])
        .filter(p => (p.quantity_on_hand ?? 0) <= (p.min_stock_level ?? 0))
        .slice(0, 50)
        .map(p => ({
            id:               p.id,
            sku:              p.sku,
            name:             p.name,
            quantity_on_hand: p.quantity_on_hand ?? 0,
            min_stock_level:  p.min_stock_level ?? 0,
            supplier:         SUPPLIER_LABELS[(p.meta as Record<string, string>)?.source ?? ''] ?? null,
        }))

    const criticalStockCount = criticalProducts.length

    // ── 3. Draft onay kuyruğu — limit 30 ─────────────────────────────────────
    const { data: draftRaw } = await supabase
        .from('products')
        .select('id, sku, name, sale_price, meta, created_at')
        .eq('status', 'draft')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30)

    const draftQueue = (draftRaw ?? []).map(p => ({
        id:         p.id,
        sku:        p.sku,
        name:       p.name,
        sale_price: p.sale_price ?? null,
        supplier:   (p.meta as Record<string, string>)?.source ?? null,
        created_at: p.created_at ?? '',
    }))

    // ── 4. Tedarikçi breakdown — yalnızca meta + status (küçük payload) ──────
    const { data: supplierRaw } = await supabase
        .from('products')
        .select('meta, status')
        .is('deleted_at', null)
        .limit(20000)

    const supplierMap: Record<string, { active: number; draft: number; total: number }> = {}
    for (const p of supplierRaw ?? []) {
        const src = (p.meta as Record<string, string>)?.source ?? 'bilinmiyor'
        if (!supplierMap[src]) supplierMap[src] = { active: 0, draft: 0, total: 0 }
        supplierMap[src].total++
        if (p.status === 'active') supplierMap[src].active++
        if (p.status === 'draft')  supplierMap[src].draft++
    }
    const supplierStats = Object.entries(supplierMap)
        .map(([supplier, s]) => ({ supplier, ...s }))
        .sort((a, b) => b.total - a.total)

    // ── 5. Envanter değeri — yalnızca stoklu aktif ürünlerin 2 kolonu ────────
    const { data: inventoryRaw } = await supabase
        .from('products')
        .select('quantity_on_hand, cost_price')
        .eq('status', 'active')
        .is('deleted_at', null)
        .gt('quantity_on_hand', 0)
        .not('cost_price', 'is', null)
        .limit(20000)

    const inventoryValue = (inventoryRaw ?? [])
        .reduce((sum, p) => sum + (p.quantity_on_hand ?? 0) * Number(p.cost_price ?? 0), 0)

    // ── Grafik verisi ─────────────────────────────────────────────────────────
    const stockStats = [
        { name: 'Stokta Var', value: inStockCount   ?? 0, color: '#10b981' },
        { name: 'Stok Yok',   value: zeroStockCount ?? 0, color: '#ef4444' },
        { name: 'Taslak',     value: draftCount     ?? 0, color: '#f59e0b' },
    ]
    const supplierChartStats = supplierStats.slice(0, 9).map(s => ({
        name:   SUPPLIER_LABELS[s.supplier] ?? s.supplier.replace('_2026', '').toUpperCase(),
        active: s.active,
        draft:  s.draft,
    }))

    return (
        <div className="flex flex-col space-y-6">

            {/* Başlık */}
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Operasyonel Durum
                </h1>
                <p className="text-slate-500 mt-0.5 text-sm font-medium">
                    Anlık stok ve katalog görünümü ·{' '}
                    {new Date().toLocaleDateString('tr-TR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                </p>
            </div>

            {/* Uyarı bandı — sadece kritik durum varsa render edilir */}
            <AlertBand
                zeroStockCount={zeroStockCount ?? 0}
                criticalStockCount={criticalStockCount}
            />

            {/* KPI kartlar */}
            <OperationalKPIs
                totalProducts={totalProducts ?? 0}
                inStockCount={inStockCount ?? 0}
                zeroStockCount={zeroStockCount ?? 0}
                criticalStockCount={criticalStockCount}
                draftCount={draftCount ?? 0}
                activeCount={activeCount ?? 0}
                inventoryValue={inventoryValue}
            />

            {/* Grafikler */}
            <DashboardCharts
                stockStats={stockStats}
                supplierStats={supplierChartStats}
            />

            {/* Kritik stok tablosu */}
            {criticalProducts.length > 0 && (
                <CriticalStockTable products={criticalProducts} />
            )}

            {/* Hızlı stok güncelleme */}
            <StockUpdateWidget />

            {/* İki kolon: Ana içerik + Yan panel */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Sol — 2/3 genişlik */}
                <div className="xl:col-span-2 space-y-6">
                    <DraftApprovalQueue products={draftQueue} />
                    <ReorderPanel />
                    <LowStockPanel />
                </div>

                {/* Sağ — 1/3 genişlik */}
                <div className="space-y-6">
                    <SupplierBreakdown stats={supplierStats} />
                    <ImageCoverage />
                    <DescriptionCoverage />
                </div>

            </div>

        </div>
    )
}

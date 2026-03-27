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

export const revalidate = 0

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

    // ── Tek sorguda tüm ürünler ───────────────────────────────────────────────
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, sku, name, status, quantity_on_hand, min_stock_level, sale_price, meta')
        .is('deleted_at', null)

    const products = allProducts ?? []

    // ── KPI sayımları ─────────────────────────────────────────────────────────
    const totalProducts      = products.length
    const activeCount        = products.filter(p => p.status === 'active').length
    const draftCount         = products.filter(p => p.status === 'draft').length
    const inStockCount       = products.filter(p => p.status === 'active' && (p.quantity_on_hand ?? 0) > 0).length
    const zeroStockCount     = products.filter(p => p.status === 'active' && (p.quantity_on_hand ?? 0) === 0).length
    const criticalStockCount = products.filter(
        p => p.status === 'active' &&
             (p.quantity_on_hand ?? 0) > 0 &&
             (p.quantity_on_hand ?? 0) <= (p.min_stock_level ?? 0)
    ).length

    // ── Tedarikçi breakdown ───────────────────────────────────────────────────
    const supplierMap: Record<string, { active: number; draft: number; total: number }> = {}
    for (const p of products) {
        const src = (p.meta as Record<string, string>)?.source ?? 'bilinmiyor'
        if (!supplierMap[src]) supplierMap[src] = { active: 0, draft: 0, total: 0 }
        supplierMap[src].total++
        if (p.status === 'active') supplierMap[src].active++
        if (p.status === 'draft')  supplierMap[src].draft++
    }
    const supplierStats = Object.entries(supplierMap)
        .map(([supplier, s]) => ({ supplier, ...s }))
        .sort((a, b) => b.total - a.total)

    // ── Grafik verisi ─────────────────────────────────────────────────────────
    const stockStats = [
        { name: 'Stokta Var',  value: inStockCount,   color: '#10b981' },
        { name: 'Stok Yok',    value: zeroStockCount,  color: '#ef4444' },
        { name: 'Taslak',      value: draftCount,      color: '#f59e0b' },
    ]
    const supplierChartStats = supplierStats.slice(0, 9).map(s => ({
        name:   SUPPLIER_LABELS[s.supplier] ?? s.supplier.replace('_2026', '').toUpperCase(),
        active: s.active,
        draft:  s.draft,
    }))

    // ── Kritik stok listesi ───────────────────────────────────────────────────
    const criticalProducts = products
        .filter(p =>
            p.status === 'active' &&
            (p.quantity_on_hand ?? 0) <= (p.min_stock_level ?? 0) &&
            (p.min_stock_level ?? 0) > 0
        )
        .sort((a, b) => (a.quantity_on_hand ?? 0) - (b.quantity_on_hand ?? 0))
        .slice(0, 50)
        .map(p => ({
            id:               p.id,
            sku:              p.sku,
            name:             p.name,
            quantity_on_hand: p.quantity_on_hand ?? 0,
            min_stock_level:  p.min_stock_level ?? 0,
            supplier:         SUPPLIER_LABELS[(p.meta as Record<string, string>)?.source ?? ''] ?? null,
        }))

    // ── Envanter değeri (Sprint 3) ────────────────────────────────────────────
    const inventoryValue = products
        .filter(p => p.status === 'active' && (p.quantity_on_hand ?? 0) > 0)
        .reduce((sum, p) => sum + (p.quantity_on_hand ?? 0) * Number(p.sale_price ?? 0), 0)

    // ── Draft onay kuyruğu ────────────────────────────────────────────────────
    const draftQueue = products
        .filter(p => p.status === 'draft')
        .slice(0, 30)
        .map(p => ({
            id:         p.id,
            sku:        p.sku,
            name:       p.name,
            sale_price: p.sale_price ?? null,
            supplier:   (p.meta as Record<string, string>)?.source ?? null,
            created_at: '',
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
                zeroStockCount={zeroStockCount}
                criticalStockCount={criticalStockCount}
            />

            {/* KPI kartlar */}
            <OperationalKPIs
                totalProducts={totalProducts}
                inStockCount={inStockCount}
                zeroStockCount={zeroStockCount}
                criticalStockCount={criticalStockCount}
                draftCount={draftCount}
                activeCount={activeCount}
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

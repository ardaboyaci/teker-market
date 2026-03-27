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

export const revalidate = 0

export default async function DashboardPage() {
    const supabase = createAdminClient()

    // Genel sayımlar + tedarikçi bilgisi tek sorguda
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, status, quantity_on_hand, min_stock_level, meta, base_price, sale_price')
        .is('deleted_at', null)

    // Taslak onay kuyruğu (son 30)
    const { data: draftProducts } = await supabase
        .from('products')
        .select('id, sku, name, sale_price, meta')
        .eq('status', 'draft')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30)

    // Tedarikçi breakdown
    const { data: supplierData } = await supabase
        .from('products')
        .select('status, meta')
        .is('deleted_at', null)

    // ── Sayımlar ──────────────────────────────────────────────────────────────
    const products = allProducts ?? []
    const totalProducts      = products.length
    const activeCount        = products.filter(p => p.status === 'active').length
    const draftCount         = products.filter(p => p.status === 'draft').length
    const inStockCount       = products.filter(p => (p.quantity_on_hand ?? 0) > 0).length
    const zeroStockCount     = products.filter(
        p => p.status === 'active' && (p.quantity_on_hand ?? 0) === 0
    ).length
    const criticalStockCount = products.filter(
        p => p.status === 'active' &&
            (p.quantity_on_hand ?? 0) > 0 &&
            (p.quantity_on_hand ?? 0) <= (p.min_stock_level ?? 0)
    ).length

    // ── Tedarikçi breakdown ───────────────────────────────────────────────────
    const supplierMap: Record<string, { active: number; draft: number; total: number }> = {}
    for (const p of (supplierData ?? [])) {
        const src = (p.meta as Record<string, string>)?.source ?? 'bilinmiyor'
        if (!supplierMap[src]) supplierMap[src] = { active: 0, draft: 0, total: 0 }
        supplierMap[src].total++
        if (p.status === 'active') supplierMap[src].active++
        if (p.status === 'draft')  supplierMap[src].draft++
    }
    const supplierStats = Object.entries(supplierMap).map(([supplier, s]) => ({ supplier, ...s }))

    // ── Grafik verisi — kategori bazlı stok istatistikleri ───────────────────
    const { data: categoryStats } = await supabase
        .rpc('get_category_stock_stats')
        .limit(20)

    // ── Draft queue prop ──────────────────────────────────────────────────────
    const draftQueue = (draftProducts ?? []).map(p => ({
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
                    Anlık stok ve katalog görünümü · {new Date().toLocaleDateString('tr-TR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                </p>
            </div>

            {/* Uyarı bandı */}
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

            {/* Grafikler — kategori bazlı stok dağılımı */}
            {categoryStats && categoryStats.length > 0 && (
                <DashboardCharts data={categoryStats} />
            )}

            {/* Hızlı Stok Güncelleme Widget */}
            <div className="pt-2">
                <StockUpdateWidget />
            </div>

            {/* Ana içerik: Taslak kuyruğu + Düşük stok */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <DraftApprovalQueue products={draftQueue} />
                    <LowStockPanel />
                </div>
                <div className="space-y-6">
                    <SupplierBreakdown stats={supplierStats} />
                    <ImageCoverage />
                    <DescriptionCoverage />
                </div>
            </div>

        </div>
    )
}

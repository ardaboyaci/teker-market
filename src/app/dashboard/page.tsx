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

    // Genel sayımlar için tek sorgu
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, status, quantity_on_hand, min_stock_level')
        .is('deleted_at', null)

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

            {/* Hızlı Stok Güncelleme Widget */}
            <div className="pt-4">
                <StockUpdateWidget />
            </div>

            {/* Düşük Stok + Doluluk Panelleri */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-2">
                <div className="xl:col-span-2">
                    <LowStockPanel />
                </div>
                <div className="space-y-6">
                    <ImageCoverage />
                    <DescriptionCoverage />
                </div>
            </div>

        </div>
    )
}

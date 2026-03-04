import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, TrendingUp, AlertTriangle, Box } from "lucide-react"
import { DashboardCharts } from "@/components/dashboard/charts"
import { formatCurrency } from "@/lib/utils/currency"

export const revalidate = 0 // Her zaman güncel kalsın

export default async function DashboardPage() {
    const supabase = createAdminClient()

    // Kategorik Stok Özeti View'ı
    const { data: categoryStats } = await supabase
        .from('mv_category_stock_summary')
        .select('*')

    // Eksik Bilgili Ürünler View'ı (Sadece sayı için)
    const { count: incompleteCount } = await supabase
        .from('mv_incomplete_products')
        .select('*', { count: 'exact', head: true })

    // Agregasyonlar
    let totalProducts = 0
    let totalActive = 0
    let totalStock = 0
    let totalStockValue = 0

    categoryStats?.forEach((cat) => {
        totalProducts += cat.product_count || 0
        totalActive += cat.active_count || 0
        totalStock += cat.total_stock || 0
        totalStockValue += Number(cat.total_stock_value || 0)
    })

    const totalDraft = totalProducts - totalActive

    return (
        <div className="flex flex-col space-y-8">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
                <p className="text-slate-500 mt-1 font-medium">
                    Katalog ve stok durumunuzun genel özetine hoş geldiniz.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm border-slate-200/60 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Package className="w-16 h-16" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                            Toplam Ürün
                        </CardTitle>
                        <Package className="h-5 w-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{totalProducts}</div>
                        <p className="text-sm text-slate-500 mt-1 font-medium">
                            <span className="text-green-600 font-semibold">{totalActive}</span> Yayında, <span className="text-yellow-600 font-semibold">{totalDraft}</span> Taslak
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200/60 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp className="w-16 h-16" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                            Toplam Stok Değeri
                        </CardTitle>
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{formatCurrency(totalStockValue)}</div>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Tahmini satış potansiyeli</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200/60 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Box className="w-16 h-16" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                            Fiziksel Stok
                        </CardTitle>
                        <Box className="h-5 w-5 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{totalStock} <span className="text-lg font-normal text-slate-500">adet</span></div>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Depodaki toplam tekerlek</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200/60 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <AlertTriangle className="w-16 h-16" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                            Data Alert
                        </CardTitle>
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{incompleteCount}</div>
                        <p className="text-sm text-amber-600 mt-1 font-semibold">
                            Eksik bilgili ürün (Fiyat, Resim vb)
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <DashboardCharts data={categoryStats || []} />
        </div>
    )
}

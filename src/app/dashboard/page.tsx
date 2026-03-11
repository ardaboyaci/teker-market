import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, AlertTriangle, Layers, ImageOff, Tag, ArrowRight } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"
import Link from "next/link"

export const revalidate = 0

export default async function DashboardPage() {
    const supabase = createAdminClient()

    // 1. KPI: Kategori özeti
    const { data: categoryStats } = await supabase
        .from('mv_category_stock_summary')
        .select('product_count, active_count, total_stock, total_stock_value')

    let totalProducts = 0
    let totalActive = 0
    let totalStock = 0
    let totalStockValue = 0

    categoryStats?.forEach((cat) => {
        totalProducts += cat.product_count || 0
        totalActive   += cat.active_count  || 0
        totalStock    += cat.total_stock   || 0
        totalStockValue += Number(cat.total_stock_value || 0)
    })

    // 2. Kritik stok: quantity_on_hand < 10, aktif ürünler
    const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, sku, name, quantity_on_hand, cost_price, sale_price')
        .is('deleted_at', null)
        .eq('status', 'active')
        .lt('quantity_on_hand', 10)
        .order('quantity_on_hand', { ascending: true })
        .limit(20)

    // 3. Data Health — her eksiklik tipi ayrı sayılıyor
    const [
        { count: missingPriceCount },
        { count: missingImageCount },
        { count: missingDescCount },
    ] = await Promise.all([
        supabase.from('mv_incomplete_products').select('*', { count: 'exact', head: true }).eq('missing_price', true),
        supabase.from('mv_incomplete_products').select('*', { count: 'exact', head: true }).eq('missing_image', true),
        supabase.from('mv_incomplete_products').select('*', { count: 'exact', head: true }).eq('missing_description', true),
    ])

    return (
        <div className="flex flex-col space-y-8 max-w-7xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Operasyon Merkezi</h1>
                <p className="text-slate-500 mt-1 text-sm">Stok durumu, veri kalitesi ve anlık envanter özeti.</p>
            </div>

            {/* ── KPI Kartları ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Toplam Aktif Ürün</CardTitle>
                        <Package className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{totalActive.toLocaleString('tr-TR')}</div>
                        <p className="text-xs text-slate-400 mt-1">{totalProducts.toLocaleString('tr-TR')} toplam kayıt</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Kritik Stok</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">
                            {(lowStockProducts?.length ?? 0).toLocaleString('tr-TR')}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Stoku 10 adedin altında aktif ürün</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm sm:col-span-2 lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Toplam Stok Değeri</CardTitle>
                        <Layers className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{formatCurrency(totalStockValue)}</div>
                        <p className="text-xs text-slate-400 mt-1">{totalStock.toLocaleString('tr-TR')} adet, satış fiyatı bazlı</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Kritik Stok Tablosu ── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Kritik Stok Uyarıları</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Stoku 10 adedin altına düşmüş aktif ürünler</p>
                    </div>
                    <Link
                        href="/dashboard/products"
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        Tüm ürünler <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {!lowStockProducts || lowStockProducts.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 text-sm">
                            Tüm ürünlerin stoğu yeterli seviyede.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ürün Adı</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Mevcut Stok</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Alış</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Satış</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksiyon</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {lowStockProducts.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{p.sku}</td>
                                            <td className="px-4 py-3 text-slate-800 font-medium max-w-[240px] truncate">{p.name}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold
                                                    ${p.quantity_on_hand === 0
                                                        ? 'bg-red-100 text-red-700'
                                                        : p.quantity_on_hand <= 3
                                                        ? 'bg-orange-100 text-orange-700'
                                                        : 'bg-yellow-50 text-yellow-700'
                                                    }`}>
                                                    {p.quantity_on_hand} adet
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                                                {p.cost_price ? formatCurrency(Number(p.cost_price)) : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                                                {p.sale_price ? formatCurrency(Number(p.sale_price)) : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href="/dashboard/products"
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap"
                                                >
                                                    Stok Ekle
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Data Health ── */}
            <div>
                <div className="mb-3">
                    <h2 className="text-base font-semibold text-slate-900">Veri Kalitesi (Data Health)</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Eksik bilgilere tıklayarak ürünler sayfasına gidin ve tamamlayın.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Link href="/dashboard/products" className="group">
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 hover:border-amber-300 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 bg-amber-50 rounded-lg">
                                    <Tag className="w-4 h-4 text-amber-600" />
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors mt-1" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mb-1">
                                {(missingPriceCount ?? 0).toLocaleString('tr-TR')}
                            </div>
                            <div className="text-sm font-medium text-slate-700">Fiyat Eksik</div>
                            <div className="text-xs text-slate-400 mt-0.5">Satış fiyatı girilmemiş ürünler</div>
                        </div>
                    </Link>

                    <Link href="/dashboard/products" className="group">
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <ImageOff className="w-4 h-4 text-blue-600" />
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors mt-1" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mb-1">
                                {(missingImageCount ?? 0).toLocaleString('tr-TR')}
                            </div>
                            <div className="text-sm font-medium text-slate-700">Fotoğraf Eksik</div>
                            <div className="text-xs text-slate-400 mt-0.5">Görseli yüklenmemiş ürünler</div>
                        </div>
                    </Link>

                    <Link href="/dashboard/products" className="group">
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 hover:border-purple-300 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <Package className="w-4 h-4 text-purple-600" />
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors mt-1" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mb-1">
                                {(missingDescCount ?? 0).toLocaleString('tr-TR')}
                            </div>
                            <div className="text-sm font-medium text-slate-700">Açıklama Eksik</div>
                            <div className="text-xs text-slate-400 mt-0.5">SEO açıklaması yazılmamış ürünler</div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    )
}

import { createAdminClient } from "@/lib/supabase/admin"
import { AlertTriangle } from "lucide-react"

export async function LowStockPanel() {
    const supabase = createAdminClient()

    // Supabase kolon-kolon karşılaştırmasını desteklemez,
    // önce min_stock_level > 0 olanları çek, JS tarafında filtrele
    const { data: rawProducts, error } = await supabase
        .from('products')
        .select('id, sku, name, quantity_on_hand, min_stock_level, meta')
        .eq('status', 'active')
        .is('deleted_at', null)
        .gt('min_stock_level', 0)
        .order('quantity_on_hand', { ascending: true })
        .limit(500)

    if (error) {
        console.error("Error fetching low stock:", error)
        return null
    }

    // JS tarafında: quantity_on_hand < min_stock_level
    const products = (rawProducts ?? [])
        .filter(p => (p.quantity_on_hand ?? 0) < (p.min_stock_level ?? 0))
        .slice(0, 50)

    if (products.length === 0) {
        return (
            <div className="w-full p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-slate-500 font-medium">Tüm stoklar yeterli seviyede.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-slate-800">
                    Düşük Stok — <span className="text-amber-600">{products.length} ürün</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map(p => {
                    const isZero = (p.quantity_on_hand ?? 0) === 0
                    const bgColor = isZero ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                    const titleColor = isZero ? 'text-red-900' : 'text-amber-900'
                    const badgeBg = isZero ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    const supplier = (p.meta as any)?.source || 'Bilinmiyor'
                    const deficit = (p.min_stock_level ?? 0) - (p.quantity_on_hand ?? 0)

                    return (
                        <div key={p.id} className={`p-4 rounded-xl border ${bgColor} flex flex-col gap-3 shadow-sm`}>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    {p.sku} • {supplier.replace('_2026', '').toUpperCase()}
                                </span>
                                <h3 className={`text-sm font-semibold leading-tight line-clamp-2 ${titleColor}`}>
                                    {p.name}
                                </h3>
                            </div>

                            <div className="flex w-full items-center justify-between bg-white/60 p-2 rounded-lg gap-2">
                                <div className="flex flex-col items-center flex-1">
                                    <span className="text-[10px] text-slate-500 font-medium">Mevcut</span>
                                    <span className={`text-lg font-black ${badgeBg} px-2 py-0.5 rounded-md mt-0.5`}>
                                        {p.quantity_on_hand ?? 0}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center flex-1">
                                    <span className="text-[10px] text-slate-500 font-medium">Minimum</span>
                                    <span className="text-lg font-bold text-slate-700 px-2 py-0.5 mt-0.5">
                                        {p.min_stock_level ?? 0}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center flex-1">
                                    <span className="text-[10px] text-slate-500 font-medium">Eksik</span>
                                    <span className="text-lg font-bold text-red-600 px-2 py-0.5 mt-0.5">
                                        {deficit}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="w-full mt-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold py-2 border border-slate-200 rounded-lg shadow-sm transition-colors"
                                data-quick-stock-sku={p.sku}
                                data-quick-stock-name={p.name}
                                data-quick-stock-qty={p.quantity_on_hand ?? 0}
                            >
                                Hızlı Stok Gir
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

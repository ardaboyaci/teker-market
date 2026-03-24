import { createAdminClient } from "@/lib/supabase/admin"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

export async function LowStockPanel() {
    const supabase = createAdminClient()

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

    const products = (rawProducts ?? [])
        .filter(p => (p.quantity_on_hand ?? 0) < (p.min_stock_level ?? 0))
        .slice(0, 50)

    if (products.length === 0) {
        return (
            <div className="w-full p-8 text-center bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-slate-500 font-medium text-sm">Tüm stoklar yeterli seviyede.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-800">
                    Düşük Stok — <span className="text-amber-600">{products.length} ürün</span>
                </h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Tablo başlığı */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-2">Tedarikçi</div>
                    <div className="col-span-4">SKU / Ürün</div>
                    <div className="col-span-2 text-center">Mevcut</div>
                    <div className="col-span-2 text-center">Min.</div>
                    <div className="col-span-2 text-center">Eksik</div>
                </div>

                <div className="divide-y divide-slate-100">
                    {products.map(p => {
                        const isZero = (p.quantity_on_hand ?? 0) === 0
                        const deficit = (p.min_stock_level ?? 0) - (p.quantity_on_hand ?? 0)
                        const supplier = String((p.meta as Record<string,unknown>)?.source ?? '—')
                            .replace('_2026', '').toUpperCase()

                        return (
                            <div
                                key={p.id}
                                className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50 transition-colors ${isZero ? 'bg-red-50/40' : ''}`}
                            >
                                <div className="col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {supplier}
                                    </span>
                                </div>
                                <div className="col-span-4 min-w-0">
                                    <div className="text-[10px] font-mono text-slate-400">{p.sku}</div>
                                    <div className="text-xs font-semibold text-slate-700 truncate">{p.name}</div>
                                </div>
                                <div className="col-span-2 text-center">
                                    <span className={`text-sm font-black ${isZero ? 'text-red-600' : 'text-amber-600'}`}>
                                        {p.quantity_on_hand ?? 0}
                                    </span>
                                </div>
                                <div className="col-span-2 text-center">
                                    <span className="text-sm text-slate-500">{p.min_stock_level ?? 0}</span>
                                </div>
                                <div className="col-span-2 text-center">
                                    <span className="text-sm font-bold text-red-500">-{deficit}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

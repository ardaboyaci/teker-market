import { createAdminClient } from "@/lib/supabase/admin"
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export async function LowStockPanel() {
    const supabase = createAdminClient()

    const { data: rawProducts } = await supabase
        .from('products')
        .select('id, sku, name, quantity_on_hand, min_stock_level, meta')
        .eq('status', 'active')
        .is('deleted_at', null)
        .gt('min_stock_level', 0)
        .order('quantity_on_hand', { ascending: true })
        .limit(5)

    const products = (rawProducts ?? []).filter(
        p => (p.quantity_on_hand ?? 0) <= (p.min_stock_level ?? 0)
    )

    if (products.length === 0) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Kritik stok seviyesinde ürün yok.</span>
            </div>
        )
    }

    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200 dark:border-amber-900">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Kritik Stok — Hızlı Bakış
                    </span>
                    <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full px-2 py-0.5 font-bold">
                        {products.length}
                    </span>
                </div>
                <Link
                    href="#reorder-panel"
                    className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium"
                >
                    Sipariş Planla <ArrowRight className="w-3 h-3" />
                </Link>
            </div>

            {/* Ürün listesi */}
            <ul className="divide-y divide-amber-100 dark:divide-amber-900/50">
                {products.map(p => {
                    const qty = p.quantity_on_hand ?? 0
                    const min = p.min_stock_level ?? 0
                    const pct = min > 0 ? Math.round((qty / min) * 100) : 0
                    const supplier = (p.meta as Record<string, string>)?.source ?? ''

                    return (
                        <li key={p.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{p.sku}{supplier ? ` · ${supplier}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{qty}</span>
                                    <span className="text-xs text-slate-400"> / {min}</span>
                                </div>
                                <div className="w-16 h-1.5 rounded-full bg-amber-200 dark:bg-amber-900 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-red-500"
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

import { CheckCircle2, XCircle } from "lucide-react"

export function StockBadge({ quantity }: { quantity: number | null }) {
    const qty = quantity ?? 0
    const inStock = qty > 0

    if (inStock) {
        return (
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Stokta</span>
                {qty <= 10 && (
                    <span className="text-[10px] text-emerald-500">
                        (Son {qty} adet)
                    </span>
                )}
            </div>
        )
    }

    return (
        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-3 py-1">
            <XCircle className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Sipariş Üzerine</span>
        </div>
    )
}

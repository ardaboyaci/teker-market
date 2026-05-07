"use client"

import * as React from "react"
import { History, TrendingUp, TrendingDown, Loader2, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"

interface Movement {
    id: string
    movement_type: string
    quantity: number
    quantity_before: number
    quantity_after: number
    reference_type: string | null
    reference_note: string | null
    created_at: string
}

interface Props {
    productId: string
    productName: string
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    in:         { label: 'Giriş',    color: 'text-emerald-600 bg-emerald-50' },
    out:        { label: 'Çıkış',    color: 'text-rose-600 bg-rose-50' },
    adjustment: { label: 'Düzeltme', color: 'text-blue-600 bg-blue-50' },
    transfer:   { label: 'Transfer', color: 'text-purple-600 bg-purple-50' },
    return:     { label: 'İade',     color: 'text-amber-600 bg-amber-50' },
}

const REF_LABELS: Record<string, string> = {
    manual:         'Manuel',
    import:         'Import',
    sale:           'Satış',
    purchase_order: 'Sipariş',
    bulk_update:    'Toplu güncelleme',
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (days > 0)  return `${days} gün önce`
    if (hours > 0) return `${hours} saat önce`
    if (mins > 0)  return `${mins} dk önce`
    return 'Az önce'
}

export function StockMovementHistory({ productId, productName }: Props) {
    const [limit, setLimit] = React.useState(10)

    const { data: movements, isLoading } = useQuery({
        queryKey: ['stock-movements', productId, limit],
        queryFn: async () => {
            const res = await fetch(`/api/stock-movements?product_id=${productId}&limit=${limit}`)
            if (!res.ok) throw new Error('Hareketler alınamadı.')
            const json = await res.json()
            return (json.movements ?? []) as Movement[]
        },
        enabled: !!productId,
    })

    return (
        <Card className="shadow-sm border-slate-200/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-500" />
                    <CardTitle className="text-sm font-bold text-slate-800">Hareket Geçmişi</CardTitle>
                </div>
                <span className="text-xs text-slate-400 font-medium">{productName}</span>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                    </div>
                ) : !movements || movements.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <History className="w-8 h-8 text-slate-200" />
                        <p className="text-sm font-semibold text-slate-400">Hareket kaydı yok</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <div className="col-span-2">Tip</div>
                            <div className="col-span-2 text-center">Miktar</div>
                            <div className="col-span-3 text-center">Önce → Sonra</div>
                            <div className="col-span-3">Kaynak</div>
                            <div className="col-span-2 text-right">Zaman</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {movements.map(m => {
                                const typeInfo = TYPE_LABELS[m.movement_type] ?? { label: m.movement_type, color: 'text-slate-600 bg-slate-50' }
                                const isPositive = m.quantity > 0
                                return (
                                    <div key={m.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50 transition-colors">
                                        <div className="col-span-2">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${typeInfo.color}`}>{typeInfo.label}</span>
                                        </div>
                                        <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                            {isPositive ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                                            <span className={`text-sm font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>{isPositive ? '+' : ''}{m.quantity}</span>
                                        </div>
                                        <div className="col-span-3 text-center">
                                            <span className="text-xs text-slate-400">{m.quantity_before}</span>
                                            <span className="text-xs text-slate-300 mx-1">→</span>
                                            <span className="text-xs font-semibold text-slate-700">{m.quantity_after}</span>
                                        </div>
                                        <div className="col-span-3">
                                            <span className="text-xs text-slate-500">{REF_LABELS[m.reference_type ?? ''] ?? m.reference_type ?? '—'}</span>
                                            {m.reference_note && <p className="text-[10px] text-slate-400 truncate" title={m.reference_note}>{m.reference_note}</p>}
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <span className="text-[10px] text-slate-400">{timeAgo(m.created_at)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {movements.length >= limit && (
                            <div className="px-4 py-3 border-t border-slate-100 text-center">
                                <button onClick={() => setLimit(l => l + 20)} className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold flex items-center gap-1 mx-auto">
                                    <ChevronDown className="w-3 h-3" /> Daha Fazla Göster
                                </button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
"use client"

import * as React from "react"
import { Clock, CheckCircle2, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"

interface DraftProduct {
    id: string
    sku: string
    name: string
    sale_price: string | null
    supplier: string | null
    created_at: string
}

const SUPPLIER_LABELS: Record<string, string> = {
    ciftel_2026:       'ÇİFTEL',
    oskar_2026:        'OSKAR',
    kaucuk_takoz_2026: 'KAUÇUK',
    falo_2026:         'FALO',
}

export function DraftApprovalQueue({ products }: { products: DraftProduct[] }) {
    const queryClient = useQueryClient()
    const [selected, setSelected] = React.useState<Set<string>>(new Set())
    const [publishing, setPublishing] = React.useState(false)

    const toggleAll = () => {
        if (selected.size === products.length) setSelected(new Set())
        else setSelected(new Set(products.map(p => p.id)))
    }

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) { next.delete(id) } else { next.add(id) }
            return next
        })
    }

    const handlePublish = async () => {
        if (selected.size === 0) return
        setPublishing(true)
        const ids = [...selected]

        const toPublish = products
            .filter(p => selected.has(p.id) && p.sale_price && Number(p.sale_price) > 0)
            .map(p => p.id)

        for (const id of toPublish) {
            await fetch(`/api/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active' }),
            })
        }

        setSelected(new Set())
        setPublishing(false)
        queryClient.invalidateQueries({ queryKey: ['dashboard-draft'] })

        const skipped = ids.length - toPublish.length
        if (skipped > 0) {
            alert(`${toPublish.length} ürün yayınlandı. ${skipped} ürün fiyatsız olduğu için atlandı.`)
        }
    }

    if (products.length === 0) {
        return (
            <Card className="shadow-sm border-slate-200/60">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Onay bekleyen ürün yok</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm border-slate-200/60">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <CardTitle className="text-sm font-bold text-slate-800">
                        Taslak Onay Kuyruğu
                        <span className="ml-2 text-xs font-normal text-slate-400">(son 30 eklenen)</span>
                    </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                    {selected.size > 0 && (
                        <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handlePublish}
                            disabled={publishing}
                        >
                            <CheckCircle2 className="w-3 h-3" />
                            {publishing ? 'Yayınlanıyor...' : `${selected.size} Ürünü Yayınla`}
                        </Button>
                    )}
                    <a href="/dashboard/products?status=draft" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                        Tümünü Gör <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="py-2.5 px-4 w-8">
                                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300"
                                        checked={selected.size === products.length && products.length > 0}
                                        onChange={toggleAll} />
                                </th>
                                <th className="text-left py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">SKU</th>
                                <th className="text-left py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ürün Adı</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tedarikçi</th>
                                <th className="text-right py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fiyat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(p => {
                                const hasPrice = p.sale_price && Number(p.sale_price) > 0
                                return (
                                    <tr key={p.id}
                                        className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${selected.has(p.id) ? 'bg-primary/5' : 'hover:bg-slate-50/50'}`}
                                        onClick={() => toggle(p.id)}
                                    >
                                        <td className="py-2.5 px-4">
                                            <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 pointer-events-none"
                                                checked={selected.has(p.id)} readOnly />
                                        </td>
                                        <td className="py-2.5 px-4"><span className="font-mono text-xs font-bold text-slate-600">{p.sku}</span></td>
                                        <td className="py-2.5 px-4"><span className="text-xs text-slate-700 line-clamp-1 max-w-[260px] block">{p.name}</span></td>
                                        <td className="py-2.5 px-4 text-center">
                                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                {SUPPLIER_LABELS[p.supplier ?? ''] ?? (p.supplier ? 'EMES' : '—')}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            {hasPrice ? (
                                                <span className="text-xs font-bold text-slate-800">
                                                    ₺{Number(p.sale_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded">Fiyat Yok</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
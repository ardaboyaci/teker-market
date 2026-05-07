"use client"

import * as React from "react"
import { AlertTriangle, Download, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"

interface CriticalProduct {
    id: string
    sku: string
    name: string
    quantity_on_hand: number
    min_stock_level: number
    supplier: string | null
}

interface CriticalStockTableProps {
    products: CriticalProduct[]
}

export function CriticalStockTable({ products }: CriticalStockTableProps) {
    const queryClient = useQueryClient()
    const [updating, setUpdating] = React.useState<string | null>(null)
    const [localQty, setLocalQty] = React.useState<Record<string, string>>({})

    const handleExportCSV = () => {
        const header = "SKU;Ürün Adı;Mevcut Stok;Min Stok;Gereken;Tedarikçi"
        const rows = products.map(p => {
            const gereken = Math.max(0, p.min_stock_level - p.quantity_on_hand)
            return `${p.sku};"${p.name}";${p.quantity_on_hand};${p.min_stock_level};${gereken};${p.supplier ?? '-'}`
        })
        const csv = [header, ...rows].join('\n')
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `kritik-stok-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleUpdateQty = async (id: string, newQty: number) => {
        setUpdating(id)
        const product = products.find(p => p.id === id)
        const oldQty = product?.quantity_on_hand ?? 0

        await fetch(`/api/products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity_on_hand: newQty }),
        })

        const qty = newQty - oldQty
        await fetch('/api/stock-movements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id:      id,
                movement_type:   qty > 0 ? 'in' : qty < 0 ? 'out' : 'adjustment',
                quantity:        qty,
                quantity_before: oldQty,
                quantity_after:  newQty,
                reference_type:  'manual',
                reference_note:  'Kritik stok tablosundan güncelleme',
            }),
        })

        queryClient.invalidateQueries({ queryKey: ['dashboard-critical'] })
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
        setUpdating(null)
    }

    if (products.length === 0) {
        return (
            <Card className="shadow-sm border-slate-200/60">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                        <AlertTriangle className="w-6 h-6 text-emerald-500" />
                    </div>
                    <p className="font-semibold text-slate-700 text-sm">Tüm stoklar normal seviyede</p>
                    <p className="text-xs text-slate-400 mt-1">Kritik ürün bulunmuyor</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm border-red-100">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <CardTitle className="text-sm font-bold text-slate-800">
                        Kritik Stok Listesi
                        <span className="ml-2 font-normal text-red-500 text-xs">({products.length} ürün)</span>
                    </CardTitle>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-slate-200" onClick={handleExportCSV}>
                    <Download className="w-3 h-3" /> Sipariş Listesi İndir
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">SKU</th>
                                <th className="text-left py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ürün Adı</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stok</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Min</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tedarikçi</th>
                                <th className="text-center py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Güncelle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => {
                                const isZero = p.quantity_on_hand === 0
                                return (
                                    <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${isZero ? 'bg-red-50/40' : 'hover:bg-slate-50/50'}`}>
                                        <td className="py-1.5 px-4"><span className="font-mono text-xs font-bold text-slate-600">{p.sku}</span></td>
                                        <td className="py-1.5 px-4"><span className="text-sm text-slate-700 line-clamp-1 max-w-[280px] block">{p.name}</span></td>
                                        <td className="py-2.5 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-extrabold ${isZero ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {p.quantity_on_hand}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-4 text-center"><span className="text-xs text-slate-500">{p.min_stock_level}</span></td>
                                        <td className="py-2.5 px-4 text-center">
                                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                                {p.supplier ?? '—'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="w-16 text-center text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-primary"
                                                    placeholder="Adet"
                                                    value={localQty[p.id] ?? ''}
                                                    onChange={e => setLocalQty(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && localQty[p.id]) {
                                                            handleUpdateQty(p.id, parseInt(localQty[p.id]))
                                                        }
                                                    }}
                                                />
                                                <button
                                                    disabled={!localQty[p.id] || updating === p.id}
                                                    onClick={() => localQty[p.id] && handleUpdateQty(p.id, parseInt(localQty[p.id]))}
                                                    className="p-1 rounded hover:bg-primary/10 disabled:opacity-30 transition-colors"
                                                    title="Kaydet (Enter)"
                                                >
                                                    <RefreshCw className={`w-3.5 h-3.5 text-primary ${updating === p.id ? 'animate-spin' : ''}`} />
                                                </button>
                                            </div>
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
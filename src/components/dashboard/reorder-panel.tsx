/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { ShoppingCart, Download, ChevronDown, ChevronRight, Package, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"

interface LowStockProduct {
    id: string
    sku: string
    name: string
    quantity_on_hand: number
    min_stock_level: number
    supplier: string
}

const SUPPLIER_LABELS: Record<string, string> = {
    emes_2026:         'EMES',
    emes_kulp_2026:    'EMES KULP',
    yedek_emes_2026:   'YEDEK EMES',
    zet_2026:          'ZET',
    ciftel_2026:       'ÇİFTEL',
    oskar_2026:        'OSKAR',
    kaucuk_takoz_2026: 'KAUÇUK TAKOZ',
    falo_2026:         'FALO',
    mertsan_2026:      'MERTSAN',
}

export function ReorderPanel() {
    const supabase = createBrowserClient()
    const [openSuppliers, setOpenSuppliers] = React.useState<Set<string>>(new Set())

    const { data: products, isLoading } = useQuery({
        queryKey: ['reorder-products'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name, quantity_on_hand, min_stock_level, meta')
                .eq('status', 'active')
                .is('deleted_at', null)
                .gt('min_stock_level', 0)
                .order('quantity_on_hand', { ascending: true })
            if (error) throw error

            return (data ?? [])
                .filter(p => (p.quantity_on_hand ?? 0) <= (p.min_stock_level ?? 0))
                .map(p => ({
                    id:               p.id,
                    sku:              p.sku,
                    name:             p.name,
                    quantity_on_hand: p.quantity_on_hand ?? 0,
                    min_stock_level:  p.min_stock_level ?? 0,
                    supplier:         (p.meta as any)?.source ?? 'bilinmiyor',
                })) as LowStockProduct[]
        },
        staleTime: 60_000,
    })

    // Tedarikçiye göre grupla
    const grouped = React.useMemo(() => {
        if (!products) return {}
        return products.reduce<Record<string, LowStockProduct[]>>((acc, p) => {
            const key = p.supplier
            if (!acc[key]) acc[key] = []
            acc[key].push(p)
            return acc
        }, {})
    }, [products])

    const supplierKeys = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length)
    const totalProducts = products?.length ?? 0
    const totalDeficit  = products?.reduce((s, p) => s + Math.max(0, p.min_stock_level - p.quantity_on_hand), 0) ?? 0

    const toggleSupplier = (key: string) => {
        setOpenSuppliers(prev => {
            const next = new Set(prev)
            next.has(key) ? next.delete(key) : next.add(key)
            return next
        })
    }

    const exportToExcel = () => {
        if (!products || products.length === 0) return
        const rows = products.map(p => ({
            'Tedarikçi':        SUPPLIER_LABELS[p.supplier] ?? p.supplier,
            'SKU':              p.sku,
            'Ürün Adı':         p.name,
            'Mevcut Stok':      p.quantity_on_hand,
            'Min Stok':         p.min_stock_level,
            'Sipariş Edilmeli': Math.max(0, p.min_stock_level - p.quantity_on_hand),
        }))

        // Basit CSV export (xlsx bağımlılığı olmadan)
        const header  = Object.keys(rows[0]).join(';')
        const csvRows = rows.map(r => Object.values(r).join(';'))
        const csv     = [header, ...csvRows].join('\n')
        const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const url     = URL.createObjectURL(blob)
        const a       = document.createElement('a')
        a.href        = url
        a.download    = `yeniden-siparis-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <Card className="shadow-sm border-slate-200/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-500" />
                    <CardTitle className="text-sm font-bold text-slate-800">Yeniden Sipariş Önerileri</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                    {totalProducts > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                            {totalProducts} ürün · {totalDeficit} adet eksik
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={exportToExcel}
                        disabled={!products || products.length === 0}
                        className="h-7 text-xs gap-1 border-slate-200"
                    >
                        <Download className="w-3 h-3" /> CSV İndir
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                    </div>
                ) : supplierKeys.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                        <Package className="w-10 h-10 text-slate-200" />
                        <p className="text-sm font-semibold text-slate-500">Sipariş gerektirecek ürün yok</p>
                        <p className="text-xs text-slate-400">Tüm stoklar minimum seviyenin üzerinde</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {supplierKeys.map(key => {
                            const items   = grouped[key]
                            const deficit = items.reduce((s, p) => s + Math.max(0, p.min_stock_level - p.quantity_on_hand), 0)
                            const isOpen  = openSuppliers.has(key)
                            return (
                                <div key={key}>
                                    {/* Tedarikçi başlık satırı */}
                                    <button
                                        onClick={() => toggleSupplier(key)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            {isOpen
                                                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                                : <ChevronRight className="w-4 h-4 text-slate-400" />
                                            }
                                            <span className="text-sm font-bold text-slate-800">
                                                {SUPPLIER_LABELS[key] ?? key.replace('_2026', '').toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="text-slate-500">{items.length} ürün</span>
                                            <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                                                {deficit} adet sipariş
                                            </span>
                                        </div>
                                    </button>

                                    {/* Ürün listesi */}
                                    {isOpen && (
                                        <div className="bg-slate-50/50 border-t border-slate-100">
                                            {/* Alt tablo header */}
                                            <div className="grid grid-cols-12 gap-2 px-8 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                <div className="col-span-4">SKU</div>
                                                <div className="col-span-4 truncate">Ürün</div>
                                                <div className="col-span-2 text-center">Mevcut</div>
                                                <div className="col-span-2 text-right">Sipariş</div>
                                            </div>
                                            {items.map(p => {
                                                const needed = Math.max(0, p.min_stock_level - p.quantity_on_hand)
                                                return (
                                                    <div key={p.id} className="grid grid-cols-12 gap-2 px-8 py-2 items-center border-t border-slate-100 hover:bg-white transition-colors">
                                                        <div className="col-span-4">
                                                            <span className="text-xs font-mono font-semibold text-slate-700">{p.sku}</span>
                                                        </div>
                                                        <div className="col-span-4">
                                                            <span className="text-xs text-slate-600 line-clamp-1" title={p.name}>{p.name}</span>
                                                        </div>
                                                        <div className="col-span-2 text-center">
                                                            <span className={`text-xs font-bold ${p.quantity_on_hand === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                                                {p.quantity_on_hand}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">/{p.min_stock_level}</span>
                                                        </div>
                                                        <div className="col-span-2 text-right">
                                                            <span className="text-xs font-bold text-slate-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                                                +{needed}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

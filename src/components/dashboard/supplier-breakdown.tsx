"use client"

import * as React from "react"
import { Download, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SupplierStat {
    supplier: string
    active: number
    draft: number
    total: number
}

const SUPPLIER_LABELS: Record<string, string> = {
    ciftel_2026:       'ÇİFTEL',
    oskar_2026:        'OSKAR',
    kaucuk_takoz_2026: 'KAUÇUK TAKOZ',
    falo_2026:         'FALO',
    emes:              'EMES',
}

const SUPPLIER_COLORS: Record<string, string> = {
    ciftel_2026:       'bg-blue-500',
    oskar_2026:        'bg-purple-500',
    kaucuk_takoz_2026: 'bg-orange-500',
    falo_2026:         'bg-teal-500',
    emes:              'bg-primary',
}

export function SupplierBreakdown({ stats }: { stats: SupplierStat[] }) {
    const handleExportOrders = () => {
        const header = "Tedarikçi;Aktif Ürün;Taslak Ürün;Toplam"
        const rows = stats.map(s =>
            `${SUPPLIER_LABELS[s.supplier] ?? s.supplier};${s.active};${s.draft};${s.total}`
        )
        const csv = [header, ...rows].join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tedarikci-ozet-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <Card className="shadow-sm border-slate-200/60">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-500" />
                    <CardTitle className="text-sm font-bold text-slate-800">Tedarikçi Dağılımı</CardTitle>
                </div>
                <button
                    onClick={handleExportOrders}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors font-medium"
                >
                    <Download className="w-3 h-3" />
                    CSV İndir
                </button>
            </CardHeader>
            <CardContent className="space-y-3">
                {stats.map(s => {
                    const label     = SUPPLIER_LABELS[s.supplier] ?? s.supplier
                    const color     = SUPPLIER_COLORS[s.supplier] ?? 'bg-slate-400'
                    const activePct = s.total > 0 ? Math.round((s.active / s.total) * 100) : 0

                    return (
                        <div key={s.supplier}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
                                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-emerald-600 font-bold">{s.active} aktif</span>
                                    {s.draft > 0 && (
                                        <span className="text-amber-600 font-medium">{s.draft} taslak</span>
                                    )}
                                    <span className="text-slate-400">{s.total} toplam</span>
                                </div>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${color} rounded-full transition-all duration-500`}
                                    style={{ width: `${activePct}%` }}
                                />
                            </div>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}

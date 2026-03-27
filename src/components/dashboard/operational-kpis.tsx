"use client"

import * as React from "react"
import { Package, AlertTriangle, Clock, CheckCircle2, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface OperationalKPIsProps {
    totalProducts: number
    inStockCount: number
    zeroStockCount: number
    criticalStockCount: number
    draftCount: number
    activeCount: number
    inventoryValue?: number
}

interface KPICardProps {
    title: string
    value: number | string
    subtitle?: string
    icon: React.ReactNode
    accent: string
    urgent?: boolean
}

function KPICard({ title, value, subtitle, icon, accent, urgent }: KPICardProps) {
    return (
        <Card className={`shadow-sm overflow-hidden relative border ${urgent ? 'border-red-200 bg-red-50/40' : 'border-slate-200/60 bg-white'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-[0.06]">
                <div className="w-16 h-16">{icon}</div>
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
                <CardTitle className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    {title}
                </CardTitle>
                <div className={`p-1.5 rounded-lg ${accent}`}>
                    {icon}
                </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
                <div className={`text-3xl font-extrabold tracking-tight ${urgent ? 'text-red-600' : 'text-slate-900'}`}>
                    {value}
                </div>
                {subtitle && (
                    <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
                )}
            </CardContent>
        </Card>
    )
}

export function OperationalKPIs({
    totalProducts,
    inStockCount,
    zeroStockCount,
    criticalStockCount,
    draftCount,
    activeCount,
    inventoryValue,
}: OperationalKPIsProps) {
    const cards = [
        {
            title: "Toplam Ürün",
            value: totalProducts.toLocaleString('tr-TR'),
            subtitle: `${activeCount} aktif · ${draftCount} taslak`,
            icon: <Package className="w-5 h-5 text-blue-500" />,
            accent: "bg-blue-50",
        },
        {
            title: "Stokta Var",
            value: inStockCount.toLocaleString('tr-TR'),
            subtitle: "Stok > 0 olan ürünler",
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            accent: "bg-emerald-50",
        },
        {
            title: "Stok Bitti",
            value: zeroStockCount,
            subtitle: criticalStockCount > 0 ? `+${criticalStockCount} kritik seviyede` : "Acil sipariş gerekiyor",
            icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
            accent: "bg-red-50",
            urgent: zeroStockCount > 0,
        },
        inventoryValue !== undefined
            ? {
                title: "Envanter Değeri",
                value: inventoryValue >= 1_000_000
                    ? `₺${(inventoryValue / 1_000_000).toFixed(1)}M`
                    : `₺${(inventoryValue / 1_000).toFixed(0)}K`,
                subtitle: "Mevcut stok × birim fiyat",
                icon: <TrendingUp className="w-5 h-5 text-indigo-500" />,
                accent: "bg-indigo-50",
            }
            : {
                title: "Taslak Ürünler",
                value: draftCount.toLocaleString('tr-TR'),
                subtitle: "Yayınlanmayı bekliyor",
                icon: <Clock className="w-5 h-5 text-amber-500" />,
                accent: "bg-amber-50",
            },
    ]

    return (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => (
                <div
                    key={card.title}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
                >
                    <KPICard {...card} />
                </div>
            ))}
        </div>
    )
}

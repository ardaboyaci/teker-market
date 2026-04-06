/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import {
    PieChart, Pie, Cell,
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, PieChart as PieIcon } from "lucide-react"

interface StockStat {
    name: string
    value: number
    color: string
}

interface SupplierStat {
    name: string
    active: number
    draft: number
}

interface DashboardChartsProps {
    stockStats: StockStat[]
    supplierStats: SupplierStat[]
}


export function DashboardCharts({ stockStats, supplierStats }: DashboardChartsProps) {
    const total = stockStats.reduce((s, d) => s + d.value, 0)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Pasta — stok dağılımı */}
            <Card className="shadow-sm border-slate-200/60">
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                    <PieIcon className="w-4 h-4 text-indigo-500" />
                    <CardTitle className="text-sm font-bold text-slate-800">Stok Dağılımı</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6">
                        <ResponsiveContainer width={140} height={140}>
                            <PieChart>
                                <Pie
                                    data={stockStats}
                                    cx="50%" cy="50%"
                                    innerRadius={38} outerRadius={60}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {stockStats.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                {/* @ts-expect-error recharts formatter tipi */}
                                <Tooltip formatter={(v: number) => [`${v} ürün`]} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2.5">
                            {stockStats.map((d) => (
                                <div key={d.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                        <span className="text-xs text-slate-600">{d.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800">{d.value.toLocaleString('tr')}</span>
                                        <span className="text-[10px] text-slate-400 w-8 text-right">
                                            %{total > 0 ? Math.round(d.value / total * 100) : 0}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bar — tedarikçi bazlı */}
            <Card className="shadow-sm border-slate-200/60">
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <CardTitle className="text-sm font-bold text-slate-800">Tedarikçi Dağılımı</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={supplierStats} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 9, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 9, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                formatter={((v: number, name: string) => [`${v.toLocaleString('tr')}`, name === 'active' ? 'Aktif' : 'Taslak']) as any}
                            />
                            <Legend
                                iconType="circle"
                                iconSize={8}
                                formatter={(v) => <span style={{ fontSize: 10, color: '#64748b' }}>{v === 'active' ? 'Aktif' : 'Taslak'}</span>}
                            />
                            <Bar dataKey="active" name="active" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="draft"  name="draft"  fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

        </div>
    )
}

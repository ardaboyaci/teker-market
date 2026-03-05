"use client"

import * as React from "react"
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/currency"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ec4899', '#14b8a6', '#f43f5e', '#8b5cf6']

interface CategoryStat {
    category_id: string | null
    category_name: string | null
    active_count: number | null
    critical_count: number | null
    product_count: number | null
    total_stock: number | null
    total_stock_value: string | null
}

export function DashboardCharts({ data }: { data: CategoryStat[] }) {
    // Format data for Pie Chart (Stok Dağılımı)
    const pieData = data
        .filter(item => item.total_stock && item.total_stock > 0)
        .map(item => ({
            name: item.category_name || "Diğer",
            value: item.total_stock || 0
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8) // Sadece en büyük 8 kategoriyi göster

    // Format data for Bar Chart (Kategori Bazlı Finansal Değer)
    const barData = data
        .filter(item => item.total_stock_value && Number(item.total_stock_value) > 0)
        .map(item => ({
            name: item.category_name || "Diğer",
            deger: Number(item.total_stock_value || 0)
        }))
        .sort((a, b) => b.deger - a.deger)
        .slice(0, 10)

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-slate-200/60">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-800">Kategori Bazlı Stok Dağılımı</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    innerRadius={70}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => [`${value} adet`, 'Stok']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200/60">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-800">Kategori Bazlı Finansal Büyüklük</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={barData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 12 }}
                                    angle={-45}
                                    textAnchor="end"
                                    interval={0}
                                    height={80}
                                />
                                <YAxis
                                    tickFormatter={(val) => `₺${(val / 1000).toFixed(0)}k`}
                                    tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                    formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Toplam Değer']}
                                    cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                                />
                                <Bar dataKey="deger" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

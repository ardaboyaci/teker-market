import pool from "@/lib/db/pool"
import type { RowDataPacket } from "mysql2/promise"
import { AlignLeft, ArrowRight } from "lucide-react"
import Link from "next/link"

export async function DescriptionCoverage() {
    const [products] = await pool.query<RowDataPacket[]>(
        `SELECT id, description, meta FROM products WHERE status = 'active' AND deleted_at IS NULL`
    )

    const suppliers = [
        'emes_2026', 'zet_2026', 'ciftel_2026', 'oskar_2026',
        'kaucuk_takoz_2026', 'emes_kulp_2026', 'yedek_emes_2026', 'falo_2026', 'mertsan_2026'
    ]

    const stats: Record<string, { total: number; withDescription: number }> = {}
    suppliers.forEach(s => stats[s] = { total: 0, withDescription: 0 })

    for (const p of products as RowDataPacket[]) {
        const source = (p.meta as Record<string, unknown>)?.source as string | undefined
        if (source && stats[source]) {
            stats[source].total++
            if (p.description && String(p.description).trim() !== '') {
                stats[source].withDescription++
            }
        }
    }

    const validStats = suppliers
        .filter(s => stats[s].total > 0)
        .map(s => {
            const row = stats[s]
            const percentage = Math.round((row.withDescription / row.total) * 100)
            let colorClass = 'bg-red-500'
            if (percentage > 30 && percentage <= 70) colorClass = 'bg-amber-400'
            else if (percentage > 70) colorClass = 'bg-emerald-500'
            return { supplier: s.replace('_2026', '').toUpperCase(), ...row, percentage, colorClass }
        })
        .sort((a, b) => b.total - a.total)

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <AlignLeft className="w-5 h-5 text-fuchsia-500" />
                    <h3 className="text-sm font-bold text-slate-800">Açıklama Doluluk Oranı</h3>
                </div>
                <Link href="/dashboard/products?filter=no-description" className="flex items-center gap-1 text-xs text-fuchsia-600 hover:underline font-medium">
                    Eksikleri Listele <ArrowRight className="w-3 h-3" />
                </Link>
            </div>
            <div className="space-y-4">
                {validStats.map(stat => (
                    <div key={stat.supplier} className="flex flex-col gap-1">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-600">{stat.supplier}</span>
                            <span className="text-[10px] font-medium text-slate-500">
                                {stat.withDescription} / {stat.total} (<span className={stat.percentage < 100 ? "text-amber-600" : "text-emerald-600"}>%{stat.percentage}</span>)
                            </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${stat.colorClass} transition-all duration-500`} style={{ width: `${stat.percentage}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
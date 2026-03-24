import { createAdminClient } from "@/lib/supabase/admin"
import { Image as ImageIcon } from "lucide-react"

export async function ImageCoverage() {
    const supabase = createAdminClient()

    // Yalnızca aktif ve silinmemiş ürünleri alıyoruz
    const { data: products, error } = await supabase
        .from('products')
        .select('id, image_url, meta')
        .eq('status', 'active')
        .is('deleted_at', null)

    if (error) {
        console.error("Error fetching for image coverage:", error)
        return null
    }

    const suppliers = [
        'emes_2026', 'zet_2026', 'ciftel_2026', 'oskar_2026',
        'kaucuk_takoz_2026', 'emes_kulp_2026', 'yedek_emes_2026', 'falo_2026', 'mertsan_2026'
    ]

    const stats: Record<string, { total: number; withImage: number }> = {}
    suppliers.forEach(s => stats[s] = { total: 0, withImage: 0 })

    for (const p of (products ?? [])) {
        const source = ((p.meta as Record<string,unknown>)?.source) as string | undefined
        if (source && stats[source]) {
            stats[source].total++
            if (p.image_url && p.image_url.trim() !== '') {
                stats[source].withImage++
            }
        }
    }

    const validStats = suppliers
        .filter(s => stats[s].total > 0)
        .map(s => {
            const row = stats[s]
            const percentage = Math.round((row.withImage / row.total) * 100)
            let colorClass = 'bg-red-500'
            if (percentage > 30 && percentage <= 70) colorClass = 'bg-amber-400'
            else if (percentage > 70) colorClass = 'bg-emerald-500'

            return {
                supplier: s.replace('_2026', '').toUpperCase(),
                ...row,
                percentage,
                colorClass
            }
        })
        .sort((a, b) => b.total - a.total)

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-800">Görsel Doluluk Oranı</h3>
            </div>
            
            <div className="space-y-4">
                {validStats.map(stat => (
                    <div key={stat.supplier} className="flex flex-col gap-1">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-600">{stat.supplier}</span>
                            <span className="text-[10px] font-medium text-slate-500">
                                {stat.withImage} / {stat.total} (<span className={stat.percentage < 100 ? "text-amber-600" : "text-emerald-600"}>%{stat.percentage}</span>)
                            </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${stat.colorClass} transition-all duration-500`} 
                                style={{ width: `${stat.percentage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

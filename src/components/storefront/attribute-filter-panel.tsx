"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

const wheelDiameters = ["50mm", "75mm", "100mm", "125mm", "150mm", "200mm", "250mm"]
const materials = ["Kauçuk", "Poliüretan", "Poliamid", "Döküm", "PVC", "Naylon"]
const loadCapacities = ["50-100 kg", "100-200 kg", "200-500 kg", "500-1000 kg", "1000+ kg"]
const connectionTypes = ["Sabit", "Döner", "Frenli", "Civatalı"]

export function AttributeFilterPanel() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const createFilterUrl = useCallback((key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        const existing = params.get(key)

        if (existing === value) {
            params.delete(key)
        } else {
            params.set(key, value)
        }
        // Reset to page 1 on filter change
        params.delete("page")

        return `/?${params.toString()}`
    }, [searchParams])

    const isActive = (key: string, value: string) => searchParams.get(key) === value

    return (
        <div className="space-y-6">
            {/* Çap */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Tekerlek Çapı
                </h3>
                <div className="flex flex-wrap gap-1.5">
                    {wheelDiameters.map((d) => (
                        <button
                            key={d}
                            onClick={() => router.push(createFilterUrl("diameter", d))}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${isActive("diameter", d)
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                                }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>

            {/* Malzeme */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Malzeme
                </h3>
                <div className="space-y-1.5">
                    {materials.map((m) => (
                        <button
                            key={m}
                            onClick={() => router.push(createFilterUrl("material", m))}
                            className={`w-full text-left px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${isActive("material", m)
                                    ? "bg-primary/10 text-primary"
                                    : "text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {/* Yük Kapasitesi */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Yük Kapasitesi
                </h3>
                <div className="space-y-1.5">
                    {loadCapacities.map((lc) => (
                        <button
                            key={lc}
                            onClick={() => router.push(createFilterUrl("load", lc))}
                            className={`w-full text-left px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${isActive("load", lc)
                                    ? "bg-primary/10 text-primary"
                                    : "text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            {lc}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bağlantı Tipi */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Bağlantı Tipi
                </h3>
                <div className="flex flex-wrap gap-1.5">
                    {connectionTypes.map((ct) => (
                        <button
                            key={ct}
                            onClick={() => router.push(createFilterUrl("type", ct))}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${isActive("type", ct)
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                                }`}
                        >
                            {ct}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

"use client"

import { X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

const filterLabels: Record<string, string> = {
    diameter: "Çap",
    material: "Malzeme",
    load: "Yük",
    type: "Bağlantı",
    q: "Arama",
}

export function ActiveFilterChips() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const activeFilters: { key: string; value: string; label: string }[] = []

    searchParams.forEach((value, key) => {
        if (key !== "sort" && key !== "page" && key !== "category") {
            activeFilters.push({
                key,
                value,
                label: filterLabels[key] || key,
            })
        }
    })

    const removeFilter = useCallback((keyToRemove: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete(keyToRemove)
        params.delete("page")
        router.push(`/?${params.toString()}`)
    }, [router, searchParams])

    const clearAll = useCallback(() => {
        const params = new URLSearchParams()
        const sort = searchParams.get("sort")
        const category = searchParams.get("category")
        if (sort) params.set("sort", sort)
        if (category) params.set("category", category)
        router.push(`/?${params.toString()}`)
    }, [router, searchParams])

    if (activeFilters.length === 0) return null

    return (
        <div className="flex flex-wrap items-center gap-2 mb-4">
            {activeFilters.map((f) => (
                <button
                    key={f.key}
                    onClick={() => removeFilter(f.key)}
                    className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                >
                    <span className="text-primary/60">{f.label}:</span>
                    {f.value}
                    <X className="w-3 h-3" />
                </button>
            ))}

            <button
                onClick={clearAll}
                className="text-xs text-slate-400 hover:text-destructive font-medium underline underline-offset-2 ml-1"
            >
                Tümünü temizle
            </button>
        </div>
    )
}

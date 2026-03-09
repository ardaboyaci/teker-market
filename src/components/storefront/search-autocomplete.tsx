"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, Loader2 } from "lucide-react"
import Link from "next/link"

interface SearchResult {
    id: string
    name: string
    sku: string
    slug: string
    sale_price: string | null
    image_url: string | null
}

export function SearchAutocomplete({ defaultValue }: { defaultValue?: string }) {
    const [query, setQuery] = useState(defaultValue || "")
    const [results, setResults] = useState<SearchResult[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const search = useCallback(async (term: string) => {
        if (term.length < 2) {
            setResults([])
            setIsOpen(false)
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch(
                `/api/search?q=${encodeURIComponent(term)}&limit=6`
            )
            if (!res.ok) return

            const { results } = await res.json()
            if (results) {
                setResults(results as SearchResult[])
                setIsOpen(true)
            }
        } catch {
            // Silently fail
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Debounced search — 300ms
    const handleChange = (value: string) => {
        setQuery(value)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => search(value), 300)
    }

    // Click outside to close
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    return (
        <div ref={wrapperRef} className="relative hidden md:block w-96">
            <form action="/" method="GET">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                <input
                    type="text"
                    name="q"
                    value={query}
                    onChange={(e) => handleChange(e.target.value)}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    placeholder="Ürün kodu, adı veya kategori arayın..."
                    autoComplete="off"
                    className="w-full bg-slate-100/70 border border-transparent focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 rounded-full py-2 pl-10 pr-10 text-sm transition-all outline-none text-slate-700"
                />
            </form>

            {/* Dropdown Results */}
            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                    {results.map((item) => (
                        <Link
                            key={item.id}
                            href={`/?q=${encodeURIComponent(item.sku)}`}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{item.sku}</p>
                            </div>
                            {item.sale_price && Number(item.sale_price) > 0 && (
                                <span className="text-sm font-bold text-primary whitespace-nowrap">
                                    ₺{Number(item.sale_price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                                </span>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

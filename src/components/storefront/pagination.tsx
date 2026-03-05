"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function Pagination({
    totalCount,
    pageSize = 40,
}: {
    totalCount: number
    pageSize?: number
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentPage = Number(searchParams.get("page") || "1")
    const totalPages = Math.ceil(totalCount / pageSize)

    const goToPage = useCallback((page: number) => {
        const params = new URLSearchParams(searchParams.toString())
        if (page <= 1) {
            params.delete("page")
        } else {
            params.set("page", String(page))
        }
        router.push(`/?${params.toString()}`)
    }, [router, searchParams])

    if (totalPages <= 1) return null

    return (
        <div className="flex items-center justify-center gap-2 mt-8 pt-6 border-t border-slate-100">
            {/* Previous */}
            <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((page, i, arr) => {
                    const prev = arr[i - 1]
                    const showEllipsis = prev && page - prev > 1

                    return (
                        <div key={page} className="flex items-center gap-1">
                            {showEllipsis && <span className="text-sm text-slate-300 px-1">…</span>}
                            <button
                                onClick={() => goToPage(page)}
                                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === currentPage
                                        ? "bg-primary text-white"
                                        : "text-slate-600 hover:bg-slate-50 border border-slate-200"
                                    }`}
                            >
                                {page}
                            </button>
                        </div>
                    )
                })}

            {/* Next */}
            <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>

            {/* Info */}
            <span className="text-xs text-slate-400 ml-3">
                Sayfa {currentPage} / {totalPages}
            </span>
        </div>
    )
}

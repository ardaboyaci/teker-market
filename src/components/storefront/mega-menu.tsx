"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import Link from "next/link"

interface Category {
    id: string
    name: string
    slug: string | null
}

export function MegaMenu({ categories }: { categories: Category[] }) {
    const [openMenu, setOpenMenu] = useState<string | null>(null)

    // Group categories into columns of 5
    const columns: Category[][] = []
    for (let i = 0; i < categories.length; i += 5) {
        columns.push(categories.slice(i, i + 5))
    }

    return (
        <nav className="hidden lg:flex items-center gap-1">
            {/* Tüm Ürünler */}
            <Link
                href="/"
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors"
            >
                Ana Sayfa
            </Link>

            {/* Ürünler Mega Menu */}
            <div
                className="relative"
                onMouseEnter={() => setOpenMenu("products")}
                onMouseLeave={() => setOpenMenu(null)}
            >
                <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors">
                    Ürünler
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openMenu === "products" ? "rotate-180" : ""}`} />
                </button>

                {openMenu === "products" && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-2xl p-6 min-w-[480px] z-50">
                        <div className="mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kategoriler</h3>
                        </div>
                        <div className="flex gap-8">
                            {columns.map((col, ci) => (
                                <ul key={ci} className="space-y-1">
                                    {col.map((cat) => (
                                        <li key={cat.id}>
                                            <Link
                                                href={`/?category=${cat.slug}`}
                                                className="block px-3 py-1.5 text-sm text-slate-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors font-medium"
                                            >
                                                {cat.name}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <Link
                                href="/"
                                className="text-xs font-semibold text-primary hover:underline"
                            >
                                Tüm ürünleri görüntüle →
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Static Links */}
            <Link href="/#" className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors">
                Hakkımızda
            </Link>
            <Link href="/#" className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors">
                İletişim
            </Link>
        </nav>
    )
}

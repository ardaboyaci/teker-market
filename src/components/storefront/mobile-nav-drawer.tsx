"use client"

import { useState } from "react"
import { Menu, X, ChevronRight, Search } from "lucide-react"
import Link from "next/link"

interface Category {
    id: string
    name: string
    slug: string | null
}

export function MobileNavDrawer({ categories }: { categories: Category[] }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Menüyü aç"
            >
                <Menu className="w-5 h-5 text-slate-700" />
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Drawer */}
            <div
                className={`fixed top-0 left-0 bottom-0 w-[300px] bg-white z-50 transform transition-transform duration-300 ease-out lg:hidden shadow-2xl ${isOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900">⚙ TekerMarket</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Mobile Search */}
                <div className="p-4">
                    <form action="/" method="GET">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                name="q"
                                placeholder="Ürün ara..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                    </form>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-2 pb-6">
                    <Link
                        href="/"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                    >
                        Ana Sayfa
                    </Link>

                    <div className="px-4 pt-4 pb-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kategoriler</p>
                    </div>

                    {categories.map((cat) => (
                        <Link
                            key={cat.id}
                            href={`/?category=${cat.slug}`}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center justify-between px-4 py-2.5 rounded-lg text-sm text-slate-600 hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                            <span className="font-medium">{cat.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        </Link>
                    ))}

                    <div className="mt-4 pt-4 border-t border-slate-100 px-2">
                        <Link
                            href="/login"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center justify-center gap-2 w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Bayi Girişi
                        </Link>
                    </div>
                </nav>
            </div>
        </>
    )
}

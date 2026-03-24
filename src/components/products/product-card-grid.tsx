/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client"

import * as React from "react"
import Image from "next/image"
import { ProductWithCategory, useRevisePrice, useDeleteProduct } from "@/lib/hooks/use-products"
import { formatCurrency } from "@/lib/utils/currency"
import { Button } from "@/components/ui/button"
import { Package, RefreshCw, CheckCircle2, Trash2, TrendingUp, TrendingDown } from "lucide-react"

// ── ReviseButton (kart içi) ────────────────────────────────────────────────
function ReviseButton({ productId }: { productId: string }) {
    const revise = useRevisePrice()
    const [done, setDone] = React.useState(false)

    if (done) return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <CheckCircle2 className="w-3 h-3" /> Uygulandı
        </span>
    )

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={revise.isPending}
            onClick={() => revise.mutate(productId, {
                onSuccess: () => { setDone(true); setTimeout(() => setDone(false), 2500) },
                onError: (err) => alert(err instanceof Error ? err.message : "Revize başarısız."),
            })}
            className="h-6 px-2 text-[11px] font-semibold text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
        >
            {revise.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Revize"}
        </Button>
    )
}

// ── Ana bileşen ────────────────────────────────────────────────────────────
interface ProductCardGridProps {
    products: ProductWithCategory[]
    onDelete?: (product: ProductWithCategory) => void
}

export function ProductCardGrid({ products, onDelete }: ProductCardGridProps) {
    if (products.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Arama kriterlerinize uygun ürün bulunamadı.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {products.map((product, i) => {
                const image = (product as any).image_url ?? (product.meta as any)?.images?.[0] ?? null
                const saleNum = product.sale_price ? parseFloat(String(product.sale_price)) : null
                const compNum = (product as any).competitor_price ? parseFloat(String((product as any).competitor_price)) : null
                const diff = saleNum !== null && compNum !== null
                    ? ((saleNum - compNum) / compNum * 100)
                    : null
                const scrapedAt = (product as any).competitor_scraped_at as string | null
                const dateStr = scrapedAt
                    ? new Date(scrapedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })
                    : null
                const qty = product.quantity_on_hand ?? 0
                const stockColor = qty === 0 ? "bg-red-100 text-red-700" : qty <= 5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                const stockLabel = qty === 0 ? "Stok Yok" : qty <= 5 ? `${qty} adet` : `${qty} adet`

                return (
                    <div
                        key={product.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col overflow-hidden animate-fade-in-up"
                        style={{ animationDelay: `${i * 30}ms`, animationFillMode: "both" }}
                    >
                        {/* Fotoğraf */}
                        <div className="relative w-full aspect-square bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                            {image ? (
                                <Image
                                    src={image}
                                    alt={product.name}
                                    width={300}
                                    height={300}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <Package className="w-12 h-12 text-slate-200" />
                            )}
                            {/* Stok badge — sağ üst */}
                            <span className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stockColor}`}>
                                {stockLabel}
                            </span>
                        </div>

                        {/* İçerik */}
                        <div className="p-3 flex flex-col gap-2 flex-1">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{product.sku}</span>
                                <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 mt-0.5">{product.name}</p>
                                {product.category && (
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">{product.category.name}</span>
                                )}
                            </div>

                            {/* Fiyat + Rakip */}
                            <div className="flex items-end justify-between gap-1">
                                <div>
                                    {saleNum !== null ? (
                                        <span className="text-base font-extrabold text-slate-900">{formatCurrency(saleNum)}</span>
                                    ) : (
                                        <span className="text-sm italic text-slate-300">Fiyat yok</span>
                                    )}
                                </div>
                                {compNum !== null && diff !== null && (
                                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        diff > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                                    }`}>
                                        {diff > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                                    </span>
                                )}
                            </div>

                            {/* Rakip fiyat detayı */}
                            {compNum !== null && (
                                <div className="text-[10px] text-slate-400">
                                    Rakip: <span className="font-semibold text-amber-700">{formatCurrency(compNum)}</span>
                                    {dateStr && <span className="ml-1">· {dateStr}</span>}
                                </div>
                            )}

                            {/* Aksiyonlar */}
                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                                <ReviseButton productId={product.id} />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => onDelete?.(product)}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

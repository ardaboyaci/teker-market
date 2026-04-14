/* eslint-disable @typescript-eslint/no-explicit-any */
import { ColumnDef } from "@tanstack/react-table"
import Image from "next/image"
import { ProductWithCategory, useRevisePrice } from "@/lib/hooks/use-products"
import { InlineEditCell } from "./inline-edit-cell"
import { formatCurrency } from "@/lib/utils/currency"
import { Button } from "@/components/ui/button"
import { Trash2, RefreshCw, CheckCircle2, ImageOff, Check, X } from "lucide-react"
import React from "react"

// ── ReviseButton ──────────────────────────────────────────────────────────────
function ReviseButton({ productId }: { productId: string }) {
    const revise = useRevisePrice()
    const [done, setDone] = React.useState(false)

    const handleClick = () => {
        revise.mutate(productId, {
            onSuccess: () => {
                setDone(true)
                setTimeout(() => setDone(false), 2500)
            },
            onError: (err: unknown) => {
                const msg = err instanceof Error ? err.message : "Revize başarısız."
                alert(msg)
            },
        })
    }

    if (done) {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Uygulandı
            </span>
        )
    }

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={revise.isPending}
            onClick={handleClick}
            className="h-6 px-2 text-[11px] font-semibold text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-400 disabled:opacity-50"
        >
            {revise.isPending
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : "Kontrol Et"
            }
        </Button>
    )
}

// ── Kolon tanımları ───────────────────────────────────────────────────────────
export function getProductColumns(
    onUpdateProduct: (id: string, field: string, value: any) => void,
    onDeleteProduct?: (product: ProductWithCategory) => void,
    pendingDeleteId?: string | null,
    onConfirmDelete?: (id: string) => void,
): ColumnDef<ProductWithCategory>[] {
    return [
        {
            id: "select",
            header: ({ table }) => (
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 mx-2"
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 mx-2"
                    checked={row.getIsSelected()}
                    onChange={(e) => row.toggleSelected(!!e.target.checked)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "image",
            header: "Görsel",
            cell: ({ row }) => {
                const img = (row.original as any).image_url ?? (row.original as any).meta?.images?.[0] ?? null
                return img ? (
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                        <Image src={img} alt="" width={40} height={40} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center text-slate-400">
                        <ImageOff className="w-4 h-4" />
                    </div>
                )
            },
        },
        { accessorKey: "sku",  header: "SKU",     cell: ({ row }) => <span className="font-medium">{row.original.sku}</span> },
        { accessorKey: "name", header: "Ürün Adı" },
        {
            id: "description",
            header: "Detay",
            cell: ({ row }) => {
                const hasDesc = !!(row.original as any).description
                return (
                    <div className="flex justify-center">
                        {hasDesc ? (
                            <div className="bg-emerald-100 text-emerald-600 rounded-full p-1" title="Açıklama Var">
                                <Check className="w-3.5 h-3.5 font-bold" />
                            </div>
                        ) : (
                            <div className="bg-red-100 text-red-500 rounded-full p-1" title="Açıklama Yok">
                                <X className="w-3.5 h-3.5 font-bold" />
                            </div>
                        )}
                    </div>
                )
            }
        },
        { id: "category", accessorFn: (row) => row.category?.name || "-", header: "Kategori" },
        {
            accessorKey: "quantity_on_hand",
            header: "Stok",
            cell: ({ row }) => {
                const qty = row.original.quantity_on_hand ?? 0
                const minStock = row.original.min_stock_level ?? 0
                return (
                    <div className="flex flex-col gap-1">
                        <InlineEditCell initialValue={row.original.quantity_on_hand} type="number"
                            onSave={(val) => onUpdateProduct(row.original.id, "quantity_on_hand", val)} />
                        {qty === 0 && (
                            <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                                Stok Yok
                            </span>
                        )}
                        {qty > 0 && minStock > 0 && qty <= minStock && (
                            <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                                Kritik
                            </span>
                        )}
                    </div>
                )
            }
        },
        {
            accessorKey: "cost_price",
            header: "Alış Fiyatı",
            cell: ({ row }) => (
                <InlineEditCell initialValue={row.original.cost_price} type="price"
                    formatDisplay={(val) => formatCurrency(val)}
                    onSave={(val) => onUpdateProduct(row.original.id, "cost_price", val)} />
            )
        },
        {
            accessorKey: "sale_price",
            header: "Satış Fiyatı",
            cell: ({ row }) => (
                <InlineEditCell initialValue={row.original.sale_price} type="price"
                    formatDisplay={(val) => formatCurrency(val)}
                    onSave={(val) => onUpdateProduct(row.original.id, "sale_price", val)} />
            )
        },
        {
            id: "competitor_price",
            header: () => (
                <span className="flex items-center gap-1">
                    <span className="text-amber-700">Rakip Fiyat</span>
                    <span className="text-[10px] font-normal text-slate-400">(e-tekerlek)</span>
                </span>
            ),
            cell: ({ row }) => {
                const cp        = (row.original as any).competitor_price
                const scrapedAt = (row.original as any).competitor_scraped_at as string | null
                const hasPrice  = cp !== null && cp !== undefined && Number(cp) > 0
                const compNum   = hasPrice ? Number(cp) : null
                const saleNum   = row.original.sale_price ? parseFloat(String(row.original.sale_price)) : null

                const diff = (saleNum !== null && compNum !== null)
                    ? ((saleNum - compNum) / compNum * 100).toFixed(1)
                    : null

                const dateStr = scrapedAt
                    ? new Date(scrapedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })
                    : null

                return (
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                        {hasPrice ? (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-amber-700">
                                        {formatCurrency(cp)}
                                    </span>
                                    {diff !== null && (
                                        <span className={`text-[10px] font-bold px-1 rounded ${
                                            parseFloat(diff) > 0
                                                ? "bg-red-50 text-red-500"
                                                : "bg-emerald-50 text-emerald-600"
                                        }`}>
                                            {parseFloat(diff) > 0 ? `+${diff}%` : `${diff}%`}
                                        </span>
                                    )}
                                </div>
                                {dateStr && (
                                    <span className="text-[10px] text-slate-400">{dateStr} güncellendi</span>
                                )}
                                <ReviseButton productId={row.original.id} />
                            </>
                        ) : (
                            <span className="text-[11px] italic text-slate-300">Eşleşme yok</span>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "status",
            header: "Durum",
            cell: ({ row }) => {
                const map: Record<string, string> = { active: "Aktif", inactive: "Pasif", draft: "Taslak", archived: "Arşiv" }
                const s = row.original.status
                return (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                        ${s === "active"   ? "bg-green-100 text-green-800"  : ""}
                        ${s === "inactive" ? "bg-red-100 text-red-800"      : ""}
                        ${s === "draft"    ? "bg-yellow-100 text-yellow-800": ""}
                        ${s === "archived" ? "bg-slate-100 text-slate-800"  : ""}
                    `}>{map[s] || s}</span>
                )
            }
        },
        {
            id: "actions",
            header: "Aksiyon",
            cell: ({ row }) => {
                const id = row.original.id
                const isPending = pendingDeleteId === id

                if (isPending) {
                    return (
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Emin misin?</span>
                            <Button
                                type="button" variant="ghost" size="sm"
                                className="h-6 px-2 text-xs text-red-600 hover:bg-red-50 font-semibold"
                                onClick={(e) => { e.stopPropagation(); onConfirmDelete?.(id) }}
                            >
                                Evet
                            </Button>
                            <Button
                                type="button" variant="ghost" size="sm"
                                className="h-6 px-2 text-xs text-slate-500 hover:bg-slate-100"
                                onClick={(e) => { e.stopPropagation(); onDeleteProduct?.(null as any) }}
                            >
                                Hayır
                            </Button>
                        </div>
                    )
                }

                return (
                    <Button type="button" variant="ghost" size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); onDeleteProduct?.(row.original) }}>
                        <Trash2 className="h-4 w-4" /> Sil
                    </Button>
                )
            },
        }
    ]
}


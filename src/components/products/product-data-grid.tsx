/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client"

import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Percent, LayoutGrid, List } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { BulkUpdateDialog } from "./bulk-update-dialog"
import { ProductCardGrid } from "./product-card-grid"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProductWithCategory } from "@/lib/hooks/use-products"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    totalCount: number
    page: number
    pageSize: number
    onPageChange: (page: number) => void
    onSearchChange: (search: string) => void
    categoryId: string
    onCategoryChange: (categoryId: string) => void
    status: string
    onStatusChange: (status: string) => void
    categories: { id: string; name: string; slug: string | null }[]
    isLoading: boolean
    onDeleteProduct?: (product: ProductWithCategory) => void
    onRowClick?: (product: TData) => void
    selectedProductId?: string
}

export function ProductDataGrid<TData, TValue>({
    columns,
    data,
    totalCount,
    page,
    pageSize,
    onPageChange,
    onSearchChange,
    categoryId,
    onCategoryChange,
    status,
    onStatusChange,
    categories,
    isLoading,
    onDeleteProduct,
    onRowClick,
    selectedProductId,
}: DataTableProps<TData, TValue>) {
    const [searchTerm, setSearchTerm] = React.useState("")
    const [rowSelection, setRowSelection] = React.useState({})
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = React.useState(false)
    const [viewMode, setViewMode] = React.useState<"table" | "grid">("table")

    React.useEffect(() => {
        const timer = setTimeout(() => {
            onSearchChange(searchTerm)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm, onSearchChange])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: Math.ceil(totalCount / pageSize),
        getRowId: (row: any) => row.id,
        state: {
            rowSelection,
        },
        onRowSelectionChange: setRowSelection,
    })

    const selectedIds = Object.keys(rowSelection)

    const currentPageDescCount = data.filter((row: any) => !!row.description).length
    const currentPageImgCount = data.filter((row: any) => !!row.image_url).length

    return (
        <div className="flex flex-col space-y-4">
            <BulkUpdateDialog
                isOpen={isBulkUpdateOpen}
                onClose={() => setIsBulkUpdateOpen(false)}
                selectedIds={selectedIds}
                onSuccess={() => { setRowSelection({}) }}
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative w-full max-w-sm flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Ürün Ara (İsim, SKU, Barkod)..."
                        value={searchTerm}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value)}
                        className="pl-9 bg-white shadow-sm border-slate-200 transition-colors focus-visible:ring-primary dark:bg-slate-950 dark:border-slate-800"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Select value={categoryId} onValueChange={onCategoryChange}>
                        <SelectTrigger className="w-[200px] bg-white text-sm">
                            <SelectValue placeholder="Tüm Kategoriler" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Kategoriler</SelectItem>
                            {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={status} onValueChange={onStatusChange}>
                        <SelectTrigger className="w-[140px] bg-white text-sm">
                            <SelectValue placeholder="Tüm Durumlar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="draft">Taslak (Fiyat Sorunuz)</SelectItem>
                            <SelectItem value="inactive">Pasif</SelectItem>
                            <SelectItem value="archived">Arşiv</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Grid / Table toggle */}
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                        <button
                            onClick={() => setViewMode("table")}
                            className={`p-2 transition-colors ${viewMode === "table" ? "bg-primary text-white" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"}`}
                            title="Tablo görünümü"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"}`}
                            title="Kart grid görünümü"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>

                    {selectedIds.length > 0 && viewMode === "table" && (
                        <Button
                            variant="default"
                            className="bg-primary hover:bg-primary/90 text-white font-semibold text-sm h-10 px-4 flex items-center gap-2 transition-all animate-in fade-in"
                            onClick={() => setIsBulkUpdateOpen(true)}
                        >
                            <Percent className="w-4 h-4" />
                            {selectedIds.length} Ürünü Güncelle
                        </Button>
                    )}
                </div>
            </div>

            {/* Stat bar */}
            {!isLoading && data.length > 0 && viewMode === "table" && (
                <div className="flex items-center text-xs font-medium text-slate-500 px-1">
                    <span className="text-slate-700">{totalCount} toplam ürün</span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span>Sayfadaki {data.length} üründe: </span>
                    <span className="ml-1 text-emerald-600">{currentPageDescCount} açıklamalı</span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="text-blue-600">{currentPageImgCount} görselli</span>
                </div>
            )}

            {/* Grid Modu */}
            {viewMode === "grid" ? (
                <div>
                    {isLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <Skeleton className="aspect-square w-full" />
                                    <div className="p-3 space-y-2">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-5 w-20 mt-2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <ProductCardGrid
                            products={data as unknown as ProductWithCategory[]}
                            onDelete={onDeleteProduct}
                        />
                    )}
                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 px-1">
                        <span className="text-sm text-slate-500">
                            <span className="font-medium text-slate-900">{(page - 1) * pageSize + (totalCount > 0 ? 1 : 0)}–{Math.min(page * pageSize, totalCount)}</span>
                            {" "}/ {totalCount} kayıt
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="h-8 bg-white">Önceki</Button>
                            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= Math.ceil(totalCount / pageSize)} className="h-8 bg-white">Sonraki</Button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Tablo Modu */
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-950 dark:border-slate-800">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="bg-slate-50/50 hover:bg-slate-50/50 dark:bg-slate-900/50 dark:hover:bg-slate-900/50 border-b-slate-200 dark:border-b-slate-800">
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id} className="h-10 text-xs uppercase tracking-wider text-slate-500 font-semibold dark:text-slate-400 whitespace-nowrap px-4 py-3 align-middle">
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <TableRow key={i} className="border-b border-slate-100 dark:border-slate-800">
                                            <TableCell colSpan={columns.length} className="py-2 px-4">
                                                <Skeleton className="h-8 w-full" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : table.getRowModel().rows?.length ? (
                                    table.getRowModel().rows.map((row) => {
                                        const qty = (row.original as any).quantity_on_hand ?? null
                                        const rowColor =
                                            qty === 0 ? "bg-red-50 hover:bg-red-100"
                                            : qty !== null && qty <= 5 ? "bg-amber-50 hover:bg-amber-100"
                                            : "hover:bg-slate-50"
                                        return (
                                            <TableRow
                                                key={row.id}
                                                data-state={row.getIsSelected() && "selected"}
                                                onClick={() => onRowClick?.(row.original)}
                                                className={`border-b border-slate-100 transition-colors dark:border-slate-800/60 cursor-pointer ${
                                                    selectedProductId === (row.original as any).id
                                                        ? "bg-blue-50/70 hover:bg-blue-50"
                                                        : rowColor
                                                }`}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id} className="py-1.5 px-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-32 text-center text-slate-500">
                                            Arama kriterlerinize uygun ürün bulunamadı.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/30 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/20">
                        <div className="flex bg-transparent text-sm text-slate-500 dark:text-slate-400 tracking-tight">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{(page - 1) * pageSize + (totalCount > 0 ? 1 : 0)}-{Math.min(page * pageSize, totalCount)}</span>
                            <span className="mx-1">/</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">{totalCount}</span> kayıt gösteriliyor
                        </div>
                        <div className="flex space-x-2">
                            <Button variant="outline" size="sm" className="bg-white hover:bg-slate-100 shadow-sm transition-all h-8 dark:bg-slate-950 dark:hover:bg-slate-900 dark:border-slate-800" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                                Önceki
                            </Button>
                            <Button variant="outline" size="sm" className="bg-white hover:bg-slate-100 shadow-sm transition-all h-8 dark:bg-slate-950 dark:hover:bg-slate-900 dark:border-slate-800" onClick={() => onPageChange(page + 1)} disabled={page >= Math.ceil(totalCount / pageSize)}>
                                Sonraki
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

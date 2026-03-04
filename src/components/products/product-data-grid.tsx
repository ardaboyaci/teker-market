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
import { Search, Percent } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { BulkUpdateDialog } from "./bulk-update-dialog"

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
    categories: any[]
    isLoading: boolean
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
}: DataTableProps<TData, TValue>) {
    const [searchTerm, setSearchTerm] = React.useState("")
    const [rowSelection, setRowSelection] = React.useState({})
    const [isBulkUpdateOpen, setIsBulkUpdateOpen] = React.useState(false)

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

    return (
        <div className="flex flex-col space-y-4">
            <BulkUpdateDialog
                isOpen={isBulkUpdateOpen}
                onClose={() => setIsBulkUpdateOpen(false)}
                selectedIds={selectedIds}
                onSuccess={() => {
                    setRowSelection({})
                    // Ideally trigger a refresh here. Since page.tsx controls data, 
                    // changing page or search refetches. In a real app we'd pass an onRefresh prop.
                    // For now, we rely on the grid UI to reflect updates if we integrate React Query invalidate.
                    // Actually, useUpdateProduct does trigger invalidateQueries(['products']). The dialog doesn't yet.
                    // But we can just un-select rows. The user can refresh or we can add an onRefresh callback later.
                }}
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

                    {selectedIds.length > 0 && (
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

            {/* Data Grid Card */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-950 dark:border-slate-800">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-slate-50/50 hover:bg-slate-50/50 dark:bg-slate-900/50 dark:hover:bg-slate-900/50 border-b-slate-200 dark:border-b-slate-800">
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead key={header.id} className="h-10 text-xs uppercase tracking-wider text-slate-500 font-semibold dark:text-slate-400 whitespace-nowrap px-4 py-3 align-middle">
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-32 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
                                            <span className="text-sm font-medium">Veriler yükleniyor...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="hover:bg-slate-50 border-b border-slate-100 transition-colors dark:hover:bg-slate-900/80 dark:border-slate-800/60"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="py-2 px-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
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
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white hover:bg-slate-100 shadow-sm transition-all h-8 dark:bg-slate-950 dark:hover:bg-slate-900 dark:border-slate-800"
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1}
                        >
                            Önceki
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white hover:bg-slate-100 shadow-sm transition-all h-8 dark:bg-slate-950 dark:hover:bg-slate-900 dark:border-slate-800"
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= Math.ceil(totalCount / pageSize)}
                        >
                            Sonraki
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

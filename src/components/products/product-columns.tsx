"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ProductWithCategory } from "@/lib/hooks/use-products"
import { InlineEditCell } from "./inline-edit-cell"
import { formatCurrency } from "@/lib/utils/currency"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

export function getProductColumns(
    onUpdateProduct: (id: string, field: string, value: any) => void,
    onDeleteProduct?: (product: ProductWithCategory) => void
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
            accessorKey: "sku",
            header: "SKU",
            cell: ({ row }) => <span className="font-medium">{row.original.sku}</span>
        },
        {
            accessorKey: "name",
            header: "Ürün Adı",
        },
        {
            id: "category",
            accessorFn: (row) => row.category?.name || "-",
            header: "Kategori",
        },
        {
            accessorKey: "quantity_on_hand",
            header: "Stok",
            cell: ({ row }) => {
                return (
                    <InlineEditCell
                        initialValue={row.original.quantity_on_hand}
                        type="number"
                        onSave={(val) => onUpdateProduct(row.original.id, "quantity_on_hand", val)}
                    />
                )
            }
        },
        {
            accessorKey: "cost_price",
            header: "Alış Fiyatı",
            cell: ({ row }) => {
                return (
                    <InlineEditCell
                        initialValue={row.original.cost_price}
                        type="price"
                        formatDisplay={(val) => formatCurrency(val)}
                        onSave={(val) => onUpdateProduct(row.original.id, "cost_price", val)}
                    />
                )
            }
        },
        {
            accessorKey: "sale_price",
            header: "Satış Fiyatı",
            cell: ({ row }) => {
                return (
                    <InlineEditCell
                        initialValue={row.original.sale_price}
                        type="price"
                        formatDisplay={(val) => formatCurrency(val)}
                        onSave={(val) => onUpdateProduct(row.original.id, "sale_price", val)}
                    />
                )
            }
        },
        {
            accessorKey: "status",
            header: "Durum",
            cell: ({ row }) => {
                const statuses: Record<string, string> = {
                    active: 'Aktif',
                    inactive: 'Pasif',
                    draft: 'Taslak',
                    archived: 'Arşiv',
                };
                const status = row.original.status;
                return (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
            ${status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''}
            ${status === 'inactive' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : ''}
            ${status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
            ${status === 'archived' ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400' : ''}
          `}>
                        {statuses[status] || status}
                    </span>
                )
            }
        },
        {
            id: "actions",
            header: "Aksiyon",
            cell: ({ row }) => {
                return (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onDeleteProduct?.(row.original)}
                    >
                        <Trash2 className="h-4 w-4" />
                        Sil
                    </Button>
                )
            },
        }
    ]
}

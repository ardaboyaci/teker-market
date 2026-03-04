"use client"

import * as React from "react"
import { useProducts, useUpdateProduct, useCategories } from "@/lib/hooks/use-products"
import { ProductDataGrid } from "@/components/products/product-data-grid"
import { getProductColumns } from "@/components/products/product-columns"
import { Button } from "@/components/ui/button"

export default function ProductsPage() {
    const [page, setPage] = React.useState(1)
    const [search, setSearch] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("all")
    const [status, setStatus] = React.useState("all")
    const pageSize = 20

    const { data: categoriesData } = useCategories()
    const { data, isLoading } = useProducts({ page, pageSize, search, categoryId, status })
    const updateProduct = useUpdateProduct()

    const handleUpdateProduct = (id: string, field: string, value: any) => {
        if (!id) return;
        updateProduct.mutate({ id, updates: { [field]: value } });
    }

    const columns = React.useMemo(
        () => getProductColumns(handleUpdateProduct),
        []
    )

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Ürün Yönetimi</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Ürün kataloğunuzu yönetin, stok durumunu izleyin ve fiyatları çift tıklayarak anında güncelleyin.
                    </p>
                </div>
                <div>
                    <Button>Yeni Ürün Ekle</Button>
                </div>
            </div>

            <ProductDataGrid
                columns={columns}
                data={data?.products || []}
                totalCount={data?.totalCount || 0}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onSearchChange={(val) => {
                    setSearch(val)
                    setPage(1) // Yeni aramada sayfayı 1'e sıfırla
                }}
                categoryId={categoryId}
                onCategoryChange={(val) => { setCategoryId(val); setPage(1); }}
                status={status}
                onStatusChange={(val) => { setStatus(val); setPage(1); }}
                categories={categoriesData || []}
                isLoading={isLoading}
            />
        </div>
    )
}

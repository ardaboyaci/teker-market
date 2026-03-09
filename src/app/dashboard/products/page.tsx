"use client"

import * as React from "react"
import {
    ProductWithCategory,
    useCategories,
    useCreateProduct,
    useDeleteProduct,
    useProducts,
    useUpdateProduct,
} from "@/lib/hooks/use-products"
import { ProductDataGrid } from "@/components/products/product-data-grid"
import { getProductColumns } from "@/components/products/product-columns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PlusCircle } from "lucide-react"
import type { Database } from "@/types/supabase"

type ProductInsert = Database['public']['Tables']['products']['Insert']

const slugify = (value: string) => {
    return value
        .trim()
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
}

export default function ProductsPage() {
    const [page, setPage] = React.useState(1)
    const [search, setSearch] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("all")
    const [status, setStatus] = React.useState("all")
    const [createError, setCreateError] = React.useState("")
    const [createSuccess, setCreateSuccess] = React.useState("")
    const [newProduct, setNewProduct] = React.useState({
        name: "",
        sku: "",
        categoryId: "all",
        salePrice: "",
        quantityOnHand: "0",
        status: "active",
    })
    const pageSize = 20

    const { data: categoriesData } = useCategories()
    const { data, isLoading } = useProducts({ page, pageSize, search, categoryId, status })
    const updateProduct = useUpdateProduct()
    const createProduct = useCreateProduct()
    const deleteProduct = useDeleteProduct()

    const handleUpdateProduct = React.useCallback((id: string, field: string, value: any) => {
        if (!id) return;
        updateProduct.mutate({ id, updates: { [field]: value } });
    }, [updateProduct])

    const handleDeleteProduct = React.useCallback((product: ProductWithCategory) => {
        const confirmed = window.confirm(`"${product.name}" ürününü silmek istediğinize emin misiniz?`)
        if (!confirmed) return

        deleteProduct.mutate(product.id, {
            onError: (error: unknown) => {
                const message = error instanceof Error ? error.message : "Ürün silinemedi."
                alert(message)
            },
        })
    }, [deleteProduct])

    const columns = React.useMemo(() => {
        return getProductColumns(handleUpdateProduct, handleDeleteProduct)
    }, [handleUpdateProduct, handleDeleteProduct])

    const handleCreateProduct = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setCreateError("")
        setCreateSuccess("")

        const name = newProduct.name.trim()
        const sku = newProduct.sku.trim().toUpperCase()
        if (!name || !sku) {
            setCreateError("Ürün adı ve SKU zorunludur.")
            return
        }

        const rawSalePrice = newProduct.salePrice.trim()
        const salePriceNumber = rawSalePrice ? Number(rawSalePrice) : null
        if (rawSalePrice && (salePriceNumber === null || Number.isNaN(salePriceNumber) || salePriceNumber < 0)) {
            setCreateError("Satış fiyatı geçerli bir sayı olmalıdır.")
            return
        }

        const quantityNumber = Number(newProduct.quantityOnHand)
        if (!Number.isFinite(quantityNumber) || quantityNumber < 0) {
            setCreateError("Stok adedi sıfır veya daha büyük bir sayı olmalıdır.")
            return
        }

        const slugBase = slugify(name)
        const skuPart = slugify(sku)
        const fallbackSuffix = Date.now().toString()
        const slug = [slugBase || "urun", skuPart || fallbackSuffix].join("-")

        const payload: ProductInsert = {
            name,
            sku,
            slug,
            category_id: newProduct.categoryId === "all" ? null : newProduct.categoryId,
            quantity_on_hand: quantityNumber,
            sale_price: salePriceNumber !== null ? salePriceNumber.toFixed(2) : null,
            status: newProduct.status as ProductInsert['status'],
        }

        createProduct.mutate(payload, {
            onSuccess: () => {
                setCreateSuccess("Ürün eklendi.")
                setNewProduct({
                    name: "",
                    sku: "",
                    categoryId: "all",
                    salePrice: "",
                    quantityOnHand: "0",
                    status: "active",
                })
                setPage(1)
            },
            onError: (error: unknown) => {
                const message = error instanceof Error ? error.message : "Ürün eklenemedi."
                setCreateError(message)
            },
        })
    }

    return (
        <div className="flex flex-col space-y-6">
            <div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Ürün Yönetimi</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Ürün kataloğunuzu yönetin, stok durumunu izleyin ve fiyatları çift tıklayarak anında güncelleyin.
                    </p>
                </div>
            </div>

            <Card className="border-slate-200/70 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold">Yeni Ürün Ekle</CardTitle>
                    <CardDescription>
                        Basit ürün kaydı: ad, SKU, kategori, fiyat ve stok bilgisi.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handleCreateProduct}>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                            <Input
                                value={newProduct.name}
                                onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))}
                                placeholder="Ürün adı"
                                required
                                className="xl:col-span-2"
                            />
                            <Input
                                value={newProduct.sku}
                                onChange={(event) => setNewProduct((prev) => ({ ...prev, sku: event.target.value }))}
                                placeholder="SKU"
                                required
                            />
                            <Select
                                value={newProduct.categoryId}
                                onValueChange={(value) => setNewProduct((prev) => ({ ...prev, categoryId: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Kategori yok</SelectItem>
                                    {(categoriesData || []).map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                value={newProduct.salePrice}
                                onChange={(event) => setNewProduct((prev) => ({ ...prev, salePrice: event.target.value }))}
                                placeholder="Satış Fiyatı (TRY)"
                                type="number"
                                min="0"
                                step="0.01"
                            />
                            <Input
                                value={newProduct.quantityOnHand}
                                onChange={(event) => setNewProduct((prev) => ({ ...prev, quantityOnHand: event.target.value }))}
                                placeholder="Stok"
                                type="number"
                                min="0"
                                step="1"
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full sm:w-[220px]">
                                <Select
                                    value={newProduct.status}
                                    onValueChange={(value) => setNewProduct((prev) => ({ ...prev, status: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Durum" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Aktif</SelectItem>
                                        <SelectItem value="draft">Taslak</SelectItem>
                                        <SelectItem value="inactive">Pasif</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button type="submit" disabled={createProduct.isPending}>
                                <PlusCircle className="h-4 w-4" />
                                {createProduct.isPending ? "Ekleniyor..." : "Ürün Ekle"}
                            </Button>
                        </div>

                        {createError && (
                            <p className="text-sm text-red-600 font-medium">{createError}</p>
                        )}
                        {createSuccess && (
                            <p className="text-sm text-emerald-600 font-medium">{createSuccess}</p>
                        )}
                    </form>
                </CardContent>
            </Card>

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

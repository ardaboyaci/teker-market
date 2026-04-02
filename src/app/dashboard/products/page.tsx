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
import { ProductDetailPanel } from "@/components/products/product-detail-panel"
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
import { PlusCircle, ChevronDown, ChevronUp } from "lucide-react"
import { useSearchParams } from "next/navigation"
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

const SUPPLIERS = [
    { label: "Tümü", value: "all" },
    { label: "EMES", value: "EMES" },
    { label: "CFT", value: "CFT" },
    { label: "OSK", value: "OSK" },
    { label: "KAU", value: "KAU" },
    { label: "FAL", value: "FAL" },
    { label: "ZET", value: "ZET" },
    { label: "EMS KUL", value: "EMES_KULP" },
    { label: "YDK EMS", value: "YEDEK_EMES" },
    { label: "MRT", value: "MERTSAN" },
]

export default function ProductsPage() {
    const searchParams = useSearchParams()
    const [page, setPage] = React.useState(1)
    const [search, setSearch] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("all")
    const [status, setStatus] = React.useState("all")
    const [supplier, setSupplier] = React.useState("all")
    const [contentFilter, setContentFilter] = React.useState<"all" | "no-image" | "no-description">("all")
    const [isFormOpen, setIsFormOpen] = React.useState(false)
    const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)

    // URL'den gelen filter param'ını oku (dashboard coverage kartlarından link)
    React.useEffect(() => {
        const f = searchParams.get("filter")
        if (f === "no-image" || f === "no-description") setContentFilter(f)
    }, [searchParams])
    const [createError, setCreateError] = React.useState("")
    const [createSuccess, setCreateSuccess] = React.useState("")
    const [selectedProduct, setSelectedProduct] = React.useState<ProductWithCategory | null>(null)
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
    const { data, isLoading } = useProducts({ page, pageSize, search, categoryId, status, supplier })
    const updateProduct = useUpdateProduct()
    const createProduct = useCreateProduct()
    const deleteProduct = useDeleteProduct()

    const handleUpdateProduct = React.useCallback((id: string, field: string, value: unknown) => {
        if (!id) return;
        updateProduct.mutate({ id, updates: { [field]: value } });
    }, [updateProduct])

    const handleDeleteProduct = React.useCallback((product: ProductWithCategory) => {
        setPendingDeleteId(product.id)
    }, [])

    const confirmDelete = React.useCallback((id: string) => {
        deleteProduct.mutate(id, {
            onSuccess: () => setPendingDeleteId(null),
            onError: (error: unknown) => {
                const message = error instanceof Error ? error.message : "Ürün silinemedi."
                alert(message)
                setPendingDeleteId(null)
            },
        })
    }, [deleteProduct])

    const columns = React.useMemo(() => {
        return getProductColumns(handleUpdateProduct, handleDeleteProduct, pendingDeleteId, confirmDelete)
    }, [handleUpdateProduct, handleDeleteProduct, pendingDeleteId, confirmDelete])

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
                    <h1 className="text-2xl font-bold tracking-tight">Ürün Kataloğu</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Ürün kataloğunuzu yönetin, stok durumunu izleyin ve fiyatları çift tıklayarak anında güncelleyin.
                    </p>
                </div>
            </div>

            {/* Tedarikçi Filtre Çipleri */}
            <div className="flex items-center gap-2 flex-wrap">
                {SUPPLIERS.map((s) => (
                    <button
                        key={s.value}
                        onClick={() => { setSupplier(s.value); setPage(1); }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            supplier === s.value
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <Card className="border-slate-200/70 shadow-sm">
                <CardHeader
                    className="pb-4 cursor-pointer select-none"
                    onClick={() => setIsFormOpen(o => !o)}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <PlusCircle className="h-4 w-4 text-primary" />
                                Yeni Ürün Ekle
                            </CardTitle>
                            {!isFormOpen && (
                                <CardDescription className="mt-0.5">
                                    Tıklayarak formu aç
                                </CardDescription>
                            )}
                        </div>
                        {isFormOpen
                            ? <ChevronUp className="h-4 w-4 text-slate-400" />
                            : <ChevronDown className="h-4 w-4 text-slate-400" />
                        }
                    </div>
                </CardHeader>
                {isFormOpen && (
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
                )}
            </Card>

            {/* Aktif content filter bildirimi */}
            {contentFilter !== "all" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <span>Filtre aktif: <strong>{contentFilter === "no-image" ? "Görselsiz ürünler" : "Açıklamasız ürünler"}</strong></span>
                    <button
                        onClick={() => setContentFilter("all")}
                        className="ml-auto text-xs underline hover:no-underline"
                    >
                        Filtreyi kaldır
                    </button>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className={`transition-all duration-300 ${selectedProduct ? "w-full lg:w-[55%] xl:w-[60%]" : "w-full"}`}>
                    <ProductDataGrid
                        columns={columns}
                        data={(data?.products || []).filter(p => {
                            if (contentFilter === "no-image") return !p.image_url
                            if (contentFilter === "no-description") return !p.description || p.description.trim() === ""
                            return true
                        })}
                        totalCount={data?.totalCount || 0}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onSearchChange={(val) => {
                            setSearch(val)
                            setPage(1)
                        }}
                        categoryId={categoryId}
                        onCategoryChange={(val) => { setCategoryId(val); setPage(1); }}
                        status={status}
                        onStatusChange={(val) => { setStatus(val); setPage(1); }}
                        categories={categoriesData || []}
                        isLoading={isLoading}
                        onDeleteProduct={handleDeleteProduct}
                        onRowClick={setSelectedProduct}
                        selectedProductId={selectedProduct?.id}
                    />
                </div>

                {selectedProduct && (
                    <div className="w-full lg:w-[45%] xl:w-[40%] lg:sticky top-6">
                        <ProductDetailPanel 
                            product={selectedProduct} 
                            onClose={() => setSelectedProduct(null)}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

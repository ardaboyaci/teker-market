"use client"

import * as React from "react"
import { Search, Loader2, Check, PackageSearch } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Database } from "@/types/supabase"

type Product = Database['public']['Tables']['products']['Row']

export function QuickSkuSearch() {
    const supabase = createBrowserClient()
    const queryClient = useQueryClient()
    const [searchTerm, setSearchTerm] = React.useState("")
    const [debouncedTerm, setDebouncedTerm] = React.useState("")
    const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
    const [newQuantity, setNewQuantity] = React.useState<string>("")
    const inputRef = React.useRef<HTMLInputElement>(null)
    const quantityInputRef = React.useRef<HTMLInputElement>(null)

    // Arama kelimesini debounce (gecikmeli) işlemiyle veritabanına sor
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTerm(searchTerm.trim())
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['quick-search', debouncedTerm],
        queryFn: async () => {
            if (!debouncedTerm) return []
            
            // SKU veya İsim üzerinden esnek (fuzzy) arama
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .is('deleted_at', null)
                .or(`sku.ilike.%${debouncedTerm}%,name.ilike.%${debouncedTerm}%`)
                .order('sku', { ascending: true })
                .limit(5)
            
            if (error) throw error
            return data
        },
        enabled: debouncedTerm.length > 1,
    })

    const updateStockMutation = useMutation({
        mutationFn: async ({ id, newStock }: { id: string, newStock: number }) => {
            const { data, error } = await supabase
                .from('products')
                .update({ quantity_on_hand: newStock })
                .eq('id', id)
                .select()
                .single()
            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quick-search'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setSelectedProduct(null)
            setSearchTerm("")
            setNewQuantity("")
            // İşlem sonrası tekrar aramaya tıkla
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    })

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product)
        setNewQuantity((product.quantity_on_hand ?? 0).toString())
        setTimeout(() => quantityInputRef.current?.focus(), 100)
    }

    const handleSubmitStock = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProduct) return
        const num = parseInt(newQuantity, 10)
        if (isNaN(num) || num < 0) return

        updateStockMutation.mutate({ id: selectedProduct.id, newStock: num })
    }

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
            {/* Dekoratif arka plan "Tech Modern" dokunuşu */}
            <div className="absolute top-0 right-0 -mx-10 -my-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-start justify-between">
                
                {/* Sol Taraf - SKU Arama Çubuğu */}
                <div className="flex-1 space-y-4 max-w-xl">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <PackageSearch className="w-5 h-5 text-primary" />
                            Hızlı SKU & Stok Güncelleyici
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Ürün kodunun (SKU) bir kısmını veya ürün adını yazarak en yakın eşleşmeleri bulun.
                        </p>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            {isSearching ? (
                                <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                            ) : (
                                <Search className="h-5 w-5 text-slate-400" />
                            )}
                        </div>
                        <Input
                            ref={inputRef}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Örn: 110-100 veya Döner Teker..."
                            className="bg-slate-50 border-slate-200 text-slate-900 pl-10 h-14 text-lg placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-2 shadow-inner"
                        />
                    </div>

                    {/* Canlı Arama Sonuçları Listesi */}
                    {debouncedTerm.length > 1 && !selectedProduct && (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-2 animate-in fade-in slide-in-from-top-2 shadow-md">
                            {searchResults && searchResults.length > 0 ? (
                                <ul className="divide-y divide-slate-100">
                                    {searchResults.map(result => {
                                        const thumb = (result.meta as any)?.images?.[0] ?? null
                                        return (
                                        <li
                                            key={result.id}
                                            className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors group"
                                            onClick={() => handleSelectProduct(result)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Thumbnail */}
                                                <div className="w-10 h-10 rounded-md bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                                                    {thumb ? (
                                                        <img src={thumb} alt={result.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <PackageSearch className="w-5 h-5 text-slate-300" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800">{result.sku}</span>
                                                    <span className="text-sm text-slate-500 line-clamp-1">{result.name}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-400">Mevcut</div>
                                                    <div className="font-semibold text-slate-900">{result.quantity_on_hand ?? 0} <span className="text-xs text-slate-400 font-normal">adet</span></div>
                                                </div>
                                                <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white hover:bg-primary/90">
                                                    Seç
                                                </Button>
                                            </div>
                                        </li>
                                    )})}

                                </ul>
                            ) : (
                                <div className="p-4 text-sm text-slate-500 text-center">
                                    Olası ürün uyuşmazlığı: Eşleşen ürün bulunamadı. Lütfen kodu kontrol edin.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sağ Taraf - Stok Düzenleme Kutusu (Sadece bir ürün listeden seçildiğinde görünür) */}
                {selectedProduct && (
                    <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-inner animate-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-start gap-3">
                                {/* Büyük fotoğraf — görsel teyit */}
                                {(() => {
                                    const img = (selectedProduct.meta as any)?.images?.[0] ?? null
                                    return (
                                        <div className="w-20 h-20 rounded-lg bg-white flex-shrink-0 overflow-hidden border border-slate-200">
                                            {img ? (
                                                <img src={img} alt={selectedProduct.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <PackageSearch className="w-8 h-8 text-slate-300" />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                                <div>
                                    <h3 className="text-sm font-medium text-primary">Görsel Teyit / Seçili Ürün</h3>
                                    <p className="font-bold text-slate-900 text-lg mt-0.5">{selectedProduct.sku}</p>
                                    <p className="text-sm text-slate-500 line-clamp-2 mt-1">{selectedProduct.name}</p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-slate-400 hover:text-slate-600 h-8 hover:bg-slate-200"
                                onClick={() => setSelectedProduct(null)}
                            >
                                Farklı Ara
                            </Button>
                        </div>

                        <form onSubmit={handleSubmitStock} className="flex gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-slate-500 font-medium mb-1.5 block">YENİ STOK MİKTARI</label>
                                <Input
                                    ref={quantityInputRef}
                                    type="number"
                                    min="0"
                                    required
                                    value={newQuantity}
                                    onChange={(e) => setNewQuantity(e.target.value)}
                                    className="h-12 text-center text-xl font-bold bg-white border-slate-300 text-slate-900 focus-visible:ring-primary focus-visible:border-primary"
                                />
                            </div>
                            <div className="flex items-end">
                                <Button 
                                    type="submit" 
                                    disabled={updateStockMutation.isPending}
                                    className="h-12 px-6 bg-primary hover:bg-primary/90 text-white font-bold"
                                >
                                    {updateStockMutation.isPending ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="w-5 h-5 mr-2" />
                                            KAYDET
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}

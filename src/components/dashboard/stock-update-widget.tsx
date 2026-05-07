/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import Image from "next/image"
import { Search, Loader2, Check, PackageSearch, Upload, FileSpreadsheet, RefreshCw, AlertCircle, Plus, Minus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as xlsx from "xlsx"

interface Product {
    id: string
    sku: string
    name: string
    quantity_on_hand: number
    image_url: string | null
    meta: any
}

interface RecentUpdate {
    id: string
    name: string
    oldStock: number
    newStock: number
    timestamp: Date
}

interface BulkPreviewRow {
    sku: string
    newStock: number
    product: Product | null
    status: 'pending' | 'success' | 'error'
    errorMsg?: string
}

export function StockUpdateWidget() {
    const queryClient = useQueryClient()

    const [activeTab, setActiveTab] = React.useState<'single' | 'bulk'>('single')
    const [searchTerm, setSearchTerm] = React.useState("")
    const [debouncedTerm, setDebouncedTerm] = React.useState("")
    const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
    const [newQuantity, setNewQuantity] = React.useState<string>("")
    const [note, setNote] = React.useState<string>("")
    const [recentUpdates, setRecentUpdates] = React.useState<RecentUpdate[]>([])
    const [bulkRows, setBulkRows] = React.useState<BulkPreviewRow[]>([])
    const [isProcessingFile, setIsProcessingFile] = React.useState(false)
    const [bulkResult, setBulkResult] = React.useState<{success: number, error: number, notFound: number} | null>(null)
    const [isBulkUpdating, setIsBulkUpdating] = React.useState(false)

    const inputRef = React.useRef<HTMLInputElement>(null)
    const quantityInputRef = React.useRef<HTMLInputElement>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 300)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['quick-search', debouncedTerm],
        queryFn: async () => {
            if (!debouncedTerm) return []
            const res = await fetch(`/api/products/quick-search?q=${encodeURIComponent(debouncedTerm)}&limit=5`)
            if (!res.ok) return []
            const json = await res.json()
            return (json.products ?? []) as Product[]
        },
        enabled: debouncedTerm.length > 1,
    })

    const updateStockMutation = useMutation({
        mutationFn: async ({ id, newStock, oldStock, note }: { id: string, newStock: number, oldStock: number, note: string }) => {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity_on_hand: newStock }),
            })
            if (!res.ok) throw new Error('Güncelleme başarısız.')

            const qty = newStock - oldStock
            await fetch('/api/stock-movements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id:      id,
                    movement_type:   qty > 0 ? 'in' : qty < 0 ? 'out' : 'adjustment',
                    quantity:        qty,
                    quantity_before: oldStock,
                    quantity_after:  newStock,
                    reference_type:  'manual',
                    reference_note:  note.trim() || 'Dashboard manuel güncelleme',
                }),
            })
            return { id, newStock }
        },
        onSuccess: (_, variables) => {
            if (selectedProduct) {
                const newUpdate: RecentUpdate = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: selectedProduct.name,
                    oldStock: selectedProduct.quantity_on_hand ?? 0,
                    newStock: variables.newStock,
                    timestamp: new Date(),
                }
                setRecentUpdates(prev => [newUpdate, ...prev].slice(0, 10))
            }
            queryClient.invalidateQueries({ queryKey: ['quick-search'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
            setSelectedProduct(null)
            setSearchTerm("")
            setNewQuantity("")
            setNote("")
            setTimeout(() => inputRef.current?.focus(), 100)
        },
    })

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product)
        setNewQuantity((product.quantity_on_hand ?? 0).toString())
        setTimeout(() => quantityInputRef.current?.focus(), 100)
    }

    const adjustQuantity = (amount: number) => {
        setNewQuantity(prev => Math.max(0, (parseInt(prev) || 0) + amount).toString())
    }

    const handleSubmitStock = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProduct) return
        const num = parseInt(newQuantity, 10)
        if (isNaN(num) || num < 0) return
        updateStockMutation.mutate({ id: selectedProduct.id, newStock: num, oldStock: selectedProduct.quantity_on_hand ?? 0, note })
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsProcessingFile(true)
        setBulkResult(null)
        try {
            const buffer = await file.arrayBuffer()
            const workbook = xlsx.read(buffer, { type: 'array' })
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = xlsx.utils.sheet_to_json<any>(firstSheet, { header: 1 })

            let skuIdx = -1, stockIdx = -1
            const firstRow = (jsonData[0] as any[]) || []
            firstRow.forEach((col, idx) => {
                if (typeof col === 'string') {
                    const n = col.toLowerCase()
                    if (n.includes('sku') || n.includes('kod')) skuIdx = idx
                    if (n.includes('stok') || n.includes('adet') || n.includes('miktar')) stockIdx = idx
                }
            })
            let startIndex = 1
            if (skuIdx === -1 || stockIdx === -1) { skuIdx = 0; stockIdx = 1; startIndex = 0 }

            const parsedRows: {sku: string, newStock: number}[] = []
            for (let i = startIndex; i < jsonData.length; i++) {
                const row = jsonData[i] as any[]
                if (!row || row.length < 2) continue
                const rawSku = row[skuIdx]
                const stockVal = parseInt(row[stockIdx], 10)
                if (!rawSku || isNaN(stockVal)) continue
                parsedRows.push({ sku: String(rawSku).trim(), newStock: Math.max(0, stockVal) })
            }

            if (parsedRows.length > 0) {
                const skus = parsedRows.map(r => r.sku)
                const chunkSize = 100
                const matchedProducts: Product[] = []

                for (let i = 0; i < skus.length; i += chunkSize) {
                    const chunk = skus.slice(i, i + chunkSize)
                    const res = await fetch(`/api/products/quick-search?q=${encodeURIComponent(chunk[0])}&limit=100`)
                    if (res.ok) {
                        const json = await res.json()
                        const found = (json.products ?? []).filter((p: Product) => chunk.includes(p.sku))
                        matchedProducts.push(...found)
                    }
                }

                const mapBySku = new Map<string, Product>()
                matchedProducts.forEach(p => mapBySku.set(p.sku.toLowerCase(), p))

                setBulkRows(parsedRows.map(row => ({
                    sku: row.sku,
                    newStock: row.newStock,
                    product: mapBySku.get(row.sku.toLowerCase()) || null,
                    status: 'pending' as const,
                })))
            } else {
                setBulkRows([])
            }
        } catch (err) {
            console.error("File processing error", err)
            alert("Dosya işlenirken hata oluştu.")
        } finally {
            setIsProcessingFile(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const executeBulkUpdate = async () => {
        if (bulkRows.length === 0) return
        setIsBulkUpdating(true)
        const validRows = bulkRows.filter(r => r.product !== null)
        let successCount = 0, errorCount = 0

        for (const row of validRows) {
            const oldStock = row.product!.quantity_on_hand ?? 0
            const res = await fetch(`/api/products/${row.product!.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity_on_hand: row.newStock }),
            })

            if (res.ok) {
                await fetch('/api/stock-movements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_id:      row.product!.id,
                        movement_type:   'adjustment',
                        quantity:        row.newStock - oldStock,
                        quantity_before: oldStock,
                        quantity_after:  row.newStock,
                        reference_type:  'bulk_update',
                        reference_note:  'Toplu Excel/CSV güncelleme',
                    }),
                })
                successCount++
            } else {
                errorCount++
            }

            setBulkRows(prev => prev.map(r =>
                r.sku === row.sku ? { ...r, status: res.ok ? 'success' : 'error' } : r
            ))
        }

        queryClient.invalidateQueries({ queryKey: ['products'] })
        setBulkResult({ success: successCount, error: errorCount, notFound: bulkRows.length - validRows.length })
        setIsBulkUpdating(false)
    }

    const clearBulkData = () => { setBulkRows([]); setBulkResult(null) }

    function timeAgo(date: Date) {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
        if (seconds < 60) return `${seconds} saniye önce`
        if (seconds < 3600) return `${Math.floor(seconds / 60)} dk önce`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat önce`
        return `${Math.floor(seconds / 86400)} gün önce`
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 -mx-10 -my-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex border-b border-slate-200">
                <button className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'single' ? 'text-primary border-b-2 border-primary bg-slate-50' : 'text-slate-500 hover:bg-slate-50/50'}`} onClick={() => setActiveTab('single')}>
                    <Search className="w-4 h-4" /> Tek Ürün Güncelleme
                </button>
                <button className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'bulk' ? 'text-primary border-b-2 border-primary bg-slate-50' : 'text-slate-500 hover:bg-slate-50/50'}`} onClick={() => setActiveTab('bulk')}>
                    <FileSpreadsheet className="w-4 h-4" /> Toplu (Excel/CSV)
                </button>
            </div>

            <div className="p-6 relative z-10 min-h-[400px]">
                {activeTab === 'single' && (
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex-1 w-full max-w-xl space-y-4">
                            {!selectedProduct ? (
                                <>
                                    <div>
                                        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                            <PackageSearch className="w-5 h-5 text-primary" /> SKU & Stok Ara
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">Ürün kodunun (SKU) bir kısmını veya ürün adını yazarak arayın.</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            {isSearching ? <Loader2 className="h-5 w-5 text-slate-400 animate-spin" /> : <Search className="h-5 w-5 text-slate-400" />}
                                        </div>
                                        <Input ref={inputRef} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                            placeholder="Örn: 110-100 veya Döner Teker..."
                                            className="bg-slate-50 border-slate-200 text-slate-900 pl-10 h-14 text-lg placeholder:text-slate-400 focus-visible:ring-primary focus-visible:ring-2 shadow-inner" />
                                    </div>
                                    {debouncedTerm.length > 1 && (
                                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-2 animate-in fade-in slide-in-from-top-2 shadow-md">
                                            {searchResults && searchResults.length > 0 ? (
                                                <ul className="divide-y divide-slate-100">
                                                    {searchResults.map(result => {
                                                        const thumb = result.image_url ?? result.meta?.images?.[0] ?? null
                                                        return (
                                                            <li key={result.id} className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors group" onClick={() => handleSelectProduct(result)}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-md bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                                                                        {thumb ? <Image src={thumb} alt={result.name} width={40} height={40} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><PackageSearch className="w-5 h-5 text-slate-300" /></div>}
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-slate-800">{result.sku}</span>
                                                                        <span className="text-sm text-slate-500 line-clamp-1">{result.name}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-right">
                                                                        <div className="text-xs text-slate-400">Mevcut</div>
                                                                        <div className="font-semibold text-slate-900">{result.quantity_on_hand ?? 0}</div>
                                                                    </div>
                                                                    <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white hover:bg-primary/90">Seç</Button>
                                                                </div>
                                                            </li>
                                                        )
                                                    })}
                                                </ul>
                                            ) : (
                                                <div className="p-4 text-sm text-slate-500 text-center">Eşleşen ürün bulunamadı.</div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-inner w-full">
                                    <div className="flex justify-between items-start mb-6 border-b border-slate-200 pb-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 rounded-lg bg-white flex-shrink-0 overflow-hidden border border-slate-200">
                                                {selectedProduct.image_url ? <Image src={selectedProduct.image_url} alt={selectedProduct.name} width={64} height={64} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><PackageSearch className="w-6 h-6 text-slate-300" /></div>}
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-semibold uppercase text-primary tracking-wider mb-1">Seçili Ürün</h3>
                                                <p className="font-bold text-slate-900 text-xl">{selectedProduct.sku}</p>
                                                <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{selectedProduct.name}</p>
                                                <div className="mt-2 text-sm text-slate-600">Mevcut Stok: <span className="font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800">{selectedProduct.quantity_on_hand ?? 0}</span></div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 shrink-0" onClick={() => setSelectedProduct(null)}>Farklı Seç</Button>
                                    </div>
                                    <form onSubmit={handleSubmitStock} className="flex flex-col gap-4">
                                        <label className="text-sm font-bold text-slate-800">Yeni Stok Adedi</label>
                                        <div className="flex items-center gap-4">
                                            <Input ref={quantityInputRef} type="number" min="0" required value={newQuantity} onChange={e => setNewQuantity(e.target.value)}
                                                className="h-14 w-32 text-center text-2xl font-bold bg-white border-slate-300 text-slate-900 focus-visible:ring-primary focus-visible:border-primary shadow-sm" />
                                            <div className="flex flex-wrap gap-2 flex-1">
                                                <Button type="button" variant="outline" size="sm" onClick={() => adjustQuantity(-10)} className="h-10 text-rose-600 border-rose-200 hover:bg-rose-50 font-bold bg-white"><Minus className="w-4 h-4 mr-1" /> 10</Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => adjustQuantity(10)} className="h-10 text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-bold bg-white"><Plus className="w-4 h-4 mr-1" /> 10</Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => adjustQuantity(50)} className="h-10 text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-bold bg-white"><Plus className="w-4 h-4 mr-1" /> 50</Button>
                                            </div>
                                        </div>
                                        <Input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Not (isteğe bağlı, ör: Yeni sevkiyat)" className="h-10 text-sm bg-white border-slate-300 text-slate-700 placeholder:text-slate-400" />
                                        <Button type="submit" disabled={updateStockMutation.isPending} className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg shadow-sm">
                                            {updateStockMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5 mr-2" /> STOĞU GÜNCELLE</>}
                                        </Button>
                                    </form>
                                </div>
                            )}
                        </div>
                        <div className="w-full md:w-80 border-l border-slate-200 pl-8 hidden md:block">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-primary" /> Son Revizeler
                            </h3>
                            {recentUpdates.length > 0 ? (
                                <ul className="space-y-4">
                                    {recentUpdates.map(u => (
                                        <li key={u.id} className="text-sm animate-in fade-in slide-in-from-left-2">
                                            <p className="font-semibold text-slate-800 line-clamp-1" title={u.name}>{u.name}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-slate-500 line-through">{u.oldStock}</span>
                                                    <span>→</span>
                                                    <span className={`font-bold ${u.newStock > u.oldStock ? 'text-emerald-600' : 'text-rose-600'}`}>{u.newStock}</span>
                                                </div>
                                                <span className="text-xs text-slate-400">{timeAgo(u.timestamp)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-400 text-center mt-8">Henüz bu oturumda güncelleme yapılmadı.</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'bulk' && (
                    <div className="space-y-6">
                        {bulkRows.length === 0 ? (
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:bg-slate-50 hover:border-primary transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileUpload} />
                                <Upload className="w-12 h-12 text-slate-300 group-hover:text-primary mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-slate-900 mb-2">CSV veya Excel Yükle</h3>
                                <p className="text-sm text-slate-500 max-w-sm mx-auto">Dosyanızda <strong>SKU</strong> ve <strong>YeniStok</strong> adlı iki sütun bulunmalıdır.</p>
                                {isProcessingFile && <div className="mt-4 text-primary text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> İşleniyor...</div>}
                            </div>
                        ) : (
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Önizleme ve Onay</h3>
                                        <p className="text-sm text-slate-500">Dosyadan {bulkRows.length} satır ayrıştırıldı.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button variant="outline" onClick={clearBulkData} disabled={isBulkUpdating}>İptal Et</Button>
                                        {!bulkResult && (
                                            <Button onClick={executeBulkUpdate} disabled={isBulkUpdating || bulkRows.every(r => r.product === null)} className="bg-primary hover:bg-primary/90 text-white font-bold">
                                                {isBulkUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                                                Onayla ve Güncelle ({bulkRows.filter(r => r.product).length} Ürün)
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {bulkResult && (
                                    <div className={`p-4 rounded-lg mb-6 border ${bulkResult.error > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                        <h4 className={`font-bold ${bulkResult.error > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>Güncelleme Raporu</h4>
                                        <ul className={`text-sm mt-2 ${bulkResult.error > 0 ? 'text-amber-700' : 'text-emerald-700'} space-y-1 font-medium`}>
                                            <li>✅ {bulkResult.success} ürün başarıyla güncellendi.</li>
                                            {bulkResult.error > 0 && <li>❌ {bulkResult.error} üründe hata oluştu.</li>}
                                            {bulkResult.notFound > 0 && <li>⚠️ {bulkResult.notFound} SKU sistemde bulunamadı.</li>}
                                        </ul>
                                    </div>
                                )}
                                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-sm text-left text-slate-500 font-medium">
                                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-3">Durum</th>
                                                <th className="px-6 py-3">SKU</th>
                                                <th className="px-6 py-3">Bulunan Ad</th>
                                                <th className="px-6 py-3 text-right">Eski Stok</th>
                                                <th className="px-6 py-3 text-right">Yeni Stok</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {bulkRows.map((row, idx) => (
                                                <tr key={idx} className={row.product ? 'bg-white' : 'bg-red-50'}>
                                                    <td className="px-6 py-3">
                                                        {!row.product ? <span className="text-amber-600 flex items-center gap-1 text-xs"><AlertCircle className="w-3 h-3" /> Bulunamadı</span>
                                                            : row.status === 'success' ? <span className="text-emerald-600 flex items-center gap-1 text-xs"><Check className="w-3 h-3" /> Başarılı</span>
                                                            : row.status === 'error' ? <span className="text-rose-600 flex items-center gap-1 text-xs"><AlertCircle className="w-3 h-3" /> Hata</span>
                                                            : <span className="text-slate-400 text-xs">Bekliyor</span>}
                                                    </td>
                                                    <td className="px-6 py-3 font-semibold text-slate-900">{row.sku}</td>
                                                    <td className="px-6 py-3 text-slate-600 line-clamp-1 max-w-[200px]">{row.product?.name || '-'}</td>
                                                    <td className="px-6 py-3 text-right opacity-70">{row.product?.quantity_on_hand ?? '-'}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-slate-900">{row.newStock}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
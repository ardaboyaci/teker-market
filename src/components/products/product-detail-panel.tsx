"use client"

import React, { useState, useEffect } from "react"
import { ProductWithCategory, useUpdateProduct } from "@/lib/hooks/use-products"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ImageOff, X, Save, Box, Tag, FileText } from "lucide-react"

export function ProductDetailPanel({ product, onClose }: { product: ProductWithCategory, onClose: () => void }) {
    const updateProduct = useUpdateProduct()
    
    const [formData, setFormData] = useState({
        quantity_on_hand: product.quantity_on_hand ?? 0,
        base_price: product.base_price != null ? String(product.base_price) : "",
        sale_price: product.sale_price != null ? String(product.sale_price) : "",
        wholesale_price: product.wholesale_price != null ? String(product.wholesale_price) : "",
        description: product.description || ""
    })

    useEffect(() => {
        setFormData({
            quantity_on_hand: product.quantity_on_hand ?? 0,
            base_price: product.base_price != null ? String(product.base_price) : "",
            sale_price: product.sale_price != null ? String(product.sale_price) : "",
            wholesale_price: product.wholesale_price != null ? String(product.wholesale_price) : "",
            description: product.description || ""
        })
    }, [product])

    const handleSave = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: Record<string, any> = {
            quantity_on_hand: formData.quantity_on_hand ? Number(formData.quantity_on_hand) : 0,
            base_price: formData.base_price ? Number(formData.base_price) : null,
            sale_price: formData.sale_price ? Number(formData.sale_price) : null,
            wholesale_price: formData.wholesale_price ? Number(formData.wholesale_price) : null,
            description: formData.description
        }
        updateProduct.mutate({ id: product.id, updates })
    }

    const img = (product as any).image_url
    const supplier = (product.meta as any)?.source || "Bilinmiyor"
    const attributes = (product as any).attributes || {}
    const compPrice = (product as any).competitor_price
    const compSource = (product as any).competitor_source
    const compDate = (product as any).competitor_scraped_at

    return (
        <Card className="h-full border-slate-200/70 shadow-sm relative overflow-hidden bg-white flex flex-col max-h-[calc(100vh-6rem)]">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose} 
                className="absolute right-4 top-4 hover:bg-slate-100 z-10"
            >
                <X className="w-4 h-4" />
            </Button>
            
            <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
                <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                        {img ? (
                            <img src={img} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                            <ImageOff className="w-8 h-8 text-slate-300" />
                        )}
                    </div>
                    <div className="flex flex-col space-y-1 mt-1 pr-8">
                        <div className="text-xs font-semibold tracking-wide text-primary uppercase">{supplier}</div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">{product.name}</h2>
                        <div className="text-sm font-medium text-slate-500">SKU: {product.sku}</div>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto p-0">
                <div className="p-5 space-y-8">
                    {/* Stock & Prices */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <Tag className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-bold text-slate-900">Fiyat & Stok</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600">Stok (Adet)</Label>
                                <Input 
                                    type="number" 
                                    value={formData.quantity_on_hand ?? ""} 
                                    onChange={e => setFormData({...formData, quantity_on_hand: Number(e.target.value)})}
                                    className="font-semibold bg-slate-50 border-slate-200"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600">Satış Fiyatı (TRY)</Label>
                                <Input 
                                    type="number" step="0.01" 
                                    value={formData.sale_price} 
                                    onChange={e => setFormData({...formData, sale_price: e.target.value})}
                                    className="font-semibold text-emerald-700 bg-emerald-50/30 border-emerald-200"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600">Liste/Baz Fiyat (TRY)</Label>
                                <Input 
                                    type="number" step="0.01" 
                                    value={formData.base_price} 
                                    onChange={e => setFormData({...formData, base_price: e.target.value})}
                                    className="border-slate-200"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-600">Toptan Fiyat (TRY)</Label>
                                <Input 
                                    type="number" step="0.01" 
                                    value={formData.wholesale_price} 
                                    onChange={e => setFormData({...formData, wholesale_price: e.target.value})}
                                    className="border-slate-200"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Competitor Price Readonly */}
                    {compPrice && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between items-center text-sm">
                            <div>
                                <strong className="text-amber-800">Rakip:</strong> <span className="text-amber-700">{compSource || "e-tekerlek"}</span>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-amber-700">₺{Number(compPrice).toFixed(2)}</div>
                                <div className="text-[10px] text-amber-600/70">{compDate ? new Date(compDate).toLocaleDateString() : 'Bilinmeyen'} tarihli</div>
                            </div>
                        </div>
                    )}

                    {/* Description Editor */}
                    <div className="space-y-4">
                        <div className="flex flex-col space-y-1 border-b pb-2">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-900">Ürün Açıklaması (HTML)</h3>
                            </div>
                            <p className="text-xs text-slate-500">TipTap kısıtlaması nedeniyle direkt HTML düzenleyici olarak ayarlıdır.</p>
                        </div>
                        <Textarea 
                            rows={8}
                            value={formData.description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, description: e.target.value})}
                            className="font-mono text-xs bg-slate-900 text-emerald-400 p-3 leading-relaxed border-slate-800 rounded-md focus-visible:ring-emerald-500"
                            placeholder="<p>Ürün açıklamasını buraya girin...</p>"
                        />
                    </div>

                    {/* Attributes */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <Box className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-bold text-slate-900">Özellikler</h3>
                        </div>
                        {Object.keys(attributes).length > 0 ? (
                            <div className="rounded-md border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-slate-100">
                                        {Object.entries(attributes).map(([k, v]) => (
                                            <tr key={k} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 bg-slate-50/50 text-slate-500 font-medium w-1/3">{k}</td>
                                                <td className="px-3 py-2 text-slate-900">{String(v)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400 italic">Özellik tanımlanmamış.</div>
                        )}
                    </div>
                </div>
            </CardContent>
            
            <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                <Button 
                    onClick={handleSave} 
                    disabled={updateProduct.isPending}
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-sm flex items-center justify-center gap-2 py-5"
                >
                    <Save className="w-4 h-4" />
                    {updateProduct.isPending ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </Button>
            </div>
        </Card>
    )
}

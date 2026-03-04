"use client"

import * as React from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useQueryClient } from "@tanstack/react-query"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface BulkUpdateDialogProps {
    isOpen: boolean
    onClose: () => void
    selectedIds: string[]
    onSuccess: () => void
}

export function BulkUpdateDialog({
    isOpen,
    onClose,
    selectedIds,
    onSuccess,
}: BulkUpdateDialogProps) {
    const supabase = createBrowserClient()
    const queryClient = useQueryClient()
    const [isLoading, setIsLoading] = React.useState(false)
    const [operation, setOperation] = React.useState<"zam" | "indirim">("zam")
    const [percentage, setPercentage] = React.useState("")

    const handleUpdate = async () => {
        if (!percentage || isNaN(Number(percentage))) return

        setIsLoading(true)
        try {
            const numPercentage = Number(percentage)
            // If operation is zam, multiplier is 1 + (percentage / 100). Ex: 10% = 1.10
            // If operation is indirim, multiplier is 1 - (percentage / 100). Ex: 10% = 0.90
            const multiplier = operation === "zam"
                ? 1 + (numPercentage / 100)
                : 1 - (numPercentage / 100)

            const { error } = await supabase.rpc('rpc_bulk_update_prices', {
                p_product_ids: selectedIds,
                p_operation: '*',
                p_value: multiplier,
                p_price_column: 'sale_price',
                p_reason: `Toplu Fiyat ${operation === 'zam' ? 'Artışı' : 'İndirimi'} (%${percentage})`
            })

            if (error) throw error

            onSuccess()
            queryClient.invalidateQueries({ queryKey: ['products'] })
            onClose()
            setPercentage("")
            setOperation("zam")
        } catch (error) {
            console.error("Toplu güncelleme hatası:", error)
            alert("Fiyatlar güncellenirken bir hata oluştu.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Toplu Fiyat Güncelleme</DialogTitle>
                    <DialogDescription>
                        Seçilen {selectedIds.length} ürünün satış fiyatına yüzde olarak zam veya indirim uygulayın.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-4">
                        <Select value={operation} onValueChange={(val: any) => setOperation(val)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="İşlem Tipi" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="zam">Zam Yap (+)</SelectItem>
                                <SelectItem value="indirim">İndirim Yap (-)</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="relative flex-1">
                            <Input
                                id="percentage"
                                type="number"
                                placeholder="Örn: 10"
                                value={percentage}
                                onChange={(e) => setPercentage(e.target.value)}
                                className="pr-8"
                            />
                            <span className="absolute right-3 top-2.5 text-sm text-slate-500 font-medium">%</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        İptal
                    </Button>
                    <Button onClick={handleUpdate} disabled={isLoading || !percentage}>
                        {isLoading ? "Güncelleniyor..." : "Uygula"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

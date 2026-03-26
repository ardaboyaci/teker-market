/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client"

import { MessageCircle } from "lucide-react"
import { useState } from "react"

interface WhatsAppOrderButtonProps {
    sku: string
    name: string
    defaultQty?: number
}

export function WhatsAppOrderButton({ sku, name, defaultQty = 1 }: WhatsAppOrderButtonProps) {
    const [qty, setQty] = useState(defaultQty)

    // Listen for quantity changes from QuantityInput via a shared approach
    // For now, qty is updated externally via the `defaultQty` prop
    const currentQty = defaultQty || qty

    const message = encodeURIComponent(
        `Merhaba,\n\nAşağıdaki ürün için sipariş vermek istiyorum:\n\n` +
        `📦 Ürün: ${name}\n` +
        `🔖 SKU: ${sku}\n` +
        `📊 Adet: ${currentQty}\n\n` +
        `Teşekkürler.`
    )

    return (
        <a
            href={`https://wa.me/908505551234?text=${message}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-sm"
        >
            <MessageCircle className="w-5 h-5" />
            WhatsApp ile Sipariş Ver
        </a>
    )
}

"use client"

import { useState } from "react"
import { QuantityInput } from "./quantity-input"
import { WhatsAppOrderButton } from "./whatsapp-order-button"

interface OrderSectionProps {
    sku: string
    name: string
    max: number
}

export function OrderSection({ sku, name, max }: OrderSectionProps) {
    const [qty, setQty] = useState(1)

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 pt-2">
            <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Adet</label>
                <QuantityInput max={max} onChange={setQty} />
            </div>
            <div className="flex-1 w-full sm:w-auto">
                <WhatsAppOrderButton sku={sku} name={name} defaultQty={qty} />
            </div>
        </div>
    )
}

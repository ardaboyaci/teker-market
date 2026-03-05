"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"

interface QuantityInputProps {
    max: number
    onChange?: (qty: number) => void
}

export function QuantityInput({ max, onChange }: QuantityInputProps) {
    const [qty, setQty] = useState(1)
    const effectiveMax = Math.max(max, 0)

    const update = (newQty: number) => {
        const clamped = Math.max(1, Math.min(newQty, effectiveMax || 9999))
        setQty(clamped)
        onChange?.(clamped)
    }

    return (
        <div className="flex items-center">
            <button
                onClick={() => update(qty - 1)}
                disabled={qty <= 1}
                className="w-10 h-10 rounded-l-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
                <Minus className="w-4 h-4 text-slate-600" />
            </button>
            <input
                type="number"
                value={qty}
                onChange={(e) => update(Number(e.target.value) || 1)}
                min={1}
                max={effectiveMax || undefined}
                className="w-16 h-10 border-y border-slate-200 text-center text-sm font-semibold text-slate-800 outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
                onClick={() => update(qty + 1)}
                disabled={effectiveMax > 0 && qty >= effectiveMax}
                className="w-10 h-10 rounded-r-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
                <Plus className="w-4 h-4 text-slate-600" />
            </button>
            {effectiveMax > 0 && effectiveMax <= 20 && (
                <span className="text-[11px] text-slate-400 ml-2">Maks. {effectiveMax}</span>
            )}
        </div>
    )
}

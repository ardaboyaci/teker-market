"use client"

import * as React from "react"
import { AlertTriangle, X } from "lucide-react"

interface AlertBandProps {
    zeroStockCount: number
    criticalStockCount: number
}

export function AlertBand({ zeroStockCount, criticalStockCount }: AlertBandProps) {
    const [dismissed, setDismissed] = React.useState(false)

    if ((zeroStockCount === 0 && criticalStockCount === 0) || dismissed) return null

    return (
        <div className="flex items-center justify-between gap-4 bg-red-600 text-white px-6 py-3 rounded-xl mb-6 shadow-lg shadow-red-600/20">
            <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
                <span className="text-sm font-semibold">
                    {zeroStockCount > 0 && (
                        <span className="mr-4">
                            <span className="font-extrabold text-base">{zeroStockCount}</span> ürün stok bitti
                        </span>
                    )}
                    {criticalStockCount > 0 && (
                        <span className="text-red-100">
                            <span className="font-extrabold text-base text-white">{criticalStockCount}</span> ürün kritik seviyede
                        </span>
                    )}
                </span>
            </div>
            <button
                onClick={() => setDismissed(true)}
                className="p-1 rounded hover:bg-red-500 transition-colors flex-shrink-0"
                aria-label="Kapat"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}

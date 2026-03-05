"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

const STORAGE_KEY = "tm_announcement_dismissed"

const messages = [
    "🔧 B2B Toptan Tekerlek Satışında Türkiye'nin Güvenilir Adresi",
    "🚚 500₺ Üzeri Siparişlerde Ücretsiz Kargo",
    "📞 Teknik Destek: 0850 XXX XX XX",
]

export function AnnouncementBar() {
    const [dismissed, setDismissed] = useState(true) // Start hidden to avoid flash

    useEffect(() => {
        const wasDismissed = localStorage.getItem(STORAGE_KEY)
        if (!wasDismissed) setDismissed(false)
    }, [])

    if (dismissed) return null

    return (
        <div className="bg-primary text-primary-foreground relative overflow-hidden">
            <div className="max-w-[1600px] mx-auto flex items-center justify-center h-9 px-10">
                {/* Marquee */}
                <div className="overflow-hidden whitespace-nowrap flex-1">
                    <div className="inline-flex animate-marquee gap-16">
                        {[...messages, ...messages].map((msg, i) => (
                            <span key={i} className="text-xs font-medium tracking-wide">
                                {msg}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Close */}
                <button
                    onClick={() => {
                        setDismissed(true)
                        localStorage.setItem(STORAGE_KEY, "1")
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 transition-colors"
                    aria-label="Duyuruyu kapat"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}

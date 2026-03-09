import { Phone, MessageCircle } from "lucide-react"
import Link from "next/link"

export function ContactBar() {
    return (
        <div className="bg-slate-900 text-slate-300">
            <div className="max-w-[1600px] mx-auto px-3 sm:px-6 min-h-9 py-1 flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
                <span className="hidden md:inline font-medium tracking-wide">
                    Endüstriyel Tekerlek & Roda Çözümleri
                </span>

                <div className="flex items-center gap-1.5 sm:gap-4 ml-auto min-w-0">
                    {/* Telefon */}
                    <a
                        href="tel:+908505551234"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 hover:bg-slate-800/70 hover:text-white transition-colors group"
                        title="Bizi arayın"
                    >
                        <Phone className="w-3 h-3 group-hover:animate-pulse" />
                        <span className="font-semibold hidden min-[420px]:inline">0850 555 12 34</span>
                        <span className="font-semibold min-[420px]:hidden">Ara</span>
                    </a>

                    <div className="hidden sm:block w-px h-3 bg-slate-700" />

                    {/* WhatsApp */}
                    <a
                        href="https://wa.me/908505551234?text=Merhaba%2C%20ürünleriniz%20hakkında%20bilgi%20almak%20istiyorum."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 hover:bg-slate-800/70 hover:text-emerald-400 transition-colors group"
                        title="WhatsApp ile yazın"
                    >
                        <MessageCircle className="w-3 h-3" />
                        <span className="font-semibold hidden min-[360px]:inline">WhatsApp</span>
                    </a>

                    <div className="hidden sm:block w-px h-3 bg-slate-700" />

                    {/* Bayi Girişi */}
                    <Link
                        href="/login"
                        className="inline-flex h-8 items-center rounded-md px-1.5 hover:bg-slate-800/70 hover:text-white transition-colors font-semibold"
                    >
                        <span className="hidden min-[420px]:inline">Bayi Girişi</span>
                        <span className="min-[420px]:hidden">Giriş</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}

import { Phone, MessageCircle } from "lucide-react"
import Link from "next/link"

export function ContactBar() {
    return (
        <div className="bg-slate-900 text-slate-300">
            <div className="max-w-[1600px] mx-auto px-6 h-8 flex items-center justify-between text-[11px]">
                <span className="hidden sm:inline font-medium tracking-wide">
                    Endüstriyel Tekerlek & Roda Çözümleri
                </span>

                <div className="flex items-center gap-4 ml-auto">
                    {/* Telefon */}
                    <a
                        href="tel:+908505551234"
                        className="flex items-center gap-1.5 hover:text-white transition-colors group"
                        title="Bizi arayın"
                    >
                        <Phone className="w-3 h-3 group-hover:animate-pulse" />
                        <span className="font-semibold">0850 555 12 34</span>
                    </a>

                    <div className="w-px h-3 bg-slate-700" />

                    {/* WhatsApp */}
                    <a
                        href="https://wa.me/908505551234?text=Merhaba%2C%20ürünleriniz%20hakkında%20bilgi%20almak%20istiyorum."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors group"
                        title="WhatsApp ile yazın"
                    >
                        <MessageCircle className="w-3 h-3" />
                        <span className="font-semibold">WhatsApp</span>
                    </a>

                    <div className="w-px h-3 bg-slate-700" />

                    {/* Bayi Girişi */}
                    <Link
                        href="/login"
                        className="hover:text-white transition-colors font-semibold"
                    >
                        Bayi Girişi
                    </Link>
                </div>
            </div>
        </div>
    )
}

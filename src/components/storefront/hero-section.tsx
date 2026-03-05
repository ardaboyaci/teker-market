import Link from "next/link"
import { ArrowRight, MessageCircle } from "lucide-react"

export function HeroSection() {
    return (
        <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />

            <div className="max-w-[1600px] mx-auto px-6 py-16 md:py-24 relative z-10">
                <div className="max-w-2xl">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground border border-primary/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        B2B Toptan Satış Platformu
                    </div>

                    {/* H1 */}
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
                        Endüstriyel{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                            Tekerlek
                        </span>{" "}
                        Çözümleri
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 leading-relaxed mb-8 max-w-lg">
                        600+ ürün, rekabetçi toptan fiyatlar ve teknik danışmanlık.
                        Endüstriyel tekerlek ve roda ihtiyaçlarınız için güvenilir çözüm ortağınız.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                            href="/#products"
                            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 text-sm"
                        >
                            Ürünleri İncele
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a
                            href="https://wa.me/908505551234?text=Merhaba%2C%20toptan%20fiyat%20almak%20istiyorum."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur text-white font-semibold px-6 py-3 rounded-xl transition-all border border-white/10 text-sm"
                        >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp ile Teklif Al
                        </a>
                    </div>

                    {/* Stats Mini */}
                    <div className="flex gap-8 mt-12 pt-8 border-t border-white/10">
                        <div>
                            <p className="text-2xl font-extrabold text-white">600+</p>
                            <p className="text-xs text-slate-500 font-medium">Ürün Çeşidi</p>
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold text-white">24 Saat</p>
                            <p className="text-xs text-slate-500 font-medium">Hızlı Kargo</p>
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold text-white">%100</p>
                            <p className="text-xs text-slate-500 font-medium">Müşteri Memnuniyeti</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

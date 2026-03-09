import Link from "next/link"
import { Phone, Mail, MapPin } from "lucide-react"

interface Category {
    id: string
    name: string
    slug: string | null
}

export function TrustFooter({ categories }: { categories: Category[] }) {
    return (
        <footer className="bg-slate-900 text-slate-400">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div>
                        <h3 className="text-xl font-extrabold text-white flex items-center gap-2 mb-4">
                            <span className="text-2xl">⚙</span> TekerMarket
                        </h3>
                        <p className="text-sm leading-relaxed mb-4">
                            Endüstriyel tekerlek ve roda çözümlerinde Türkiye&apos;nin güvenilir B2B
                            toptan satış platformu.
                        </p>
                        <div className="flex gap-3">
                            <div className="w-10 h-6 bg-slate-700 rounded flex items-center justify-center text-[10px] font-bold text-slate-300">SSL</div>
                            <div className="w-10 h-6 bg-slate-700 rounded flex items-center justify-center text-[10px] font-bold text-slate-300">256</div>
                            <div className="w-10 h-6 bg-slate-700 rounded flex items-center justify-center text-[10px] font-bold text-emerald-400">✓</div>
                        </div>
                    </div>

                    {/* Categories */}
                    <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Kategoriler</h4>
                        <ul className="space-y-2">
                            {categories.slice(0, 6).map((cat) => (
                                <li key={cat.id}>
                                    <Link
                                        href={`/?category=${cat.slug}`}
                                        className="text-sm hover:text-white transition-colors"
                                    >
                                        {cat.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Hızlı Linkler</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link href="/" className="hover:text-white transition-colors">Ana Sayfa</Link></li>
                            <li><Link href="/login" className="hover:text-white transition-colors">Bayi Girişi</Link></li>
                            <li><Link href="/#" className="hover:text-white transition-colors">Hakkımızda</Link></li>
                            <li><Link href="/#" className="hover:text-white transition-colors">Blog</Link></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">İletişim</h4>
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>0850 555 12 34</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>info@tekermarket.com</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>İstanbul, Türkiye</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Copyright */}
            <div className="border-t border-slate-800">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                        © {new Date().getFullYear()} TekerMarket. Tüm hakları saklıdır.
                    </p>
                    <p className="text-xs text-slate-600">
                        Powered by Next.js & Supabase
                    </p>
                </div>
            </div>
        </footer>
    )
}

import Image from "next/image"
import { PackageSearch, ArrowRight } from "lucide-react"

interface Product {
    id: string
    name: string
    sku: string
    sale_price: string | null
    image_url: string | null
}

export function FeaturedProducts({ products }: { products: Product[] }) {
    if (!products || products.length === 0) return null

    return (
        <section className="py-16 bg-slate-50/50">
            <div className="max-w-[1600px] mx-auto px-6">
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                            Öne Çıkan Ürünler
                        </h2>
                        <p className="text-slate-500 mt-1 text-sm">En çok tercih edilen tekerlek ve rodalar</p>
                    </div>
                    <a href="/" className="hidden md:flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        Tümünü Gör <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                </div>

                {/* Horizontal Scroll Container */}
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-6 px-6">
                    {products.map((item) => (
                        <div
                            key={item.id}
                            className="flex-shrink-0 w-[220px] snap-start bg-white rounded-2xl border border-slate-200/60 overflow-hidden hover:shadow-lg transition-all duration-300 group"
                        >
                            <div className="relative aspect-square bg-slate-50 p-4 flex items-center justify-center">
                                {item.image_url ? (
                                    <Image
                                        src={item.image_url}
                                        alt={item.name}
                                        width={200}
                                        height={200}
                                        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                ) : (
                                    <PackageSearch className="w-8 h-8 text-slate-200" />
                                )}
                            </div>
                            <div className="p-4">
                                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1">{item.sku}</p>
                                <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug mb-2">{item.name}</h3>
                                {item.sale_price && Number(item.sale_price) > 0 && (
                                    <p className="text-sm font-extrabold text-primary">
                                        ₺{Number(item.sale_price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

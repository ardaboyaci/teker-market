import Image from "next/image"
import Link from "next/link"
import { PackageSearch } from "lucide-react"

interface RelatedProduct {
    id: string
    name: string
    sku: string
    slug: string
    sale_price: string | null
    image_url: string | null
}

export function RelatedProducts({ products }: { products: RelatedProduct[] }) {
    if (!products || products.length === 0) return null

    return (
        <section className="mt-12 pt-8 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Benzer Ürünler</h3>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-4">
                {products.slice(0, 4).map((item) => (
                    <Link
                        key={item.id}
                        href={`/products/${item.slug}`}
                        className="group bg-white rounded-xl border border-slate-200/60 overflow-hidden hover:shadow-md transition-all"
                    >
                        <div className="aspect-square bg-slate-50 p-4 flex items-center justify-center">
                            {item.image_url ? (
                                <Image
                                    src={item.image_url}
                                    alt={item.name}
                                    width={200}
                                    height={200}
                                    className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                />
                            ) : (
                                <PackageSearch className="w-8 h-8 text-slate-200" />
                            )}
                        </div>
                        <div className="p-3">
                            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase block max-w-full truncate">{item.sku}</p>
                            <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 mt-0.5">{item.name}</h4>
                            {item.sale_price && Number(item.sale_price) > 0 && (
                                <p className="text-sm font-extrabold text-primary mt-1.5 break-words">
                                    ₺{Number(item.sale_price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}

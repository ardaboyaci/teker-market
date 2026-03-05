import Image from "next/image"
import Link from "next/link"
import { PackageSearch, MessageCircle } from "lucide-react"

interface ProductCardProps {
    id: string
    name: string
    sku: string
    slug: string
    sale_price: string | null
    image_url: string | null
    quantity_on_hand: number | null
    attributes: Record<string, string> | null
}

export function ProductCard({ id, name, sku, slug, sale_price, image_url, quantity_on_hand, attributes }: ProductCardProps) {
    const inStock = (quantity_on_hand ?? 0) > 0
    const hasPrice = Number(sale_price) > 0

    return (
        <div className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-slate-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col h-full">

            {/* Image Area */}
            <div className="relative w-full aspect-[4/3] bg-slate-50/50 p-4 flex items-center justify-center overflow-hidden border-b border-slate-50">
                {/* Stock Badge */}
                <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 ${inStock
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-red-50 text-red-500 border border-red-200"
                    }`}>
                    {inStock ? "Stokta" : "Tükendi"}
                </span>

                {/* WhatsApp Mini Icon */}
                <a
                    href={`https://wa.me/908505551234?text=${encodeURIComponent(`Merhaba, ${sku} kodlu ürün hakkında bilgi almak istiyorum.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full shadow-sm hover:bg-emerald-50 transition-colors z-10 opacity-0 group-hover:opacity-100"
                    title="WhatsApp ile sor"
                >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                </a>

                {image_url ? (
                    <Image
                        src={image_url}
                        alt={name}
                        width={400}
                        height={300}
                        className="w-full h-full object-contain mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <PackageSearch className="w-10 h-10 text-slate-200" />
                )}

                <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out flex justify-center">
                    <Link href={`/products/${slug}`} className="w-full bg-primary/95 backdrop-blur text-white text-[13px] font-semibold py-2 rounded-lg hover:bg-primary transition-colors shadow-sm text-center block">
                        Detaylı İncele
                    </Link>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 flex flex-col flex-grow bg-white">
                <span className="text-[10px] font-bold text-slate-400 tracking-widest mb-1 uppercase">
                    {sku}
                </span>

                <h3 className="font-semibold text-slate-800 text-[13px] leading-snug mb-2 line-clamp-2">
                    {name}
                </h3>

                {/* Attribute Chips */}
                {attributes && Object.keys(attributes).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {Object.entries(attributes).slice(0, 3).map(([key, value]) => (
                            <span
                                key={key}
                                className="text-[9px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded"
                                title={key}
                            >
                                {value}
                            </span>
                        ))}
                    </div>
                )}

                <div className="mt-auto pt-3 border-t border-slate-100/60 flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-medium text-slate-400 mb-0.5 uppercase tracking-wide">Toptan Fiyat</span>
                        <span className="text-[18px] font-extrabold text-slate-900 tracking-tight">
                            {hasPrice
                                ? `₺${Number(sale_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                                : 'Fiyat Sorunuz'
                            }
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

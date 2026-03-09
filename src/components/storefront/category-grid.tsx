import Link from "next/link"

interface Category {
    id: string
    name: string
    slug: string | null
}

const categoryIcons: Record<string, string> = {
    "Döner Tekerlekler": "🔄",
    "Sabit Tekerlekler": "🔩",
    "Hafif Sanayi Tekerlekleri": "⚙️",
    "Ağır Sanayi Tekerlekleri": "🏗️",
    "Poliüretan Tekerlekler": "🟡",
    "Kauçuk Tekerlekler": "⚫",
}

export function CategoryGrid({ categories }: { categories: Category[] }) {
    const displayCategories = categories.slice(0, 6)

    return (
        <section className="py-12 sm:py-16">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
                <div className="text-center mb-8 sm:mb-10">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Kategorilere Göz Atın
                    </h2>
                    <p className="text-slate-500 mt-2 text-sm">
                        Endüstriyel tekerlek çeşitlerimiz arasından ihtiyacınıza uygun olanı bulun
                    </p>
                </div>

                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-4">
                    {displayCategories.map((cat) => (
                        <Link
                            key={cat.id}
                            href={`/?category=${cat.slug}`}
                            className="group relative bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                        >
                            <div className="text-3xl mb-3">
                                {categoryIcons[cat.name] || "🔧"}
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {cat.name}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Ürünleri incele →
                            </p>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    )
}

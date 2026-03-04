import { createAdminClient } from "@/lib/supabase/admin"
import { PackageSearch, SlidersHorizontal, ChevronRight, Search } from "lucide-react"

export const revalidate = 0

import Link from "next/link"

export default async function Home(props: { searchParams: Promise<{ category?: string }> }) {
    const searchParams = await props.searchParams;
    const activeCategorySlug = searchParams?.category as string | undefined;

    const supabase = createAdminClient()

    // Kategorileri Çek
    const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    // Ürünleri Çek (Kategori Filtresi Varsa Uygula)
    let productQuery = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40)

    let activeCategoryName = "Tüm Tekerlekler";

    if (activeCategorySlug) {
        const activeCat = categories?.find(c => c.slug === activeCategorySlug);
        if (activeCat) {
            productQuery = productQuery.eq('category_id', activeCat.id);
            activeCategoryName = activeCat.name;
        }
    }

    const { data: products, error } = await productQuery;

    if (error) {
        console.error("Error fetching products:", error)
    }

    return (
        <div className="min-h-screen bg-slate-50/50 font-sans flex flex-col">

            {/* Şık ve İnce Üst Bar */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-20">
                <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/">
                            <h1 className="text-2xl tracking-tighter font-extrabold text-slate-900 flex items-center gap-2">
                                <span className="text-primary text-3xl leading-none">⚙</span> TekerMarket
                            </h1>
                        </Link>

                        <div className="hidden md:flex relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Ürün kodu, adı veya kategori arayın..."
                                className="w-full bg-slate-100/70 border border-transparent focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 rounded-full py-2 pl-10 pr-4 text-sm transition-all outline-none text-slate-700"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Bayi Girişi</button>
                        <div className="h-4 w-px bg-slate-200"></div>
                        <button className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">İletişim</button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 flex gap-8 relative items-start">

                {/* Sol Kenar Çubuğu (Kategori Filtreleri) */}
                <aside className="w-64 flex-shrink-0 hidden lg:block sticky top-24">
                    <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-slate-800 tracking-tight">Kategoriler</h2>
                            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                        </div>

                        <ul className="space-y-1.5">
                            {/* "Tüm Ürünler" Seçeneği */}
                            <li>
                                <Link
                                    href="/"
                                    className={`w-full group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${!activeCategorySlug ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                                >
                                    <span className={`text-[13px] font-medium transition-colors ${!activeCategorySlug ? 'text-primary font-bold' : 'text-slate-600 group-hover:text-primary'}`}>
                                        Tüm Ürünler
                                    </span>
                                    <ChevronRight className={`w-3.5 h-3.5 transition-all ${!activeCategorySlug ? 'text-primary translate-x-0.5' : 'text-slate-300 group-hover:text-primary group-hover:translate-x-0.5'}`} />
                                </Link>
                            </li>
                            <div className="h-px bg-slate-100 my-2"></div>

                            {categories?.map((cat) => {
                                // Sipariş veya anlamsız root kategorileri gizle (opsiyonel, genelde "tekerlekler" root kategorisini göstermeyebiliriz)
                                if (cat.slug === 'tekerlekler' || cat.slug === 'aparatlar' || cat.slug === 'aksesuarlar') return null;

                                const isActive = activeCategorySlug === cat.slug;
                                return (
                                    <li key={cat.id}>
                                        <Link
                                            href={isActive ? "/" : `/?category=${cat.slug}`}
                                            className={`w-full group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                                        >
                                            <span className={`text-[13px] font-medium transition-colors ${isActive ? 'text-primary font-bold' : 'text-slate-600 group-hover:text-primary'}`}>
                                                {cat.name}
                                            </span>
                                            <ChevronRight className={`w-3.5 h-3.5 transition-all ${isActive ? 'text-primary translate-x-0.5' : 'text-slate-300 group-hover:text-primary group-hover:translate-x-0.5'}`} />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Markalar</h3>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-primary focus:ring-primary/20" />
                                    <span className="text-sm text-slate-600">Emes Teker</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="rounded border-slate-300 text-primary focus:ring-primary/20" />
                                    <span className="text-sm text-slate-600">Kama Teker</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Ürün Listesi Grid'i */}
                <section className="flex-1 min-w-0">

                    <div className="mb-6 flex items-end justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">{activeCategoryName}</h2>
                            <p className="text-sm text-slate-500">{products?.length || 0} ürün listeleniyor</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-400">Sırala:</span>
                            <select className="text-sm border-0 bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer outline-none">
                                <option>En Yeniler</option>
                                <option>Fiyata Göre Artan</option>
                                <option>Fiyata Göre Azalan</option>
                            </select>
                        </div>
                    </div>

                    {products && products.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {products.map((item) => (
                                <div
                                    key={item.id}
                                    className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-slate-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col h-full"
                                >

                                    {/* Resim Alanı (Geniş boşluklu, açık gri zeminli) */}
                                    <div className="relative w-full aspect-[4/3] bg-slate-50/50 p-4 flex items-center justify-center overflow-hidden border-b border-slate-50">
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt={item.name}
                                                className="w-full h-full object-contain mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <PackageSearch className="w-10 h-10 text-slate-200" />
                                        )}

                                        <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out flex justify-center">
                                            <button className="w-full bg-primary/95 backdrop-blur text-white text-[13px] font-semibold py-2 rounded-lg hover:bg-primary transition-colors shadow-sm">
                                                Detaylı İncele
                                            </button>
                                        </div>
                                    </div>

                                    {/* İçerik Alanı */}
                                    <div className="p-5 flex flex-col flex-grow bg-white">
                                        <span className="text-[11px] font-bold text-slate-400 tracking-widest mb-1.5 uppercase">
                                            {item.sku}
                                        </span>

                                        <h3 className="font-semibold text-slate-800 text-[14px] leading-snug mb-4 line-clamp-2">
                                            {item.name}
                                        </h3>

                                        <div className="mt-auto pt-3 border-t border-slate-100/60 flex items-end justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-medium text-slate-400 mb-0.5 uppercase tracking-wide">Toptan Fiyat</span>
                                                <span className="text-[19px] font-extrabold text-slate-900 tracking-tight">
                                                    {Number(item.sale_price) > 0
                                                        ? `₺${Number(item.sale_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                                                        : 'Fiyat Sorunuz'
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full py-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-white text-center px-4">
                            <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-2xl mb-4">
                                <PackageSearch className="w-10 h-10 text-slate-300" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-700 mb-1">Yeni Ürünler Yükleniyor</h2>
                            <p className="text-sm text-slate-500 max-w-sm">Botumuz arkada veri topluyor veya henüz veritabanında listelenecek tekerlek bulunmuyor.</p>
                        </div>
                    )}

                </section>

            </main>

        </div>
    )
}

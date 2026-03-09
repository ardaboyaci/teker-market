import { createServerClient } from "@/lib/supabase/server"
import { PackageSearch, SlidersHorizontal, ChevronRight } from "lucide-react"
import Link from "next/link"

// Sprint 4 Hafta 1 Components
import { AnnouncementBar } from "@/components/storefront/announcement-bar"
import { ContactBar } from "@/components/storefront/contact-bar"
import { SearchAutocomplete } from "@/components/storefront/search-autocomplete"
import { MegaMenu } from "@/components/storefront/mega-menu"
import { MobileNavDrawer } from "@/components/storefront/mobile-nav-drawer"
import { HeroSection } from "@/components/storefront/hero-section"
import { CategoryGrid } from "@/components/storefront/category-grid"
import { FeaturedProducts } from "@/components/storefront/featured-products"
import { TrustBand } from "@/components/storefront/trust-band"
import { WhatsAppFAB } from "@/components/storefront/whatsapp-fab"
import { TrustFooter } from "@/components/storefront/trust-footer"

// Sprint 4 Hafta 2 Components
import { AttributeFilterPanel } from "@/components/storefront/attribute-filter-panel"
import { ActiveFilterChips } from "@/components/storefront/active-filter-chips"
import { ProductCard } from "@/components/storefront/product-card"
import { CategoryHeader } from "@/components/storefront/category-header"
import { BreadcrumbNav } from "@/components/storefront/breadcrumb-nav"
import { Pagination } from "@/components/storefront/pagination"

export const revalidate = 0

const PAGE_SIZE = 40

export default async function Home(props: {
    searchParams: Promise<{
        category?: string
        q?: string
        sort?: string
        page?: string
        diameter?: string
        material?: string
        load?: string
        type?: string
    }>
}) {
    const searchParams = await props.searchParams;
    const activeCategorySlug = searchParams?.category as string | undefined;
    const searchQuery = searchParams?.q as string | undefined;
    const sortParam = searchParams?.sort as string | undefined;
    const currentPage = Math.max(1, Number(searchParams?.page || "1"));

    const supabase = await createServerClient()

    // ── Kategorileri Çek ──
    const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    // ── Ürün Sorgusu ──
    let productQuery = supabase
        .from('products')
        .select('*', { count: 'exact' })

    let activeCategoryName = "Tüm Tekerlekler";

    if (activeCategorySlug) {
        const activeCat = categories?.find(c => c.slug === activeCategorySlug);
        if (activeCat) {
            productQuery = productQuery.eq('category_id', activeCat.id);
            activeCategoryName = activeCat.name;
        }
    }

    if (searchQuery) {
        productQuery = productQuery.or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`);
        activeCategoryName = `"${searchQuery}" için sonuçlar`;
    }

    // Madde #16: Genişletilmiş sıralama seçenekleri
    switch (sortParam) {
        case 'price_asc':
            productQuery = productQuery.order('sale_price', { ascending: true, nullsFirst: false });
            break;
        case 'price_desc':
            productQuery = productQuery.order('sale_price', { ascending: false, nullsFirst: false });
            break;
        case 'name_asc':
            productQuery = productQuery.order('name', { ascending: true });
            break;
        case 'name_desc':
            productQuery = productQuery.order('name', { ascending: false });
            break;
        default:
            productQuery = productQuery.order('created_at', { ascending: false });
    }

    // Madde #18: Sayfalama — offset/limit
    const rangeFrom = (currentPage - 1) * PAGE_SIZE;
    const rangeTo = rangeFrom + PAGE_SIZE - 1;
    productQuery = productQuery.range(rangeFrom, rangeTo);

    const { data: products, count: totalCount } = await productQuery;

    // Featured products (first 10 with sale_price — only for homepage)
    const featuredProducts = products?.filter(p => Number(p.sale_price) > 0).slice(0, 10) || [];

    // Show homepage sections only when no filters active
    const isHomepage = !activeCategorySlug && !searchQuery;

    // Madde #17: Breadcrumb items
    const breadcrumbItems = [];
    if (activeCategorySlug) {
        const activeCat = categories?.find(c => c.slug === activeCategorySlug);
        if (activeCat) {
            breadcrumbItems.push({ label: activeCat.name });
        }
    }
    if (searchQuery) {
        breadcrumbItems.push({ label: `"${searchQuery}" araması` });
    }

    return (
        <div className="min-h-screen bg-slate-50/50 font-sans flex flex-col">

            {/* ── Top Bars ── */}
            <AnnouncementBar />
            <ContactBar />

            {/* ── Header ── */}
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-20">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                        <MobileNavDrawer categories={categories || []} />

                        <Link href="/">
                            <h1 className="text-xl sm:text-2xl tracking-tighter font-extrabold text-slate-900 flex items-center gap-2">
                                <span className="text-primary text-2xl sm:text-3xl leading-none">⚙</span> TekerMarket
                            </h1>
                        </Link>

                        <MegaMenu categories={categories || []} />
                    </div>

                    <SearchAutocomplete defaultValue={searchQuery} />
                </div>
            </header>

            {/* ── Hero (only on homepage) ── */}
            {isHomepage && <HeroSection />}

            {/* ── Category Grid (only on homepage) ── */}
            {isHomepage && categories && <CategoryGrid categories={categories} />}

            {/* ── Featured Products (only on homepage) ── */}
            {isHomepage && featuredProducts.length > 0 && <FeaturedProducts products={featuredProducts} />}

            {/* ── Trust Band (only on homepage) ── */}
            {isHomepage && <TrustBand />}

            {/* ── Product Listing ── */}
            <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 flex gap-8 relative items-start" id="products">

                {/* ── Sidebar: Kategoriler + Madde #12 AttributeFilterPanel ── */}
                <aside className="w-64 flex-shrink-0 hidden lg:block sticky top-24 space-y-4">
                    {/* Kategori Listesi */}
                    <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-slate-800 tracking-tight">Kategoriler</h2>
                            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                        </div>

                        <ul className="space-y-1.5">
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
                            <div className="h-px bg-slate-100 my-2" />

                            {categories?.map((cat) => {
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
                    </div>

                    {/* Madde #12: Özellik Filtreleri */}
                    <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                        <h2 className="font-bold text-slate-800 tracking-tight mb-4">Filtreler</h2>
                        <AttributeFilterPanel />
                    </div>
                </aside>

                {/* ── Product Grid Area ── */}
                <section className="flex-1 min-w-0">

                    {/* Madde #17: Breadcrumb */}
                    {breadcrumbItems.length > 0 && <BreadcrumbNav items={breadcrumbItems} />}

                    {/* Madde #15: CategoryHeader + Madde #16: Genişletilmiş Sıralama */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
                        <CategoryHeader
                            title={activeCategoryName}
                            count={totalCount ?? products?.length ?? 0}
                        />

                        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-3 flex-shrink-0">
                            <span className="text-xs font-medium text-slate-400">Sırala:</span>
                            <form action="/" method="GET" className="min-w-0">
                                {activeCategorySlug && <input type="hidden" name="category" value={activeCategorySlug} />}
                                {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
                                <select
                                    name="sort"
                                    defaultValue={sortParam || ''}
                                    onChange={(e) => (e.target.form as HTMLFormElement)?.submit()}
                                    className="text-sm border border-slate-200 rounded-lg bg-white px-3 py-2 font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 cursor-pointer outline-none"
                                >
                                    <option value="">En Yeniler</option>
                                    <option value="price_asc">Fiyat: Düşükten Yükseğe</option>
                                    <option value="price_desc">Fiyat: Yüksekten Düşüğe</option>
                                    <option value="name_asc">İsim: A → Z</option>
                                    <option value="name_desc">İsim: Z → A</option>
                                </select>
                            </form>
                        </div>
                    </div>

                    {/* Madde #13: Aktif Filtre Chip'leri */}
                    <ActiveFilterChips />

                    {/* Product Grid — Madde #14: ProductCard bileşeni */}
                    {products && products.length > 0 ? (
                        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {products.map((item) => (
                                <ProductCard
                                    key={item.id}
                                    id={item.id}
                                    name={item.name}
                                    sku={item.sku}
                                    slug={item.slug}
                                    sale_price={item.sale_price}
                                    image_url={item.image_url}
                                    quantity_on_hand={item.quantity_on_hand}
                                    attributes={item.attributes}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="w-full py-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-white text-center px-4">
                            <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-2xl mb-4">
                                <PackageSearch className="w-10 h-10 text-slate-300" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-700 mb-1">Ürün Bulunamadı</h2>
                            <p className="text-sm text-slate-500 max-w-sm">Arama kriterlerinize uygun ürün bulunamadı veya henüz veritabanında listelenecek tekerlek bulunmuyor.</p>
                        </div>
                    )}

                    {/* Madde #18: Sayfalama */}
                    <Pagination totalCount={totalCount ?? 0} pageSize={PAGE_SIZE} />

                </section>
            </main>

            {/* ── Footer ── */}
            <TrustFooter categories={categories || []} />

            {/* ── WhatsApp FAB ── */}
            <WhatsAppFAB />

        </div>
    )
}

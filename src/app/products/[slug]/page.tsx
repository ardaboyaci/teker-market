import { createServerClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"

// Hafta 3 Components
import { ProductImageGallery } from "@/components/storefront/product-image-gallery"
import { StockBadge } from "@/components/storefront/stock-badge"
import { PriceBlock } from "@/components/storefront/price-block"
import { QuantityInput } from "@/components/storefront/quantity-input"
import { WhatsAppOrderButton } from "@/components/storefront/whatsapp-order-button"
import { AttributeTable } from "@/components/storefront/attribute-table"
import { TechnicalDocButton } from "@/components/storefront/technical-doc-button"
import { RelatedProducts } from "@/components/storefront/related-products"
import { ProductStructuredData } from "@/components/storefront/product-structured-data"

// Global Layout Components
import { SearchAutocomplete } from "@/components/storefront/search-autocomplete"
import { MegaMenu } from "@/components/storefront/mega-menu"
import { MobileNavDrawer } from "@/components/storefront/mobile-nav-drawer"
import { TrustFooter } from "@/components/storefront/trust-footer"
import { BreadcrumbNav } from "@/components/storefront/breadcrumb-nav"

export const revalidate = 0

// Dynamic metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const supabase = await createServerClient()
    const { data: product } = await supabase
        .from("products")
        .select("name, description, sku")
        .eq("slug", slug)
        .single()

    if (!product) return { title: "Ürün Bulunamadı | TekerMarket" }

    return {
        title: `${product.name} | TekerMarket`,
        description: product.description || `${product.name} (${product.sku}) - TekerMarket'te toptan fiyatlarla`,
    }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const supabase = await createServerClient()

    // Ürün verisi
    const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .single()

    if (!product) notFound()

    // Kategoriler (header + footer)
    const { data: categories } = await supabase
        .from("categories")
        .select("*")
        .order("name")

    // Aktif kategori adı
    let categoryName: string | null = null
    if (product.category_id && categories) {
        const cat = categories.find((c) => c.id === product.category_id)
        if (cat) categoryName = cat.name
    }

    // Auth kontrolü — Madde #28
    const { data: { user } } = await supabase.auth.getUser()
    const isAuthenticated = !!user

    // İlgili ürünler — Madde #26
    let relatedProducts: any[] = []
    if (product.category_id) {
        const { data } = await supabase
            .from("products")
            .select("id, name, sku, slug, sale_price, image_url")
            .eq("category_id", product.category_id)
            .neq("id", product.id)
            .limit(4)
        relatedProducts = data || []
    }

    // Görseller — ana görsel ve varsa ek görseller
    const images: string[] = []
    if (product.image_url) images.push(product.image_url)

    // Breadcrumb
    const breadcrumbItems = []
    if (categoryName) {
        const cat = categories?.find((c) => c.name === categoryName)
        breadcrumbItems.push({
            label: categoryName,
            href: cat ? `/?category=${cat.slug}` : "/",
        })
    }
    breadcrumbItems.push({ label: product.name })

    // PDF URL (metadata)
    const pdfUrl = product.attributes?.pdf_url || null

    const productUrl = `https://tekermarket.com/products/${slug}`

    return (
        <div className="min-h-screen bg-slate-50/50 font-sans flex flex-col">
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
                    <SearchAutocomplete />
                </div>
            </header>

            {/* ── Madde #27: JSON-LD Structured Data ── */}
            <ProductStructuredData
                name={product.name}
                sku={product.sku}
                description={product.description}
                imageUrl={product.image_url}
                price={product.sale_price}
                inStock={(product.quantity_on_hand ?? 0) > 0}
                url={productUrl}
            />

            {/* ── Main Content ── */}
            <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8">

                {/* Madde #17: Breadcrumb */}
                <BreadcrumbNav items={breadcrumbItems} />

                {/* Product Detail Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

                    {/* Left: Madde #19 Image Gallery */}
                    <ProductImageGallery images={images} productName={product.name} />

                    {/* Right: Product Info */}
                    <div className="space-y-6">
                        {/* SKU & Category */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase font-mono">
                                {product.sku}
                            </span>
                            {categoryName && (
                                <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
                                    {categoryName}
                                </span>
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                            {product.name}
                        </h1>

                        {/* Madde #20: Stock Badge */}
                        <StockBadge quantity={product.quantity_on_hand} />

                        {/* Madde #21 + #28: Price Block */}
                        <PriceBlock
                            salePrice={product.sale_price}
                            basePrice={product.base_price}
                            isAuthenticated={isAuthenticated}
                            wholesalePrice={product.cost_price}
                        />

                        {/* Description */}
                        {product.description && (
                            <div className="prose prose-sm prose-slate max-w-none">
                                <p className="text-slate-600 leading-relaxed">{product.description}</p>
                            </div>
                        )}

                        {/* Madde #22 + #23: Quantity + WhatsApp Order */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 pt-2">
                            <div>
                                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Adet</label>
                                <QuantityInput max={product.quantity_on_hand ?? 0} />
                            </div>
                            <div className="flex-1 w-full sm:w-auto">
                                <WhatsAppOrderButton sku={product.sku} name={product.name} />
                            </div>
                        </div>

                        {/* Madde #25: Technical Doc */}
                        <TechnicalDocButton pdfUrl={pdfUrl} />
                    </div>
                </div>

                {/* Madde #24: Attribute Table */}
                <div className="mt-12">
                    <AttributeTable attributes={product.attributes} />
                </div>

                {/* Madde #26: Related Products */}
                <RelatedProducts products={relatedProducts} />
            </main>

            {/* ── Footer ── */}
            <TrustFooter categories={categories || []} />
        </div>
    )
}

import pool from "@/lib/db/pool"
import type { RowDataPacket } from "mysql2/promise"
import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"

import { ProductImageGallery } from "@/components/storefront/product-image-gallery"
import { StockBadge } from "@/components/storefront/stock-badge"
import { PriceBlock } from "@/components/storefront/price-block"
import { OrderSection } from "@/components/storefront/order-section"
import { AttributeTable } from "@/components/storefront/attribute-table"
import { TechnicalDocButton } from "@/components/storefront/technical-doc-button"
import { RelatedProducts, type RelatedProduct } from "@/components/storefront/related-products"
import { ProductStructuredData } from "@/components/storefront/product-structured-data"
import { SearchAutocomplete } from "@/components/storefront/search-autocomplete"
import { MegaMenu } from "@/components/storefront/mega-menu"
import { MobileNavDrawer } from "@/components/storefront/mobile-nav-drawer"
import { TrustFooter } from "@/components/storefront/trust-footer"
import { BreadcrumbNav } from "@/components/storefront/breadcrumb-nav"

export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT name, description, sku FROM products WHERE slug = ? AND deleted_at IS NULL LIMIT 1',
        [slug]
    )
    const product = (rows as RowDataPacket[])[0]
    if (!product) return { title: "Ürün Bulunamadı | TekerMarket" }
    return {
        title: `${product.name} | TekerMarket`,
        description: product.description || `${product.name} (${product.sku}) - TekerMarket'te toptan fiyatlarla`,
    }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params

    const [productRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM products WHERE slug = ? AND deleted_at IS NULL LIMIT 1',
        [slug]
    )
    const product = (productRows as RowDataPacket[])[0]
    if (!product) notFound()

    const [categoryRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, name, slug, parent_id FROM categories ORDER BY name'
    )
    const categories = categoryRows as unknown as { id: string; name: string; slug: string | null; parent_id: string | null }[]

    const buildBreadcrumb = (categoryId: string | null) => {
        if (!categoryId || !categories) return []
        const chain: { id: string; name: string; slug: string }[] = []
        let current = categories.find((c) => c.id === categoryId)
        while (current) {
            chain.unshift({ id: current.id as string, name: current.name as string, slug: current.slug as string })
            current = current.parent_id
                ? categories.find((c) => c.id === current!.parent_id)
                : undefined
        }
        return chain
    }

    const categoryChain = buildBreadcrumb(product.category_id as string | null)
    const categoryName = categoryChain.length > 0 ? categoryChain[categoryChain.length - 1].name : null

    const isAuthenticated = false

    let relatedProducts: RelatedProduct[] = []
    if (product.category_id) {
        const [relRows] = await pool.query<RowDataPacket[]>(
            'SELECT id, name, sku, slug, sale_price, image_url FROM products WHERE category_id = ? AND id != ? AND deleted_at IS NULL LIMIT 4',
            [product.category_id, product.id]
        )
        relatedProducts = (relRows as RowDataPacket[]).map(r => ({
            id:         r.id as string,
            name:       r.name as string,
            sku:        r.sku as string,
            slug:       r.slug as string,
            sale_price: r.sale_price != null ? String(r.sale_price) : null,
            image_url:  r.image_url as string | null,
        }))
    }

    const images: string[] = []
    if (product.image_url) images.push(product.image_url as string)

    const breadcrumbItems = [
        ...categoryChain.map((cat) => ({ label: cat.name, href: `/products?category=${cat.slug}` })),
        { label: product.name as string },
    ]

    const pdfUrl = (product.attributes as Record<string, unknown>)?.pdf_url || null
    const productUrl = `https://tekermarket.com/products/${slug}`

    return (
        <div className="min-h-screen bg-slate-50/50 font-sans flex flex-col">
            <header className="bg-white border-b border-slate-200/60 sticky top-0 z-20">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                        <MobileNavDrawer categories={categories} />
                        <Link href="/">
                            <h1 className="text-xl sm:text-2xl tracking-tighter font-extrabold text-slate-900 flex items-center gap-2">
                                <span className="text-primary text-2xl sm:text-3xl leading-none">⚙</span> TekerMarket
                            </h1>
                        </Link>
                        <MegaMenu categories={categories} />
                    </div>
                    <SearchAutocomplete />
                </div>
            </header>

            <ProductStructuredData
                name={product.name as string}
                sku={product.sku as string}
                description={product.description as string | null}
                imageUrl={product.image_url as string | null}
                price={product.sale_price != null ? String(product.sale_price) : null}
                inStock={(Number(product.quantity_on_hand) ?? 0) > 0}
                url={productUrl}
            />

            <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8">
                <BreadcrumbNav items={breadcrumbItems} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    <ProductImageGallery images={images} productName={product.name as string} />
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase font-mono">{product.sku as string}</span>
                            {categoryName && (
                                <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">{categoryName}</span>
                            )}
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{product.name as string}</h1>
                        <StockBadge quantity={Number(product.quantity_on_hand)} />
                        <PriceBlock
                            salePrice={product.sale_price != null ? String(product.sale_price) : null}
                            basePrice={product.base_price != null ? String(product.base_price) : null}
                            isAuthenticated={isAuthenticated}
                            wholesalePrice={product.cost_price != null ? String(product.cost_price) : null}
                        />
                        {product.description && (
                            <div className="prose prose-sm prose-slate max-w-none">
                                <p className="text-slate-600 leading-relaxed">{product.description as string}</p>
                            </div>
                        )}
                        <OrderSection sku={product.sku as string} name={product.name as string} max={Number(product.quantity_on_hand) ?? 0} />
                        <TechnicalDocButton pdfUrl={pdfUrl as string | null} />
                    </div>
                </div>
                <div className="mt-12">
                    <AttributeTable attributes={product.attributes} />
                </div>
                <RelatedProducts products={relatedProducts} />
            </main>

            <TrustFooter categories={categories} />
        </div>
    )
}
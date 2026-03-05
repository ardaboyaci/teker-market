interface ProductStructuredDataProps {
    name: string
    sku: string
    description: string | null
    imageUrl: string | null
    price: string | null
    inStock: boolean
    url: string
}

export function ProductStructuredData({
    name,
    sku,
    description,
    imageUrl,
    price,
    inStock,
    url,
}: ProductStructuredDataProps) {
    const salePrice = Number(price) || 0

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        sku,
        description: description || `${name} - Endüstriyel tekerlek TekerMarket'te`,
        image: imageUrl || undefined,
        url,
        brand: {
            "@type": "Brand",
            name: "TekerMarket",
        },
        offers: {
            "@type": "Offer",
            priceCurrency: "TRY",
            price: salePrice > 0 ? salePrice.toFixed(2) : undefined,
            availability: inStock
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            seller: {
                "@type": "Organization",
                name: "TekerMarket",
            },
        },
    }

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    )
}

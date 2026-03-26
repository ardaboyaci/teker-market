/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { ProductQuerySchema } from '@/lib/validations/price.schema'
import type { product_status } from '@/types/supabase'

// ── Cache factory ─────────────────────────────────────────────────────────────
// Her benzersiz parametre kombinasyonu için ayrı cache entry oluşturur.
// revalidate: 60 sn — 3660 ürün için DB'ye gereksiz istek atmaz.
function getCachedProducts(params: ParsedParams) {
    const cacheKey = JSON.stringify(params)

    return unstable_cache(
        async () => {
            const supabase = await createServerClient()

            const p = params

            // Alt kategori UUID listesini çek
            let categoryIds: string[] | null = null
            if (p.category_id) {
                if (p.include_children) {
                    const { data: catRow } = await supabase
                        .from('categories')
                        .select('id, path')
                        .eq('id', p.category_id)
                        .single()

                    if (catRow?.path) {
                        const { data: children } = await supabase
                            .from('categories')
                            .select('id')
                            .filter('path', 'cd', catRow.path)

                        categoryIds = [p.category_id, ...(children ?? []).map((c) => c.id)]
                    } else {
                        categoryIds = [p.category_id]
                    }
                } else {
                    categoryIds = [p.category_id]
                }
            }

            let query = supabase
                .from('products')
                .select(
                    `id, sku, barcode, name, slug, short_description,
                     category_id, category:categories(id, name, slug, path),
                     base_price, sale_price, vat_rate, currency,
                     quantity_on_hand, min_stock_level,
                     weight, width, height,
                     attributes, status, is_featured, tags,
                     created_at, updated_at,
                     primary_image:product_media(storage_path, alt_text)`,
                    { count: 'exact' }
                )
                .is('deleted_at', null)

            if (p.search) {
                query = query.or(
                    `name.ilike.%${p.search}%,sku.ilike.%${p.search}%,barcode.ilike.%${p.search}%`
                )
            }
            if (categoryIds)           query = query.in('category_id', categoryIds)
            if (p.status)              query = query.eq('status', p.status as product_status)
            if (p.min_price != null)   query = query.gte('sale_price', p.min_price)
            if (p.max_price != null)   query = query.lte('sale_price', p.max_price)
            if (p.is_featured != null) query = query.eq('is_featured', p.is_featured)

            const { data, error, count } = await query
                .order(p.sort_by, { ascending: p.sort_dir === 'asc' })
                .range(p.offset, p.offset + p.limit - 1)

            if (error) throw error

            const products = (data ?? []).map((row: any) => ({
                ...row,
                category: Array.isArray(row.category) ? row.category[0] ?? null : row.category,
                primary_image: Array.isArray(row.primary_image)
                    ? row.primary_image.find((m: any) => m) ?? null
                    : row.primary_image,
            }))

            return { products, count: count ?? 0 }
        },
        // Cache tag — price_bot veya admin update tetiklenince invalidate edilebilir
        [`products-list`, cacheKey],
        { revalidate: 60, tags: ['products'] }
    )()
}

// ── Parsed params tipi (sadece başarılı parse sonucu) ─────────────────────────
type ParsedParams = Exclude<ReturnType<typeof buildParams>, { error: unknown }>

// ── Parametre ayrıştırma + Zod validasyon ─────────────────────────────────────
function buildParams(req: NextRequest) {
    const sp = req.nextUrl.searchParams
    const raw = {
        search:           sp.get('search')?.trim() || undefined,
        category_id:      sp.get('category_id')    || undefined,
        include_children: sp.get('include_children') ?? undefined,
        status:           sp.get('status')          || undefined,
        min_price:        sp.get('min_price')        || undefined,
        max_price:        sp.get('max_price')        || undefined,
        low_stock:        sp.get('low_stock')        || undefined,
        is_featured:      sp.get('is_featured')      || undefined,
        sort_by:          sp.get('sort_by')          || undefined,
        sort_dir:         sp.get('sort_dir')         || undefined,
        limit:            sp.get('limit')            || undefined,
        page:             sp.get('page')             || undefined,
    }

    const parsed = ProductQuerySchema.safeParse(raw)
    if (!parsed.success) return { error: parsed.error.flatten() }

    const p = parsed.data
    return {
        ...p,
        offset: (p.page - 1) * p.limit,
    }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const params = buildParams(req)

        if ('error' in params) {
            return NextResponse.json(
                { error: 'Geçersiz parametre.', details: params.error },
                { status: 400 }
            )
        }

        const { products, count } = await getCachedProducts(params)

        const totalPages = Math.ceil(count / params.limit)

        return NextResponse.json(
            {
                products,
                pagination: {
                    page:        params.page,
                    limit:       params.limit,
                    total_count: count,
                    total_pages: totalPages,
                    has_next:    params.page < totalPages,
                    has_prev:    params.page > 1,
                },
            },
            {
                status: 200,
                headers: {
                    // Edge CDN katmanı 60 sn, stale iken arka planda yeniler
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
                },
            }
        )
    } catch (err) {
        console.error('[/api/products] Unexpected error:', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

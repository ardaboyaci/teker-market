import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { product_status } from '@/types/supabase'

const VALID_STATUSES: product_status[] = ['active', 'inactive', 'draft', 'archived']
const VALID_SORT_FIELDS = ['created_at', 'name', 'base_price', 'sale_price', 'quantity_on_hand'] as const
const VALID_SORT_DIRS  = ['asc', 'desc'] as const

type SortField = typeof VALID_SORT_FIELDS[number]
type SortDir   = typeof VALID_SORT_DIRS[number]

function parseParams(req: NextRequest) {
    const sp = req.nextUrl.searchParams

    const status     = sp.get('status')   as product_status | null
    const sort_by    = (sp.get('sort_by')  || 'created_at') as SortField
    const sort_dir   = (sp.get('sort_dir') || 'desc')       as SortDir
    const limit      = Math.min(Math.max(parseInt(sp.get('limit')  || '20', 10), 1), 100)
    const page       = Math.max(parseInt(sp.get('page') || '1', 10), 1)

    return {
        search:       sp.get('search')?.trim()   || null,
        category_id:  sp.get('category_id')      || null,
        // Alt kategoriler dahil mi?
        include_children: sp.get('include_children') !== 'false',
        status:       status && VALID_STATUSES.includes(status) ? status : null,
        min_price:    sp.get('min_price') ? parseFloat(sp.get('min_price')!) : null,
        max_price:    sp.get('max_price') ? parseFloat(sp.get('max_price')!) : null,
        low_stock:    sp.get('low_stock') === 'true',
        is_featured:  sp.get('is_featured') === 'true' ? true : null,
        sort_by:      VALID_SORT_FIELDS.includes(sort_by)  ? sort_by  : 'created_at',
        sort_dir:     VALID_SORT_DIRS.includes(sort_dir)   ? sort_dir : 'desc',
        limit,
        page,
        offset: (page - 1) * limit,
    }
}

export async function GET(req: NextRequest) {
    try {
        const p = parseParams(req)
        const supabase = await createServerClient()

        // Alt kategori UUID listesini çek (include_children=true ise)
        let categoryIds: string[] | null = null
        if (p.category_id) {
            if (p.include_children) {
                const { data: catRows } = await supabase
                    .from('categories')
                    .select('id, path')
                    .eq('id', p.category_id)
                    .single()

                if (catRows?.path) {
                    // ltree: path ile başlayan tüm alt kategoriler
                    const { data: children } = await supabase
                        .from('categories')
                        .select('id')
                        // Supabase ltree operatörü: path <@ ancestor
                        .filter('path', 'cd', catRows.path)

                    categoryIds = [
                        p.category_id,
                        ...(children ?? []).map((c) => c.id),
                    ]
                } else {
                    categoryIds = [p.category_id]
                }
            } else {
                categoryIds = [p.category_id]
            }
        }

        // Ana sorgu
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

        if (categoryIds) {
            query = query.in('category_id', categoryIds)
        }

        if (p.status) {
            query = query.eq('status', p.status)
        }

        if (p.min_price !== null) {
            query = query.gte('sale_price', p.min_price)
        }
        if (p.max_price !== null) {
            query = query.lte('sale_price', p.max_price)
        }

        if (p.low_stock) {
            // quantity_on_hand <= min_stock_level — PostgREST ile sütun karşılaştırması
            query = query.filter('quantity_on_hand', 'lte', supabase
                .from('products')
                .select('min_stock_level')
                .limit(0) as unknown as number
            )
            // PostgREST doğrudan sütun<sütun karşılaştırmasını desteklemez;
            // bunun yerine RPC yolunu kullan
        }

        if (p.is_featured !== null) {
            query = query.eq('is_featured', p.is_featured)
        }

        const { data, error, count } = await query
            .order(p.sort_by, { ascending: p.sort_dir === 'asc' })
            .range(p.offset, p.offset + p.limit - 1)

        if (error) {
            console.error('[/api/products] Supabase error:', error)
            return NextResponse.json({ error: 'Veri çekme hatası.' }, { status: 500 })
        }

        // primary_image: array yerine tek nesne döndür
        const products = (data ?? []).map((row: any) => ({
            ...row,
            category: Array.isArray(row.category) ? row.category[0] ?? null : row.category,
            primary_image: Array.isArray(row.primary_image)
                ? row.primary_image.find((m: any) => m) ?? null
                : row.primary_image,
        }))

        const totalPages = count ? Math.ceil(count / p.limit) : 0

        return NextResponse.json(
            {
                products,
                pagination: {
                    page:        p.page,
                    limit:       p.limit,
                    total_count: count ?? 0,
                    total_pages: totalPages,
                    has_next:    p.page < totalPages,
                    has_prev:    p.page > 1,
                },
            },
            {
                status: 200,
                headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15' },
            }
        )
    } catch (err) {
        console.error('[/api/products] Unexpected error:', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

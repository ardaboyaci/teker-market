import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { SearchQuerySchema } from '@/lib/validations/price.schema'

// ── Cache factory ─────────────────────────────────────────────────────────────
// Arama sonuçları 30 sn boyunca cache'lenir.
// Aynı q+filtre kombinasyonu tekrar geldiğinde DB'ye istek atılmaz.
function getCachedSearch(params: Record<string, unknown>) {
    const cacheKey = JSON.stringify(params)

    return unstable_cache(
        async () => {
            const supabase = await createServerClient()

            const { data, error } = await supabase.rpc('rpc_search_products', {
                p_search:         params.q          ?? null,
                p_category_id:    params.category_id ?? null,
                p_status:         params.status      ?? null,
                p_min_price:      params.min_price   ?? null,
                p_max_price:      params.max_price   ?? null,
                p_low_stock_only: params.low_stock   ?? false,
                p_limit:          params.limit,
                p_offset:         params.offset,
            })

            if (error) throw error
            return data ?? []
        },
        [`search`, cacheKey],
        { revalidate: 30, tags: ['products', 'search'] }
    )()
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams
        const raw = {
            q:           sp.get('q')?.trim()    || undefined,
            category_id: sp.get('category_id')  || undefined,
            status:      sp.get('status')        || undefined,
            min_price:   sp.get('min_price')     || undefined,
            max_price:   sp.get('max_price')     || undefined,
            low_stock:   sp.get('low_stock')     || undefined,
            limit:       sp.get('limit')         || undefined,
            offset:      sp.get('offset')        || undefined,
        }

        const parsed = SearchQuerySchema.safeParse(raw)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Geçersiz parametre.', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const results = await getCachedSearch(parsed.data)

        return NextResponse.json(
            { results, count: results.length },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
                },
            }
        )
    } catch (err) {
        console.error('[/api/search] Unexpected error:', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

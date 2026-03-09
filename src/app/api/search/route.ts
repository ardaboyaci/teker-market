import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Desteklenen parametreler ve tip korumaları
function parseParams(req: NextRequest) {
    const { searchParams } = req.nextUrl

    const q            = searchParams.get('q')?.trim() || null
    const category_id  = searchParams.get('category_id') || null
    const status       = searchParams.get('status') || 'active'
    const min_price    = searchParams.get('min_price')
    const max_price    = searchParams.get('max_price')
    const low_stock    = searchParams.get('low_stock') === 'true'
    const limit        = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const offset       = Math.max(parseInt(searchParams.get('offset') || '0',  10), 0)

    return {
        p_search:         q,
        p_category_id:    category_id,
        p_status:         status as 'active' | 'inactive' | 'draft' | 'archived' | null,
        p_min_price:      min_price  ? parseFloat(min_price)  : null,
        p_max_price:      max_price  ? parseFloat(max_price)  : null,
        p_low_stock_only: low_stock,
        p_limit:          isNaN(limit)  ? 20  : limit,
        p_offset:         isNaN(offset) ? 0   : offset,
    }
}

export async function GET(req: NextRequest) {
    try {
        const params = parseParams(req)

        // En az 2 karakter veya filtre parametresi zorunlu (boş arama önleme)
        const hasFilter =
            params.p_search         !== null ||
            params.p_category_id    !== null ||
            params.p_min_price      !== null ||
            params.p_max_price      !== null ||
            params.p_low_stock_only === true

        if (!hasFilter) {
            return NextResponse.json(
                { error: 'En az bir arama parametresi gerekli (q, category_id, min_price, max_price, low_stock).' },
                { status: 400 }
            )
        }

        if (params.p_search !== null && params.p_search.length < 2) {
            return NextResponse.json(
                { error: 'Arama terimi en az 2 karakter olmalıdır.' },
                { status: 400 }
            )
        }

        const supabase = await createServerClient()

        const { data, error } = await supabase.rpc('rpc_search_products', params)

        if (error) {
            console.error('[/api/search] Supabase RPC error:', error)
            return NextResponse.json(
                { error: 'Arama sırasında bir hata oluştu.' },
                { status: 500 }
            )
        }

        return NextResponse.json(
            { results: data ?? [], count: (data ?? []).length },
            {
                status: 200,
                headers: {
                    // Tarayıcı 30 sn, CDN/edge 60 sn cache'lesin
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
                },
            }
        )
    } catch (err) {
        console.error('[/api/search] Unexpected error:', err)
        return NextResponse.json(
            { error: 'Sunucu hatası.' },
            { status: 500 }
        )
    }
}

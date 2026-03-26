/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams

        const includeInactive  = sp.get('include_inactive') === 'true'
        const withProductCount = sp.get('with_count')       !== 'false' // varsayılan: true
        const parentId         = sp.get('parent_id')        || null     // null = kökler
        const rootOnly         = sp.get('root_only')        === 'true'
        const flat             = sp.get('flat')             === 'true'  // ağaç yerine düz liste

        const supabase = await createServerClient()

        // --- Temel kategori sorgusu ---
        let catQuery = supabase
            .from('categories')
            .select('id, name, slug, description, path, parent_id, depth, sort_order, is_active, image_url, created_at, updated_at')
            .order('sort_order', { ascending: true })
            .order('name',       { ascending: true })

        if (!includeInactive) {
            catQuery = catQuery.eq('is_active', true)
        }

        if (rootOnly) {
            catQuery = catQuery.is('parent_id', null)
        } else if (parentId) {
            catQuery = catQuery.eq('parent_id', parentId)
        }

        const { data: categories, error: catError } = await catQuery

        if (catError) {
            console.error('[/api/categories] Supabase error:', catError)
            return NextResponse.json({ error: 'Kategori verisi alınamadı.' }, { status: 500 })
        }

        // --- Ürün sayısını iste (opsiyonel) ---
        const countMap: Record<string, number> = {}
        if (withProductCount && categories && categories.length > 0) {
            const ids = categories.map((c) => c.id)
            const { data: counts } = await supabase
                .from('products')
                .select('category_id')
                .in('category_id', ids)
                .eq('status', 'active')
                .is('deleted_at', null)

            if (counts) {
                counts.forEach((row: any) => {
                    countMap[row.category_id] = (countMap[row.category_id] ?? 0) + 1
                })
            }
        }

        const enriched = (categories ?? []).map((cat) => ({
            ...cat,
            product_count: withProductCount ? (countMap[cat.id] ?? 0) : undefined,
        }))

        // --- Düz liste mi, ağaç mı? ---
        if (flat) {
            return NextResponse.json(
                { categories: enriched, count: enriched.length },
                {
                    status: 200,
                    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
                }
            )
        }

        // Ağaç yapısı: parent_id null olanlar kök, diğerleri children[]
        const tree = buildTree(enriched)

        return NextResponse.json(
            { categories: tree, count: enriched.length },
            {
                status: 200,
                headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
            }
        )
    } catch (err) {
        console.error('[/api/categories] Unexpected error:', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

// --- Yardımcı: düz diziyi iç içe ağaca çevir (O(n) — Map tabanlı) ---
type CategoryNode = Record<string, any> & { children: CategoryNode[] }

function buildTree(rows: any[]): CategoryNode[] {
    const map = new Map<string, CategoryNode>()
    const roots: CategoryNode[] = []

    // Önce tüm node'ları map'e ekle
    for (const row of rows) {
        map.set(row.id, { ...row, children: [] })
    }

    // Sonra parent-child ilişkisini kur
    for (const row of rows) {
        const node = map.get(row.id)!
        if (row.parent_id && map.has(row.parent_id)) {
            map.get(row.parent_id)!.children.push(node)
        } else {
            roots.push(node)
        }
    }

    return roots
}

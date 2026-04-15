/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import pool from '@/lib/db/pool'
import { SearchQuerySchema } from '@/lib/validations/price.schema'
import type { RowDataPacket } from 'mysql2/promise'

// ── Cache factory ─────────────────────────────────────────────────────────────
function getCachedSearch(params: Record<string, unknown>) {
    const cacheKey = JSON.stringify(params)

    return unstable_cache(
        async () => {
            const conditions: string[] = ['p.deleted_at IS NULL']
            const args: unknown[] = []

            // Arama: LIKE tabanlı (PostgreSQL'deki tsvector/trigram yerine)
            if (params.q) {
                conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)')
                args.push(`%${params.q}%`, `%${params.q}%`, `%${params.q}%`)
            }

            if (params.category_id) {
                conditions.push('p.category_id = ?')
                args.push(params.category_id)
            }

            if (params.status) {
                conditions.push('p.status = ?')
                args.push(params.status)
            }

            if (params.min_price != null) {
                conditions.push('p.sale_price >= ?')
                args.push(params.min_price)
            }

            if (params.max_price != null) {
                conditions.push('p.sale_price <= ?')
                args.push(params.max_price)
            }

            if (params.low_stock) {
                conditions.push('p.quantity_on_hand <= p.min_stock_level')
            }

            const where = conditions.join(' AND ')
            const limit  = Number(params.limit)  || 50
            const offset = Number(params.offset) || 0

            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT
                    p.id, p.sku, p.barcode, p.name, p.slug,
                    p.category_id,
                    c.name AS category_name,
                    p.base_price, p.sale_price, p.vat_rate,
                    p.quantity_on_hand, p.min_stock_level,
                    p.status, p.is_featured,
                    p.attributes, p.tags,
                    p.created_at, p.updated_at
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE ${where}
                ORDER BY p.name ASC
                LIMIT ? OFFSET ?`,
                [...args, limit, offset]
            )

            return (rows as any[]).map((row) => ({
                ...row,
                is_featured: Boolean(row.is_featured),
            }))
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
                headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15' },
            }
        )
    } catch (err) {
        console.error('[/api/search] Unexpected error:', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

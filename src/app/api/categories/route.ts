/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db/pool'
import type { RowDataPacket } from 'mysql2/promise'

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams

        const includeInactive  = sp.get('include_inactive') === 'true'
        const withProductCount = sp.get('with_count')       !== 'false'
        const parentId         = sp.get('parent_id')        || null
        const rootOnly         = sp.get('root_only')        === 'true'
        const flat             = sp.get('flat')             === 'true'

        // ── Kategori sorgusu ─────────────────────────────────────────────────
        const conditions: string[] = []
        const args: unknown[] = []

        if (!includeInactive) {
            conditions.push('is_active = 1')
        }
        if (rootOnly) {
            conditions.push('parent_id IS NULL')
        } else if (parentId) {
            conditions.push('parent_id = ?')
            args.push(parentId)
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        const [categories] = await pool.query<RowDataPacket[]>(
            `SELECT id, name, slug, description, path, parent_id, depth,
                    sort_order, is_active, image_url, created_at, updated_at
             FROM categories
             ${where}
             ORDER BY sort_order ASC, name ASC`,
            args
        )

        // ── Ürün sayısı (opsiyonel) ──────────────────────────────────────────
        const countMap: Record<string, number> = {}
        if (withProductCount && categories.length > 0) {
            const ids = (categories as any[]).map((c) => c.id)
            const placeholders = ids.map(() => '?').join(',')

            const [counts] = await pool.query<RowDataPacket[]>(
                `SELECT category_id, COUNT(*) AS cnt
                 FROM products
                 WHERE category_id IN (${placeholders})
                   AND status = 'active'
                   AND deleted_at IS NULL
                 GROUP BY category_id`,
                ids
            )
            ;(counts as any[]).forEach((row) => {
                countMap[row.category_id] = Number(row.cnt)
            })
        }

        const enriched = (categories as any[]).map((cat) => ({
            ...cat,
            is_active:     Boolean(cat.is_active),
            product_count: withProductCount ? (countMap[cat.id] ?? 0) : undefined,
        }))

        if (flat) {
            return NextResponse.json(
                { categories: enriched, count: enriched.length },
                {
                    status: 200,
                    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
                }
            )
        }

        // ── Ağaç yapısı ──────────────────────────────────────────────────────
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

// ── Yardımcı: düz diziyi iç içe ağaca çevir (O(n) — Map tabanlı) ─────────────
type CategoryNode = Record<string, any> & { children: CategoryNode[] }

function buildTree(rows: any[]): CategoryNode[] {
    const map = new Map<string, CategoryNode>()
    const roots: CategoryNode[] = []

    for (const row of rows) {
        map.set(row.id, { ...row, children: [] })
    }

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

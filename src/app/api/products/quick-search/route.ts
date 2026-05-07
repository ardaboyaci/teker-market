import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db/pool'
import type { RowDataPacket } from 'mysql2/promise'

export async function GET(req: NextRequest) {
    try {
        const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
        const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '10'), 50)

        if (!q || q.length < 2) {
            return NextResponse.json({ products: [] })
        }

        const like = `%${q}%`
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, sku, name, quantity_on_hand, image_url, meta, status
             FROM products
             WHERE deleted_at IS NULL
               AND (sku LIKE ? OR name LIKE ? OR barcode LIKE ?)
             ORDER BY sku ASC
             LIMIT ?`,
            [like, like, like, limit]
        )

        return NextResponse.json({ products: rows })
    } catch (err) {
        console.error('[GET /api/products/quick-search]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
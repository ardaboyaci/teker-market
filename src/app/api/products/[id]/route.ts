/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db/pool'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await req.json()

        const allowed = [
            'name', 'sku', 'slug', 'status', 'sale_price', 'base_price', 'cost_price',
            'quantity_on_hand', 'min_stock_level', 'description', 'image_url',
            'category_id', 'barcode', 'is_featured', 'tags', 'meta', 'attributes',
        ]

        const setClauses: string[] = []
        const args: unknown[] = []

        for (const key of allowed) {
            if (key in body) {
                const val = body[key] ?? null
                if (key === 'tags' || key === 'meta' || key === 'attributes') {
                    setClauses.push(`${key} = ?`)
                    args.push(val !== null ? JSON.stringify(val) : null)
                } else {
                    setClauses.push(`${key} = ?`)
                    args.push(val)
                }
            }
        }

        if (setClauses.length === 0) {
            return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 })
        }

        setClauses.push('updated_at = NOW()')
        args.push(id)

        await pool.query(
            `UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`,
            args
        )

        const [rows] = await pool.query<any[]>('SELECT * FROM products WHERE id = ? LIMIT 1', [id])
        if (!rows.length) return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 })

        return NextResponse.json({ product: rows[0] })
    } catch (err) {
        console.error('[PATCH /api/products/[id]]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params

        await pool.query(
            `UPDATE products SET deleted_at = NOW(), status = 'archived', updated_at = NOW() WHERE id = ?`,
            [id]
        )

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[DELETE /api/products/[id]]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
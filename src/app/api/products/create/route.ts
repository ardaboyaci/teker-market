import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db/pool'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { name, sku, slug, category_id, quantity_on_hand, sale_price, status, image_url } = body

        if (!name || !sku || !slug) {
            return NextResponse.json({ error: 'name, sku, slug zorunludur.' }, { status: 400 })
        }

        const id = uuidv4()

        await pool.query(
            `INSERT INTO products (id, name, sku, slug, category_id, quantity_on_hand, sale_price, status, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                name,
                sku,
                slug,
                category_id ?? null,
                quantity_on_hand ?? 0,
                sale_price ?? null,
                status ?? 'draft',
                image_url ?? null,
            ]
        )

        return NextResponse.json({ product: { id, name, sku, slug } }, { status: 201 })
    } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'Bu SKU veya slug zaten mevcut.' }, { status: 409 })
        }
        console.error('[POST /api/products/create]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
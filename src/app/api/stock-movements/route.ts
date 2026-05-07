import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db/pool'
import type { RowDataPacket } from 'mysql2/promise'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
    try {
        const productId = req.nextUrl.searchParams.get('product_id')
        const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20'), 100)

        if (!productId) {
            return NextResponse.json({ error: 'product_id zorunludur.' }, { status: 400 })
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, movement_type, quantity, quantity_before, quantity_after,
                    reference_type, reference_note, created_at
             FROM stock_movements
             WHERE product_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [productId, limit]
        )

        return NextResponse.json({ movements: rows })
    } catch (err) {
        console.error('[GET /api/stock-movements]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_note } = body

        if (!product_id || !movement_type || quantity === undefined) {
            return NextResponse.json({ error: 'product_id, movement_type, quantity zorunludur.' }, { status: 400 })
        }

        const id = uuidv4()
        await pool.query(
            `INSERT INTO stock_movements (id, product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                product_id,
                movement_type,
                quantity,
                quantity_before ?? 0,
                quantity_after ?? 0,
                reference_type ?? 'manual',
                reference_note ?? null,
            ]
        )

        return NextResponse.json({ id }, { status: 201 })
    } catch (err) {
        console.error('[POST /api/stock-movements]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
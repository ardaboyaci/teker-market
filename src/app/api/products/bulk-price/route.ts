/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db/pool'
import type { RowDataPacket } from 'mysql2/promise'

export async function POST(req: NextRequest) {
    try {
        const { product_ids, operation, value, reason } = await req.json()

        if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
            return NextResponse.json({ error: 'product_ids zorunludur.' }, { status: 400 })
        }
        if (!['*', '+', '-'].includes(operation)) {
            return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 })
        }

        const placeholders = product_ids.map(() => '?').join(',')
        const [products] = await pool.query<RowDataPacket[]>(
            `SELECT id, sale_price FROM products WHERE id IN (${placeholders}) AND sale_price IS NOT NULL`,
            product_ids
        )

        let updated = 0
        for (const p of products as any[]) {
            let newPrice = parseFloat(p.sale_price)
            if (operation === '*') newPrice = Math.round(newPrice * value * 100) / 100
            else if (operation === '+') newPrice = Math.round((newPrice + value) * 100) / 100
            else newPrice = Math.max(0, Math.round((newPrice - value) * 100) / 100)

            await pool.query(
                'UPDATE products SET sale_price = ?, updated_at = NOW() WHERE id = ?',
                [newPrice, p.id]
            )
            updated++
        }

        console.log(`[POST /api/products/bulk-price] ${updated} ürün güncellendi. reason=${reason}`)
        return NextResponse.json({ success: true, updated, reason })
    } catch (err) {
        console.error('[POST /api/products/bulk-price]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
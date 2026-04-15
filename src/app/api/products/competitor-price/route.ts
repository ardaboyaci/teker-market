/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db/pool'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export async function POST(req: NextRequest) {
    try {
        // Docker versiyonunda Supabase auth yok — API erişimi açık.
        // Prod'da bu endpoint rate-limit veya API key ile korunmalıdır.

        const body = await req.json()
        const { productId } = body

        if (!productId || typeof productId !== 'string') {
            return NextResponse.json({ error: 'productId gerekli.' }, { status: 400 })
        }

        // Ürünü çek
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, sku, sale_price, competitor_price, competitor_source
             FROM products
             WHERE id = ? AND deleted_at IS NULL
             LIMIT 1`,
            [productId]
        )

        if ((rows as any[]).length === 0) {
            return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 })
        }

        const product = (rows as any[])[0]

        if (!product.competitor_price) {
            return NextResponse.json(
                { error: 'Bu ürün için rakip fiyat verisi yok.' },
                { status: 400 }
            )
        }

        const newPrice = parseFloat(String(product.competitor_price))
        const oldPrice = product.sale_price ? parseFloat(String(product.sale_price)) : null

        // sale_price = competitor_price
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE products SET sale_price = ?, status = 'active', updated_at = CURRENT_TIMESTAMP(6)
             WHERE id = ?`,
            [newPrice, productId]
        )

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Güncelleme başarısız.' }, { status: 500 })
        }

        // price_history kaydı (trigger ayrıca da yazar)
        await pool.query(
            `INSERT INTO price_history (product_id, price_type, old_price, new_price, change_reason)
             VALUES (?, 'sale', ?, ?, ?)`,
            [productId, oldPrice, newPrice,
             `[revize] ${product.competitor_source ?? 'e-tekerlek.com'} fiyatı uygulandı`]
        )

        return NextResponse.json({
            ok: true,
            product: {
                id:             productId,
                sku:            product.sku,
                sale_price:     newPrice,
                competitor_price: product.competitor_price,
                status:         'active',
            },
            applied: {
                old_price:         oldPrice,
                new_price:         newPrice,
                competitor_source: product.competitor_source,
            },
        })
    } catch (err) {
        console.error('[competitor-price] unexpected error:', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import pool from '@/lib/db/pool'
import { runCronStep, verifyCronSecret } from '@/lib/cron/helpers'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

// ─── Adım 1: Fiyat güncellemesi ──────────────────────────────────────────────
async function stepSyncPrices() {
    const [products] = await pool.query<RowDataPacket[]>(
        `SELECT id, sku, base_price, sale_price, status
         FROM products
         WHERE status IN ('draft', 'active')
           AND deleted_at IS NULL
         ORDER BY sku
         LIMIT 100`
    )

    if ((products as any[]).length === 0) {
        return { ok: true, message: 'Güncellenecek ürün bulunamadı.', data: { updated: 0 } }
    }

    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const product of products as any[]) {
        if (!product.base_price) { skipped++; continue }

        const currentSalePrice = product.sale_price ? parseFloat(String(product.sale_price)) : null
        const basePrice        = parseFloat(String(product.base_price))

        const newSalePrice = currentSalePrice ?? Math.round(basePrice * 0.90 * 100) / 100
        const priceChanged = currentSalePrice === null ||
            Math.abs(currentSalePrice - newSalePrice) > 0.001

        // TODO: gerçek fiyat scraping entegre edilene kadar otomatik güncelleme devre dışı
        if (!priceChanged) { skipped++; continue }
        skipped++; continue // placeholder — aktif etme

        const [res] = await pool.query<ResultSetHeader>(
            `UPDATE products SET sale_price = ?, status = 'active' WHERE id = ?`,
            [newSalePrice, product.id]
        )

        if (res.affectedRows === 0) {
            errors.push(`${product.sku}: güncelleme başarısız`)
            continue
        }

        await pool.query(
            `INSERT INTO price_history (product_id, price_type, old_price, new_price, change_reason)
             VALUES (?, 'sale', ?, ?, 'cron/sync — otomatik fiyat normalizasyonu')`,
            [product.id, currentSalePrice, newSalePrice]
        )

        updated++
    }

    if (errors.length > 0) {
        Sentry.captureMessage(
            `stepSyncPrices: ${errors.length} ürün güncellenemedi`,
            { level: 'warning', extra: { errors } }
        )
    }

    return {
        ok:      errors.length < (products as any[]).length,
        message: `${updated} güncellendi, ${skipped} atlandı, ${errors.length} hata.`,
        data:    { total: (products as any[]).length, updated, skipped, errors },
    }
}

// ─── Adım 2: Yeni ürün kontrolü ──────────────────────────────────────────────
async function stepCheckNewProducts() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ')

    const [newProducts] = await pool.query<RowDataPacket[]>(
        `SELECT p.id, p.sku, p.name, p.status, p.base_price, p.sale_price, p.created_at,
                COUNT(pm.id) AS image_count
         FROM products p
         LEFT JOIN product_media pm ON pm.product_id = p.id
         WHERE p.deleted_at IS NULL AND p.created_at >= ?
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [since]
    )

    const incomplete = (newProducts as any[]).filter((p) => {
        return p.base_price === null || Number(p.image_count) === 0
    })

    if (incomplete.length > 0) {
        Sentry.captureMessage(
            `${incomplete.length} yeni ürün eksik veriyle eklendi (fiyat veya görsel yok)`,
            {
                level: 'info',
                extra: {
                    products: incomplete.map((p) => ({
                        sku:      p.sku,
                        name:     p.name,
                        hasPrice: p.base_price !== null,
                        hasImage: Number(p.image_count) > 0,
                        created_at: p.created_at,
                    })),
                },
            }
        )
    }

    return {
        ok:      true,
        message: `Son 24 saatte ${(newProducts as any[]).length} yeni ürün; ${incomplete.length} eksik.`,
        data: {
            new_count:        (newProducts as any[]).length,
            incomplete_count: incomplete.length,
            incomplete_skus:  incomplete.map((p) => p.sku),
        },
    }
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req.headers.get('authorization'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startedAt = Date.now()
    const results: Record<string, unknown> = {}

    results.syncPrices      = await runCronStep('syncPrices',      stepSyncPrices)
    results.checkNewProducts = await runCronStep('checkNewProducts', stepCheckNewProducts)

    const allOk    = Object.values(results).every((r: any) => r.ok)
    const duration = Date.now() - startedAt

    console.log(`[cron/sync] Tamamlandı — ${duration}ms | ok=${allOk}`, results)

    return NextResponse.json(
        { ok: allOk, duration_ms: duration, timestamp: new Date().toISOString(), steps: results },
        { status: allOk ? 200 : 207 }
    )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import pool from '@/lib/db/pool'
import { ProductQuerySchema } from '@/lib/validations/price.schema'
import type { RowDataPacket } from 'mysql2/promise'

// ── Tip tanımı ────────────────────────────────────────────────────────────────
type ParsedParams = Exclude<ReturnType<typeof buildParams>, { error: unknown }>

// ── Cache factory ─────────────────────────────────────────────────────────────
function getCachedProducts(params: ParsedParams) {
    const cacheKey = JSON.stringify(params)

    return unstable_cache(
        async () => {
            const p = params
            const conditions: string[] = ['p.deleted_at IS NULL']
            const args: unknown[] = []

            // Kategori filtresi: alt kategoriler path LIKE ile bulunur (ltree yerine)
            if (p.category_id) {
                if (p.include_children) {
                    const [catRows] = await pool.query<RowDataPacket[]>(
                        'SELECT path FROM categories WHERE id = ?',
                        [p.category_id]
                    )
                    if (catRows.length > 0) {
                        const path = catRows[0].path as string
                        const [childRows] = await pool.query<RowDataPacket[]>(
                            'SELECT id FROM categories WHERE id = ? OR path LIKE ?',
                            [p.category_id, `${path}.%`]
                        )
                        const ids = childRows.map((r) => r.id as string)
                        if (ids.length > 0) {
                            conditions.push(`p.category_id IN (${ids.map(() => '?').join(',')})`)
                            args.push(...ids)
                        }
                    } else {
                        conditions.push('p.category_id = ?')
                        args.push(p.category_id)
                    }
                } else {
                    conditions.push('p.category_id = ?')
                    args.push(p.category_id)
                }
            }

            if (p.search) {
                conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)')
                args.push(`%${p.search}%`, `%${p.search}%`, `%${p.search}%`)
            }
            if (p.supplier) {
                const sourceMap: Record<string, string> = {
                    EMES:       'emes_2026',
                    EMES_KULP:  'emes_kulp_2026',
                    ZET:        'zet_2026',
                    MERTSAN:    'mertsan_2026',
                    YEDEK_EMES: 'yedek_emes_2026',
                    CFT:        'ciftel_2026',
                    OSK:        'oskar_2026',
                    KAU:        'kaucuk_takoz_2026',
                    FAL:        'falo_2026',
                }
                const source = sourceMap[p.supplier]
                if (source) {
                    conditions.push("JSON_UNQUOTE(JSON_EXTRACT(p.meta, '$.source')) = ?")
                    args.push(source)
                }
            }
            if (p.status)              { conditions.push('p.status = ?');        args.push(p.status) }
            if (p.min_price != null)   { conditions.push('p.sale_price >= ?');   args.push(p.min_price) }
            if (p.max_price != null)   { conditions.push('p.sale_price <= ?');   args.push(p.max_price) }
            if (p.is_featured != null) { conditions.push('p.is_featured = ?');   args.push(p.is_featured ? 1 : 0) }

            const where = conditions.join(' AND ')

            // Sıralama — SQL injection'a karşı whitelist
            const allowed = ['sku', 'name', 'sale_price', 'created_at', 'updated_at']
            const sortCol = allowed.includes(p.sort_by) ? p.sort_by : 'created_at'
            const sortDir = p.sort_dir === 'asc' ? 'ASC' : 'DESC'

            // Toplam kayıt sayısı
            const [countRows] = await pool.query<RowDataPacket[]>(
                `SELECT COUNT(*) AS total FROM products p WHERE ${where}`,
                args
            )
            const total = (countRows[0] as any).total as number

            // Sayfalandırılmış veri — görselli+stoklu ürünler önce
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT
                    p.id, p.sku, p.barcode, p.name, p.slug, p.short_description,
                    p.category_id,
                    c.id AS cat_id, c.name AS cat_name, c.slug AS cat_slug, c.path AS cat_path,
                    p.base_price, p.sale_price, p.vat_rate, p.currency,
                    p.quantity_on_hand, p.min_stock_level,
                    p.weight, p.width, p.height,
                    p.attributes, p.status, p.is_featured, p.tags,
                    p.image_url,
                    p.competitor_price, p.competitor_source,
                    p.created_at, p.updated_at,
                    pm.url AS media_url, pm.alt_text AS media_alt
                FROM products p
                LEFT JOIN categories c   ON p.category_id = c.id
                LEFT JOIN product_media pm ON pm.product_id = p.id AND pm.is_primary = 1
                WHERE ${where}
                ORDER BY
                    CASE
                        WHEN (p.image_url IS NOT NULL OR pm.url IS NOT NULL) AND p.quantity_on_hand > 0 THEN 1
                        WHEN (p.image_url IS NOT NULL OR pm.url IS NOT NULL) THEN 2
                        ELSE 3
                    END ASC,
                    p.${sortCol} ${sortDir}
                LIMIT ? OFFSET ?`,
                [...args, p.limit, p.offset]
            )

            const products = (rows as any[]).map((row) => ({
                id:                row.id,
                sku:               row.sku,
                barcode:           row.barcode,
                name:              row.name,
                slug:              row.slug,
                short_description: row.short_description,
                category_id:       row.category_id,
                category: row.cat_id ? {
                    id:   row.cat_id,
                    name: row.cat_name,
                    slug: row.cat_slug,
                    path: row.cat_path,
                } : null,
                base_price:       row.base_price,
                sale_price:       row.sale_price,
                vat_rate:         row.vat_rate,
                currency:         row.currency,
                quantity_on_hand: row.quantity_on_hand,
                min_stock_level:  row.min_stock_level,
                weight:           row.weight,
                width:            row.width,
                height:           row.height,
                attributes:       row.attributes,
                status:           row.status,
                is_featured:      Boolean(row.is_featured),
                tags:             row.tags,
                image_url:              (row.image_url as string | null) ?? (row.media_url as string | null) ?? null,
                competitor_price:       row.competitor_price ?? null,
                competitor_source:      row.competitor_source ?? null,
                competitor_scraped_at:  null,
                created_at:             row.created_at,
                updated_at:             row.updated_at,
                primary_image: row.media_url ? {
                    url:      row.media_url,
                    alt_text: row.media_alt,
                } : null,
            }))

            return { products, count: total }
        },
        [`products-list`, cacheKey],
        { revalidate: 60, tags: ['products'] }
    )()
}

// ── Parametre ayrıştırma + Zod validasyon ─────────────────────────────────────
function buildParams(req: NextRequest) {
    const sp = req.nextUrl.searchParams
    const raw = {
        search:           sp.get('search')?.trim()       || undefined,
        supplier:         sp.get('supplier')?.trim()     || undefined,
        category_id:      sp.get('category_id')          || undefined,
        include_children: sp.get('include_children')     ?? undefined,
        status:           sp.get('status')               || undefined,
        min_price:        sp.get('min_price')            || undefined,
        max_price:        sp.get('max_price')            || undefined,
        low_stock:        sp.get('low_stock')            || undefined,
        is_featured:      sp.get('is_featured')          || undefined,
        sort_by:          sp.get('sort_by')              || undefined,
        sort_dir:         sp.get('sort_dir')             || undefined,
        limit:            sp.get('limit')                || undefined,
        page:             sp.get('page')                 || undefined,
    }

    const parsed = ProductQuerySchema.safeParse(raw)
    if (!parsed.success) return { error: parsed.error.flatten() }

    const p = parsed.data
    return { ...p, offset: (p.page - 1) * p.limit }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const params = buildParams(req)

        if ('error' in params) {
            return NextResponse.json(
                { error: 'Geçersiz parametre.', details: params.error },
                { status: 400 }
            )
        }

        const { products, count } = await getCachedProducts(params)
        const totalPages = Math.ceil(count / params.limit)

        return NextResponse.json(
            {
                products,
                pagination: {
                    page:        params.page,
                    limit:       params.limit,
                    total_count: count,
                    total_pages: totalPages,
                    has_next:    params.page < totalPages,
                    has_prev:    params.page > 1,
                },
            },
            {
                status: 200,
                headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
            }
        )
    } catch (err) {
        console.error('[/api/products] Unexpected error:', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

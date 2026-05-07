/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { name, sku, slug, category_id, quantity_on_hand, sale_price, status, image_url } = body

        if (!name || !sku || !slug) {
            return NextResponse.json({ error: 'name, sku, slug zorunludur.' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('products')
            .insert({
                name,
                sku,
                slug,
                category_id: category_id || null,
                quantity_on_hand: quantity_on_hand ?? 0,
                sale_price: sale_price ?? null,
                status: status ?? 'draft',
                image_url: image_url ?? null,
            })
            .select('id, name, sku, slug')
            .single()

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Bu SKU veya slug zaten mevcut.' }, { status: 409 })
            }
            throw error
        }

        return NextResponse.json({ product: data }, { status: 201 })
    } catch (err) {
        console.error('[POST /api/products/create]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
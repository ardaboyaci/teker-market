/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await req.json()
        const supabase = createAdminClient()

        const allowed = [
            'name', 'sku', 'slug', 'status', 'sale_price', 'base_price', 'cost_price',
            'quantity_on_hand', 'min_stock_level', 'description', 'image_url',
            'category_id', 'barcode', 'is_featured', 'tags', 'meta', 'attributes',
        ]
        const updates: Record<string, unknown> = {}
        for (const key of allowed) {
            if (key in body) updates[key] = body[key] ?? null
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ product: data })
    } catch (err) {
        console.error('[PATCH /api/products/[id]]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = createAdminClient()

        const { error } = await supabase
            .from('products')
            .update({ deleted_at: new Date().toISOString(), status: 'archived' })
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[DELETE /api/products/[id]]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
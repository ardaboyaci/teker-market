/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
    try {
        const productId = req.nextUrl.searchParams.get('product_id')
        const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20'), 100)

        if (!productId) {
            return NextResponse.json({ error: 'product_id zorunludur.' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('stock_movements')
            .select('id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_note, created_at')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error
        return NextResponse.json({ movements: data ?? [] })
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

        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('stock_movements')
            .insert({
                product_id,
                movement_type,
                quantity,
                quantity_before: quantity_before ?? 0,
                quantity_after: quantity_after ?? 0,
                reference_type: reference_type ?? 'manual',
                reference_note: reference_note ?? null,
            })
            .select('id')
            .single()

        if (error) throw error
        return NextResponse.json({ id: data.id }, { status: 201 })
    } catch (err) {
        console.error('[POST /api/stock-movements]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
    try {
        const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
        const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '10'), 50)

        if (!q || q.length < 2) {
            return NextResponse.json({ products: [] })
        }

        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('products')
            .select('id, sku, name, quantity_on_hand, image_url, meta, status')
            .is('deleted_at', null)
            .or(`sku.ilike.%${q}%,name.ilike.%${q}%,barcode.ilike.%${q}%`)
            .order('sku', { ascending: true })
            .limit(limit)

        if (error) throw error
        return NextResponse.json({ products: data ?? [] })
    } catch (err) {
        console.error('[GET /api/products/quick-search]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
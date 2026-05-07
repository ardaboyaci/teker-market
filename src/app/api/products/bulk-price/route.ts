/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
    try {
        const { product_ids, operation, value, reason } = await req.json()

        if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
            return NextResponse.json({ error: 'product_ids zorunludur.' }, { status: 400 })
        }
        if (!['*', '+', '-'].includes(operation)) {
            return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // Her ürünü çek, yeni fiyatı hesapla, güncelle
        const { data: products, error: fetchErr } = await supabase
            .from('products')
            .select('id, sale_price')
            .in('id', product_ids)
            .not('sale_price', 'is', null)

        if (fetchErr) throw fetchErr

        const updates = (products ?? []).map((p: any) => {
            let newPrice = parseFloat(p.sale_price)
            if (operation === '*') newPrice = Math.round(newPrice * value * 100) / 100
            else if (operation === '+') newPrice = Math.round((newPrice + value) * 100) / 100
            else newPrice = Math.max(0, Math.round((newPrice - value) * 100) / 100)
            return { id: p.id, sale_price: newPrice }
        })

        for (const u of updates) {
            await supabase.from('products').update({ sale_price: u.sale_price }).eq('id', u.id)
        }

        return NextResponse.json({ success: true, updated: updates.length, reason })
    } catch (err) {
        console.error('[POST /api/products/bulk-price]', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerClient()

        // Auth guard — sadece oturum açmış kullanıcılar
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
        }

        const body = await req.json()
        const { productId } = body

        if (!productId || typeof productId !== 'string') {
            return NextResponse.json({ error: 'productId gerekli.' }, { status: 400 })
        }

        // Ürünü çek
        const { data: product, error: fetchErr } = await supabase
            .from('products')
            .select('id, sku, sale_price, competitor_price, competitor_source')
            .eq('id', productId)
            .is('deleted_at', null)
            .single()

        if (fetchErr || !product) {
            return NextResponse.json({ error: 'Ürün bulunamadı.' }, { status: 404 })
        }

        if (!product.competitor_price) {
            return NextResponse.json(
                { error: 'Bu ürün için rakip fiyat verisi yok.' },
                { status: 400 }
            )
        }

        const newPrice   = parseFloat(String(product.competitor_price))
        const oldPrice   = product.sale_price ? parseFloat(String(product.sale_price)) : null

        // sale_price = competitor_price
        const { data: updated, error: updateErr } = await supabase
            .from('products')
            .update({ sale_price: newPrice, status: 'active' })
            .eq('id', productId)
            .select('id, sku, sale_price, competitor_price, status')
            .single()

        if (updateErr) {
            console.error('[competitor-price] update error:', updateErr.message)
            return NextResponse.json({ error: 'Güncelleme başarısız.' }, { status: 500 })
        }

        // Ek price_history kaydı (trigger ayrıca da yazar, bu açıklayıcı not)
        await supabase.from('price_history').insert({
            product_id:    productId,
            price_type:    'sale',
            old_price:     oldPrice,
            new_price:     newPrice,
            change_reason: `[revize] ${product.competitor_source ?? 'e-tekerlek.com'} fiyatı uygulandı`,
        })

        return NextResponse.json({
            ok: true,
            product: updated,
            applied: {
                old_price:        oldPrice,
                new_price:        newPrice,
                competitor_source: product.competitor_source,
            },
        })
    } catch (err) {
        console.error('[competitor-price] unexpected error:', err)
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
    }
}

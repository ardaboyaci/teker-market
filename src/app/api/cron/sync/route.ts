/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { runCronStep, verifyCronSecret } from '@/lib/cron/helpers'

// ─── Adım 1: Fiyat güncellemesi ──────────────────────────────────────────────
async function stepSyncPrices() {
    const supabase = createAdminClient()

    // Draft veya active ürünleri al
    const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, sku, sale_price')
        .in('status', ['draft', 'active'])
        .is('deleted_at', null)
        .order('sku')
        .limit(100) // Tek cron çalışmasında makul limit

    if (fetchError) {
        return { ok: false, message: `Ürün listesi alınamadı: ${fetchError.message}` }
    }

    if (!products || products.length === 0) {
        return { ok: true, message: 'Güncellenecek ürün bulunamadı.', data: { updated: 0 } }
    }

    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const product of products) {
        // Mevcut fiyatı koru — burada gerçek fiyat mantığı (scrape-pricing.ts) entegre edilebilir.
        // Şimdilik: base_price varsa sale_price'ı normalize et, yoksa atla.
        const { data: full, error: fullErr } = await supabase
            .from('products')
            .select('id, sku, base_price, sale_price, status')
            .eq('id', product.id)
            .single()

        if (fullErr || !full) { skipped++; continue }
        if (!full.base_price) { skipped++; continue }

        const currentSalePrice = full.sale_price ? parseFloat(String(full.sale_price)) : null
        const basePrice        = parseFloat(String(full.base_price))

        // Basit kural: sale_price yoksa base_price'tan %10 indirimli set et
        const newSalePrice = currentSalePrice ?? Math.round(basePrice * 0.90 * 100) / 100
        const priceChanged = currentSalePrice === null ||
            Math.abs(currentSalePrice - newSalePrice) > 0.001

        if (!priceChanged) { skipped++; continue }

        // products tablosunu güncelle
        const { error: updateErr } = await supabase
            .from('products')
            .update({ sale_price: newSalePrice, status: 'active' })
            .eq('id', product.id)

        if (updateErr) {
            errors.push(`${product.sku}: ${updateErr.message}`)
            continue
        }

        // price_history'e kaydet
        await supabase.from('price_history').insert({
            product_id: product.id,
            price_type: 'sale',
            old_price:  currentSalePrice,
            new_price:  newSalePrice,
            notes:      'cron/sync — otomatik fiyat normalizasyonu',
        })

        updated++
    }

    if (errors.length > 0) {
        // Kısmi hatalar varsa Sentry'e toplu ilet
        Sentry.captureMessage(
            `stepSyncPrices: ${errors.length} ürün güncellenemedi`,
            { level: 'warning', extra: { errors } }
        )
    }

    return {
        ok:      errors.length < products.length, // en az bir başarılıysa ok
        message: `${updated} güncellendi, ${skipped} atlandı, ${errors.length} hata.`,
        data:    { total: products.length, updated, skipped, errors },
    }
}

// ─── Adım 2: Yeni ürün kontrolü ──────────────────────────────────────────────
async function stepCheckNewProducts() {
    const supabase = createAdminClient()

    // Son 24 saatte eklenen, henüz fiyatsız veya görselsiz ürünleri bul
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: newProducts, error } = await supabase
        .from('products')
        .select(`
            id, sku, name, status, base_price, sale_price, created_at,
            images:product_media(id)
        `)
        .is('deleted_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false })

    if (error) {
        return { ok: false, message: `Yeni ürün sorgusu başarısız: ${error.message}` }
    }

    const incomplete = (newProducts ?? []).filter((p: any) => {
        const hasPrice = p.base_price !== null
        const hasImage = Array.isArray(p.images) && p.images.length > 0
        return !hasPrice || !hasImage
    })

    if (incomplete.length > 0) {
        // Eksik ürünleri Sentry'ye bilgi olarak ilet
        Sentry.captureMessage(
            `${incomplete.length} yeni ürün eksik veriyle eklendi (fiyat veya görsel yok)`,
            {
                level: 'info',
                extra: {
                    products: incomplete.map((p: any) => ({
                        sku:        p.sku,
                        name:       p.name,
                        hasPrice:   p.base_price !== null,
                        hasImage:   Array.isArray(p.images) && p.images.length > 0,
                        created_at: p.created_at,
                    })),
                },
            }
        )
    }

    return {
        ok:      true,
        message: `Son 24 saatte ${newProducts?.length ?? 0} yeni ürün; ${incomplete.length} eksik.`,
        data:    {
            new_count:        newProducts?.length ?? 0,
            incomplete_count: incomplete.length,
            incomplete_skus:  incomplete.map((p: any) => p.sku),
        },
    }
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    // 1. Güvenlik: CRON_SECRET doğrula
    if (!verifyCronSecret(req.headers.get('authorization'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startedAt = Date.now()
    const results: Record<string, unknown> = {}

    // 2. Her adımı izole çalıştır; biri patlasa diğeri devam eder
    results.syncPrices = await runCronStep('syncPrices', stepSyncPrices)
    results.checkNewProducts = await runCronStep('checkNewProducts', stepCheckNewProducts)

    const allOk    = Object.values(results).every((r: any) => r.ok)
    const duration = Date.now() - startedAt

    console.log(`[cron/sync] Tamamlandı — ${duration}ms | ok=${allOk}`, results)

    return NextResponse.json(
        {
            ok:        allOk,
            duration_ms: duration,
            timestamp:  new Date().toISOString(),
            steps:     results,
        },
        { status: allOk ? 200 : 207 } // 207 Multi-Status: kısmi başarı
    )
}

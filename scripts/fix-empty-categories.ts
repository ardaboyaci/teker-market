/**
 * fix-empty-categories.ts
 * Boyut/isim bazlı mantıkla boş kategorilere ürün atar:
 *  1. Çiftel parent (0c85e3af) → Hafif Yük / Orta Yük
 *  2. VBP/VBV/VBZ/VBR ürünleri → PU alt kategorileri (Hafif/Ağır/Ekstra Ağır)
 *
 * Çalıştır:  npx tsx scripts/fix-empty-categories.ts
 * Dry-run:   npx tsx scripts/fix-empty-categories.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY = process.argv.includes('--dry-run')

// ── Kategori ID'leri ─────────────────────────────────────────────────────────
const CAT = {
    ciftel_parent:  '0c85e3af-0b6f-46c6-ae07-45d57663b93d',
    ciftel_hafif:   '7ec1b6c2-4e87-4581-9fe6-a6276f5d5044',
    ciftel_orta:    'c58bb0fb-cfe6-4f0d-a67f-4172579da974',
    ciftel_yedek:   'd00efd16-6d67-4648-bf77-52d54dd8c9d7',
    tekerlekler:    '19a9d71c-aee5-4374-85ce-f80139df8611',
    pu_hafif:       'ce475604-9a7e-49de-af0d-c6a79fbc0132', // Hafif Yük PU
    pu_agir:        '0fe68d14-170d-4ed2-816f-8bd332e9b3b9', // Ağır Yük PU
    pu_ekstra_agir: '0f1859b0-35ca-408b-bdea-7f4f175c030a', // Ekstra Ağır Yük PU
}

// ── Ürün isminden ilk boyut (çap, mm) çıkar ──────────────────────────────────
function extractDiameter(name: string): number | null {
    const m = name.match(/^(\d+)[xX]/)
    return m ? parseInt(m[1], 10) : null
}

// ── PU çap → kategori ────────────────────────────────────────────────────────
function puCategory(name: string): string {
    // VBP 200X60 → 200mm → Ağır Yük PU
    // VBP 300X80 → 300mm → Ekstra Ağır Yük PU
    const m = name.match(/(\d+)[xX]/i)
    const d = m ? parseInt(m[1], 10) : 0
    if (d >= 250) return CAT.pu_ekstra_agir
    if (d >= 150) return CAT.pu_agir
    return CAT.pu_hafif
}

async function main() {
    console.log(DRY ? '🔍 DRY-RUN modu\n' : '🚀 Boş kategori düzeltmesi başlıyor...\n')

    let totalUpdated = 0

    // ── 1. Çiftel parent → Hafif / Orta / Yedek ─────────────────────────────
    console.log('── Çiftel parent → alt kategoriler ────────────────────────')
    const groups: Record<string, string[]> = {}
    let offset = 0

    while (true) {
        const { data } = await sb
            .from('products')
            .select('id, name')
            .eq('category_id', CAT.ciftel_parent)
            .is('deleted_at', null)
            .range(offset, offset + 999)

        if (!data || data.length === 0) break

        for (const p of data) {
            const upper = (p.name || '').toUpperCase()
            let target: string

            if (/YEDEK/.test(upper)) {
                target = CAT.ciftel_yedek
            } else {
                const diam = extractDiameter(p.name || '')
                if (diam !== null) {
                    target = diam <= 110 ? CAT.ciftel_hafif : CAT.ciftel_orta
                } else if (/HAF[İI]F|HAFIF/.test(upper)) {
                    target = CAT.ciftel_hafif
                } else {
                    // Boyut çıkarılamayan ürünler parent'ta kalır
                    continue
                }
            }

            if (!groups[target]) groups[target] = []
            groups[target].push(p.id)
        }

        offset += 1000
        if (data.length < 1000) break
    }

    for (const [catId, ids] of Object.entries(groups)) {
        const label = Object.entries(CAT).find(([, v]) => v === catId)?.[0] ?? catId
        console.log(`  ${DRY ? '[DRY]' : '✓'} ${ids.length} Çiftel ürün → ${label}`)
        if (!DRY) {
            // Toplu güncelle (Supabase max 1000/istek)
            for (let i = 0; i < ids.length; i += 500) {
                const { error } = await sb.from('products').update({ category_id: catId }).in('id', ids.slice(i, i + 500))
                if (error) console.error('  ❌', error.message)
                else totalUpdated += Math.min(500, ids.length - i)
            }
        }
    }

    // ── 2. VBP/VBV/VBZ/VBR (PU teker) → Hafif/Ağır/Ekstra Ağır PU ─────────
    console.log('\n── PU tekerlekler → PU alt kategoriler ────────────────────')
    const puGroups: Record<string, string[]> = {}

    const { data: puProducts } = await sb
        .from('products')
        .select('id, name')
        .eq('category_id', CAT.tekerlekler)
        .or('name.ilike.%VBP%,name.ilike.%VBV%,name.ilike.%VBZ%,name.ilike.%VBR%')
        .is('deleted_at', null)

    for (const p of puProducts ?? []) {
        const catId = puCategory(p.name || '')
        if (!puGroups[catId]) puGroups[catId] = []
        puGroups[catId].push(p.id)
    }

    for (const [catId, ids] of Object.entries(puGroups)) {
        const label = Object.entries(CAT).find(([, v]) => v === catId)?.[0] ?? catId
        console.log(`  ${DRY ? '[DRY]' : '✓'} ${ids.length} PU ürün → ${label}`)
        if (!DRY) {
            const { error } = await sb.from('products').update({ category_id: catId }).in('id', ids)
            if (error) console.error('  ❌', error.message)
            else totalUpdated += ids.length
        }
    }

    // ── Özet ─────────────────────────────────────────────────────────────────
    console.log('\n── Özet ────────────────────────────────────────────────────')
    const ciftelTotal = Object.values(groups).reduce((a, b) => a + b.length, 0)
    const puTotal     = Object.values(puGroups).reduce((a, b) => a + b.length, 0)
    console.log(`Çiftel dağıtılan : ${ciftelTotal}`)
    console.log(`PU dağıtılan     : ${puTotal}`)
    console.log(`Toplam güncellenen: ${DRY ? '(dry-run)' : totalUpdated}`)
}

main().catch(console.error)

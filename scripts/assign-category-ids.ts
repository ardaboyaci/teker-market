/**
 * assign-category-ids.ts
 * category_id NULL olan ürünlere kaynak + isim/SKU pattern'ına göre kategori atar.
 *
 * Çalıştır: npx tsx scripts/assign-category-ids.ts
 * Dry-run:  npx tsx scripts/assign-category-ids.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')

// ── Kategori ID haritası ──────────────────────────────────────────────────────
const CAT: Record<string, string> = {
    // EMES — E-serisi prefix (isim başı)
    'ED': 'fb2ed69d-03f9-4df0-ab98-893c9741e53c', // ED Serisi → Ağır Sanayi
    'EX': 'caea0020-9a5a-468c-b6ef-357a0b0a3306', // EX Serisi → Ağır Sanayi
    'EG': '9fdf80a2-6796-49bd-92a1-ccdb78cb7a23', // EG Serisi → Orta Sanayi
    'EZ': '808cba79-b460-44fd-93f4-51e7b5456377', // EZ Serisi → Orta Sanayi
    'EK': 'a1e2702d-bb1b-42c5-8b60-c084320d26d2', // EK Serisi → Hafif Sanayi
    'EM': '776842cb-4ef5-40a0-a9a3-45de3397f8ad', // EM Serisi → Hafif Sanayi
    'EJ': 'dd8070f8-b0d9-4d12-b87d-35306092e5fa', // EJ Serisi → Ekstra Ağır
    'EV': 'c26225e5-1f45-4f6f-8023-24f5d210da3e', // EV Serisi → Ekstra Ağır
    'EB': '3694af72-f42e-4215-86b4-6d42a07bc08c', // EB Serisi → Servis/Mobilya
    'EF': '7a555033-57aa-450b-9910-3a82273817ea', // EF Serisi → Servis/Mobilya
    'EL': 'c0764f7d-42ec-42c0-bb84-366dc73afd52', // EL Serisi → Servis/Mobilya
    'EP': 'ef1c7261-1f05-4f95-82a6-b3eefcb7a3a5', // EP Serisi → Servis/Mobilya
    'ET': 'b36440c6-8b77-48a9-bef6-b94bf89ca470', // ET Serisi → Servis/Mobilya
    'EC': 'e2ef6cbc-ed5b-48f0-9617-155cebde7c84', // EC Serisi → Hastane/Servis
    'ER': '7b6af820-c65b-46be-8737-0d66c9d51afb', // ER Serisi → Hastane/Servis
    'ES': '7edf9e21-46f6-4652-8cff-0cfca79bd929', // ES Serisi → Süpermarket
    'EY': '7fdf9d4f-73eb-40a5-81bd-9f5d48a2ebf9', // EY Serisi → Süpermarket

    // MERTSAN → Ağır Sanayi Tipi
    'MERTSAN': '69e501e5-e085-40b1-9edd-3de661f2a306',
}

// Kaynak bazlı sabit kategori (isim eşleşmesi yoksa fallback)
const SOURCE_FALLBACK: Record<string, string> = {
    'ciftel':   '0c85e3af-0b6f-46c6-ae07-45d57663b93d', // Çiftel Tekerlek
    'oskar':    'ba533946-8d43-4956-bb6b-cc71a82866c4', // Aksesuarlar (menteşe/kilit)
    'kaucuk':   'd89fea6c-8340-4b18-8070-651291fc8b61', // Aparatlar
    'falo':     'd89fea6c-8340-4b18-8070-651291fc8b61', // Aparatlar
    'zet':      '19a9d71c-aee5-4374-85ce-f80139df8611', // Tekerlekler (genel)
    'mertsan':  '69e501e5-e085-40b1-9edd-3de661f2a306', // Ağır Sanayi Tipi
}

function inferCategoryId(name: string, source: string): string | null {
    const upperName = (name || '').toUpperCase()

    // EMES — isim başındaki 2-harfli E-serisi kodu
    const eMatch = upperName.match(/^(E[A-Z])\d/)
    if (eMatch && CAT[eMatch[1]]) return CAT[eMatch[1]]

    // MERTSAN
    if (source.includes('mertsan')) return CAT['MERTSAN']

    // OSKAR — menteşe/kilit/tutamak ayrımı
    if (source.includes('oskar')) {
        if (/MENTEŞE|MENTESE/.test(upperName)) return 'd4f9df1b-7dd7-4f63-9696-242ac761a2f8'       // Menteşe
        if (/KİLİT|KILIT|MANDAL/.test(upperName)) return '144310f3-1c28-4ec1-98fa-1c1f138907bd' // Kilit
        if (/KULP|TUTAMAK|ELÇEK/.test(upperName)) return '703da1d0-ef18-461e-b364-1fac4a18d073' // Plastik Kulplar
        return SOURCE_FALLBACK['oskar']
    }

    // KAUÇUK — makine ayağı mı, aksesuar mı
    if (source.includes('kaucuk')) {
        if (/AYAK|AYAĞI/.test(upperName)) return '151751e8-7756-421a-baa9-1b51205ca6a6' // Makine Ayakları
        return SOURCE_FALLBACK['kaucuk']
    }

    // FALO — makara, menteşe, kol, denge, hırdavat
    if (source.includes('falo')) {
        if (/MAKARA/.test(upperName)) return 'd89fea6c-8340-4b18-8070-651291fc8b61'    // Aparatlar
        if (/MENTEŞE|MENTESE/.test(upperName)) return 'd4f9df1b-7dd7-4f63-9696-242ac761a2f8'
        if (/KİLİT|KILIT/.test(upperName)) return '144310f3-1c28-4ec1-98fa-1c1f138907bd'
        if (/KULP|KOL/.test(upperName)) return '703da1d0-ef18-461e-b364-1fac4a18d073'
        return SOURCE_FALLBACK['falo']
    }

    // ZET — tümü tekerlek
    if (source.includes('zet')) return SOURCE_FALLBACK['zet']

    // CIFTEL — alt kategori ayrımı
    if (source.includes('ciftel')) {
        if (/YEDEK/.test(upperName)) return 'd00efd16-6d67-4648-bf77-52d54dd8c9d7'    // Çiftel Yedek
        if (/HAFİF|HAFIF/.test(upperName)) return '7ec1b6c2-4e87-4581-9fe6-a6276f5d5044' // Çiftel Hafif
        if (/ORTA/.test(upperName)) return 'c58bb0fb-cfe6-4f0d-a67f-4172579da974'    // Çiftel Orta
        return SOURCE_FALLBACK['ciftel']
    }

    return null
}

async function main() {
    console.log(DRY_RUN ? '🔍 DRY-RUN modu aktif, DB yazılmayacak.\n' : '🚀 Kategori atama başlıyor...\n')

    // Tüm category_id NULL ürünleri çek (batch 1000)
    let offset = 0
    const BATCH = 1000
    let totalProcessed = 0
    let totalMatched = 0
    let totalUpdated = 0

    while (true) {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, sku, meta')
            .is('category_id', null)
            .is('deleted_at', null)
            .range(offset, offset + BATCH - 1)

        if (error) { console.error('Fetch error:', error); break }
        if (!products || products.length === 0) break

        totalProcessed += products.length

        // Kategori ID'sine göre grupla
        const groups: Record<string, string[]> = {}
        const unmatched: string[] = []

        for (const p of products) {
            const source = ((p.meta as Record<string, string>)?.source || '').toLowerCase()
            const catId = inferCategoryId(p.name || '', source)
            if (catId) {
                if (!groups[catId]) groups[catId] = []
                groups[catId].push(p.id)
                totalMatched++
            } else {
                unmatched.push(p.sku || p.id)
            }
        }

        // Toplu güncelle
        if (!DRY_RUN) {
            for (const [catId, ids] of Object.entries(groups)) {
                const { error: upErr } = await supabase
                    .from('products')
                    .update({ category_id: catId })
                    .in('id', ids)
                if (upErr) console.error(`  ❌ catId=${catId}:`, upErr.message)
                else {
                    totalUpdated += ids.length
                    console.log(`  ✓ catId=${catId} → ${ids.length} ürün`)
                }
            }
        } else {
            for (const [catId, ids] of Object.entries(groups)) {
                console.log(`  [DRY] catId=${catId} → ${ids.length} ürün`)
            }
        }

        if (unmatched.length > 0) {
            console.log(`  ⚠ Eşleşmeyen ${unmatched.length} ürün (ilk 10):`, unmatched.slice(0, 10).join(', '))
        }

        offset += BATCH
        if (products.length < BATCH) break
    }

    console.log('\n── Özet ──────────────────────────────')
    console.log(`İşlenen ürün  : ${totalProcessed}`)
    console.log(`Eşleşen ürün  : ${totalMatched}`)
    console.log(`Güncellenen   : ${DRY_RUN ? '(dry-run)' : totalUpdated}`)
    console.log(`Eşleşmeyen    : ${totalProcessed - totalMatched}`)
}

main().catch(console.error)

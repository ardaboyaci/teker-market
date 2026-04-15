/**
 * assign-category-ids.ts
 * category_id NULL olan ürünlere kaynak + isim/SKU pattern'ına göre kategori atar.
 *
 * Çalıştır:  npx tsx scripts/assign-category-ids.ts
 * Dry-run:   npx tsx scripts/assign-category-ids.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')

// ── E-Serisi Kategori Haritası ────────────────────────────────────────────────
// EMES ürün isimlerindeki ilk 2 harf → kategori ID
const E_SERIES: Record<string, string> = {
    // Ağır Sanayi
    'ED': 'fb2ed69d-03f9-4df0-ab98-893c9741e53c',
    'EX': 'caea0020-9a5a-468c-b6ef-357a0b0a3306',
    // Orta Sanayi
    'EG': '9fdf80a2-6796-49bd-92a1-ccdb78cb7a23',
    'EZ': '808cba79-b460-44fd-93f4-51e7b5456377',
    // Hafif Sanayi
    'EK': 'a1e2702d-bb1b-42c5-8b60-c084320d26d2',
    'EM': '776842cb-4ef5-40a0-a9a3-45de3397f8ad',
    // Ekstra Ağır
    'EJ': 'dd8070f8-b0d9-4d12-b87d-35306092e5fa',
    'EV': 'c26225e5-1f45-4f6f-8023-24f5d210da3e',
    // Servis / Mobilya
    'EB': '3694af72-f42e-4215-86b4-6d42a07bc08c',
    'EF': '7a555033-57aa-450b-9910-3a82273817ea',
    'EL': 'c0764f7d-42ec-42c0-bb84-366dc73afd52',
    'EP': 'ef1c7261-1f05-4f95-82a6-b3eefcb7a3a5',
    'ET': 'b36440c6-8b77-48a9-bef6-b94bf89ca470',
    // Hastane / Servis
    'EC': 'e2ef6cbc-ed5b-48f0-9617-155cebde7c84',
    'ER': '7b6af820-c65b-46be-8737-0d66c9d51afb',
    // Süpermarket
    'ES': '7edf9e21-46f6-4652-8cff-0cfca79bd929',
    'EY': '7fdf9d4f-73eb-40a5-81bd-9f5d48a2ebf9',

    // ── Yeni / Eksik E-Serileri ──────────────────────────────────────────────
    // EA — Ağır/Ekstra-Ağır hibrit (EA01 ZBZ 200X50F gibi büyük tekerlekler)
    'EA': 'f6c14f6c-c20b-4613-ac2e-0ad2b18a1798', // Ekstra Ağır Sanayi Tipi (parent)
    // Eİ — Orta sanayi (Eİ02 ZBZ 150X45T)
    'Eİ': '7e5d8981-e70f-43be-b451-10982f2f1cb4', // Orta Sanayi Tipi (parent)
    // EU — Küçük/servis tekerlekler (EU01 MKT 50X20F)
    'EU': '7c38d052-8e2f-404e-804e-6f8980ab309e', // Servis ve Mobilya Ekipmanları Tekerlekleri
    // EW — Büyük/ekstra-ağır tekerlekler (EW01 VBP 300X70)
    'EW': 'f6c14f6c-c20b-4613-ac2e-0ad2b18a1798', // Ekstra Ağır Sanayi Tipi
    // EH — Ağır sanayi (EH 150X50, EH 01 200X60)
    'EH': '69e501e5-e085-40b1-9edd-3de661f2a306', // Ağır Sanayi Tipi (parent)
    // EI — Eİ'nin ASCII karşılığı (güvenlik için)
    'EI': '7e5d8981-e70f-43be-b451-10982f2f1cb4',
}

// ── Kaynak Tabanlı Fallback ───────────────────────────────────────────────────
const SOURCE_FALLBACK: Record<string, string> = {
    'ciftel':   '0c85e3af-0b6f-46c6-ae07-45d57663b93d', // Çiftel Tekerlek
    'oskar':    'ba533946-8d43-4956-bb6b-cc71a82866c4', // Aksesuarlar
    'kaucuk':   'd89fea6c-8340-4b18-8070-651291fc8b61', // Aparatlar
    'falo':     'd89fea6c-8340-4b18-8070-651291fc8b61', // Aparatlar
    'zet':      '19a9d71c-aee5-4374-85ce-f80139df8611', // Tekerlekler
    'mertsan':  '69e501e5-e085-40b1-9edd-3de661f2a306', // Ağır Sanayi Tipi
}

// ── İsim Prefix → Kategori (EMES kaynaklı non-E-serisi ürünler) ───────────────
// Önce bakılır; eşleşirse döner.
function inferByNamePrefix(upper: string): string | null {
    // ── Tekerlekler ────────────────────────────────────────────────────────
    // VB, ZB, ZK, ZM, MB, ME, MBT — genel teker tipleri
    if (/^(VB|ZB|ZK|ZM|MB[A-Z]?|ME[A-Z])/.test(upper)) return '19a9d71c-aee5-4374-85ce-f80139df8611'
    // Volan/Çark
    if (/^VO(LAN)?/.test(upper))                          return '96de09c7-333b-4498-a9df-8e0be7c0ab25'
    // Çinko bantlı tekerlekler
    if (/^ÇI(NKO)?|^ÇINK/.test(upper))                   return '19a9d71c-aee5-4374-85ce-f80139df8611'
    // MK — Makine Kolları/Çark
    if (/^MK[A-Z]?/.test(upper))                          return 'c67fd419-a94b-4e61-9b01-e428218e23b6'

    // ── Makine Ayakları ────────────────────────────────────────────────────
    // PA — Plastik Ayak (Mafsallı)
    if (/^PA[A-Z]/.test(upper))                           return 'c41c176d-8d7f-4ad9-9eaf-72efa3a397d0' // Mafsallı Plastik Ayaklar
    // MA — Metal Ayak
    if (/^MA[A-Z]/.test(upper)) {
        if (/INOX|İNOX|PASLANMAZ/.test(upper))           return 'd5a31f91-aab7-41a7-aa82-f701b07dd8dd' // Paslanmaz Metal
        if (/MAFSALL|İM|IM/.test(upper))                  return 'ec12d3b0-660b-4301-abaa-c607e751766b' // Mafsallı Metal
        return '54fb3d5c-caf7-4fe2-8a55-34c0e2f74511'                                                    // Sabit Metal
    }
    // SA — Sac Ayak
    if (/^SA[İIA]/.test(upper) || /^SA\s/.test(upper)) {
        if (/INOX|İNOX/.test(upper))                      return 'd5a31f91-aab7-41a7-aa82-f701b07dd8dd'
        return '54fb3d5c-caf7-4fe2-8a55-34c0e2f74511'
    }
    // KK — Krom Kaplı Ayak
    if (/^KK[A-Z]/.test(upper))                           return '05c8125f-bfca-45fa-9570-4a158aaca37b' // Metal Makine Ayakları
    // İA — İnox Ayak
    if (/^[İI]A[A-Z]/.test(upper))                        return 'd5a31f91-aab7-41a7-aa82-f701b07dd8dd' // Paslanmaz Metal Ayaklar
    // MDA — Makina Denge Ayağı
    if (/^MDA/.test(upper))                               return '90a3471e-b4ec-42a2-b047-91f879688eb1' // Titreşim Tamponları

    // ── Kulp / Tutamak / Kol ────────────────────────────────────────────────
    // PT — Plastik Tutamak
    if (/^PT[A-Z]/.test(upper))                           return '703da1d0-ef18-461e-b364-1fac4a18d073' // Plastik Kulplar
    // PK — Plastik Kol
    if (/^PK[A-Z]/.test(upper))                           return '703da1d0-ef18-461e-b364-1fac4a18d073'
    // AK — Alüminyum Kol
    if (/^AK[A-Z]/.test(upper))                           return '2c019873-e9b7-4eea-ab24-3570f2b3f689' // Alüminyum Kulplar
    // BT — Bakalit Tırnaklı Volant
    if (/^BT[A-Z]/.test(upper))                           return '4ec26f4a-01d9-4b49-825e-5491cfa2a932' // Bakalit Kulplar
    // BK — Bakalit Kelebek Civatalı
    if (/^BK[A-Z]/.test(upper))                           return 'fa9be3de-0e4d-4303-afce-1a566762667a' // Bakalit Kelebek Civatalı

    // ── Aparatlar / Hırdavat ───────────────────────────────────────────────
    // TC, TB — Takoz (wedge)
    if (/^TC[A-Z]|^TB[A-Z]/.test(upper))                  return 'd89fea6c-8340-4b18-8070-651291fc8b61' // Aparatlar
    // TM — Tamir Takımı
    if (/^TM\d/.test(upper))                              return '70fecf0a-cf1c-42d2-a8e2-ea46e744ab52' // Yedek Tekerlekler
    // PR — Plastik Rotil
    if (/^PR[A-Z]/.test(upper))                           return 'd89fea6c-8340-4b18-8070-651291fc8b61' // Aparatlar
    // PY — Plastik Yonca (civata/somun türü)
    if (/^PY[A-Z]/.test(upper))                           return '00ecf6f2-0825-44b2-b299-d682ebfce830' // Hırdavat

    return null
}

// ── Ana Kategori Çıkarım Fonksiyonu ──────────────────────────────────────────
function inferCategoryId(name: string, source: string): string | null {
    const upper = (name || '').toUpperCase().trim()

    // ── EMES E-Serisi (DÜZELTME: boşluklu format + Türkçe İ dahil) ──────────
    // Eski regex ^(E[A-Z])\d sadece "ED1xx" formatını yakalıyordu.
    // Yeni regex ^(E[A-ZİÇĞÖŞÜ]) hem "ED 01 150" hem "ESP04" hem "Eİ02" formatlarını yakalıyor.
    const eMatch = upper.match(/^(E[A-ZİÇĞÖŞÜ])/)
    if (eMatch && E_SERIES[eMatch[1]]) return E_SERIES[eMatch[1]]

    // ── MERTSAN ──────────────────────────────────────────────────────────────
    if (source.includes('mertsan')) return '69e501e5-e085-40b1-9edd-3de661f2a306'

    // ── OSKAR — menteşe/kilit/kulp alt kategori ayrımı ───────────────────────
    if (source.includes('oskar')) {
        if (/MENTES[Eİ]|MENTEŞE/.test(upper))                           return 'd4f9df1b-7dd7-4f63-9696-242ac761a2f8' // Menteşe
        if (/K[İI]L[İI]T|KİLİD|KİLİT|KILID|KILIT|MANDAL/.test(upper)) return '144310f3-1c28-4ec1-98fa-1c1f138907bd' // Kilit
        if (/KULP|TUTAMAK|EL[CÇ]EK|KOL/.test(upper))                   return '703da1d0-ef18-461e-b364-1fac4a18d073' // Plastik Kulplar
        return SOURCE_FALLBACK['oskar']
    }

    // ── KAUÇUK ──────────────────────────────────────────────────────────────
    if (source.includes('kaucuk')) {
        if (/AYAK|AYAĞI|DENGE/.test(upper)) return '151751e8-7756-421a-baa9-1b51205ca6a6' // Makine Ayakları
        return SOURCE_FALLBACK['kaucuk']
    }

    // ── FALO ─────────────────────────────────────────────────────────────────
    if (source.includes('falo')) {
        if (/MAKARA/.test(upper))                                        return 'd89fea6c-8340-4b18-8070-651291fc8b61'
        if (/MENTES[Eİ]|MENTEŞE/.test(upper))                           return 'd4f9df1b-7dd7-4f63-9696-242ac761a2f8'
        if (/K[İI]L[İI]T|KİLİD|KILID/.test(upper))                     return '144310f3-1c28-4ec1-98fa-1c1f138907bd'
        if (/KULP|KOL/.test(upper))                                      return '703da1d0-ef18-461e-b364-1fac4a18d073'
        return SOURCE_FALLBACK['falo']
    }

    // ── ZET — tümü tekerlek ───────────────────────────────────────────────────
    if (source.includes('zet')) return SOURCE_FALLBACK['zet']

    // ── ÇİFTEL ───────────────────────────────────────────────────────────────
    if (source.includes('ciftel')) {
        if (/YEDEK/.test(upper))        return 'd00efd16-6d67-4648-bf77-52d54dd8c9d7' // Çiftel Yedek
        if (/HAF[İI]F|HAFIF/.test(upper)) return '7ec1b6c2-4e87-4581-9fe6-a6276f5d5044' // Çiftel Hafif
        if (/ORTA/.test(upper))         return 'c58bb0fb-cfe6-4f0d-a67f-4172579da974' // Çiftel Orta
        return SOURCE_FALLBACK['ciftel']
    }

    // ── EMES kaynaklı non-E-serisi ürünler (emes_2026 / emes_kulp_2026 / yedek_emes_2026) ──
    if (source.includes('emes')) {
        // İsim prefix'e göre daha spesifik kategori dene
        const byPrefix = inferByNamePrefix(upper)
        if (byPrefix) return byPrefix

        // Anahtar kelime bazlı son çare eşleştirme
        if (/AYAK|DENGE AYAĞI|MAKINE AYAĞI/.test(upper)) return '151751e8-7756-421a-baa9-1b51205ca6a6'
        if (/VOLAN|ÇARK|VOLANT/.test(upper))              return '96de09c7-333b-4498-a9df-8e0be7c0ab25'
        if (/TEKER|TEKERLEK/.test(upper))                 return '19a9d71c-aee5-4374-85ce-f80139df8611'
        if (/KULP|TUTAMAK|KOL/.test(upper))               return '703da1d0-ef18-461e-b364-1fac4a18d073'
        if (/MENTEŞE|MENTESE|MENTES[Eİ]/.test(upper))    return 'd4f9df1b-7dd7-4f63-9696-242ac761a2f8'
        if (/KİLİT|KILIT|KİLİD|KILID/.test(upper))       return '144310f3-1c28-4ec1-98fa-1c1f138907bd'
        if (/TAKOZ/.test(upper))                          return 'd89fea6c-8340-4b18-8070-651291fc8b61'
        if (/TAMİR|TAMIR|YEDEK/.test(upper))              return '70fecf0a-cf1c-42d2-a8e2-ea46e744ab52'

        // EMES yedek parça / bilinmeyen → Yedek Tekerlekler
        if (source.includes('yedek_emes')) return '70fecf0a-cf1c-42d2-a8e2-ea46e744ab52'
        // EMES kulp → Tutamaklar/Kulplar
        if (source.includes('emes_kulp'))  return '4a86e27b-06bc-4198-8e7f-0cc0a0509584'
        // Genel EMES fallback → Tekerlekler
        return '19a9d71c-aee5-4374-85ce-f80139df8611'
    }

    return null
}

// ── Ana Fonksiyon ─────────────────────────────────────────────────────────────
async function main() {
    console.log(DRY_RUN ? '🔍 DRY-RUN modu — DB yazılmayacak.\n' : '🚀 Kategori atama başlıyor...\n')

    let offset = 0
    const BATCH = 1000
    let totalProcessed  = 0
    let totalMatched    = 0
    let totalUpdated    = 0
    const unmatchedSamples: string[] = []

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
            const catId  = inferCategoryId(p.name || '', source)

            if (catId) {
                if (!groups[catId]) groups[catId] = []
                groups[catId].push(p.id)
                totalMatched++
            } else {
                unmatched.push(`${p.sku} [${source}] "${p.name?.substring(0, 40)}"`)
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
                    console.log(`  ✓ ${ids.length} ürün → ${catId}`)
                }
            }
        } else {
            for (const [catId, ids] of Object.entries(groups)) {
                console.log(`  [DRY] ${ids.length} ürün → ${catId}`)
            }
        }

        if (unmatched.length > 0) {
            console.log(`  ⚠ Eşleşmeyen ${unmatched.length} ürün:`, unmatched.slice(0, 5).join(' | '))
            unmatchedSamples.push(...unmatched.slice(0, 3))
        }

        // NOT: offset'i artırmıyoruz — güncellenen kayıtlar NULL listesinden çıktığı için
        // her seferinde offset=0'dan başlamak doğru sonucu verir.
        if (products.length < BATCH) break
    }

    console.log('\n── Özet ──────────────────────────────────────────────')
    console.log(`İşlenen    : ${totalProcessed}`)
    console.log(`Eşleşen    : ${totalMatched}`)
    console.log(`Güncellenen: ${DRY_RUN ? '(dry-run)' : totalUpdated}`)
    console.log(`Eşleşmeyen : ${totalProcessed - totalMatched}`)

    if (unmatchedSamples.length > 0) {
        console.log('\nEşleşmeyen örnekler:')
        unmatchedSamples.forEach(s => console.log(' ', s))
    }
}

main().catch(console.error)

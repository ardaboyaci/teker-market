/**
 * Ticimax Import Scripti
 *
 * 1. TicimaxExport (1).xls → categories tablosuna hiyerarşik kategori import
 * 2. Ticimax açıklamalarını products tablosuna aktar (sadece description boş olanlar)
 * 3. Ürünlerin category_id'sini güncelle
 *
 * Çalıştır: npx tsx scripts/import-ticimax.ts
 */

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const SUPABASE_URL = 'https://jdxmqvmrrteuzcwkuehi.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkeG1xdm1ycnRldXpjd2t1ZWhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjY0MSwiZXhwIjoyMDg4MDUyNjQxfQ.Fv-31flkNrI7RVOqIFvS9XLPUnMPzJPzhgAjXWNp5wc'
const EXCEL_PATH = path.resolve(process.cwd(), 'TicimaxExport (1).xls')
const TEMP_JSON = path.resolve(process.cwd(), 'scripts/output/ticimax-data.json')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Slug üretici ────────────────────────────────────────────────────────────
// ltree path: sadece harf, rakam, alt çizgi — nokta ile birleştir
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function ltreePath(parts: string[]): string {
  return parts.map(slugify).join('.')
}

// ── Python ile Excel oku ────────────────────────────────────────────────────
function readExcel(): { sku: string; name: string; desc: string; cat: string }[] {
  const pyScript = `
import xlrd, json, sys

wb = xlrd.open_workbook(sys.argv[1])
sh = wb.sheet_by_index(0)
rows = []
for r in range(1, sh.nrows):
    sku  = str(sh.cell_value(r, 2)).strip()
    name = str(sh.cell_value(r, 6)).strip()
    desc = str(sh.cell_value(r, 8)).strip()
    cat  = str(sh.cell_value(r, 16)).strip()
    if sku and sku != 'None':
        rows.append({'sku': sku, 'name': name, 'desc': desc if len(desc) > 10 else '', 'cat': cat if cat != 'None' else ''})
print(json.dumps(rows, ensure_ascii=False))
`
  const pyFile = '/tmp/read_ticimax.py'
  fs.writeFileSync(pyFile, pyScript)
  const out = execSync(`python3 ${pyFile} "${EXCEL_PATH}"`, { maxBuffer: 50 * 1024 * 1024 }).toString()
  fs.unlinkSync(pyFile)
  return JSON.parse(out)
}

// ── Kategori hiyerarşisi kur ────────────────────────────────────────────────
async function importCategories(rows: { cat: string }[]): Promise<Map<string, string>> {
  console.log('\n━━━ 1. KATEGORİ İMPORTU ━━━')

  // Mevcut kategorileri çek
  const { data: existing } = await supabase.from('categories').select('id, slug, path')
  const existingByPath = new Map<string, string>()
  for (const c of existing ?? []) {
    existingByPath.set(c.path, c.id)
  }
  console.log(`Mevcut kategori sayısı: ${existingByPath.size}`)

  // Tüm unique path'leri topla
  const allPaths = new Set<string>()
  for (const row of rows) {
    if (!row.cat) continue
    const parts = row.cat.split('>').map(p => p.trim()).filter(Boolean)
    // Her seviyeyi kaydet: A, A>B, A>B>C
    for (let i = 1; i <= parts.length; i++) {
      allPaths.add(parts.slice(0, i).join('>'))
    }
  }
  console.log(`Import edilecek unique kategori path: ${allPaths.size}`)

  // path'leri derinlik sırasına göre sırala (önce kökler)
  const sortedPaths = [...allPaths].sort((a, b) => {
    return a.split('>').length - b.split('>').length || a.localeCompare(b)
  })

  let created = 0, skipped = 0

  for (const fullPath of sortedPaths) {
    if (existingByPath.has(fullPath)) { skipped++; continue }

    const parts = fullPath.split('>').map(p => p.trim())
    const name = parts[parts.length - 1]
    const depth = parts.length
    const slugPath = ltreePath(parts)
    const parentPath = depth > 1 ? parts.slice(0, -1).join('>') : null
    const parentId = parentPath ? (existingByPath.get(parentPath) ?? null) : null

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        slug: slugPath,
        path: slugPath,
        parent_id: parentId,
        is_active: true,
        sort_order: 0,
        meta: { ticimax_path: fullPath },
      })
      .select('id')
      .single()

    if (error) {
      console.warn(`  [SKIP] "${fullPath}": ${error.message}`)
      skipped++
    } else {
      existingByPath.set(fullPath, data.id)
      created++
    }
  }

  console.log(`  ✓ Oluşturuldu: ${created} | Atlandı (zaten var): ${skipped}`)

  // Ticimax path → kategori ID map'i döndür (tam path eşleşmesi için)
  return existingByPath
}

// ── Ürün eşleştirme ve açıklama + kategori güncelleme ───────────────────────
async function importDescriptionsAndCategories(
  rows: { sku: string; name: string; desc: string; cat: string }[],
  catMap: Map<string, string>
) {
  console.log('\n━━━ 2. ÜRÜN EŞLEŞTİRME & GÜNCELLEME ━━━')

  // Tüm aktif ürünleri çek (name + description + category_id)
  let allProducts: { id: string; name: string; description: string | null; category_id: string | null }[] = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data } = await supabase
      .from('products')
      .select('id, name, description, category_id')
      .eq('status', 'active')
      .is('deleted_at', null)
      .range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    allProducts = allProducts.concat(data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`DB'den çekilen ürün: ${allProducts.length}`)

  // DB ürünlerini normalize edilmiş isimle index'le
  // Ticimax: "EM01 SPR 80" → DB'de "EM01 SPR 80X25", "EM01 SPR 80X25F" gibi
  // Strateji: DB name, Ticimax SKU ile BAŞLIYORSA eşleşme var
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

  // DB ürünlerini normalize name → id map
  const dbByName = new Map<string, { id: string; description: string | null; category_id: string | null }>()
  for (const p of allProducts) {
    dbByName.set(normalize(p.name), { id: p.id, description: p.description, category_id: p.category_id })
  }

  // Prefix eşleştirme için sorted array (daha uzun prefix önce)
  const dbNames = [...dbByName.keys()].sort((a, b) => b.length - a.length)

  let descUpdated = 0, catUpdated = 0, noMatch = 0
  const noMatchList: string[] = []

  for (const row of rows) {
    const hasDesc = row.desc.length > 10
    const hasCat = !!row.cat

    if (!hasDesc && !hasCat) continue

    // Eşleştirme stratejisi:
    // 1. Ticimax SKU → DB name tam eşleşme
    // 2. Ticimax adının ilk kısmı (tire öncesi) → DB name başlangıcı
    const ticimaxSku = normalize(row.sku)  // "em01 spr 80"

    let match: { id: string; description: string | null; category_id: string | null } | undefined

    // Strateji 1: Tam eşleşme
    match = dbByName.get(ticimaxSku)

    // Strateji 2: DB name, Ticimax SKU + 'x' ile başlıyor (EM01 SPR 80 → EM01 SPR 80x25)
    if (!match) {
      for (const dbName of dbNames) {
        if (dbName.startsWith(ticimaxSku + 'x') || dbName.startsWith(ticimaxSku + ' ')) {
          match = dbByName.get(dbName)
          if (match) break
        }
      }
    }

    // Strateji 3: Ticimax SKU sonu F ile bitiyorsa (frenli)
    // "em01 spr 80f" → DB'de "em01 spr 80x25f" gibi bir şey ara
    // F'yi sonda tut, ortaya X+sayı gelebilir: prefix + 'x' + sayılar + 'f'
    if (!match && ticimaxSku.endsWith('f')) {
      const base = ticimaxSku.slice(0, -1) // "em01 spr 80f" → "em01 spr 80"
      for (const dbName of dbNames) {
        if (dbName.startsWith(base + 'x') && dbName.endsWith('f')) {
          match = dbByName.get(dbName)
          if (match) break
        }
      }
    }

    // Strateji 4: Ticimax SKU sonu T veya TF ile bitiyorsa (tablalı/tablalı frenli)
    if (!match && (ticimaxSku.endsWith('tf') || ticimaxSku.endsWith('t'))) {
      const suffix = ticimaxSku.endsWith('tf') ? 'tf' : 't'
      const base = ticimaxSku.slice(0, -suffix.length)
      for (const dbName of dbNames) {
        if (dbName.startsWith(base + 'x') && dbName.endsWith(suffix)) {
          match = dbByName.get(dbName)
          if (match) break
        }
      }
    }

    if (!match) {
      noMatch++
      if (noMatchList.length < 20) noMatchList.push(row.sku)
      continue
    }

    const productId = match.id

    // Güncellenecek alanları belirle
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    // Açıklama: sadece boş/null olanlara yaz
    if (hasDesc && (!match.description || match.description.trim() === '')) {
      updates.description = row.desc
      descUpdated++
    }

    // Kategori: sadece null olanlara yaz
    if (hasCat && !match.category_id) {
      const catId = catMap.get(row.cat.trim())
      if (catId) {
        updates.category_id = catId
        catUpdated++
      }
    }

    if (Object.keys(updates).length <= 1) continue // sadece updated_at varsa geç

    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)

    if (error) console.warn(`  [DB HATA] ${row.sku}: ${error.message}`)
  }

  console.log(`\n  ✓ Açıklama güncellenen ürün: ${descUpdated}`)
  console.log(`  ✓ Kategori atanan ürün:       ${catUpdated}`)
  console.log(`  ✗ Eşleşme bulunamayan:        ${noMatch}`)
  if (noMatchList.length > 0) {
    console.log(`\n  Eşleşmeyen örnek SKU'lar (ilk 20):`)
    noMatchList.forEach(s => console.log(`    - ${s}`))
  }
}

// ── Ana Fonksiyon ────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━ TİCİMAX İMPORT BOTU ━━━')
  console.log(`Excel: ${EXCEL_PATH}`)

  fs.mkdirSync(path.dirname(TEMP_JSON), { recursive: true })

  // 1. Excel oku
  console.log('\nExcel okunuyor...')
  const rows = readExcel()
  console.log(`Okunan satır: ${rows.length}`)
  console.log(`Açıklaması olan: ${rows.filter(r => r.desc.length > 10).length}`)
  console.log(`Kategorisi olan: ${rows.filter(r => r.cat).length}`)

  // 2. Kategori import
  const catMap = await importCategories(rows)

  // 3. Ürün güncelleme
  await importDescriptionsAndCategories(rows, catMap)

  console.log('\n━━━ TAMAMLANDI ━━━')
}

main().catch(err => {
  console.error('[Fatal]', err)
  process.exit(1)
})

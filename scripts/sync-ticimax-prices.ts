/**
 * Ticimax Fiyat + Stok Senkronizasyon Scripti
 *
 * TicimaxExport.xls → DB'deki sale_price ve quantity_on_hand günceller
 * Eşleştirme: Ticimax SKU → DB name (prefix matching)
 * Örnek: "EM01 SPR 80" → "EM01 SPR 80X25", "EM01 SPR 80X25F", ... (tüm varyantlar)
 *
 * Çalıştır: npx tsx scripts/sync-ticimax-prices.ts
 */

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import fs from 'fs'

const SUPABASE_URL = 'https://jdxmqvmrrteuzcwkuehi.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkeG1xdm1ycnRldXpjd2t1ZWhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NjY0MSwiZXhwIjoyMDg4MDUyNjQxfQ.Fv-31flkNrI7RVOqIFvS9XLPUnMPzJPzhgAjXWNp5wc'
const EXCEL_PATH = '/Users/ardab/Desktop/teker market/TicimaxExport.xls'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface ExcelRow {
  price: number
  stock: number
}

function readExcelData(filePath: string): Map<string, ExcelRow> {
  const pyScript = `
import xlrd, json, sys

wb = xlrd.open_workbook(sys.argv[1])
sh = wb.sheet_by_index(0)
rows = {}
for r in range(1, sh.nrows):
    sku   = str(sh.cell_value(r, 2)).strip()
    price = sh.cell_value(r, 39)  # SATISFIYATI
    stock = sh.cell_value(r, 35)  # STOKADEDI
    if sku and sku != 'None':
        try:
            price_val = float(str(price).replace(',', '.'))
            stock_val = int(float(str(stock))) if stock != '' else 0
            rows[sku] = {'price': price_val, 'stock': stock_val}
        except:
            pass
print(json.dumps(rows, ensure_ascii=False))
`
  const pyFile = '/tmp/read_ticimax_prices.py'
  fs.writeFileSync(pyFile, pyScript)
  const out = execSync(`python3 ${pyFile} "${filePath}"`, { maxBuffer: 50 * 1024 * 1024 }).toString()
  fs.unlinkSync(pyFile)
  const raw = JSON.parse(out) as Record<string, ExcelRow>
  return new Map(Object.entries(raw))
}

async function main() {
  console.log('━━━ TİCİMAX FİYAT + STOK SENKRONIZASYON BOTU ━━━')
  console.log(`Excel: ${EXCEL_PATH}\n`)

  // 1. Excel'den oku
  console.log('Excel okunuyor...')
  const excelData = readExcelData(EXCEL_PATH)
  console.log(`Okunan Ticimax SKU sayısı: ${excelData.size}`)

  // 2. DB'den tüm ürünleri çek (name + sale_price + quantity_on_hand)
  console.log("\nDB'den ürünler çekiliyor...")
  let allProducts: { id: string; name: string; sale_price: number | null; quantity_on_hand: number | null }[] = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sale_price, quantity_on_hand')
      .is('deleted_at', null)
      .range(offset, offset + PAGE - 1)
    if (error) { console.error('DB hata:', error.message); break }
    if (!data || data.length === 0) break
    allProducts = allProducts.concat(data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  console.log(`DB'den çekilen ürün: ${allProducts.length}`)

  // 3. Eşleştirme: Ticimax SKU → DB name prefix
  // "EM01 SPR 80" → DB'de "EM01 SPR 80X25", "EM01 SPR 80X25F" ... (tüm varyantlar)
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

  const updates: { id: string; name: string; old_price: number | null; new_price: number; old_stock: number | null; new_stock: number }[] = []

  for (const product of allProducts) {
    const normName = normalize(product.name)

    // Hangi Ticimax SKU ile eşleşiyor?
    let match: ExcelRow | undefined

    for (const [ticimaxSku, row] of excelData) {
      const normSku = normalize(ticimaxSku)

      // Tam eşleşme
      if (normName === normSku) { match = row; break }

      // Prefix: "em01 spr 80" → name "em01 spr 80x25" veya "em01 spr 80 x25"
      if (normName.startsWith(normSku + 'x') || normName.startsWith(normSku + ' ')) {
        match = row; break
      }
    }

    if (!match || match.price <= 0) continue

    const priceChanged = product.sale_price !== match.price
    const stockChanged = product.quantity_on_hand !== match.stock
    if (!priceChanged && !stockChanged) continue

    updates.push({
      id: product.id,
      name: product.name,
      old_price: product.sale_price,
      new_price: match.price,
      old_stock: product.quantity_on_hand,
      new_stock: match.stock,
    })
  }

  console.log(`\nGüncellenecek ürün sayısı: ${updates.length}`)

  if (updates.length === 0) {
    console.log('Güncellenecek ürün yok. Çıkılıyor.')
    return
  }

  // 4. Özet
  const priceChanges = updates.filter(u => u.old_price !== u.new_price)
  const stockChanges = updates.filter(u => u.old_stock !== u.new_stock)
  const zam = priceChanges.filter(u => (u.old_price ?? 0) < u.new_price)
  const indirim = priceChanges.filter(u => (u.old_price ?? 0) > u.new_price)
  console.log(`  Fiyat değişen  : ${priceChanges.length} (↑${zam.length} zam, ↓${indirim.length} indirim)`)
  console.log(`  Stok değişen   : ${stockChanges.length}`)

  // 5. DB'ye yaz
  console.log('\nDB güncelleniyor...')
  let success = 0, fail = 0
  const BATCH = 100

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    for (const u of batch) {
      const { error } = await supabase
        .from('products')
        .update({
          sale_price: u.new_price,
          quantity_on_hand: u.new_stock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', u.id)

      if (error) { console.warn(`  [HATA] ${u.name}: ${error.message}`); fail++ }
      else success++
    }
    process.stdout.write(`\r  İşlenen: ${Math.min(i + BATCH, updates.length)}/${updates.length}`)
  }

  console.log(`\n\n  ✓ Güncellenen: ${success}`)
  if (fail > 0) console.log(`  ✗ Hata: ${fail}`)

  // 6. Örnek değişimler
  console.log('\n━━━ ÖRNEK FİYAT DEĞİŞİMLERİ ━━━')
  const sample = [...zam.slice(0, 5), ...indirim.slice(0, 5)]
  for (const u of sample) {
    const arrow = u.new_price > (u.old_price ?? 0) ? '▲' : '▼'
    const diff = Math.abs(u.new_price - (u.old_price ?? 0)).toFixed(2)
    console.log(`  ${u.name}: ${u.old_price ?? 'null'} → ${u.new_price} (${arrow}${diff} ₺)`)
  }

  console.log('\n━━━ TAMAMLANDI ━━━')
}

main().catch(err => {
  console.error('[Fatal]', err)
  process.exit(1)
})

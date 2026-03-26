import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const specs = JSON.parse(fs.readFileSync('scripts/output/emes-specs.json', 'utf-8'))
  const specsSkus = new Set(Object.keys(specs))

  // DB'den emes_2026 ürünleri çek
  let allProducts: any[] = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, supplier_code')
      .eq('source', 'emes_2026')
      .range(from, from + pageSize - 1)
    if (error || !data?.length) break
    allProducts = allProducts.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }

  console.log(`DB'de emes_2026 ürün sayısı: ${allProducts.length}`)
  console.log(`Specs'te ürün sayısı: ${specsSkus.size}`)

  // SKU eşleştir
  let matched = 0
  let unmatched = 0
  const unmatchedSamples: string[] = []

  for (const p of allProducts) {
    const sku = (p.sku || p.supplier_code || '').replace(/\s+/g, '').toUpperCase()
    if (specsSkus.has(sku)) {
      matched++
    } else {
      unmatched++
      if (unmatchedSamples.length < 10) unmatchedSamples.push(p.sku)
    }
  }

  console.log(`\nEşleşen: ${matched} (%${Math.round(matched/allProducts.length*100)})`)
  console.log(`Eşleşmeyen: ${unmatched} (%${Math.round(unmatched/allProducts.length*100)})`)
  console.log('\nEşleşmeyen örnekler:')
  unmatchedSamples.forEach(s => console.log(' ', s))

  // Örnek DB SKU formatı
  console.log('\nDB SKU örnekleri:')
  allProducts.slice(0, 10).forEach(p => console.log(' ', p.sku))
}

main()

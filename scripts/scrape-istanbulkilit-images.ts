/**
 * İstanbul Kilit (istanbulkilit.com) — OSKAR Görsel Scraper
 *
 * Tüm kategori sayfalarını tarar, ürün adını normalize ederek
 * DB'deki oskar_2026 kaynaklı ürünlerle eşleştirir.
 * Görseli indirir, watermark ekler, Storage'a yükler, DB'ye bağlar.
 *
 * Flags:
 *   --dry-run    Storage/DB'ye yazmadan loglar
 *   --limit=N    İlk N eşleşmeyi işle
 *
 * Çalıştır: npx tsx scripts/scrape-istanbulkilit-images.ts
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import https from 'https'
import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { downloadAndProcess, uploadToStorage, linkToProduct, sleep } from './lib/image-pipeline'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const DRY_RUN = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null

const BASE_URL = 'https://www.istanbulkilit.com/tr-TR'
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output/istanbulkilit-images')
const LOG_FILE = path.resolve(process.cwd(), 'scripts/output/istanbulkilit-images-log.json')

const CATEGORIES = [
  '/kilitler,KT_1.html',
  '/menteseler,KT_266.html',
  '/aksesuarlar,KT_268.html',
  '/paslanmaz-celik-urunler,KT_337.html',
]

const httpsAgent = new https.Agent({ rejectUnauthorized: false })
const http = axios.create({
  httpsAgent,
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'tr-TR,tr;q=0.9',
    'Accept': 'text/html,application/xhtml+xml',
  },
})

interface SiteProduct {
  name: string       // normalize edilmiş ad
  nameRaw: string    // orijinal ad
  code: string       // ürün kodu (026 gibi)
  imageUrl: string   // tam görsel URL
  pageUrl: string    // ürün detay sayfası
}

// Türkçe karakterleri normalize et, büyük harf, tek boşluk
function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

// Bir kategori sayfasını çek, tüm sayfaları tara
async function scrapeCategory(catPath: string): Promise<SiteProduct[]> {
  const products: SiteProduct[] = []
  let page = 1

  while (true) {
    const url = page === 1
      ? `${BASE_URL}${catPath}`
      : `${BASE_URL}${catPath}?sayfa=${page}`

    try {
      const { data } = await http.get(url)
      const $ = cheerio.load(data)

      let found = 0
      $('a[id="urun-kutu"]').each((_, el) => {
        const href = $(el).attr('href') ?? ''
        const imgSrc = $(el).find('img').attr('src') ?? ''
        const nameRaw = $(el).find('.baslik').text().trim()
        const code = $(el).find('.kod').text().trim()

        if (!imgSrc || !nameRaw) return

        products.push({
          name: normalize(nameRaw),
          nameRaw,
          code,
          imageUrl: imgSrc.startsWith('http') ? imgSrc : `https://www.istanbulkilit.com${imgSrc}`,
          pageUrl: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        })
        found++
      })

      if (found === 0) break

      // Sonraki sayfa var mı?
      const nextExists = $(`a[href*="sayfa=${page + 1}"]`).length > 0
      if (!nextExists) break
      page++
      await sleep(300)
    } catch (err: any) {
      console.warn(`  [UYARI] ${url}: ${err.message}`)
      break
    }
  }

  return products
}

async function main() {
  console.log('━━━ İSTANBUL KİLİT (OSKAR) GÖRSEL SCRAPER ━━━')
  if (DRY_RUN) console.log('⚠  DRY-RUN — Storage/DB\'ye yazılmıyor\n')

  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  // 1. Siteyi tara — tüm kategoriler
  console.log('Site taranıyor...')
  const siteProducts: SiteProduct[] = []
  for (const cat of CATEGORIES) {
    const prods = await scrapeCategory(cat)
    console.log(`  ${cat}: ${prods.length} ürün`)
    siteProducts.push(...prods)
    await sleep(500)
  }
  console.log(`Toplam site ürünü: ${siteProducts.length}`)

  // Ürün adına göre index (aynı ada birden fazla ürün olabilir — kodu ile ayır)
  const siteByName = new Map<string, SiteProduct[]>()
  for (const p of siteProducts) {
    const arr = siteByName.get(p.name) ?? []
    arr.push(p)
    siteByName.set(p.name, arr)
  }

  // 2. DB'den görselsiz Oskar ürünlerini çek
  console.log("\nDB'den Oskar ürünleri çekiliyor...")
  const { data: dbProducts } = await supabase
    .from('products')
    .select('id, sku, name, image_url')
    .eq('meta->>source', 'oskar_2026')
    .is('deleted_at', null)
    .is('image_url', null)

  console.log(`DB'de görseli eksik Oskar ürünü: ${dbProducts?.length ?? 0}`)

  const toProcess = LIMIT ? (dbProducts ?? []).slice(0, LIMIT) : (dbProducts ?? [])

  // 3. Eşleştir
  console.log('\nEşleştirme yapılıyor...')
  const matched: { db: typeof toProcess[0]; site: SiteProduct }[] = []
  const noMatch: string[] = []

  // Site ürünlerini kod → ürün şeklinde de indexle
  const siteByCode = new Map<string, SiteProduct>()
  for (const p of siteProducts) {
    if (p.code && !siteByCode.has(p.code)) siteByCode.set(p.code, p)
  }

  for (const dbProd of toProcess) {
    const normDbName = normalize(dbProd.name)
    const normDbSku  = normalize(dbProd.sku)
    const dbWords    = normDbName.split(' ').filter(w => w.length > 2)
    const dbWordSet  = new Set(dbWords)

    // Strateji 1: Tam normalize ad eşleşmesi
    if (siteByName.has(normDbName)) {
      matched.push({ db: dbProd, site: siteByName.get(normDbName)![0] })
      continue
    }

    // Strateji 2: SKU kodu site koduna eşleşiyor mu?
    // DB SKU "016.M1.01.CM" → son segment "CM" veya tam sku
    const skuParts = normDbSku.replace(/[^A-Z0-9]/g,' ').trim().split(' ')
    let foundByCode = false
    for (const part of skuParts) {
      if (part.length >= 3 && siteByCode.has(part)) {
        matched.push({ db: dbProd, site: siteByCode.get(part)! })
        foundByCode = true
        break
      }
    }
    if (foundByCode) continue

    // Strateji 3: DB adı, site adını içeriyor mu (veya tersi)?
    let found = false
    let bestScore = 0
    let bestSite: SiteProduct | null = null

    for (const [siteName, siteArr] of siteByName) {
      if (normDbName.includes(siteName) || siteName.includes(normDbName)) {
        matched.push({ db: dbProd, site: siteArr[0] })
        found = true
        break
      }
      // Kelime bazlı örtüşme — her iki yönde hesapla
      const siteWords = new Set(siteName.split(' ').filter(w => w.length > 2))
      const overlapDB   = dbWords.filter(w => siteWords.has(w)).length
      const overlapSite = [...siteWords].filter(w => dbWordSet.has(w)).length
      const scoreDB   = dbWords.length   > 0 ? overlapDB   / dbWords.length   : 0
      const scoreSite = siteWords.size   > 0 ? overlapSite / siteWords.size   : 0
      const score = Math.max(scoreDB, scoreSite)
      if (score > bestScore) { bestScore = score; bestSite = siteArr[0] }
    }

    if (!found) {
      // Strateji 4: Best-effort — en yüksek skor %55 üzerindeyse al
      if (bestScore >= 0.55 && bestSite) {
        matched.push({ db: dbProd, site: bestSite })
      } else {
        noMatch.push(dbProd.name)
      }
    }
  }

  console.log(`  Eşleşen   : ${matched.length}`)
  console.log(`  Eşleşmeyen: ${noMatch.length}`)
  if (noMatch.length > 0 && noMatch.length <= 20) {
    console.log('  Eşleşmeyen örnekler:')
    noMatch.slice(0, 10).forEach(n => console.log(`    - ${n}`))
  }

  if (matched.length === 0) {
    console.log('\nEşleşme bulunamadı. Çıkılıyor.')
    return
  }

  // 4. Görselleri işle
  console.log(`\nGörsel işleniyor (${matched.length} ürün)...`)
  const log: { sku: string; name: string; status: string; url?: string; siteUrl?: string }[] = []
  let success = 0, fail = 0, skipped = 0

  for (let i = 0; i < matched.length; i++) {
    const { db, site } = matched[i]
    process.stdout.write(`\r[${i + 1}/${matched.length}] ${db.name.slice(0, 50)}...`)

    if (DRY_RUN) {
      console.log(`\n  ✓ [DRY] ${db.sku} → ${site.imageUrl}`)
      log.push({ sku: db.sku, name: db.name, status: 'dry-run', url: site.imageUrl, siteUrl: site.pageUrl })
      success++
      continue
    }

    const safeSku = db.sku.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const localPath = path.join(OUTPUT_DIR, `${safeSku}.webp`)

    const processed = await downloadAndProcess(site.imageUrl, localPath)
    if (!processed) {
      log.push({ sku: db.sku, name: db.name, status: 'download_error', siteUrl: site.pageUrl })
      fail++
      await sleep(300)
      continue
    }

    const publicUrl = await uploadToStorage(supabase, localPath, db.sku)
    if (!publicUrl) {
      log.push({ sku: db.sku, name: db.name, status: 'upload_error' })
      fail++
      continue
    }

    const linked = await linkToProduct(supabase, db.id, publicUrl)
    if (linked) {
      log.push({ sku: db.sku, name: db.name, status: 'ok', url: publicUrl, siteUrl: site.pageUrl })
      success++
    } else {
      log.push({ sku: db.sku, name: db.name, status: 'link_error' })
      fail++
    }

    await sleep(400)
  }

  await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8')

  console.log('\n\n━━━ ÖZET ━━━')
  console.table({
    'Görsel Eklendi': { Adet: success },
    'Eşleşme Yok': { Adet: noMatch.length },
    'İndirme/Yükleme Hatası': { Adet: fail },
    'Toplam DB Ürün': { Adet: toProcess.length },
  })
  console.log(`[Log] ${LOG_FILE}`)
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1) })

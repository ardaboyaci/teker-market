import axios from 'axios'
import * as cheerio from 'cheerio'
import https from 'https'

const agent = new https.Agent({ rejectUnauthorized: false })
const http = axios.create({
    httpsAgent: agent, timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
})

async function main() {
    // ── e-tekerlek isim seçicisi ──────────────────────────────────────────────
    console.log('=== e-tekerlek.com — İsim seçicisi ===')
    const { data: etData } = await http.get('https://www.e-tekerlek.com/arama?q=50x20+tekerlek')
    const $et = cheerio.load(etData)
    $et('div.product-item').slice(0, 3).each((i, el) => {
        const $el = $et(el)
        $el.find('*').each((_, child) => {
            const text = $et(child).clone().children().remove().end().text().trim()
            if (text.length > 5 && text.length < 100) {
                const tag = $et(child).prop('tagName') ?? ''
                const cls = ($et(child).attr('class') ?? '').split(' ')[0]
                console.log(`  [${tag}${cls ? '.' + cls : ''}]: ${text}`)
            }
        })
        const price = $el.find('.current-price').first().text().trim() || $el.find('.product-price').first().text().trim()
        console.log(`  FIYAT: ${price}\n`)
    })

    // ── tekermarket.com.tr — productsModel JSON parse ─────────────────────────
    console.log('\n=== tekermarket.com.tr — productsModel ===')
    const { data: tmData } = await http.get('https://www.tekermarket.com.tr/Arama?1&kelime=50x20')
    const match = tmData.match(/var productsModel\s*=\s*(\{[\s\S]+?\});?\s*\/\//)
    if (match) {
        try {
            const model = JSON.parse(match[1])
            const products = model.products ?? model.Products ?? []
            console.log(`Ürün sayısı: ${products.length}`)
            products.slice(0, 3).forEach((p: Record<string, unknown>) => {
                console.log('  Alanlar:', Object.keys(p))
                console.log('  SKU:', p.productCode || p.sku || p.ProductCode)
                console.log('  İsim:', p.name || p.productName || p.Name)
                console.log('  Fiyat:', p.price || p.Price || p.salePrice || p.listPrice)
                console.log()
            })
        } catch (e) {
            console.log('JSON parse hatası:', e instanceof Error ? e.message : e)
            // Ham veriyi göster
            console.log('Ham model (ilk 500):', match[1].substring(0, 500))
        }
    } else {
        // Regex'i genişlet
        const match2 = tmData.match(/productsModel\s*=\s*(\{.{100,5000}?\});/s)
        if (match2) {
            console.log('Alt regex buldu (ilk 300):', match2[1].substring(0, 300))
        } else {
            console.log('productsModel bulunamadı')
            // Alternatif: JSON script tag
            const $tm = cheerio.load(tmData)
            $tm('script').each((_, el) => {
                const content = $tm(el).html() ?? ''
                if (content.includes('productCode') || content.includes('ProductCode')) {
                    console.log('Script tag bulundu (ilk 200):', content.substring(0, 200))
                    return false
                }
            })
        }
    }
}

main().catch(console.error)

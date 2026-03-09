/**
 * DEBUG SCRAPER — Canlı HTTP yanıtlarını incele
 * Çalıştır: npx tsx scripts/debug-scrape.ts
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import * as fs from 'fs';

const TEST_SKU = '200x50'; // Basit, her iki sitede de bulunması muhtemel

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
    },
});

// ── Renk yardımcıları ──
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('─'.repeat(70));

// ────────────────────────────────────────────────────────────────────────────
// 1. tekermarket.com.tr — tam diagnosis
// ────────────────────────────────────────────────────────────────────────────
async function debugClient() {
    console.log(B('\n══ tekermarket.com.tr ══'));

    const url = `https://www.tekermarket.com.tr/Arama?1&kelime=${encodeURIComponent(TEST_SKU).replace(/%20/g, '+')}`;
    console.log('URL:', url);

    const { data: html, status, headers } = await http.get(url, { validateStatus: () => true });
    console.log(`HTTP ${status} | Content-Type: ${headers['content-type']} | Size: ${(html.length/1024).toFixed(1)}KB`);

    // Ham HTML'yi kaydet
    fs.writeFileSync('/tmp/debug_tekermarket.html', html);
    console.log(Y('→ /tmp/debug_tekermarket.html olarak kaydedildi'));

    const $ = cheerio.load(html);

    // Tüm fiyat içerebilecek elementleri tara
    sep();
    console.log(B('1a) Fiyat içeren elementler:'));
    const priceSelectors = [
        '.discountPrice', '.productPrice', '.discountPriceSpan',
        '.discountKdv',   '.sale-price',   '.price',
        'span[class*="price"]', 'div[class*="price"]', '[class*="Price"]',
    ];
    for (const sel of priceSelectors) {
        const els = $(sel);
        if (els.length > 0) {
            console.log(G(`  ${sel} [${els.length} adet]`));
            els.slice(0, 3).each((_, el) => {
                const text = $(el).text().trim().replace(/\s+/g, ' ');
                if (text) console.log(`    → "${text.substring(0, 80)}"`);
            });
        }
    }

    // İsim elementleri
    sep();
    console.log(B('1b) İsim elementleri:'));
    const nameSelectors = ['.productName', '.detailLink', '.product-name', '[class*="Name"]', '[class*="name"]'];
    for (const sel of nameSelectors) {
        const els = $(sel);
        if (els.length > 0) {
            console.log(G(`  ${sel} [${els.length} adet]`));
            els.slice(0, 3).each((_, el) => {
                const text = $(el).text().trim().replace(/\s+/g, ' ');
                if (text) console.log(`    → "${text.substring(0, 80)}"`);
            });
        }
    }

    // Script içi JSON
    sep();
    console.log(B('1c) Script içi JSON blokları:'));
    const jsonPatterns = [
        { name: 'initialProductList', re: /var\s+initialProductList\s*=\s*(\[[\s\S]{20,5000}?\]);/ },
        { name: 'productsModel',      re: /var\s+productsModel\s*=\s*(\{[\s\S]{20,3000}?\});/ },
        { name: 'products:',          re: /"products"\s*:\s*(\[[\s\S]{10,3000}?\])/ },
        { name: 'window.products',    re: /window\.products\s*=\s*(\[[\s\S]{10,3000}?\])/ },
    ];
    for (const { name, re } of jsonPatterns) {
        const m = html.match(re);
        if (m) {
            console.log(G(`  ✓ "${name}" bulundu, ilk 300 karakter:`));
            console.log('  ', m[1].substring(0, 300));
        } else {
            console.log(R(`  ✗ "${name}" bulunamadı`));
        }
    }

    // getFilterVariablesV3 API testi
    sep();
    console.log(B('1d) Ticimax API POST testi:'));
    const apiEndpoints = [
        'https://www.tekermarket.com.tr/api/ProductList/GetFilterVariablesV3',
        'https://www.tekermarket.com.tr/api/ProductList/GetProducts',
        'https://www.tekermarket.com.tr/api/Search/GetProducts',
    ];
    for (const endpoint of apiEndpoints) {
        try {
            const { data: res, status: s } = await http.post(endpoint, {
                filter: { SearchKeyword: TEST_SKU, CategoryIdList: [], PageType: 10 },
                paging: { PageIndex: 1, PageSize: 5, OrderBy: 'SMARTSORTING', OrderDirection: 'DESC' },
            }, {
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                validateStatus: () => true,
            });
            const preview = typeof res === 'string' ? res.substring(0, 150) : JSON.stringify(res).substring(0, 150);
            if (s === 200) {
                console.log(G(`  ✓ ${endpoint.split('/').pop()} → HTTP ${s}`));
                console.log('  ', preview);
            } else {
                console.log(Y(`  ~ ${endpoint.split('/').pop()} → HTTP ${s}: ${preview}`));
            }
        } catch (e: any) {
            console.log(R(`  ✗ ${endpoint.split('/').pop()} → ${e.message}`));
        }
    }

    // İlk 5 .ItemOrj elementinin iç HTML'si
    sep();
    console.log(B('1e) .ItemOrj/.productItem raw iç HTML:'));
    const items = $('.ItemOrj, .productItem');
    console.log(`  Bulunan .ItemOrj/.productItem sayısı: ${items.length}`);
    if (items.length > 0) {
        items.slice(0, 2).each((i, el) => {
            const inner = $(el).html()?.replace(/\s+/g, ' ').trim().substring(0, 400);
            console.log(Y(`  --- Item ${i+1} ---`));
            console.log('  ', inner);
        });
    }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. e-tekerlek.com — tam diagnosis
// ────────────────────────────────────────────────────────────────────────────
async function debugCompetitor() {
    console.log(B('\n══ e-tekerlek.com ══'));

    const url = `https://www.e-tekerlek.com/arama?q=${encodeURIComponent(TEST_SKU).replace(/%20/g, '+')}`;
    console.log('URL:', url);

    const { data: html, status, headers } = await http.get(url, { validateStatus: () => true });
    console.log(`HTTP ${status} | Content-Type: ${headers['content-type']} | Size: ${(html.length/1024).toFixed(1)}KB`);

    fs.writeFileSync('/tmp/debug_etekerlek.html', html);
    console.log(Y('→ /tmp/debug_etekerlek.html olarak kaydedildi'));

    const $ = cheerio.load(html);

    // Fiyat elementleri
    sep();
    console.log(B('2a) Fiyat elementleri:'));
    const priceSelectors = [
        'span.product-price', '.product-price', '.current-price',
        '[class*="price"]', '[class*="Price"]', '[class*="fiyat"]',
        '.fw-semibold.text-primary', 'span.fw-semibold',
    ];
    for (const sel of priceSelectors) {
        const els = $(sel);
        if (els.length > 0) {
            console.log(G(`  ${sel} [${els.length} adet]`));
            els.slice(0, 4).each((_, el) => {
                const text = $(el).text().trim().replace(/\s+/g, ' ');
                if (text) console.log(`    → "${text.substring(0, 80)}"`);
            });
        }
    }

    // İsim elementleri
    sep();
    console.log(B('2b) İsim elementleri:'));
    const nameSelectors = [
        '.product-title', 'h3', 'h2', 'a[title]',
        '[class*="title"]', '[class*="name"]', '[class*="Name"]',
    ];
    for (const sel of nameSelectors) {
        const els = $(sel);
        if (els.length > 0) {
            console.log(G(`  ${sel} [${els.length} adet]`));
            els.slice(0, 3).each((_, el) => {
                const text = ($(el).text() || $(el).attr('title') || '').replace(/\s+/g, ' ').trim();
                if (text && text.length > 3) console.log(`    → "${text.substring(0, 80)}"`);
            });
        }
    }

    // Container'lar
    sep();
    console.log(B('2c) Ürün container\'ları:'));
    const containers = [
        '.col-12.col-sm-6.col-lg-3',
        '.col-12.col-sm-6.col-xl-3',
        '.product-item',
        '.card',
        '[class*="product"]',
    ];
    for (const sel of containers) {
        const els = $(sel);
        if (els.length > 0) {
            console.log(G(`  ${sel} → ${els.length} adet`));
            // İlk elemanın price + name'ini çek
            const first = els.first();
            const price = first.find('[class*="price"], [class*="Price"]').first().text().trim();
            const name  = first.find('[class*="title"], [class*="name"], h1, h2, h3').first().text().trim();
            if (price) console.log(Y(`    fiyat: "${price.substring(0,60)}"`));
            if (name)  console.log(Y(`    isim:  "${name.substring(0,60)}"`));
        }
    }

    // İlk product-price parent DOM ağacı
    sep();
    console.log(B('2d) İlk span.product-price\'ın tam parent DOM ağacı:'));
    const firstPrice = $('span.product-price').first();
    if (firstPrice.length) {
        let el = firstPrice;
        let depth = 0;
        while (depth < 6 && el.length) {
            const cls   = el.attr('class') || '';
            const tag   = el.prop('tagName') || '';
            const text  = el.clone().children().remove().end().text().trim().substring(0, 40);
            console.log(`  ${'  '.repeat(depth)}↑ <${tag.toLowerCase()} class="${cls}"> "${text}"`);
            el = el.parent();
            depth++;
        }
    } else {
        console.log(R('  span.product-price bulunamadı!'));
    }

    // İlk 2 ürün kartının tam raw HTML'i
    sep();
    console.log(B('2e) İlk 2 ürün kartı raw HTML (en iyi eşleşen container):'));
    // En fazla ürün içeren container class'ını bul
    const bestContainer = ['col-12 col-sm-6 col-lg-3 col-xl-3', 'col-12 col-sm-6 col-lg-4', 'product-item'].find(cls => {
        return $(`[class="${cls}"], .${cls.split(' ').join('.')}`).length > 0;
    });
    const productCards = $('div').filter((_, el) => {
        const cls = $(el).attr('class') || '';
        return cls.includes('col-sm-6') && $(el).find('[class*="price"]').length > 0;
    });
    console.log(`  Fiyat içeren col-sm- div sayısı: ${productCards.length}`);
    productCards.slice(0, 2).each((i, el) => {
        console.log(Y(`  --- Kart ${i+1} [class="${$(el).attr('class')}"] ---`));
        console.log('  ', $(el).html()?.replace(/\s+/g, ' ').trim().substring(0, 500));
    });
}

// ── Ana akış ─────────────────────────────────────────────────────────────────
(async () => {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(' SCRAPER DIAGNOSIS — Test SKU:', TEST_SKU);
    console.log(`${'═'.repeat(70)}`);

    await debugClient();
    console.log('\n');
    await debugCompetitor();

    console.log(`\n${'═'.repeat(70)}`);
    console.log(G(' ✓ Diagnosis tamamlandı.'));
    console.log(' HTML dosyaları: /tmp/debug_tekermarket.html, /tmp/debug_etekerlek.html');
    console.log(`${'═'.repeat(70)}\n`);
})();

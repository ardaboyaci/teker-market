import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

function skuToQuery(sku: string): string {
    return encodeURIComponent(sku.trim()).replace(/%20/g, '+');
}

async function testScrape(query: string) {
    const url = `https://www.e-tekerlek.com/arama?q=${skuToQuery(query)}`;
    console.log(`Fetching: ${url}`);
    try {
        const { data, status } = await http.get(url, { validateStatus: () => true });
        console.log(`Status Code: ${status}`);
        
        if (status === 403 || data.includes('Cloudflare') || data.includes('Just a moment')) {
            console.log('BLOCKED BY CLOUDFLARE OR ANTI-BOT!');
            return;
        }

        const $ = cheerio.load(data);
        const CARD_SELECTORS = ['div.product-item', '.product-card', '[class*="product-item"]', 'li.product', '.col-sm-6'];
        const NAME_SELECTORS = ['.product-title', 'h3', 'h2', 'a[title]', '[class*="title"]', '[class*="name"]'];
        const PRICE_SELECTORS = ['span.product-price', '.product-price', '.current-price', '[class*="price"]'];

        let $cards = $();
        for (const sel of CARD_SELECTORS) {
            const found = $(sel);
            if (found.length > $cards.length) $cards = found;
        }

        console.log(`Found ${$cards.length} product cards.`);

        $cards.each((_, card) => {
            const $card = $(card);
            let productName = '';
            for (const sel of NAME_SELECTORS) {
                const el = $card.find(sel).first();
                const txt = el.text().trim() || el.attr('title')?.trim() || '';
                if (txt.length > 3) { productName = txt; break; }
            }

            let priceRaw = '';
            for (const sel of PRICE_SELECTORS) {
                const txt = $card.find(sel).first().text().trim();
                if (txt) { priceRaw = txt; break; }
            }

            console.log(` - Product: ${productName} | Price: ${priceRaw}`);
        });

    } catch (e: any) {
        console.error('Request failed:', e.message);
    }
}

async function run() {
    await testScrape('0169');
    await testScrape('KTÇTP');
}

run();

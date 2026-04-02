import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  try {
    const r = await axios.get('https://www.e-tekerlek.com/arama?q=emes', { 
        httpsAgent: agent, 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } 
    });
    const $ = cheerio.load(r.data);
    
    const elements = $('div, li, a, span').map((i, el) => $(el).attr('class') || '').get().filter(c => c.includes('product') || c.includes('item'));
    console.log('Unique classes with product/item:', [...new Set(elements)]);
    
    // Attempt extracting a single product title to see what works
    const titles = $('.product-title, .productName, .urun-adi, .name, h3').map((i, el) => $(el).text().trim()).get();
    console.log('\nFound titles:', titles.slice(0, 5));
    
    const prices = $('.product-price, .urun-fiyat, .price, .current-price, .indirimliFiyat').map((i, el) => $(el).text().trim()).get();
    console.log('\nFound prices:', prices.slice(0, 5));

  } catch(e: any) {
    console.error(e.message);
  }
}
run();

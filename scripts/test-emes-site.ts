import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

const agent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent: agent,
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    }
});

const BASE = 'https://emesteker.com';

async function test() {
    // Ürün detay sayfasını test et
    const testUrl = `${BASE}/tr/tekerler/em-01-spr-80-165.html`;
    console.log('Test URL:', testUrl);

    const { data } = await http.get(testUrl);
    const $ = cheerio.load(data);

    console.log('Başlık:', $('title').text().trim().slice(0, 80));
    console.log('H1:', $('h1').first().text().trim());

    // SKU / ürün kodu
    const allText = $('body').text();
    const skuMatch = allText.match(/EM\s*0[0-9]\s*[A-Z0-9 ]+/);
    console.log('SKU match:', skuMatch ? skuMatch[0].trim() : '(yok)');

    // Tüm görseller
    console.log('\nTüm görseller:');
    $('img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        console.log(`  [${i}]`, src.slice(0, 120));
    });

    // Teknik özellikler tablosu
    console.log('\nTeknik özellik alanları:');
    $('table tr, .specs tr, .ozellikler tr, dl dt, [class*="spec"]').each((i, el) => {
        if (i >= 15) return false;
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text.length > 2 && text.length < 200) console.log('  ', text);
    });

    // Meta içeriği
    console.log('\nMeta description:', $('meta[name="description"]').attr('content')?.slice(0, 150) || '(yok)');

    // Sayfanın HTML yapısını anlamak için ilgili class'lar
    console.log('\nÖnemli class\'lar:');
    const classes = new Set<string>();
    $('[class]').each((_, el) => {
        const cls = $(el).attr('class') || '';
        cls.split(' ').forEach(c => {
            if (c.includes('prod') || c.includes('urun') || c.includes('detail') || c.includes('spec') || c.includes('img')) {
                classes.add(c);
            }
        });
    });
    console.log([...classes].join(', '));
}

test().catch(e => console.error('Hata:', e.message));

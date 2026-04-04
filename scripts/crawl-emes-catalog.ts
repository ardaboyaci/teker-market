/**
 * emesteker.com TÜM ÜRÜN KATALOĞU TARAYICI
 *
 * Tüm seri sayfalarını gezip ürün detay URL'lerini toplar,
 * her detay sayfasından: ürün adı + görsel URL çeker.
 * Çıktı: scripts/output/emes-site-catalog.json
 *
 * Flags:
 *   --limit=N   Sadece ilk N ürün detayını işle (test için)
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output');
const CATALOG_FILE = path.resolve(OUTPUT_DIR, 'emes-site-catalog.json');
const BASE_URL = 'https://emesteker.com';

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface SiteProduct {
    name: string;
    compact: string;  // boşluksuz büyük harf: "EM01SMR80"
    imageUrl: string;
    detailUrl: string;
}

// Aksesuar alt kategorileri
const AKSESUAR_CATEGORIES = [
    '/tr/makine-ekipmanlari/carklar-5455.html',
    '/tr/makine-ekipmanlari/kaucuk-taban-ve-pedler-5464.html',
    '/tr/makine-ekipmanlari/kilit-ve-anahtarlari-5468.html',
    '/tr/makine-ekipmanlari/kollar-5544.html',
    '/tr/makine-ekipmanlari/makine-ayaklari-5427.html',
    '/tr/makine-ekipmanlari/makine-kulplari-5488.html',
    '/tr/makine-ekipmanlari/mandal-ve-karsiliklari-5508.html',
    '/tr/makine-ekipmanlari/menteseler-5511.html',
    '/tr/makine-ekipmanlari/raylar-8678.html',
    '/tr/makine-ekipmanlari/rotil-ve-ayaklari-5519.html',
    '/tr/makine-ekipmanlari/takozlar-5525.html',
    '/tr/makine-ekipmanlari/tutamaklar-5449.html',
];

// ─── Tüm ürün detay URL'lerini topla ────────────────────────────────────────
async function collectProductUrls(): Promise<string[]> {
    const allUrls = new Set<string>();
    const visitedSeries = new Set<string>();

    // Seri ID'lerini ana sayfadan al
    const { data: mainData } = await http.get(`${BASE_URL}/tr/tekerler.html`);
    const $main = cheerio.load(mainData);

    const seriesIds: string[] = [];
    $main('a[href]').each((_, el) => {
        const href = $main(el).attr('href') || '';
        const m = href.match(/[?&]Seri=(\d+)/);
        if (m && !visitedSeries.has(m[1])) {
            visitedSeries.add(m[1]);
            seriesIds.push(m[1]);
        }
    });

    console.log(`  Ana sayfadan ${seriesIds.length} seri bulundu`);

    // Her seri sayfasını tara
    for (let i = 0; i < seriesIds.length; i++) {
        const seriId = seriesIds[i];
        process.stdout.write(`\r  [${i + 1}/${seriesIds.length}] Seri=${seriId.padEnd(5)} | URL toplandı: ${allUrls.size}`);

        try {
            const { data, status } = await http.get(
                `${BASE_URL}/tr/tekerler.html?Seri=${seriId}`,
                { validateStatus: () => true }
            );
            if (status !== 200) continue;

            const $ = cheerio.load(data);

            // Ürün detay linkleri: /tr/tekerler/slug-id.html
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href') || '';
                if (/\/tr\/tekerler\/[^?#]+\.html$/.test(href)) {
                    const url = `${BASE_URL}${href}`;
                    allUrls.add(url);
                }
            });

            // Alt seri linkleri de ekle
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href') || '';
                const m = href.match(/[?&]Seri=(\d+)/);
                if (m && !visitedSeries.has(m[1])) {
                    visitedSeries.add(m[1]);
                    seriesIds.push(m[1]); // dinamik olarak genişlet
                }
            });
        } catch { /* devam */ }

        await sleep(300);
    }

    console.log(`\n  Teker sayfalarından ${allUrls.size} URL toplandı`);

    // Aksesuar kategorilerini tara
    console.log(`  Aksesuar kategorileri taranıyor (${AKSESUAR_CATEGORIES.length} kategori)...`);
    for (let i = 0; i < AKSESUAR_CATEGORIES.length; i++) {
        const catPath = AKSESUAR_CATEGORIES[i];
        process.stdout.write(`\r  [${i + 1}/${AKSESUAR_CATEGORIES.length}] ${catPath.split('/').pop()?.padEnd(40)} | URL: ${allUrls.size}`);

        try {
            const { data, status } = await http.get(
                `${BASE_URL}${catPath}`,
                { validateStatus: () => true }
            );
            if (status !== 200) continue;

            const $ = cheerio.load(data);
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href') || '';
                // /tr/makine-ekipmanlari/kategori/urun-slug.html
                if (/\/tr\/makine-ekipmanlari\/[^/]+\/[^?#]+\.html$/.test(href)) {
                    allUrls.add(`${BASE_URL}${href}`);
                }
            });
        } catch { /* devam */ }

        await sleep(300);
    }

    console.log(`\n  Toplam ${allUrls.size} ürün URL'si toplandı`);
    return [...allUrls];
}

// ─── Ürün detay sayfasından ad ve görsel çek ─────────────────────────────────
async function scrapeProductDetail(url: string): Promise<SiteProduct | null> {
    try {
        const { data, status } = await http.get(url, {
            validateStatus: () => true,
            timeout: 12000,
        });
        if (status !== 200) return null;

        const $ = cheerio.load(data);

        // Görsel — önce ürün görseli, sonra fallback
        let imageUrl = '';
        const imgSelectors = [
            '#ctl00_ContentPlaceHolder1_imageProduct',   // teker ürünleri
            '#ctl00_ContentPlaceHolder1_imgGorsel',      // aksesuar ürünleri
            '.mechanic-product-image img',               // aksesuar fallback
            '.product-detail-content img',
            '[class*="product-image"] img',
            '[class*="detail"] img',
            '.col-md-6 img',
        ];
        for (const sel of imgSelectors) {
            const src = $(sel).first().attr('src') || $(sel).first().attr('data-src') || '';
            if (src && !src.includes('logo') && !src.includes('banner') && src.includes('upload')) {
                imageUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
                break;
            }
        }

        if (!imageUrl) return null;

        // Ürün adı: h1'den al
        const rawName = (
            $('[class*="product-header-right-head"]').first().text().trim() ||
            $('h1').first().text().trim() ||
            $('title').text().split('|')[0].trim()
        ).split('\n')[0].replace(/\s+/g, ' ').trim();

        // compact: görsel dosya adından türet (en güvenilir)
        // /uploads/excelresim/EA01VBP150.jpg → EA01VBP150
        // Fallback: /uploads/resim/77-1/xyz.jpg gibi rassal isimlerde ürün adından türet
        let compact = '';
        const fileMatch = imageUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)$/i);
        if (fileMatch) {
            const fname = fileMatch[1].toUpperCase();
            // Anlamsız hash gibi görünmüyorsa (8+ alfanümerik karakter, nokta içermiyorsa) kullan
            if (/^[A-Z0-9]{4,}$/.test(fname) && !fname.match(/^[A-Z0-9]{8,}$/)) {
                compact = fname;
            }
        }
        // compact bulunamadıysa ürün adından türet
        if (!compact && rawName) {
            compact = rawName.replace(/\s+/g, '').toUpperCase()
                .replace(/İ/g,'I').replace(/Ğ/g,'G').replace(/Ü/g,'U')
                .replace(/Ş/g,'S').replace(/Ö/g,'O').replace(/Ç/g,'C')
                .replace(/[^A-Z0-9]/g,'').substring(0, 20);
        }
        if (!compact) return null;

        const name = rawName.length > 3 ? rawName : compact;

        return { name, compact, imageUrl, detailUrl: url };
    } catch {
        return null;
    }
}

// ─── Ana ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ EMES SİTE KATALOG TARAYICI v3 ━━━\n');
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Mevcut katalog varsa yükle (resume)
    let existing: SiteProduct[] = [];
    const existingUrls = new Set<string>();
    try {
        existing = JSON.parse(await fs.readFile(CATALOG_FILE, 'utf-8'));
        existing.forEach(p => existingUrls.add(p.detailUrl));
        console.log(`[Resume] ${existing.length} ürün zaten katalogda`);
    } catch { /* yeni başlangıç */ }

    // 1. URL topla
    console.log('[1] Ürün URL\'leri toplanıyor...');
    const productUrls = await collectProductUrls();

    const newUrls = productUrls.filter(u => !existingUrls.has(u));
    const toProcess = LIMIT ? newUrls.slice(0, LIMIT) : newUrls;
    console.log(`[2] ${toProcess.length} yeni URL işlenecek\n`);

    const catalog = [...existing];
    let ok = 0, fail = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const url = toProcess[i];
        process.stdout.write(`\r[${i + 1}/${toProcess.length}] ✓${ok} ✗${fail} | ${url.slice(-40).padEnd(40)}`);

        const product = await scrapeProductDetail(url);
        if (product) {
            catalog.push(product);
            ok++;
        } else {
            fail++;
        }

        // Her 100 üründe ara kayıt
        if ((i + 1) % 100 === 0) {
            await fs.writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf-8');
        }

        await sleep(250 + Math.random() * 150);
    }

    await fs.writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf-8');

    console.log(`\n\n━━━ ÖZET ━━━`);
    console.log(`  Toplam katalog: ${catalog.length} ürün`);
    console.log(`  Bu çalışma: ${ok} başarılı, ${fail} başarısız`);
    console.log(`[Kaydedildi] ${CATALOG_FILE}`);

    // Örnek
    console.log('\n[Örnek]:');
    catalog.slice(0, 8).forEach(p =>
        console.log(`  "${p.compact}" | img: ${p.imageUrl.slice(-50)}`)
    );
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

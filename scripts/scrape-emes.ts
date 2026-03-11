import https from 'https';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { ScrapedProduct } from './types';

// ─── Configuration ───────────────────────────────────────────────────────────
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts', 'output');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const DATA_FILE = path.join(OUTPUT_DIR, 'products.json');
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'checkpoint.json');
const WATERMARK_PATH = path.resolve(process.cwd(), 'scripts', 'watermark-logo.png');

// ─── Checkpoint types & helpers ──────────────────────────────────────────────
interface Checkpoint {
    startedAt: string;
    completedSeries: string[];          // Tamamlanan seri URL'leri
    pendingSeries: SeriesInfo[];      // Henüz işlenmeyen seriler
    products: ScrapedProduct[];  // Şimdiye kadar toplanan ürünler
    seenSkus: string[];          // Deduplicate için
    phase: 'scraping' | 'detail' | 'images' | 'done';
    detailOffset: number;            // Detail enrichment'ın kaldığı indeks
    imageOffset: number;            // Image download'ın kaldığı indeks
}

async function loadCheckpoint(): Promise<Checkpoint | null> {
    try {
        const raw = await fs.readFile(CHECKPOINT_FILE, 'utf-8');
        const cp = JSON.parse(raw) as Checkpoint;
        console.log(`[Checkpoint] Devam noktası bulundu → ${cp.startedAt}`);
        console.log(`  Tamamlanan seri: ${cp.completedSeries.length}, Toplanan ürün: ${cp.products.length}`);
        console.log(`  Kalan seri: ${cp.pendingSeries.length}, Faz: ${cp.phase}`);
        return cp;
    } catch {
        return null; // Dosya yok veya bozuk → sıfırdan başla
    }
}

async function saveCheckpoint(cp: Checkpoint): Promise<void> {
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
}

async function clearCheckpoint(): Promise<void> {
    try { await fs.unlink(CHECKPOINT_FILE); } catch { /* zaten yok */ }
}

const BASE_URL = 'https://emesteker.com';
const CATALOG_URL = `${BASE_URL}/tr/tekerler.html`;

// SSL agent — insecure only in dev
const agent = new https.Agent({
    rejectUnauthorized: process.env.NODE_ENV === 'production'
});

// Shared axios instance with defaults
const http: AxiosInstance = axios.create({
    httpsAgent: agent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(800 + Math.random() * 1200); // 0.8-2s

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data } = await http.get(url);
            return data;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`  [Retry ${attempt}/${maxRetries}] ${url}: ${msg}`);
            if (attempt >= maxRetries) throw new Error(`Failed after ${maxRetries} retries: ${url}`);
            await delay(Math.pow(2, attempt) * 1000);
        }
    }
    throw new Error('Unreachable');
}

/** ASP.NET __doPostBack ile sonraki sayfayı POST ile çeker */
async function postNextPage(
    pageUrl: string,
    eventTarget: string,
    viewState: string,
    viewStateGenerator: string,
    eventValidation: string,
    maxRetries = 3
): Promise<string> {
    // URLSearchParams → application/x-www-form-urlencoded body
    const body = new URLSearchParams({
        '__EVENTTARGET': eventTarget,
        '__EVENTARGUMENT': '',
        '__VIEWSTATE': viewState,
        '__VIEWSTATEGENERATOR': viewStateGenerator,
        '__EVENTVALIDATION': eventValidation,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data } = await http.post(pageUrl, body.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': pageUrl,
                    'Origin': BASE_URL,
                },
            });
            return data;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown';
            console.error(`  [POST Retry ${attempt}/${maxRetries}] ${msg}`);
            if (attempt >= maxRetries) throw new Error(`POST failed after ${maxRetries} retries`);
            await delay(Math.pow(2, attempt) * 1000);
        }
    }
    throw new Error('Unreachable');
}

/** Sayfanın gizli ASP.NET alanlarını çıkarır */
interface AspNetState {
    viewState: string;
    viewStateGenerator: string;
    eventValidation: string;
}

function extractAspNetState($: cheerio.CheerioAPI): AspNetState {
    return {
        viewState: $('input[name="__VIEWSTATE"]').val() as string ?? '',
        viewStateGenerator: $('input[name="__VIEWSTATEGENERATOR"]').val() as string ?? '',
        eventValidation: $('input[name="__EVENTVALIDATION"]').val() as string ?? '',
    };
}

/**
 * Sayfalama control ID'sini döndürür.
 * Emes'in DataPager yapısı: dpUrunSayfalama$ctl01$ctl01 (sayfa 2),
 *                            dpUrunSayfalama$ctl01$ctl02 (sayfa 3), ...
 * Sonraki (>) butonu:        dpUrunSayfalama$ctl02$ctl00
 */
function findNextPostbackTarget($: cheerio.CheerioAPI): string | null {
    const pagerSpan = $('#ctl00_ContentPlaceHolder1_dpUrunSayfalama');
    if (!pagerSpan.length) return null;

    // Aktif (mevcut) sayfayı bul: disabled olmayan <span> içindeki numara
    const activeSpan = pagerSpan.find('span.scroll-up, span').filter((_, el) => {
        // Aktif sayfa <span> içinde, <a> değil
        const tag = (el as any).tagName?.toLowerCase();
        return tag === 'span';
    }).first();

    // Sonraki butonu: sağ uçtaki > veya >> içeren <a>
    let nextTarget: string | null = null;

    pagerSpan.find('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        // ">" veya ">>" sonraki sayfaya götürür
        if (/^>$|^>>$|^›$|^»$/.test(text) && href.includes('__doPostBack')) {
            const match = href.match(/doPostBack\('([^']+)'/);
            if (match) nextTarget = match[1];
        }
    });

    // Sonraki butonu yoksa → son sayfadayız
    return nextTarget;
}

// ─── Phase 1: Discover all series/category pages from the main catalog ──────
interface SeriesInfo {
    name: string;
    url: string;
}

async function discoverSeriesPages(): Promise<SeriesInfo[]> {
    console.log('[Discovery] Fetching main catalog to find all series/category links...');
    const html = await fetchWithRetry(CATALOG_URL);
    const $ = cheerio.load(html);
    const series: SeriesInfo[] = [];
    const seen = new Set<string>();

    // The Emes site has series links in the navigation menu and in the left sidebar
    // Look for all links that point to /tr/tekerler/ sub-pages (series pages)
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;

        // Match series/category pages under /tr/tekerler/ or with Seri= query params
        if (fullUrl.includes('/tr/tekerler') && fullUrl !== CATALOG_URL && !seen.has(fullUrl)) {
            // Skip detail pages (those have numeric IDs at the end like -2444.html)
            if (/\-\d+\.html$/.test(fullUrl) && !fullUrl.includes('Seri=')) return;

            const name = $(el).text().trim();
            if (name && name.length > 1) {
                seen.add(fullUrl);
                series.push({ name, url: fullUrl });
            }
        }
    });

    // Also look for filter/series links with ?Seri= pattern
    $('a[href*="Seri="]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        if (!seen.has(fullUrl)) {
            const name = $(el).text().trim();
            if (name) {
                seen.add(fullUrl);
                series.push({ name, url: fullUrl });
            }
        }
    });

    // If we couldn't find series links, fall back to the main catalog page
    if (series.length === 0) {
        console.log('[Discovery] No series pages found, will scrape main catalog only.');
        series.push({ name: 'Tüm Tekerlekler', url: CATALOG_URL });
    }

    console.log(`[Discovery] Found ${series.length} series/category pages to crawl.`);
    series.forEach(s => console.log(`  → ${s.name}: ${s.url}`));
    return series;
}

// ─── Phase 2a: Tüm sayfaları ASP.NET postback ile gez ───────────────────────
async function scrapeAllPages(startUrl: string, seriesName: string): Promise<ScrapedProduct[]> {
    const collected: ScrapedProduct[] = [];
    let pageNum = 1;

    // Sayfa 1: normal GET
    console.log(`  [Page 1] GET ${startUrl}`);
    let html: string;
    try {
        html = await fetchWithRetry(startUrl);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        console.error(`  [Page 1 Error] ${msg}`);
        return collected;
    }

    let $ = cheerio.load(html);
    collected.push(...parseProductCards($, seriesName));
    console.log(`  [Page 1] ${collected.length} ürün (toplam: ${collected.length})`);

    // Sayfa 2+: __doPostBack POST döngüsü
    // POST her zaman aynı URL'ye yapılır; VIEWSTATE her sayfada değişir
    let postUrl = startUrl.startsWith('http') ? startUrl : `${BASE_URL}${startUrl}`;

    // form action göreceli olabilir (./tekerler.html?Seri=3401)
    const formAction = $('form#aspnetForm, form').first().attr('action');
    if (formAction) {
        try { postUrl = new URL(formAction, postUrl).toString(); } catch { /* geçersizse orijinali kullan */ }
    }

    while (true) {
        const state = extractAspNetState($);
        const nextTarget = findNextPostbackTarget($);

        if (!nextTarget) {
            console.log(`  [Pagination] Son sayfaya ulaşıldı (${pageNum}. sayfa).`);
            break;
        }

        // VIEWSTATE boşsa postback anlamsız — kırık sayfa
        if (!state.viewState) {
            console.error('  [Pagination] __VIEWSTATE bulunamadı, pagination durduruluyor.');
            break;
        }

        pageNum++;
        console.log(`  [Page ${pageNum}] POST → eventTarget: ${nextTarget}`);

        try {
            html = await postNextPage(
                postUrl,
                nextTarget,
                state.viewState,
                state.viewStateGenerator,
                state.eventValidation
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown';
            console.error(`  [Page ${pageNum} Error] ${msg}`);
            break;
        }

        $ = cheerio.load(html);
        const pageProducts = parseProductCards($, seriesName);
        collected.push(...pageProducts);
        console.log(`  [Page ${pageNum}] ${pageProducts.length} ürün (toplam: ${collected.length})`);

        // Sonsuz döngü koruması
        if (pageNum > 50) {
            console.warn('  [Pagination] 50 sayfa sınırına ulaşıldı, durduruluyor.');
            break;
        }

        await randomDelay();
    }

    return collected;
}

// ─── Phase 2c: Scrape product cards from a listing page ─────────────────────
function parseProductCards($: cheerio.CheerioAPI, seriesName: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];

    // Try multiple possible selectors for product containers
    const selectors = [
        '.product-list',
        '.product-item',
        '.product-card',
        '.urun-liste',
        '[class*="product"]',
        '.col-md-4',     // common grid item class
        '.col-lg-4',
    ];

    let $items: cheerio.Cheerio<any> | null = null;
    for (const sel of selectors) {
        const found = $(sel);
        if (found.length > 0) {
            $items = found;
            break;
        }
    }

    if (!$items || $items.length === 0) {
        // Fallback: look for any element with product image + product name
        $items = $('[class*="urun"], [class*="Urun"], [class*="URUN"]');
    }

    $items?.each((_, element) => {
        const $el = $(element);

        // Extract product name
        const rawTitle =
            $el.find('.product-name a').text().trim() ||
            $el.find('.urun-adi a').text().trim() ||
            $el.find('h3 a, h4 a, h5 a').first().text().trim() ||
            $el.find('a[title]').first().attr('title')?.trim() ||
            $el.find('a').first().text().trim();

        if (!rawTitle || rawTitle.length < 3) return;

        // Extract SKU from name
        const skuMatch = rawTitle.match(/^([A-Z]{1,4}\s*\d{1,3}\s*[A-Z]{2,4}\s*\d{2,4}(?:\s*F)?)/i);
        const sku = skuMatch ? skuMatch[1].trim().toUpperCase() : rawTitle.trim();

        // Extract image
        const imgSrc =
            $el.find('img').first().attr('data-src') ||
            $el.find('img').first().attr('src') || '';
        const imageUrl = imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `${BASE_URL}${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`) : '';

        // Extract detail URL
        const detailHref =
            $el.find('.product-name a').attr('href') ||
            $el.find('h3 a, h4 a, h5 a').first().attr('href') ||
            $el.find('a[href*=".html"]').first().attr('href') || '';
        const detailUrl = detailHref ? (detailHref.startsWith('http') ? detailHref : `${BASE_URL}${detailHref.startsWith('/') ? '' : '/'}${detailHref}`) : '';

        // Extract inline specs from the card (visible in listing screenshots):
        // "Teker Çapı: 125 mm", "Kaplama Cinsi: Kauçuk", "Taşıma Kapasitesi: 110 kg"
        const cardText = $el.text();
        const diameterMatch = cardText.match(/(?:Teker(?:lek)?\s*Çapı|Çap)\s*[:=]?\s*(\d+)\s*mm/i);
        const widthMatch = cardText.match(/(?:Teker(?:lek)?\s*Gen(?:işliği)?)\s*[:=]?\s*(\d+)\s*mm/i);
        const capacityMatch = cardText.match(/Taşıma\s*Kapas(?:itesi)?\s*[:=]?\s*(\d+)\s*(?:kg|KG)/i);
        const coatingMatch = cardText.match(/Kaplama\s*Cinsi\s*[:=]?\s*([A-Za-zÇçĞğİıÖöŞşÜü]+)/i);

        // Extract price (probably won't find any, but try)
        let sale_price = "0.00";
        const priceText = $el.find('.price, .product-price, .fiyat').text().trim();
        if (priceText) {
            const cleaned = priceText.replace(/[^0-9,.]/g, '').replace(/\./g, '').replace(',', '.');
            if (cleaned && parseFloat(cleaned) > 0) sale_price = cleaned;
        }

        // Determine wheel type from name
        let wheelType: string | undefined;
        const upperName = rawTitle.toUpperCase();
        if (upperName.includes(' F') || upperName.includes('FREN')) wheelType = 'Frenli';
        else if (upperName.includes('SMR')) wheelType = 'Döner Tablalı';
        else if (upperName.includes('SPR')) wheelType = 'Döner Tablalı';

        if (imageUrl) {
            products.push({
                sku,
                name: rawTitle,
                imageUrl,
                sale_price,
                detailUrl: detailUrl || undefined,
                wheelDiameter: diameterMatch ? `${diameterMatch[1]} mm` : undefined,
                wheelWidth: widthMatch ? `${widthMatch[1]} mm` : undefined,
                loadCapacity: capacityMatch ? `${capacityMatch[1]} kg` : undefined,
                coatingType: coatingMatch ? coatingMatch[1] : undefined,
                wheelType,
                series: seriesName,
            });
        }
    });

    return products;
}

// ─── Phase 3: Scrape product detail page for richer data ────────────────────
async function scrapeDetailPage(product: ScrapedProduct): Promise<void> {
    if (!product.detailUrl) return;

    try {
        const html = await fetchWithRetry(product.detailUrl);
        const $ = cheerio.load(html);

        // Extract specs from detail page — these are more reliable than listing cards
        const pageText = $('body').text();

        // Diameter
        const diaMatch = pageText.match(/(\d+)\s*mm\s*Tekerlek\s*Çapı/i) ||
            pageText.match(/Tekerlek\s*Çapı\s*[:=]?\s*(\d+)\s*mm/i);
        if (diaMatch) product.wheelDiameter = `${diaMatch[1]} mm`;

        // Width
        const widMatch = pageText.match(/(\d+)\s*mm\s*Tekerlek\s*Genişliği/i) ||
            pageText.match(/Tekerlek\s*Genişliği\s*[:=]?\s*(\d+)\s*mm/i);
        if (widMatch) product.wheelWidth = `${widMatch[1]} mm`;

        // Load Capacity
        const capMatch = pageText.match(/(\d+)\s*KG\s*Taşıma\s*Kapasitesi/i) ||
            pageText.match(/Taşıma\s*Kapasitesi\s*[:=]?\s*(\d+)\s*(?:kg|KG)/i);
        if (capMatch) product.loadCapacity = `${capMatch[1]} kg`;

        // Type from breadcrumb/title
        const typeMatch = pageText.match(/(Döner\s*Tablalı|Sabit|Frenli|Frensiz|Kilitli)/i);
        if (typeMatch) product.wheelType = typeMatch[1];

        // Description from meta or content
        const metaDesc = $('meta[name="description"]').attr('content');
        const bodyDesc = $('.product-detail-text, .urun-detay, .product-description, [class*="aciklama"]').text().trim();
        product.description = bodyDesc || metaDesc || undefined;

        // Try to get a higher-res image from the detail page
        const bigImg =
            $('img.product-detail-image, .product-image img, .urun-resim img, .product-gallery img').first().attr('src') ||
            $('img.product-detail-image, .product-image img, .urun-resim img, .product-gallery img').first().attr('data-src');
        if (bigImg) {
            const fullBigImg = bigImg.startsWith('http') ? bigImg : `${BASE_URL}${bigImg.startsWith('/') ? '' : '/'}${bigImg}`;
            // Only use if it seems like a unique/different image
            if (fullBigImg !== product.imageUrl) {
                product.imageUrl = fullBigImg;
            }
        }
    } catch {
        // Detail page failure is non-fatal — we already have listing data
    }
}

// ─── Phase 4: Download & watermark images ───────────────────────────────────
async function downloadAndWatermark(imageUrl: string, sku: string): Promise<string | undefined> {
    const safeSku = sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const outputPath = path.join(IMAGES_DIR, `${safeSku}.webp`);

    try {
        const { data } = await http.get(imageUrl, { responseType: 'arraybuffer', timeout: 12000 });
        const imgBuf = Buffer.from(data, 'binary');

        await sharp(imgBuf)
            .resize(800, null, { withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(outputPath);

        return outputPath;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        console.error(`  [Image Error] ${safeSku}: ${msg}`);
        return undefined;
    }
}

// ─── Phase 5: Auto-assign category ──────────────────────────────────────────
function autoAssignCategory(product: ScrapedProduct): string {
    const name = product.name.toUpperCase();
    const sku = product.sku.toUpperCase();

    // HQP = Ağır Yük Poliüretan
    if (sku.startsWith('HQP') || name.includes('HQP')) return 'Ağır Yük Tekerlekleri';
    // EM serisi variant detection
    if (sku.startsWith('EM') || name.startsWith('EM')) {
        if (product.coatingType?.toLowerCase()?.includes('poliüret')) return 'Endüstriyel Tekerlekler';
        return 'Endüstriyel Tekerlekler';
    }
    // EA series
    if (sku.startsWith('EA')) return 'Hafif Sanayi Tekerlekleri';
    // EB, EC, ED etc — industrial range
    if (/^E[BCDFGHIJKL]/.test(sku)) return 'Endüstriyel Tekerlekler';
    // Transpalet
    if (name.includes('TRANSPALET') || name.includes('PALET')) return 'Transpalet Tekerlekleri';
    // Mobilya
    if (name.includes('MOBİLYA') || name.includes('MOBILYA')) return 'Mobilya Tekerlekleri';
    // Havalı
    if (name.includes('HAVALI') || name.includes('HAVALİ') || name.includes('PNÖ')) return 'Havalı Tekerlekler';
    // Paslanmaz
    if (name.includes('PASLANMAZ') || name.includes('INOX')) return 'Paslanmaz Tekerlekler';
    // Isıya dayanıklı
    if (name.includes('ISI') || name.includes('SICAK')) return 'Isıya Dayanıklı Tekerlekler';

    return 'Diğer Tekerlekler';
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ TEKER MARKET PREMIUM SCRAPER v4 (Checkpoint/Resume) ━━━');
    console.log(`[Config] NODE_ENV=${process.env.NODE_ENV || 'development'}`);

    // --reset flag'i ile checkpoint'i sil ve sıfırdan başla
    const forceReset = process.argv.includes('--reset');
    if (forceReset) {
        await clearCheckpoint();
        console.log('[Checkpoint] --reset: Mevcut ilerleme silindi, sıfırdan başlanıyor.\n');
    }

    // Init directories
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.mkdir(IMAGES_DIR, { recursive: true });



    // ── Checkpoint'i yükle veya yeni oluştur ─────────────────────────────
    let cp = await loadCheckpoint();

    if (!cp) {
        // ── Step 1: Discover all series pages ────────────────────────────
        const seriesPages = await discoverSeriesPages();
        await randomDelay();

        cp = {
            startedAt: new Date().toISOString(),
            completedSeries: [],
            pendingSeries: seriesPages,
            products: [],
            seenSkus: [],
            phase: 'scraping',
            detailOffset: 0,
            imageOffset: 0,
        };
        await saveCheckpoint(cp);
        console.log(`[Checkpoint] Yeni oturum başlatıldı. ${seriesPages.length} seri keşfedildi.\n`);
    }

    // ── Step 2: Scrape product cards (kaldığı yerden) ────────────────────
    if (cp.phase === 'scraping') {
        const allProducts = cp.products;
        const seenSkus = new Set<string>(cp.seenSkus);

        for (const series of cp.pendingSeries) {
            console.log(`\n[Scrape] ── ${series.name} ──`);
            try {
                const products = await scrapeAllPages(series.url, series.name);
                for (const p of products) {
                    const key = `${p.sku}__${p.name}`;
                    if (!seenSkus.has(key)) {
                        seenSkus.add(key);
                        p.category = autoAssignCategory(p);
                        allProducts.push(p);
                    }
                }
                console.log(`  [Series Done] ${products.length} kart, ${allProducts.length} benzersiz toplam.`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Unknown';
                console.error(`  [Series Error] ${series.name}: ${msg} — seri atlanıyor.`);
            }

            // Her seri sonrası checkpoint kaydet
            cp.completedSeries.push(series.url);
            cp.pendingSeries = cp.pendingSeries.filter(s => s.url !== series.url);
            cp.products = allProducts;
            cp.seenSkus = [...seenSkus];
            await saveCheckpoint(cp);
        }

        // Fallback
        if (allProducts.length === 0) {
            console.log('\n[Fallback] Seri sayfalarından ürün alınamadı. Ana katalog deneniyor...');
            try {
                const products = await scrapeAllPages(CATALOG_URL, 'Tüm Tekerlekler');
                for (const p of products) {
                    const key = `${p.sku}__${p.name}`;
                    if (!seenSkus.has(key)) {
                        seenSkus.add(key);
                        p.category = autoAssignCategory(p);
                        allProducts.push(p);
                    }
                }
                cp.products = allProducts;
                cp.seenSkus = [...seenSkus];
                console.log(`  Fallback: ${allProducts.length} ürün.`);
            } catch {
                console.error('  [Fallback Error] Ana katalog da başarısız.');
            }
        }

        cp.phase = 'detail';
        await saveCheckpoint(cp);
        console.log(`\n[Summary] Toplam benzersiz ürün: ${cp.products.length}`);
    }

    // ── Step 3: Detail enrichment (kaldığı yerden) ───────────────────────
    if (cp.phase === 'detail') {
        const detailProducts = cp.products.filter(p => p.detailUrl);
        const startIdx = cp.detailOffset;

        if (detailProducts.length > 0 && startIdx < detailProducts.length) {
            console.log(`\n[Detail] ${startIdx > 0 ? `Devam ediliyor (${startIdx}/${detailProducts.length})` : `${detailProducts.length} ürün zenginleştiriliyor`}...`);
            const DETAIL_CHUNK = 3;

            for (let i = startIdx; i < detailProducts.length; i += DETAIL_CHUNK) {
                const chunk = detailProducts.slice(i, i + DETAIL_CHUNK);
                await Promise.all(chunk.map(p => scrapeDetailPage(p)));
                const done = Math.min(i + DETAIL_CHUNK, detailProducts.length);
                console.log(`  [Detail] ${done}/${detailProducts.length} zenginleştirildi`);

                // Checkpoint: detail offset güncelle
                cp.detailOffset = done;
                await saveCheckpoint(cp);
                await randomDelay();
            }
        }

        cp.phase = 'images';
        await saveCheckpoint(cp);
    }

    // ── Step 4: Image download (kaldığı yerden) ──────────────────────────
    if (cp.phase === 'images') {
        const startIdx = cp.imageOffset;
        console.log(`\n[Images] ${startIdx > 0 ? `Devam ediliyor (${startIdx}/${cp.products.length})` : `${cp.products.length} görsel işleniyor`}...`);

        const IMG_CHUNK = 5;
        for (let i = startIdx; i < cp.products.length; i += IMG_CHUNK) {
            const chunk = cp.products.slice(i, i + IMG_CHUNK);
            await Promise.all(chunk.map(async (p) => {
                const localPath = await downloadAndWatermark(p.imageUrl, p.sku);
                if (localPath) p.localImagePath = localPath;
            }));
            const done = Math.min(i + IMG_CHUNK, cp.products.length);
            console.log(`  [Images] ${done}/${cp.products.length} tamamlandı`);

            // Checkpoint: image offset + ürün listesi (localImagePath'ler kaydedilsin)
            cp.imageOffset = done;
            cp.products = cp.products; // referans zaten güncellendi
            await saveCheckpoint(cp);
        }

        cp.phase = 'done';
        await saveCheckpoint(cp);
    }

    // ── Step 5: Save final output ─────────────────────────────────────────
    await fs.writeFile(DATA_FILE, JSON.stringify(cp.products, null, 2), 'utf-8');
    console.log(`\n[Storage] ✓ ${cp.products.length} ürün ${DATA_FILE} dosyasına yazıldı.`);

    // Kategori dağılımı
    const catCounts: Record<string, number> = {};
    cp.products.forEach(p => {
        catCounts[p.category || 'Unknown'] = (catCounts[p.category || 'Unknown'] || 0) + 1;
    });
    console.log('\n[Stats] Kategori Dağılımı:');
    Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count} ürün`);
    });

    // Başarıyla tamamlandıysa checkpoint'i temizle
    await clearCheckpoint();
    console.log('\n[Checkpoint] ✓ Oturum tamamlandı, checkpoint silindi.');
    console.log('━━━ SCRAPER v4 COMPLETE ━━━');
}

main().catch((err: unknown) => {
    if (err instanceof Error) console.error('[FATAL]', err.message);
    process.exit(1);
});

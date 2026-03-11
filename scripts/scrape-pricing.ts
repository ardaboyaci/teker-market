/**
 * HYBRID PRICE ENGINE v5
 *
 * Değişiklikler (v4 → v5):
 * - Tüm ürünler işlenir (active + draft, deleted_at IS NULL)
 * - competitor_price, competitor_source, competitor_scraped_at alanlarına yazılır
 * - Akıllı eşleştirme: SKU token + boyutsal özellik (çap × genişlik)
 * - --dry-run flag: DB'ye yazmadan sadece log
 * - --limit=N flag: test için ilk N ürünü işle
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Supabase credentials eksik (.env.local)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN  = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// ── HTTP Client ───────────────────────────────────────────────────────────────
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection':      'keep-alive',
    },
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Türkçe fiyat formatı → number ────────────────────────────────────────────
function parsePrice(raw: string): number | null {
    if (!raw) return null;
    const trMatch = raw.match(/([\d]{1,3}(?:\.[\d]{3})*),(\d{2})/);
    if (trMatch) {
        const intPart = trMatch[1].replace(/\./g, '');
        return parseFloat(`${intPart}.${trMatch[2]}`);
    }
    const digits = raw.replace(/[^\d]/g, '');
    if (digits) return parseFloat(digits);
    return null;
}

function skuToQuery(sku: string): string {
    return encodeURIComponent(sku.trim()).replace(/%20/g, '+');
}

// ── Token tabanlı eşleşme skoru ───────────────────────────────────────────────
function tokenMatchScore(query: string, productName: string): number {
    const tokens = query.toUpperCase().match(/[A-Z]+|\d+/g) ?? [];
    const nameUp = productName.toUpperCase();
    if (!tokens.length) return 0;
    let hits = 0;
    for (const t of tokens) {
        if (t.length >= 2 && nameUp.includes(t)) hits++;
    }
    return hits / tokens.length;
}

// ── Boyutsal sorgu oluştur ────────────────────────────────────────────────────
// attributes: {"Tekerlek Çapı":"150 mm", "Tekerlek Genişliği":"45 mm"} → "150x45"
function buildDimensionQuery(attributes: Record<string, string> | null): string | null {
    if (!attributes) return null;
    const diam  = (attributes['Tekerlek Çapı']      || attributes['Çap']      || '').replace(/[^\d]/g, '');
    const width = (attributes['Tekerlek Genişliği'] || attributes['Genişlik'] || '').replace(/[^\d]/g, '');
    if (diam && width) return `${diam}x${width}`;
    if (diam) return diam;
    return null;
}

// ── 1. tekermarket.com.tr ─────────────────────────────────────────────────────
async function getClientPrice(sku: string): Promise<number | null> {
    const url = `https://www.tekermarket.com.tr/Arama?1&kelime=${skuToQuery(sku)}`;
    try {
        const { data } = await http.get(url, { validateStatus: () => true });
        const $ = cheerio.load(data);
        let best: { price: number; score: number } | null = null;

        $('.ItemOrj').each((_, card) => {
            const $card = $(card);
            const name =
                $card.find('.productName').first().text().trim() ||
                $card.find('a.detailLink').attr('title')?.trim() || '';
            const priceRaw =
                $card.find('.discountPriceSpan').first().text().trim() ||
                $card.find('.productPrice').first().text().trim() || '';
            const price = parsePrice(priceRaw);
            if (!name || !price) return;
            const score = tokenMatchScore(sku, name);
            if (score >= 0.5 && (!best || score > best.score)) best = { price, score };
        });

        return best ? (best as { price: number; score: number }).price : null;
    } catch {
        return null;
    }
}

// ── 2. e-tekerlek.com — çift sorgu stratejisi ─────────────────────────────────
async function getCompetitorPrice(
    sku: string,
    attributes: Record<string, string> | null
): Promise<{ price: number; matchType: 'sku' | 'dimension' } | null> {

    async function scrapeEtekerlek(query: string): Promise<{ name: string; price: number }[]> {
        const url = `https://www.e-tekerlek.com/arama?q=${skuToQuery(query)}`;
        try {
            const { data } = await http.get(url, { validateStatus: () => true });
            const $ = cheerio.load(data);
            const results: { name: string; price: number }[] = [];
            $('div.product-item').each((_, card) => {
                const $card = $(card);
                const name =
                    $card.find('.product-title').first().text().trim() ||
                    $card.find('a[title]').attr('title')?.trim() || '';
                const priceRaw = $card.find('span.product-price').first().text().trim();
                const price = parsePrice(priceRaw);
                if (name && price) results.push({ name, price });
            });
            return results;
        } catch {
            return [];
        }
    }

    type BestMatch = { price: number; score: number; matchType: 'sku' | 'dimension' } | null;
    let best: BestMatch = null;

    // 1. SKU ile dene
    const skuResults = await scrapeEtekerlek(sku);
    for (const r of skuResults) {
        const score = tokenMatchScore(sku, r.name);
        if (score >= 0.4 && (!best || score > best.score)) {
            best = { price: r.price, score, matchType: 'sku' };
        }
    }

    // 2. Skor düşükse boyutsal sorgu ile dene
    if (!best || best.score < 0.6) {
        const dimQuery = buildDimensionQuery(attributes);
        if (dimQuery) {
            await sleep(150);
            const dimResults = await scrapeEtekerlek(dimQuery);
            for (const r of dimResults) {
                const score = tokenMatchScore(dimQuery, r.name);
                if (score >= 0.6 && (!best || score > best.score)) {
                    best = { price: r.price, score, matchType: 'dimension' };
                }
            }
        }
    }

    return best ? { price: best.price, matchType: best.matchType } : null;
}

// ── price_history kayıt ───────────────────────────────────────────────────────
async function recordPriceHistory(
    productId: string,
    source: 'client' | 'competitor',
    oldPrice: number | null,
    newPrice: number,
    notes: string
) {
    const arrow = oldPrice === null ? '+' : newPrice > oldPrice ? '↑' : newPrice < oldPrice ? '↓' : '=';
    if (DRY_RUN) {
        console.log(`    [DRY] history/${source}: ${oldPrice ?? '—'} ${arrow} ₺${newPrice}`);
        return;
    }
    const { error } = await supabase.from('price_history').insert({
        product_id:    productId,
        price_type:    'sale',
        old_price:     oldPrice,
        new_price:     newPrice,
        change_reason: `[${source}] ${notes}`,
    });
    if (error) console.error(`    -> [history/${source}] ${error.message}`);
    else       console.log(`    -> [${source}] ₺${oldPrice ?? '—'} ${arrow} ₺${newPrice}`);
}

// ── Tek ürün işle ─────────────────────────────────────────────────────────────
interface Product {
    id: string;
    sku: string;
    name: string;
    sale_price: string | null;
    attributes: Record<string, string> | null;
}

interface Stat {
    processed: number;
    updated: number;
    competitorFound: number;
    errors: number;
}

async function processProduct(product: Product, stat: Stat): Promise<void> {
    stat.processed++;
    process.stdout.write(`\n  [${stat.processed}] SKU: ${product.sku} ... `);

    const [clientPrice, compResult] = await Promise.all([
        getClientPrice(product.sku),
        getCompetitorPrice(product.sku, product.attributes),
    ]);

    const compPrice = compResult?.price ?? null;
    const matchType = compResult?.matchType ?? null;

    console.log(
        `client=${clientPrice !== null ? `₺${clientPrice}` : 'yok'} | ` +
        `comp=${compPrice !== null ? `₺${compPrice} (${matchType})` : 'yok'}`
    );

    if (compPrice !== null) stat.competitorFound++;

    const oldPrice = product.sale_price ? parseFloat(product.sale_price) : null;

    if (clientPrice !== null) {
        const changed = oldPrice === null || Math.abs(oldPrice - clientPrice) > 0.01;
        if (changed) await recordPriceHistory(product.id, 'client', oldPrice, clientPrice, 'tekermarket.com.tr');
    }

    // Fiyat stratejisi
    let finalPrice: number | null = null;
    let strategy = '';

    if (clientPrice !== null && compPrice !== null) {
        if (clientPrice > compPrice) {
            finalPrice = Math.round(compPrice * 0.98 * 100) / 100;
            strategy = `Undercut -2% (client=₺${clientPrice}, comp=₺${compPrice})`;
        } else {
            finalPrice = clientPrice;
            strategy = `Kendi fiyat ucuz (client=₺${clientPrice})`;
        }
    } else if (clientPrice !== null) {
        finalPrice = clientPrice;
        strategy = `Sadece kendi site (₺${clientPrice})`;
    } else if (compPrice !== null) {
        finalPrice = Math.round(compPrice * 0.95 * 100) / 100;
        strategy = `Rakip -5% (₺${compPrice})`;
    } else {
        console.log('    -> Fiyat yok, atlanıyor.');
        await sleep(300);
        return;
    }

    console.log(`    -> Final: ₺${finalPrice} [${strategy}]`);

    if (DRY_RUN) {
        console.log(`    [DRY] sale_price=${finalPrice}, status=active${compPrice !== null ? `, competitor_price=${compPrice}` : ''}`);
        stat.updated++;
        await sleep(200);
        return;
    }

    const productUpdate: Record<string, unknown> = {
        sale_price: finalPrice,
        status: 'active',
    };

    if (compPrice !== null) {
        productUpdate.competitor_price      = compPrice;
        productUpdate.competitor_source     = 'e-tekerlek.com';
        productUpdate.competitor_scraped_at = new Date().toISOString();
    }

    const { error } = await supabase
        .from('products')
        .update(productUpdate)
        .eq('id', product.id);

    if (error) {
        console.error(`    -> DB hatası: ${error.message}`);
        stat.errors++;
    } else {
        stat.updated++;
    }

    await sleep(350);
}

// ── Ana akış ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ HYBRID PRICE ENGINE v5 ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN modu — DB\'ye yazılmıyor\n');
    console.log('  Kapsam : Tüm ürünler (active + draft)');
    console.log('  Kendi  : tekermarket.com.tr');
    console.log('  Rakip  : e-tekerlek.com (SKU + boyutsal eşleştirme)\n');

    let query = supabase
        .from('products')
        .select('id, sku, name, sale_price, attributes')
        .is('deleted_at', null)
        .order('sku');

    if (LIMIT) (query as any).limit(LIMIT);

    const { data: products, error } = await query;

    if (error) { console.error('[DB] Hata:', error.message); process.exit(1); }

    const total = products?.length ?? 0;
    console.log('[DB] ' + total + ' ürün' + (LIMIT ? ' (--limit=' + LIMIT + ')' : '') + ' bulundu.\n');

    const CHUNK = 10;
    const stat: Stat = { processed: 0, updated: 0, competitorFound: 0, errors: 0 };

    for (let i = 0; i < total; i += CHUNK) {
        const chunk = products!.slice(i, i + CHUNK);
        const cn    = Math.floor(i / CHUNK) + 1;
        const ct    = Math.ceil(total / CHUNK);
        console.log(`\n─── Chunk ${cn}/${ct} ───`);
        await Promise.all(chunk.map(p => processProduct(p as Product, stat)));
    }

    console.log('\n━━━ TAMAMLANDI ━━━');
    console.table({
        'İşlenen':             { Adet: stat.processed },
        'Güncellenen':         { Adet: stat.updated },
        'Rakip fiyat bulundu': { Adet: stat.competitorFound },
        'Hata':                { Adet: stat.errors },
    });
}

main();

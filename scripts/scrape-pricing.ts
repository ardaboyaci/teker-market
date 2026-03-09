/**
 * HYBRID PRICE ENGINE v4 — Gerçek DOM esas alınarak yazılmıştır
 *
 * Diagnosis (debug-scrape.ts) sonuçları:
 *
 * tekermarket.com.tr (Ticimax):
 *   Container : .ItemOrj  (52 adet — her ürün ikili geldiğinden ikiye böl)
 *   İsim      : .productName   → "ZBZ 200x50 Rulmansız Yedek Teker"
 *               a.detailLink[title]
 *   Fiyat     : .discountPriceSpan  → "₺302,98"   (KDV dahil, en temiz)
 *               .productPrice       → "₺302,98 KDV Dahil" (fallback)
 *   NOT       : Tüm API endpoint'leri 404 — HTML parse yeterli.
 *
 * e-tekerlek.com:
 *   Container : div.product-item  (22 adet)
 *   İsim      : .product-title    → "SMRG200x50 Gri Kauçuk..."
 *   Fiyat     : span.product-price → "622,08"  (TL/₺ dışarıda)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Supabase credentials eksik (.env.local)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── HTTP Client ───────────────────────────────────────────────────────────────
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection':      'keep-alive',
    },
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Türkçe fiyat formatı → number ────────────────────────────────────────────
// "₺1.924,97 KDV Dahil" → 1924.97
// "₺302,98"             → 302.98
// "622,08"              → 622.08
// "1.935,29"            → 1935.29
function parsePrice(raw: string): number | null {
    if (!raw) return null;

    // Rakam dışı her şeyi at, sadece sayısal kısmı al
    // Önce TR formatı: nokta=binlik, virgül=ondalık
    const trMatch = raw.match(/([\d]{1,3}(?:\.[\d]{3})*),(\d{2})/);
    if (trMatch) {
        const intPart = trMatch[1].replace(/\./g, '');
        return parseFloat(`${intPart}.${trMatch[2]}`);
    }

    // Sadece tam sayı (virgül/nokta yok)
    const digits = raw.replace(/[^\d]/g, '');
    if (digits) return parseFloat(digits);

    return null;
}

// ── SKU → query string ────────────────────────────────────────────────────────
function skuToQuery(sku: string): string {
    return encodeURIComponent(sku.trim()).replace(/%20/g, '+');
}

// ── Token tabanlı eşleşme skoru ───────────────────────────────────────────────
// "200x50" → ["200", "50"] — her token ürün adında aranır
// Tüm tokenlar eşleşirse score=1, hiçbiri eşleşmezse score=0
function matchScore(sku: string, productName: string): number {
    // Sayısal + harf token'lara böl: "ZBZ-200x50" → ["ZBZ","200","50"]
    const skuTokens  = sku.toUpperCase().match(/[A-Z]+|\d+/g) ?? [];
    const nameUpper  = productName.toUpperCase();
    if (!skuTokens.length) return 0;

    let hits = 0;
    for (const token of skuTokens) {
        if (token.length >= 2 && nameUpper.includes(token)) hits++;
    }
    return hits / skuTokens.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. tekermarket.com.tr — Ticimax HTML parse
//    Gerçek selektörler (debug doğrulamalı):
//      Container : .ItemOrj
//      İsim      : .productName  veya  a.detailLink[title]
//      Fiyat     : .discountPriceSpan  (en temiz, sadece rakam+sembol)
// ─────────────────────────────────────────────────────────────────────────────
async function getClientPrice(sku: string): Promise<number | null> {
    const url = `https://www.tekermarket.com.tr/Arama?1&kelime=${skuToQuery(sku)}`;

    try {
        const { data } = await http.get(url, { validateStatus: () => true });
        const $        = cheerio.load(data);

        let best: { price: number; score: number } | null = null;

        $('.ItemOrj').each((_, card) => {
            const $card = $(card);

            // İsim: önce .productName, ardından a[title] attribute
            const name =
                $card.find('.productName').first().text().trim() ||
                $card.find('a.detailLink').attr('title')?.trim() ||
                '';

            if (!name) return;

            // Fiyat: discountPriceSpan en temiz kaynak
            const priceRaw =
                $card.find('.discountPriceSpan').first().text().trim() ||
                $card.find('.productPrice').first().text().trim()      ||
                '';

            const price = parsePrice(priceRaw);
            if (!price) return;

            const score = matchScore(sku, name);
            if (score >= 0.5 && (!best || score > best.score)) {
                best = { price, score };
            }
        });

        return best ? best.price : null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. e-tekerlek.com — gerçek DOM (debug doğrulamalı)
//    Container : div.product-item
//    İsim      : .product-title
//    Fiyat     : span.product-price  → "622,08" (TL dışarıda)
// ─────────────────────────────────────────────────────────────────────────────
async function getCompetitorPrice(sku: string): Promise<number | null> {
    const url = `https://www.e-tekerlek.com/arama?q=${skuToQuery(sku)}`;

    try {
        const { data } = await http.get(url, { validateStatus: () => true });
        const $        = cheerio.load(data);

        let best: { price: number; score: number } | null = null;

        $('div.product-item').each((_, card) => {
            const $card = $(card);

            const name =
                $card.find('.product-title').first().text().trim() ||
                $card.find('a[title]').attr('title')?.trim()       ||
                '';

            const priceRaw = $card.find('span.product-price').first().text().trim();
            const price    = parsePrice(priceRaw);

            if (!name || !price) return;

            const score = matchScore(sku, name);
            if (score >= 0.4 && (!best || score > best.score)) {
                best = { price, score };
            }
        });

        return best ? best.price : null;
    } catch {
        return null;
    }
}

// ── price_history kayıt ───────────────────────────────────────────────────────
async function recordPriceHistory(
    productId: string,
    source: 'client' | 'competitor',
    oldPrice: number | null,
    newPrice: number,
    notes: string
) {
    const { error } = await supabase.from('price_history').insert({
        product_id:    productId,
        price_type:    'sale',
        old_price:     oldPrice,
        new_price:     newPrice,
        change_reason: `[${source}] ${notes}`,
    });

    if (error) {
        console.error(`    -> [history/${source}] ${error.message}`);
    } else {
        const arrow = oldPrice === null ? '+' : newPrice > oldPrice ? '↑' : newPrice < oldPrice ? '↓' : '=';
        console.log(`    -> [${source}] ${oldPrice ?? '—'} ${arrow} ₺${newPrice}`);
    }
}

// ── Batch işleyici ────────────────────────────────────────────────────────────
async function processBatch(products: any[]): Promise<number> {
    let updated = 0;

    for (const product of products) {
        process.stdout.write(`\n  SKU: ${product.sku} ... `);

        const [clientPrice, compPrice] = await Promise.all([
            getClientPrice(product.sku),
            getCompetitorPrice(product.sku),
        ]);

        console.log(
            `client=${clientPrice !== null ? `₺${clientPrice}` : 'yok'} | ` +
            `comp=${compPrice !== null ? `₺${compPrice}` : 'yok'}`
        );

        // Mevcut fiyatı oku
        const { data: current } = await supabase
            .from('products')
            .select('sale_price')
            .eq('id', product.id)
            .single();

        const oldPrice = current?.sale_price ? parseFloat(current.sale_price) : null;

        // price_history — kaynak bazlı
        if (clientPrice !== null) {
            const changed = oldPrice === null || Math.abs(oldPrice - clientPrice) > 0.01;
            if (changed) await recordPriceHistory(product.id, 'client', oldPrice, clientPrice, 'tekermarket.com.tr');
        }
        if (compPrice !== null) {
            const changed = oldPrice === null || Math.abs(oldPrice - compPrice) > 0.01;
            if (changed) await recordPriceHistory(product.id, 'competitor', oldPrice, compPrice, 'e-tekerlek.com');
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
                strategy = `Zaten ucuz (client=₺${clientPrice}, comp=₺${compPrice})`;
            }
        } else if (clientPrice !== null) {
            finalPrice = clientPrice;
            strategy = `Sadece kendi site (₺${clientPrice})`;
        } else if (compPrice !== null) {
            finalPrice = Math.round(compPrice * 0.95 * 100) / 100;
            strategy = `Rakip -5% (₺${compPrice})`;
        } else {
            console.log(`    -> Fiyat yok, atlanıyor.`);
            await sleep(300);
            continue;
        }

        console.log(`    -> Final: ₺${finalPrice} [${strategy}]`);

        const { error } = await supabase
            .from('products')
            .update({ sale_price: finalPrice, status: 'active' })
            .eq('id', product.id);

        if (error) {
            console.error(`    -> DB hatası: ${error.message}`);
        } else {
            updated++;
        }

        await sleep(350);
    }

    return updated;
}

// ── Ana akış ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ HYBRID PRICE ENGINE v4 ━━━');
    console.log('  tekermarket : .ItemOrj > .productName + .discountPriceSpan');
    console.log('  e-tekerlek  : div.product-item > .product-title + span.product-price\n');

    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name')
        .eq('status', 'draft')
        .order('sku');

    if (error) {
        console.error('[DB] Ürün hatası:', error.message);
        process.exit(1);
    }

    console.log(`[DB] ${products?.length ?? 0} draft ürün bulundu.\n`);

    const CHUNK = 10;
    let totalUpdated = 0;

    for (let i = 0; i < (products?.length ?? 0); i += CHUNK) {
        const chunk    = products!.slice(i, i + CHUNK);
        const chunkNum = Math.floor(i / CHUNK) + 1;
        const total    = Math.ceil(products!.length / CHUNK);
        console.log(`\n─── Chunk ${chunkNum}/${total} ───`);
        totalUpdated += await processBatch(chunk);
    }

    console.log(`\n━━━ TAMAMLANDI ━━━`);
    console.log(`İşlenen: ${products?.length ?? 0}  |  Güncellenen: ${totalUpdated}`);
}

main();

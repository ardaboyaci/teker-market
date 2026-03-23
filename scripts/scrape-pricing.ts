/**
 * HYBRID PRICE ENGINE v6
 *
 * Eşleştirme Mimarisi (Multi-Tier):
 *
 * TIER 1 — SKU Normalizasyonu (Kesin Eşleşme)
 *   "EA 01 ABP 150" → normalize → "EA01ABP150"
 *   Rakip ürün adında bu string geçiyor mu? Geçiyorsa kabul.
 *
 * TIER 2 — Özellik Doğrulamalı Geniş Arama (Kısıtlı Fuzzy)
 *   Arama: "EA ABP 150" gibi kısaltılmış sorgu
 *   Doğrulama (hepsi zorunlu):
 *     • Çap eşleşmesi  → rakip adında "150" veya "150mm" geçmeli
 *     • Hareket tipi   → Oynak/Sabit/Frenli aynı olmalı
 *     • Malzeme tipi   → Poliamid/Poliüretan/Lastik çelişmemeli
 *
 * Boyutsal kör arama (150x45 gibi) KAPATILDI — çok yanlış eşleşme üretiyor.
 *
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Supabase credentials eksik (.env.local)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// ── HTTP Client ───────────────────────────────────────────────────────────────
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
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
    const diam = (attributes['Tekerlek Çapı'] || attributes['Çap'] || '').replace(/[^\d]/g, '');
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

// ── SKU Normalizasyonu ────────────────────────────────────────────────────────
// "EA 01 ABP 150" → "EA01ABP150"  (boşluk, tire, nokta kaldır, büyük harf)
function normalizeSku(sku: string): string {
    return sku.toUpperCase().replace(/[\s\-_.]/g, '');
}

// ── EMES ürün adından hareket tipi çıkar ──────────────────────────────────────
// DB adı: "EA 01 ABP 150 F" → Frenli | "EA 01 ABP 150" → Sabit/Oynak
function extractMovementType(name: string): 'frenli' | 'sabit' | 'oynak' | null {
    const u = name.toUpperCase();
    if (u.includes(' F') || u.endsWith(' F') || u.includes('FRENL') || u.includes('FREN')) return 'frenli';
    if (u.includes('SABİT') || u.includes('SABIT')) return 'sabit';
    if (u.includes('OYNAK') || u.includes('DÖNER') || u.includes('DONER')) return 'oynak';
    return null;
}

// ── EMES ürün adından malzeme tipi çıkar ──────────────────────────────────────
function extractMaterial(name: string): string | null {
    const u = name.toUpperCase();
    if (u.includes('POLİÜRETAN') || u.includes('POLYURETAN') || u.includes(' PU ') || u.includes('POL.')) return 'poliuretan';
    if (u.includes('POLİAMİD') || u.includes('POLYAMID') || u.includes('NAYL') || u.includes('POLYAMİD')) return 'poliamid';
    if (u.includes('LASTİK') || u.includes('LASTIK') || u.includes('RUBBER')) return 'lastik';
    if (u.includes('KAUÇUK') || u.includes('KAUCUK')) return 'kaucuk';
    if (u.includes('DÖKÜM') || u.includes('DOKUM') || u.includes('CAST')) return 'dokum';
    return null;
}

// ── Rakip ürün adında malzeme çelişkisi var mı? ───────────────────────────────
// Bizim ürünümüz Poliüretan ise rakipte Kauçuk/Lastik/Döküm geçmemeli
function hasMaterialConflict(ourMaterial: string | null, competitorName: string): boolean {
    if (!ourMaterial) return false;
    const c = competitorName.toUpperCase();

    const byMaterial: Record<string, string[]> = {
        poliuretan: ['LASTİK', 'LASTIK', 'KAUÇUK', 'KAUCUK', 'DÖKÜM', 'DOKUM'],
        poliamid:   ['LASTİK', 'LASTIK', 'KAUÇUK', 'KAUCUK', 'DÖKÜM', 'DOKUM', 'POLİÜRETAN', 'POLYURETAN'],
        lastik:     ['POLİÜRETAN', 'POLYURETAN', 'DÖKÜM', 'DOKUM', 'POLİAMİD', 'POLYAMID'],
        kaucuk:     ['POLİÜRETAN', 'POLYURETAN', 'DÖKÜM', 'DOKUM', 'POLİAMİD', 'POLYAMID'],
        dokum:      ['LASTİK', 'LASTIK', 'POLİÜRETAN', 'POLYURETAN', 'POLİAMİD', 'POLYAMID'],
    };

    return (byMaterial[ourMaterial] ?? []).some(term => c.includes(term));
}

// ── Rakip ürün adında hareket tipi çelişkisi var mı? ─────────────────────────
function hasMovementConflict(ourType: ReturnType<typeof extractMovementType>, competitorName: string): boolean {
    if (!ourType) return false;
    const c = competitorName.toUpperCase();

    if (ourType === 'frenli') {
        // Bizimki frenli → rakipte "FREN" geçmeli; "SABİT" veya "OYNAK" tek başına geçmemeli
        const hasFren = c.includes('FREN');
        const hasSabit = c.includes('SABİT') || c.includes('SABIT');
        return hasSabit && !hasFren;
    }
    if (ourType === 'sabit') {
        // Bizimki sabit → rakipte Frenli olmamalı
        return c.includes('FRENL') || c.includes('FREN');
    }
    if (ourType === 'oynak') {
        // Bizimki oynak → rakipte Sabit olmamalı
        return c.includes('SABİT') || c.includes('SABIT');
    }
    return false;
}

// ── Çap eşleşmesi doğrula ────────────────────────────────────────────────────
// SKU'dan çap çıkar: "EA 01 ABP 150" → "150"
function extractDiameter(sku: string): string | null {
    const m = sku.match(/\b(\d{2,3})\s*$/);
    return m ? m[1] : null;
}

function hasDiameterMatch(diameter: string | null, competitorName: string): boolean {
    if (!diameter) return true; // çap bilinmiyorsa kontrol etme
    const c = competitorName.toUpperCase().replace(/[\s\-]/g, '');
    return c.includes(diameter);
}

// ── 2. e-tekerlek.com — Multi-Tier Eşleştirme ────────────────────────────────
async function getCompetitorPrice(
    sku: string,
    name: string,
    attributes: Record<string, string> | null
): Promise<{ price: number; matchType: 'tier1' | 'tier2' } | null> {

    async function scrapeEtekerlek(query: string): Promise<{ name: string; price: number }[]> {
        const url = `https://www.e-tekerlek.com/arama?q=${skuToQuery(query)}`;
        try {
            const { data } = await http.get(url, { validateStatus: () => true });
            const $ = cheerio.load(data);
            const results: { name: string; price: number }[] = [];

            // Fallback seçici zinciri — site yapısı değişirse sıradaki denenir
            const CARD_SELECTORS = [
                'div.product-item',
                '.product-card',
                '[class*="product-item"]',
                'li.product',
                '.col-sm-6',        // bootstrap grid ürün kartı
            ];
            const NAME_SELECTORS = [
                '.product-title',
                'h3',
                'h2',
                'a[title]',
                '[class*="title"]',
                '[class*="name"]',
            ];
            const PRICE_SELECTORS = [
                'span.product-price',
                '.product-price',
                '.current-price',
                '[class*="price"]',
            ];

            // En fazla sonuç döndüren kart seçiciyi bul
            let $cards = $();
            for (const sel of CARD_SELECTORS) {
                const found = $(sel);
                if (found.length > $cards.length) $cards = found;
            }

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

                const price = parsePrice(priceRaw);
                if (productName && price) results.push({ name: productName, price });
            });

            return results;
        } catch {
            return [];
        }
    }

    const normalizedOurSku = normalizeSku(sku);
    const ourMovement      = extractMovementType(name);
    const ourMaterial      = extractMaterial(name);
    const ourDiameter      = extractDiameter(sku);

    // ── TIER 1: SKU Normalizasyonu ────────────────────────────────────────────
    const tier1Results = await scrapeEtekerlek(sku);
    if (tier1Results.length === 0) {
        console.log(`      [T1] e-tekerlek'ten 0 sonuç — seçici uyuşmazlığı olabilir`);
    }
    for (const r of tier1Results) {
        const normalizedCompName = normalizeSku(r.name);
        if (normalizedCompName.includes(normalizedOurSku)) {
            return { price: r.price, matchType: 'tier1' };
        }
    }

    // ── TIER 2: Özellik Doğrulamalı Geniş Arama ──────────────────────────────
    const skuParts  = sku.trim().split(/\s+/);
    const meaningful = skuParts.filter(t => {
        if (/^[a-zA-Z]{2,4}$/.test(t)) return true; // EA, EB, ABP gibi 2-4 harf kodları
        if (/^\d{2,3}$/.test(t) && parseInt(t) > 30) return true; // çap değerleri (>30mm)
        return false;
    });
    const tier2Query = meaningful.join(' ');

    if (tier2Query !== sku) await sleep(150);

    const tier2Results = await scrapeEtekerlek(tier2Query);
    for (const r of tier2Results) {
        if (!hasDiameterMatch(ourDiameter, r.name)) {
            console.log(`      [T2 skip] çap uyuşmadı: "${r.name.slice(0, 50)}"`);
            continue;
        }
        if (hasMovementConflict(ourMovement, r.name)) {
            console.log(`      [T2 skip] hareket tipi çelişti: "${r.name.slice(0, 50)}"`);
            continue;
        }
        if (hasMaterialConflict(ourMaterial, r.name)) {
            console.log(`      [T2 skip] malzeme çelişti: "${r.name.slice(0, 50)}"`);
            continue;
        }
        const score = tokenMatchScore(sku, r.name);
        if (score < 0.4) {
            console.log(`      [T2 skip] token skoru düşük (${(score * 100).toFixed(0)}%): "${r.name.slice(0, 50)}"`);
            continue;
        }
        return { price: r.price, matchType: 'tier2' };
    }

    if (tier1Results.length > 0 || tier2Results.length > 0) {
        console.log(`      [miss] T1:${tier1Results.length} T2:${tier2Results.length} sonuç ama eşleşme yok`);
    }

    return null;
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
        product_id: productId,
        price_type: 'sale',
        old_price: oldPrice,
        new_price: newPrice,
        change_reason: `[${source}] ${notes}`,
    });
    if (error) console.error(`    -> [history/${source}] ${error.message}`);
    else console.log(`    -> [${source}] ₺${oldPrice ?? '—'} ${arrow} ₺${newPrice}`);
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
        getCompetitorPrice(product.sku, product.name, product.attributes),
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
        productUpdate.competitor_price = compPrice;
        productUpdate.competitor_source = 'e-tekerlek.com';
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
    console.log('  Kapsam : EMES serisi active ürünler (EA/EB/ED/EH/EK/EM/EP/ER/ET/EU/EV/EW/EZ/YT)');
    console.log('  Kendi  : tekermarket.com.tr');
    console.log('  Rakip  : e-tekerlek.com (SKU + boyutsal eşleştirme)\n');

    const EMES_PREFIXES = ['EA', 'EB', 'ED', 'EH', 'EK', 'EM', 'EP', 'ER', 'ET', 'EU', 'EV', 'EW', 'EZ', 'YT'];
    const prefixFilters = EMES_PREFIXES.map(p => `sku.ilike.${p}%`).join(',');

    let query = supabase
        .from('products')
        .select('id, sku, name, sale_price, attributes')
        .is('deleted_at', null)
        .eq('status', 'active')
        .or(prefixFilters)
        .order('sku');

    if (LIMIT) query = query.limit(LIMIT);

    const { data: products, error } = await query;

    if (error) { console.error('[DB] Hata:', error.message); process.exit(1); }

    const total = products?.length ?? 0;
    console.log('[DB] ' + total + ' EMES ürünü' + (LIMIT ? ' (--limit=' + LIMIT + ')' : '') + ' bulundu.\n');

    const CHUNK = 10;
    const stat: Stat = { processed: 0, updated: 0, competitorFound: 0, errors: 0 };

    for (let i = 0; i < total; i += CHUNK) {
        const chunk = products!.slice(i, i + CHUNK);
        const cn = Math.floor(i / CHUNK) + 1;
        const ct = Math.ceil(total / CHUNK);
        console.log(`\n─── Chunk ${cn}/${ct} ───`);
        await Promise.all(chunk.map(p => processProduct(p as Product, stat)));
    }

    console.log('\n━━━ TAMAMLANDI ━━━');
    console.table({
        'İşlenen': { Adet: stat.processed },
        'Güncellenen': { Adet: stat.updated },
        'Rakip fiyat bulundu': { Adet: stat.competitorFound },
        'Hata': { Adet: stat.errors },
    });
}

main();

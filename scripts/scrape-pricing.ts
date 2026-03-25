import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

function queryEncode(query: string): string {
    return encodeURIComponent(query.trim()).replace(/%20/g, '+');
}

function tokenMatchScore(query: string, productName: string): number {
    const tokens = query.toUpperCase().match(/[A-ZÖÇŞİĞÜ]+|\d+/g) ?? [];
    const nameUp = productName.toUpperCase();
    if (!tokens.length) return 0;
    let hits = 0;
    for (const t of tokens) {
        if (t.length >= 2 && nameUp.includes(t)) hits++;
    }
    return hits / tokens.length;
}

async function getClientPrice(sku: string): Promise<number | null> {
    const url = `https://www.tekermarket.com.tr/Arama?1&kelime=${queryEncode(sku)}`;
    try {
        const { data } = await http.get(url, { validateStatus: () => true });
        const $ = cheerio.load(data);
        let best: { price: number; score: number } | null = null;

        $('.ItemOrj').each((_, card) => {
            const $card = $(card);
            const name = $card.find('.productName').first().text().trim() || $card.find('a.detailLink').attr('title')?.trim() || '';
            const priceRaw = $card.find('.discountPriceSpan').first().text().trim() || $card.find('.productPrice').first().text().trim() || '';
            const price = parsePrice(priceRaw);
            if (!name || !price) return;
            const score = tokenMatchScore(sku, name);
            if (score >= 0.5 && (!best || score > best.score)) best = { price, score };
        });

        return best ? (best as any).price : null;
    } catch {
        return null; // silently fail
    }
}

async function getCompetitorPrice(sku: string, name: string): Promise<{ price: number; matchType: string } | null> {
    
    async function scrapeEtekerlek(searchQuery: string): Promise<{ name: string; price: number }[]> {
        if(!searchQuery || searchQuery.length < 3) return [];
        
        const url = `https://www.e-tekerlek.com/arama?q=${queryEncode(searchQuery)}`;
        try {
            const { data } = await http.get(url, { validateStatus: () => true });
            const $ = cheerio.load(data);
            const results: { name: string; price: number }[] = [];

            const CARD_SELECTORS = ['div.product-item', '.product-card', '[class*="product-item"]', 'li.product', '.col-sm-6'];
            const NAME_SELECTORS = ['.product-title', '.productName', '.urun-adi', '.name', 'h3', 'h2'];
            const PRICE_SELECTORS = ['.product-price', '.urun-fiyat', '.price', '.current-price', '.indirimliFiyat'];

            let $cards = $();
            for (const sel of CARD_SELECTORS) {
                const found = $(sel);
                if (found.length > $cards.length) $cards = found;
            }

            $cards.each((_, card) => {
                const $card = $(card);
                let productName = '';
                for (const sel of NAME_SELECTORS) {
                    const txt = $card.find(sel).first().text().trim();
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

    // TIER 1: Exact SKU format check
    const t1Results = await scrapeEtekerlek(sku);
    for (const r of t1Results) {
        if (r.name.toUpperCase().replace(/\s/g, '').includes(sku.toUpperCase().replace(/\s/g, ''))) {
            return { price: r.price, matchType: 'Exact SKU' };
        }
    }
    
    // TIER 2: Smart Name Search
    // Instead of using legacy SKU splits, we extract descriptive keywords from the Product Name
    const nameKeywords = name.toUpperCase()
        .replace(/TEKERLEK|TEKER|SABİT|OYNAK|FRENLİ|BUR\.|JANT|RULMANLI/g, '') // remove overly common words for search query
        .replace(/[^\w\sÇŞĞÜÖİ]/gi, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
    
    // Construct a clever dimension & material query (e.g., "100x35 Poliamid")
    const dimMatch = name.toUpperCase().match(/(\d+)\s*(X|\*)\s*(\d+)/i);
    const materialMatch = name.match(/poliamid|poliüretan|pvc|lastik|kauçuk|zamak|pik|döküm/i);
    
    const cleverQueryParts = [];
    if (dimMatch) cleverQueryParts.push(`${dimMatch[1]}x${dimMatch[3]}`);
    if (materialMatch) cleverQueryParts.push(materialMatch[0]);
    if (nameKeywords.length > 0) cleverQueryParts.push(nameKeywords[0]); // add an identifying keyword
    
    const smartQuery = cleverQueryParts.join(' ').trim();
    
    // Only query if it's different and meaningful
    if (smartQuery !== sku && smartQuery.length >= 3) {
        await sleep(200);
        const t2Results = await scrapeEtekerlek(smartQuery);
        for (const r of t2Results) {
            // Validate: Must score high locally
            const score = tokenMatchScore(name, r.name);
            if (score > 0.6) {
                return { price: r.price, matchType: `Smart Name (${Math.round(score*100)}%)` };
            }
        }
    }

    return null;
}

async function recordPriceHistory(productId: string, source: string, oldPrice: number | null, newPrice: number, notes: string) {
    const arrow = oldPrice === null ? '+' : newPrice > oldPrice ? '↑' : newPrice < oldPrice ? '↓' : '=';
    if (DRY_RUN) return;
    await supabase.from('price_history').insert({
        product_id: productId, price_type: 'sale', old_price: oldPrice, new_price: newPrice, change_reason: `[${source}] ${notes}`,
    });
}

async function processProduct(p: any, stat: any) {
    stat.processed++;
    process.stdout.write(`\n[${stat.processed}] SKU: ${p.sku} | Name: ${p.name.slice(0, 30)}... \n`);

    const clientPrice = await getClientPrice(p.sku);
    const compResult = await getCompetitorPrice(p.sku, p.name);

    const compPrice = compResult?.price ?? null;
    const matchType = compResult?.matchType ?? null;

    console.log(`  └─> Client: ${clientPrice ? '₺'+clientPrice : 'Yok'} | Rakip: ${compPrice ? '₺'+compPrice + ' ('+matchType+')' : 'Yok'}`);

    if (compPrice) stat.competitorFound++;

    const oldPrice = p.sale_price ? parseFloat(p.sale_price) : null;
    if (clientPrice !== null && (oldPrice === null || Math.abs(oldPrice - clientPrice) > 0.01)) {
        await recordPriceHistory(p.id, 'client', oldPrice, clientPrice, 'tekermarket.com.tr');
    }

    let finalPrice = null;
    let strategy = '';

    if (clientPrice !== null && compPrice !== null) {
        if (clientPrice > compPrice) {
            finalPrice = Math.round(compPrice * 0.98 * 100) / 100;
            strategy = `Undercut -2% (₺${compPrice})`;
        } else {
            finalPrice = clientPrice;
            strategy = `Zaten ucuz (₺${clientPrice})`;
        }
    } else if (clientPrice !== null) {
        finalPrice = clientPrice;
        strategy = `Sadece bizde var (₺${clientPrice})`;
    } else if (compPrice !== null) {
        finalPrice = Math.round(compPrice * 0.95 * 100) / 100;
        strategy = `Sadece rakipte var -5% (₺${compPrice})`;
    } else {
        await sleep(300);
        return;
    }

    console.log(`  └─> Karar: ₺${finalPrice} [${strategy}]`);

    if (DRY_RUN) {
        stat.updated++;
        await sleep(100);
        return;
    }

    const updates: any = { sale_price: finalPrice, status: 'active' };
    if (compPrice !== null) {
        updates.competitor_price = compPrice;
        updates.competitor_source = 'e-tekerlek.com';
        updates.competitor_scraped_at = new Date().toISOString();
    }

    const { error } = await supabase.from('products').update(updates).eq('id', p.id);
    if (!error) stat.updated++;
    else stat.errors++;

    await sleep(250);
}

async function main() {
    console.log('━━━ SMART HYBRID PRICE ENGINE v6 ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN modu — DB\'ye yazılmıyor\n');

    let query = supabase
        .from('products')
        .select('id, sku, name, sale_price')
        .is('deleted_at', null)
        .eq('status', 'active')
        .order('sku');

    if (LIMIT) query = query.limit(LIMIT);

    const { data: products, error } = await query;
    if (error) { console.error('DB Error:', error.message); return; }

    const total = products?.length ?? 0;
    console.log(`[DB] ${total} ürün analiz edilecek.\n`);

    const stat = { processed: 0, updated: 0, competitorFound: 0, errors: 0 };
    
    // Process serially instead of parallel to respect competitor rate limits
    for (const p of products!) {
        await processProduct(p, stat);
    }

    console.log('\n━━━ TAMAMLANDI ━━━');
    console.table(stat);
}

main();

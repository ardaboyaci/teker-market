import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Invalid Supabase Credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const client = axios.create({
    httpsAgent,
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
});

// Sleep function to prevent rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function parsePriceToNumber(priceText: string): number | null {
    if (!priceText) return null;
    // Extract numbers and commas (e.g. "₺518,17 KDV Dahil" -> "518,17")
    const match = priceText.match(/[\d.]+,[\d]+/);
    if (match) {
        const cleaned = match[0].replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned);
    }
    // Handle integer prices or dot decimals
    const num = parseFloat(priceText.replace(/[^\d.]/g, ''));
    return isNaN(num) ? null : num;
}

// Scrape competitor (e-tekerlek.com)
async function getCompetitorPrice(sku: string): Promise<number | null> {
    const query = encodeURIComponent(sku);
    try {
        const url = `https://www.e-tekerlek.com/arama?q=${query.replace(/%20/g, '+')}`;
        const { data } = await client.get(url);
        const $ = cheerio.load(data);
        let bestMatchPrice: number | null = null;

        const cards = $('.product-item, .product-card, .col-md-4, .col-md-3');
        cards.each((_, el) => {
            const name = $(el).find('.product-title, .product-name, h3').text().replace(/\s+/g, ' ').trim();
            const priceText = $(el).find('.product-price, .price, .current-price').text();

            // robust space-insensitive match
            const baseSku = sku.replace(/\s+/g, '').toLowerCase();
            const nameClean = name.replace(/\s+/g, '').toLowerCase();

            if (nameClean.includes(baseSku) && priceText) {
                bestMatchPrice = parsePriceToNumber(priceText);
                return false; // Break
            }
        });
        return bestMatchPrice;
    } catch {
        return null;
    }
}

// Scrape our active site (tekermarket.com.tr)
async function getOurSitePrice(sku: string): Promise<number | null> {
    const query = encodeURIComponent(sku);
    try {
        const url = `https://www.tekermarket.com.tr/Arama?1&kelime=${query.replace(/%20/g, '+')}`;
        const { data } = await client.get(url, { validateStatus: () => true });
        const $ = cheerio.load(data);
        let bestMatchPrice: number | null = null;

        const cards = $('.productItem, .ItemOrj');
        cards.each((_, el) => {
            const name = $(el).find('.productName, .detailLink').text().replace(/\s+/g, ' ').trim();
            const priceText = $(el).find('.discountPrice, .productPrice').text();

            const baseSku = sku.replace(/\s+/g, '').toLowerCase();
            const nameClean = name.replace(/\s+/g, '').toLowerCase();

            if (nameClean.includes(baseSku) && priceText) {
                bestMatchPrice = parsePriceToNumber(priceText);
                return false;
            }
        });
        return bestMatchPrice;
    } catch {
        return null;
    }
}

async function processBatch(products: any[]) {
    let updateCount = 0;

    for (const product of products) {
        process.stdout.write(`\n[Engine] Analyzing SKU: ${product.sku} ... `);

        const [compPrice, ourPrice] = await Promise.all([
            getCompetitorPrice(product.sku),
            getOurSitePrice(product.sku)
        ]);

        let finalPrice = null;
        let strategy = '';

        if (compPrice && ourPrice) {
            // Both found: Competitive Pricing Strategy
            if (ourPrice > compPrice) {
                finalPrice = compPrice * 0.98; // Undercut by 2%
                strategy = `Undercut Competitor (Our: ${ourPrice}, Comp: ${compPrice})`;
            } else {
                finalPrice = ourPrice;
                strategy = `We are cheaper/equal (Our: ${ourPrice}, Comp: ${compPrice})`;
            }
        } else if (ourPrice) {
            // Only we have it
            finalPrice = ourPrice;
            strategy = `Existing Site Match (Our: ${ourPrice})`;
        } else if (compPrice) {
            // Only competitor has it
            finalPrice = compPrice * 0.95; // Aggressive 5% undercut
            strategy = `Competitor Match -5% (Comp: ${compPrice})`;
        } else {
            console.log(`❌ No prices found.`);
            continue; // Skip update
        }

        // Round to 2 decimals
        finalPrice = Math.round(finalPrice * 100) / 100;
        console.log(`✅ Set to ₺${finalPrice} [${strategy}]`);

        // Update database
        const { error } = await supabase
            .from('products')
            .update({
                sale_price: finalPrice,
                status: 'active'
            })
            .eq('id', product.id);

        if (error) {
            console.error(`  -> DB Error: ${error.message}`);
        } else {
            updateCount++;
        }

        await sleep(500); // Politeness delay
    }
    return updateCount;
}

async function main() {
    console.log('━━━ STARTING INTELLIGENT PRICE ENGINE ━━━');

    // Fetch draft products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name')
        .eq('status', 'draft')
        .order('sku');

    if (error) {
        console.error('[DB] Failed to fetch products:', error.message);
        process.exit(1);
    }

    console.log(`[Engine] Found ${products.length} products needing price calculation.`);

    // Process in chunks to avoid overwhelming the memory/logs
    const chunkSize = 10;
    let totalUpdated = 0;

    for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);
        console.log(`\n--- Processing Chunk ${i / chunkSize + 1}/${Math.ceil(products.length / chunkSize)} ---`);
        const updated = await processBatch(chunk);
        totalUpdated += updated;
    }

    console.log(`\n━━━ PRICE ENGINE COMPLETE ━━━`);
    console.log(`Total Drafts Processed: ${products.length}`);
    console.log(`Total Prices Updated & Activated: ${totalUpdated}`);
}

main();

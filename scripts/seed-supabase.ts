import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({ path: '.env.local' });

// Fix: Strict Environment Checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseUrl.startsWith('http') || !supabaseServiceKey) {
    console.error('[Error] Invalid or missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts', 'output');
const DATA_FILE = path.join(OUTPUT_DIR, 'products.json');
const BUCKET_NAME = 'product-media';

// Fix: Import Shared Type
import { ScrapedProduct } from './types';

// Fix: Bucket Existence Check
async function ensureBucketExists() {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error('[Storage] Error listing buckets:', error.message);
        process.exit(1);
    }

    if (!buckets.some(b => b.name === BUCKET_NAME)) {
        console.log(`[Storage] Bucket '${BUCKET_NAME}' not found. Attempting to create...`);
        const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
        if (createError) {
            console.error('[Storage] Failed to create bucket:', createError.message);
            process.exit(1);
        }
    }
}

async function purgeOldData() {
    console.log('[Purge] Wiping old products from the database...');
    const { error: dbError } = await supabase
        .from('products')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (dbError) console.error('[Purge Error] DB:', dbError.message);

    console.log('[Purge] Emptying the product-media storage bucket...');
    const { data: files } = await supabase.storage.from(BUCKET_NAME).list('products');

    if (files && files.length > 0) {
        // Group files into chunks of 100 max per supabase API limits
        const chunkSize = 100;
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            const filePaths = chunk.map(file => `products/${file.name}`);
            const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove(filePaths);
            if (storageError) console.error('[Purge Error] Storage Chunk:', storageError.message);
        }
    }
    console.log('[Purge] Clean up complete.');
}

// Category name → ID cache (populated once at startup)
let categoryCache: Map<string, string> = new Map();

async function loadCategoryCache() {
    const { data, error } = await supabase
        .from('categories')
        .select('id, name');

    if (!error && data) {
        for (const cat of data) {
            categoryCache.set(cat.name, cat.id);
        }
        console.log(`[Categories] Loaded ${categoryCache.size} categories from DB.`);
    }
}

function findCategoryId(categoryName?: string): string | null {
    if (!categoryName) return null;
    // Exact match first
    if (categoryCache.has(categoryName)) return categoryCache.get(categoryName)!;
    // Fuzzy match: check if the category name contains a known key
    for (const [name, id] of categoryCache) {
        if (categoryName.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(categoryName.toLowerCase())) {
            return id;
        }
    }
    return null;
}

async function processProduct(item: ScrapedProduct, index: number): Promise<boolean> {
    let publicUrl = '';
    const safeSku = item.sku.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${safeSku}.webp`;
    const filePath = `products/${fileName}`;

    // Upload image to Supabase Storage
    if (item.localImagePath) {
        try {
            const imageBuffer = await fs.readFile(item.localImagePath);
            const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, imageBuffer, {
                upsert: true,
                contentType: 'image/webp',
            });

            if (error) {
                console.error(`[Storage Error] ${item.sku}:`, error.message);
                return false;
            } else {
                const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
                publicUrl = data.publicUrl;
            }
        } catch (e: unknown) {
            if (e instanceof Error) console.error(`[FS Error] ${item.sku}:`, e.message);
            return false;
        }
    }

    // Unique slug
    const baseSlug = item.name.toLowerCase().trim().replace(/[\s\W-]+/g, '-');
    const uniqueSlug = `${baseSlug}-${safeSku}-${index}`;

    // Pricing logic: draft if unpriced
    const isUnpriced = (!item.sale_price || item.sale_price === "0.00");
    const saleNumeric = isUnpriced ? null : Number(item.sale_price).toFixed(4);

    // Build rich attributes JSON from scraped specs
    const attributes: Record<string, string> = {};
    if (item.wheelDiameter) attributes['Tekerlek Çapı'] = item.wheelDiameter;
    if (item.wheelWidth) attributes['Tekerlek Genişliği'] = item.wheelWidth;
    if (item.loadCapacity) attributes['Taşıma Kapasitesi'] = item.loadCapacity;
    if (item.wheelType) attributes['Tip'] = item.wheelType;
    if (item.coatingType) attributes['Kaplama Cinsi'] = item.coatingType;
    if (item.series) attributes['Seri'] = item.series;

    // Match category
    const categoryId = findCategoryId(item.category);

    const productPayload = {
        sku: item.sku,
        name: item.name,
        slug: uniqueSlug,
        image_url: publicUrl || item.imageUrl,
        cost_price: null,
        sale_price: saleNumeric,
        quantity_on_hand: 50,
        status: isUnpriced ? 'draft' : 'active',
        description: item.description || null,
        external_url: item.detailUrl || null,
        attributes: Object.keys(attributes).length > 0 ? attributes : null,
        category_id: categoryId,
    };

    const { error: dbError } = await supabase
        .from('products')
        .upsert(productPayload, { onConflict: 'sku' });

    if (dbError) {
        console.error(`[DB Error] ${item.sku}:`, dbError.message);
        // Compensating transaction: remove uploaded image if DB insert fails
        if (publicUrl) {
            console.log(`[Rollback] Reverting image for ${item.sku}...`);
            await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        }
        return false;
    }

    return true;
}

async function main() {
    console.log('━━━ TEKER MARKET SEED v3 ━━━');
    await ensureBucketExists();
    await loadCategoryCache();

    const isFullReset = process.argv.includes('--full-reset');
    if (isFullReset) {
        await purgeOldData();
    } else {
        console.log('[Seed] Incremental update mode (skipping DB Purge). Use --full-reset to wipe old data.');
    }

    try {
        const rawData = await fs.readFile(DATA_FILE, 'utf-8');
        const products: ScrapedProduct[] = JSON.parse(rawData);
        console.log(`[Seed] Found ${products.length} products. Starting concurrent upload...`);

        // Fix: Summary logging
        let successCount = 0;
        let failCount = 0;

        // Fix: Promise.All Concurrency (Chunked 5 at a time)
        const chunkSize = 5;
        for (let i = 0; i < products.length; i += chunkSize) {
            const chunk = products.slice(i, i + chunkSize);

            const results = await Promise.all(
                chunk.map((item, indexOffset) => processProduct(item, i + indexOffset))
            );

            const successes = results.filter(r => r).length;
            successCount += successes;
            failCount += (chunk.length - successes);

            console.log(`[Progress] Inserted ${successCount + failCount} / ${products.length} items...`);
        }

        console.log('\n--- SEED REPORT ---');
        console.table({
            Total: products.length,
            Success: successCount,
            Failed: failCount
        });
        console.log('--- AI-REFACTORED SEED COMPLETE ---');

    } catch (error: unknown) {
        if (error instanceof Error) console.error('[Error] Execution failed:', error.message);
        process.exit(1);
    }
}

main();

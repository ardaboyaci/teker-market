import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    try {
        const rawData = fs.readFileSync('scripts/excel_skus.json', 'utf8');
        const excelSkus: string[] = JSON.parse(rawData);

        // Supabase has limits on 'in' clause size. We might need to fetch all active empty descriptions first, then filter locally.
        const { data: products, error } = await supabase
            .from('products')
            .select('id, sku, name')
            .is('deleted_at', null)
            .eq('status', 'active')
            .or('description.is.null,description.eq.""')
            .limit(5000); // Fetch a big chunk of empty descriptions

        if (error) {
             console.error('Error fetching products:', error.message);
             return;
        }

        if (!products || products.length === 0) {
            console.log('No empty description products found in DB.');
            return;
        }

        // Filter products whose SKU is in the Excel list
        // Excel SKUs might have trailing spaces or different cases, let's normalize
        const normalizedExcelSkus = new Set(excelSkus.map(s => s.trim().toUpperCase()));

        const matchedProducts = products.filter(p => p.sku && normalizedExcelSkus.has(p.sku.trim().toUpperCase()));

        console.log(`Found ${matchedProducts.length} matching products without descriptions.`);
        
        // Take the first 50
        const batch = matchedProducts.slice(0, 50);
        console.log('\n--- MATCHED BATCH (50 ITEMS) ---');
        console.log(JSON.stringify(batch, null, 2));

    } catch (e) {
        console.error('Script Error:', e);
    }
}

run();

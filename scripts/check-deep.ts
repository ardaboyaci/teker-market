import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    try {
        console.log("Loading Deep Excel Text data...");
        const rawData = fs.readFileSync('scripts/deep_excel_text.json', 'utf8');
        const excelDataRaw: string[] = JSON.parse(rawData);
        
        // Create a fast lookup Set (normalize to uppercase and trim)
        const excelTextSet = new Set(excelDataRaw.map(s => s.trim().toUpperCase()));
        console.log(`Loaded ${excelTextSet.size} unique strings from Excel.`);

        let allMatchedProducts: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        console.log("Scanning Supabase for all active products missing descriptions...");
        
        let totalBlank = 0;

        while (hasMore) {
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name')
                .is('deleted_at', null)
                .eq('status', 'active')
                .or('description.is.null,description.eq.""')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                 console.error('Error fetching page:', error.message);
                 break;
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }
            
            totalBlank += data.length;

            for (const p of data) {
                if (p.sku && excelTextSet.has(p.sku.trim().toUpperCase())) {
                    allMatchedProducts.push(p);
                }
            }
            page++;
        }

        console.log(`Scanned ${totalBlank} blank products.`);
        console.log(`\n!!! FINAL MATCH: Found ${allMatchedProducts.length} products matching the ENTIRE Excel sheet text. !!!`);
        
        if (allMatchedProducts.length > 0) {
            console.log("\nSample of missing products found now:");
            console.log(JSON.stringify(allMatchedProducts.slice(0, 10).map(p => p.sku), null, 2));
        } else {
            console.log("STILL zero matches! The SKUs in the DB are somehow completely different from the text in the Excel sheet!");
        }

    } catch (e) {
        console.error('Script Error:', e);
    }
}

run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    try {
        console.log("Analyzing product database...");
        
        // Let's get a sample of products to see their structure
        const { data: sample, error: sampleErr } = await supabase
            .from('products')
            .select('sku, name, description, brand, supplier_id')
            .limit(5);
            
        if (sample) {
            console.log("Sample product format:", Object.keys(sample[0]));
        }

        // 1. Total active products
        const { count: totalActive, error: err1 } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('status', 'active');
        console.log(`Total active products in DB: ${totalActive}`);

        // 2. Total active products without description
        const { count: totalEmptyDesc, error: err2 } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('status', 'active')
            .or('description.is.null,description.eq.""');
        console.log(`Total active products WITHOUT description: ${totalEmptyDesc}`);

        // 3. Let's see if there's a specific Emes prefix or supplier we can use
        // Check how many products start with AÇ, KT, EM, 0
        const { count: emesLike, error: err3 } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('status', 'active');
            
        // Fetch 5000 random products to see how we can identify Emes if we don't have supplier_id
        const { data: products, error: err4 } = await supabase
            .from('products')
            .select('sku, name, description, short_description')
            .is('deleted_at', null)
            .eq('status', 'active')
            .limit(10000);
            
        if (products) {
            const hasDescription = products.filter(p => p.description && p.description.trim() !== "");
            console.log(`Out of ${products.length} sampled products, ${hasDescription.length} HAVE a description.`);
            
            // Look for Emes markers like "ALÜMİNYUM ÇARK", "KAUÇUK", "BUR.POLİAMİD" etc
            // Often Emes codes are numeric with 4 digits like 0169, 0406
            const potentialEmes = products.filter(p => {
               const s = p.sku.toUpperCase();
               const n = p.name.toUpperCase();
               return s.startsWith('0') || s.startsWith('AÇ') || s.startsWith('EM') || s.startsWith('KT') || s.startsWith('11-') || n.includes('TEKERLEK') || n.includes('DÖKÜM') || n.includes('KAUÇUK');
            });
            console.log(`Potential Emes products in sample: ${potentialEmes.length}`);
            
            const emesWithoutDesc = potentialEmes.filter(p => !p.description || p.description.trim() === "");
            console.log(`Potential Emes products WITHOUT description in sample: ${emesWithoutDesc.length}`);
            
            // Print a few missing ones that didn't match the Excel to see what they look like
            // Let's read excel skus to compare
            const fs = require('fs');
            const excelData = fs.readFileSync('scripts/excel_skus.json', 'utf8');
            const excelSkus: string[] = JSON.parse(excelData);
            const normalizedExcelSkus = new Set(excelSkus.map(s => s.trim().toUpperCase()));
            
            const missedEmes = emesWithoutDesc.filter(p => !normalizedExcelSkus.has(p.sku.trim().toUpperCase()));
            console.log(`\nSample of potential Emes products that WERE NOT in the exact Excel SKU list (missing description):`);
            console.log(JSON.stringify(missedEmes.slice(0, 10), null, 2));
            console.log(`Total missed in this 10k sample: ${missedEmes.length}`);
        }

    } catch (e) {
        console.error('Script Error:', e);
    }
}

run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    try {
        console.log("================ VERIFICATION REPORT ================\n");
        
        // Count total products in DB
        const { count: total, error: e1 } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('status', 'active');
        
        // Count products containing our generated signature (e.g., <h2>...)
        // Or simply count products that DO HAVE a description
        const { count: hasDesc, error: e2 } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('status', 'active')
            .not('description', 'is', null)
            .neq('description', '');

        // Count products updated TODAY
        const todayStr = new Date().toISOString().split('T')[0];
        const { count: updatedToday, error: e3 } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('status', 'active')
            .gte('updated_at', todayStr);

        console.log(`1. Total Active Products in System: ${total}`);
        console.log(`2. Total Active Products WITH Descriptions: ${hasDesc}`);
        console.log(`3. Total Active Products UPDATED TODAY (Since we started): ${updatedToday}`);
        
        console.log("\n--- Random Sample of the Generated HTML SEO Descriptions (5 Items) ---");
        
        // Fetch 5 random products updated today
        const { data: sample, error: e4 } = await supabase
            .from('products')
            .select('sku, name, description, short_description')
            .is('deleted_at', null)
            .eq('status', 'active')
            .gte('updated_at', todayStr)
            .neq('description', '')
            .limit(5);

        if (sample && sample.length > 0) {
            sample.forEach((p, index) => {
                console.log(`\n📦 ÜRÜN ${index + 1}: ${p.sku} - ${p.name}`);
                console.log(`--------------------------------------------------`);
                console.log(`🔹 KISA AÇIKLAMA (Meta): ${p.short_description}`);
                console.log(`🔹 UZUN SEO/HTML AÇIKLAMASI:\n${p.description}`);
            });
        }
        
        console.log("\n======================================================\n");

    } catch (e) {
        console.error('Verification Script Error:', e);
    }
}

run();

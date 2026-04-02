import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await sb.from('products').select('sku,name').in('meta->>source', ['emes_2026','emes_kulp_2026','yedek_emes_2026']).is('image_url', null).limit(30);
    data?.forEach(p => {
        const compact = (p.name || p.sku).trim().replace(/\s+/g, '').toUpperCase();
        console.log(`name="${p.name}" → compact="${compact}"`);
    });
}
main().catch(console.error);

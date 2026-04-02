import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  // Önce SKU formatını kontrol et
  const { data: sample } = await sb.from('products')
    .select('sku, name, description')
    .ilike('sku', '%YEDEK%')
    .limit(10);
  console.log('YEDEK içeren SKUlar:');
  sample?.forEach(p => console.log(`  [${p.sku}] desc: ${p.description ? p.description.slice(0,30) : 'BOŞ'}`));
  
  const { data: sample2 } = await sb.from('products')
    .select('sku, name, description')
    .ilike('sku', '%emes%')
    .is('deleted_at', null)
    .limit(5);
  console.log('\nemes içeren örnek:');
  sample2?.forEach(p => console.log(`  [${p.sku}]`));
}
main().catch(console.error);

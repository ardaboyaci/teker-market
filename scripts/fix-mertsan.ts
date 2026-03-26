import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // MERTSAN ürünlerini gör
  const { data } = await supabase
    .from('products')
    .select('id, sku, name, description, short_description')
    .filter('meta->>source', 'eq', 'mertsan_2026')
    .limit(20);
  
  console.log('MERTSAN ürünleri:');
  data?.forEach(p => {
    console.log(`SKU: ${p.sku}`);
    console.log(`Ad:  ${p.name}`);
    console.log(`Açıklama (50c): ${(p.description || 'BOŞ').substring(0, 80)}`);
    console.log();
  });
}
main().catch(console.error);

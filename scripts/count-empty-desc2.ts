import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Önce source_name sütunu ne içeriyor bakalım
  const { data } = await supabase.from('products').select('source_name').limit(20);
  const names = [...new Set(data?.map(d => d.source_name))];
  console.log('Mevcut source_name değerleri:', names);
  
  // Boş desc'li ürünler
  const { data: emptyProds } = await supabase.from('products').select('id, name, sku, source_name, description, short_description').is('description', null).limit(10);
  console.log('\nBoş description örnekleri:');
  emptyProds?.forEach(p => console.log(`  source=${p.source_name} | sku=${p.sku} | name=${p.name?.substring(0,40)}`));
}
main().catch(console.error);

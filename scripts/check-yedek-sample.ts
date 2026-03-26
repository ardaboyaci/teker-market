import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await sb.from('products')
    .select('sku, name, base_price, description')
    .ilike('sku', 'YEDEK-%')
    .or('description.is.null,description.eq.')
    .is('deleted_at', null)
    .order('name')
    .limit(20);
  console.log(`Örnek ürünler (boş açıklamalılar):`);
  data?.forEach(p => console.log(`  [${p.sku}] ${p.name}`));
}
main().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data, error } = await sb.from('products')
    .select('sku, name, base_price')
    .ilike('sku', 'YEDEK_EMES-%')
    .or('description.is.null,description.eq.')
    .is('deleted_at', null)
    .order('name')
    .limit(50);
  if (error) { console.error(error.message); return; }
  console.log(`${data?.length} ürün (ilk 50):`);
  data?.forEach(p => console.log(`  ${p.sku} | ${p.name}`));
}
main().catch(console.error);

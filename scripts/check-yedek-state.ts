import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { count: total } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .filter('meta->>source', 'eq', 'yedek_emes_2026');

  const { count: noDesc } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('description', null);

  const { count: noName } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('name', null);

  // name sayı olan
  const { data: numNameSample } = await supabase
    .from('products')
    .select('name')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .limit(5);
  
  console.log(`Toplam: ${total}`);
  console.log(`Açıklama yok (null): ${noDesc}`);
  console.log(`Ad yok (null): ${noName}`);
  console.log('\nÖrnek name değerleri:');
  numNameSample?.forEach(p => console.log(' ', p.name));
}
main().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true }).like('meta->>source', 'emes%');
  const { count: withImg } = await supabase.from('products').select('*', { count: 'exact', head: true }).like('meta->>source', 'emes%').not('image_url', 'is', null);
  const { count: noImg } = await supabase.from('products').select('*', { count: 'exact', head: true }).like('meta->>source', 'emes%').is('image_url', null);
  const { data: samples } = await supabase.from('products').select('sku, name, image_url').like('meta->>source', 'emes%').limit(8);
  console.log('EMES toplam:', total);
  console.log('Görselli:', withImg);
  console.log('Görselsiz:', noImg);
  console.log('\nÖrnek SKUlar:');
  samples?.forEach(p => console.log(' ', p.sku, '-', p.name?.substring(0, 60)));
}
main().catch(console.error);

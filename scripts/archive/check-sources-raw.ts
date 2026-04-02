import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // products tablosundaki sütunları ve ilk kayıt
  const { data, error } = await supabase.from('products').select('*').limit(3);
  if (error) { console.error('Error:', error); return; }
  if (!data?.length) { console.log('Tablo boş veya erişim yok'); return; }
  console.log('Sütunlar:', Object.keys(data[0]));
  console.log('\nİlk kayıt:');
  const first = data[0];
  for (const [k, v] of Object.entries(first)) {
    console.log(`  ${k}: ${JSON.stringify(v)?.substring(0, 80)}`);
  }
}
main().catch(console.error);

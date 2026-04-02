import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  for (const src of ['YEDEK_EMES_2026', 'MERTSAN_2026']) {
    const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('source_name', src);
    const { count: emptyDesc } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('source_name', src).or('description.is.null,description.eq.');
    const { count: emptyShort } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('source_name', src).or('short_description.is.null,short_description.eq.');
    console.log(`${src}: toplam=${total}, boş_desc=${emptyDesc}, boş_short=${emptyShort}`);
  }
  
  // Birkaç örnek göster
  const { data } = await supabase.from('products').select('name, sku, description, short_description, source_name').in('source_name', ['YEDEK_EMES_2026','MERTSAN_2026']).limit(5);
  console.log('\nÖrnekler:');
  data?.forEach(p => console.log(`  [${p.source_name}] ${p.sku} — desc: "${p.description?.substring(0,50) || 'BOŞ'}" | short: "${p.short_description?.substring(0,40) || 'BOŞ'}"`));
}
main().catch(console.error);

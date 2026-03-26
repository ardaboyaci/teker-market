import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  // Toplam YEDEK ürün
  const { count: total } = await sb.from('products').select('*', { count: 'exact', head: true })
    .ilike('sku', 'YEDEK-%').is('deleted_at', null);
  
  // HTML içerenler (zaten dolu)
  const { count: hasHtml } = await sb.from('products').select('*', { count: 'exact', head: true })
    .ilike('sku', 'YEDEK-%').ilike('description', '%<ul%').is('deleted_at', null);

  // Gerçekten boş olanlar
  const { count: empty } = await sb.from('products').select('*', { count: 'exact', head: true })
    .ilike('sku', 'YEDEK-%').or('description.is.null,description.eq.').is('deleted_at', null);

  // short_description boş olanlar  
  const { count: noShort } = await sb.from('products').select('*', { count: 'exact', head: true })
    .ilike('sku', 'YEDEK-%').or('short_description.is.null,short_description.eq.').is('deleted_at', null);

  console.log(`Toplam YEDEK ürün: ${total}`);
  console.log(`HTML açıklaması olan: ${hasHtml}`);
  console.log(`Gerçekten boş description: ${empty}`);
  console.log(`short_description boş: ${noShort}`);
}
main().catch(console.error);

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Toplam sayı için tüm boş desc'leri çek (pagination ile)
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, meta, description, short_description')
      .is('description', null)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  
  const srcCount: Record<string, number> = {};
  all.forEach(p => {
    const src = (p.meta as any)?.source || 'null';
    srcCount[src] = (srcCount[src] || 0) + 1;
  });
  
  console.log(`Toplam boş description: ${all.length}`);
  console.log('Kaynağa göre:', srcCount);
  
  // yedek_emes + mertsan + falo toplam
  const targets = ['yedek_emes_2026', 'mertsan_2026', 'falo_2026'];
  const targetItems = all.filter(p => targets.includes((p.meta as any)?.source));
  console.log(`\nHedef kaynaklar (${targets.join(', ')}): ${targetItems.length} ürün`);
}
main().catch(console.error);

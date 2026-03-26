import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  let allMeta: any[] = [];
  let from = 0;
  const pageSize = 1000;
  const total = 22751;
  
  while (from < total) {
    const { data } = await sb.from('products').select('meta, sku, base_price').range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    allMeta.push(...data);
    from += pageSize;
    process.stdout.write(`\r${from}/${total} okundu...`);
  }
  console.log('\n');
  
  const sources: Record<string, number> = {};
  let withPrice = 0, noPrice = 0;
  
  for (const row of allMeta) {
    const src = (row.meta as any)?.source ?? 'UNKNOWN';
    sources[src] = (sources[src] ?? 0) + 1;
    if (row.base_price != null) withPrice++;
    else noPrice++;
  }
  
  console.log('Tüm Tedarikçi Kaynakları:');
  Object.entries(sources).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(` ${k.padEnd(25)} ${v}`));
  console.log(`\nFiyatlı: ${withPrice}, Fiyatsız: ${noPrice}`);
}
main();

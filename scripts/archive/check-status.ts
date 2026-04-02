import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Status dağılımı
  for (const status of ['active', 'draft', 'archived']) {
    const { count } = await sb.from('products').select('*', { count: 'exact', head: true }).eq('status', status);
    console.log(`${status.padEnd(10)} ${count}`);
  }
  
  // Fiyatsız ürünler
  const { count: noPrice } = await sb.from('products').select('*', { count: 'exact', head: true }).is('base_price', null);
  console.log(`\nFiyatsız (base_price null): ${noPrice}`);
  
  // external_url olan (EMES scrape)
  const { count: withUrl } = await sb.from('products').select('*', { count: 'exact', head: true }).not('external_url', 'is', null);
  console.log(`external_url olan: ${withUrl}`);
  
  // meta.source ile tedarikçi dağılımı
  const { data } = await sb.from('products').select('meta').range(0, 4999);
  const sources: Record<string, number> = {};
  for (const row of data ?? []) {
    const src = (row.meta as any)?.source ?? 'UNKNOWN';
    sources[src] = (sources[src] ?? 0) + 1;
  }
  console.log('\nMeta.source dağılımı (ilk 5000):');
  Object.entries(sources).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(` ${k.padEnd(20)} ${v}`));
}
main();

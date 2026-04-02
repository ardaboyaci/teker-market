import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  let updated = 0;
  let round = 0;

  while (true) {
    round++;
    // Önce ID'leri çek
    const { data: ids, error: fetchErr } = await sb.from('products')
      .select('id')
      .eq('status', 'draft')
      .limit(200);

    if (fetchErr) { console.error('Fetch error:', fetchErr.message); break; }
    if (!ids || ids.length === 0) break;

    const idList = ids.map(r => r.id);
    const { error: updateErr } = await sb.from('products')
      .update({ status: 'active' })
      .in('id', idList);

    if (updateErr) { console.error('Update error:', updateErr.message); break; }
    updated += idList.length;
    if (round % 10 === 0) console.log(`  ${updated} güncellendi...`);
  }

  const { count: activeCount } = await sb.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active');
  const { count: total } = await sb.from('products').select('*', { count: 'exact', head: true });
  console.log(`\nTamamlandı: ${activeCount} active / ${total} toplam`);
}
main().catch(console.error);

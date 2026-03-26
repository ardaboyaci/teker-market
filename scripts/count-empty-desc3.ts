import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Tüm meta->source değerleri
  const { data: allSources } = await supabase.rpc('exec_sql', { 
    sql: `SELECT meta->>'source' as src, count(*) FROM products GROUP BY src ORDER BY count DESC` 
  }).limit(20);
  
  // Alternatif: ham sorgu
  const { data } = await supabase.from('products').select('meta').limit(500);
  const srcCount: Record<string, number> = {};
  data?.forEach(p => {
    const src = (p.meta as any)?.source || 'null';
    srcCount[src] = (srcCount[src] || 0) + 1;
  });
  console.log('Meta source dağılımı (ilk 500):', srcCount);
  
  // Boş açıklamalar
  const { data: emptyItems } = await supabase
    .from('products')
    .select('id, name, sku, meta, description, short_description')
    .is('description', null)
    .limit(20);
  
  console.log(`\nBoş description: ${emptyItems?.length} (ilk 20)`);
  emptyItems?.forEach(p => {
    const src = (p.meta as any)?.source;
    console.log(`  [${src}] ${p.sku}`);
  });
}
main().catch(console.error);

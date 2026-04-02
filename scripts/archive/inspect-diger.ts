import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await supabase
    .from('products')
    .select('sku')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('description', null)
    .limit(1000);

  // DIGER olanlar — prefix kodlarını say
  const prefixes: Record<string, number> = {};
  data?.forEach(p => {
    const sku = p.sku || '';
    // YEDEK- sonrasını al
    const code = sku.replace('YEDEK-', '');
    // İlk kelime/kodu al
    const prefix = code.match(/^([A-ZÇŞĞÜÖİa-zçşğüöı]+)/)?.[1] || 'SAYI';
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  });
  
  Object.entries(prefixes).sort((a,b) => b[1]-a[1]).slice(0, 30).forEach(([p,c]) => {
    console.log(`${p}: ${c}`);
  });
}
main().catch(console.error);

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await supabase
    .from('products')
    .select('id, name, sku, attributes, tags, meta')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('description', null)
    .limit(1000);
  
  console.log(`Toplam: ${data?.length}`);
  
  // Ürün tiplerini ayırt et
  const types: Record<string, number> = {};
  data?.forEach(p => {
    const name = p.name as string || '';
    // Anahtar kelimelerden tip çıkar
    let type = 'diğer';
    if (name.includes('İÇ LASTİK') || name.includes('IC LASTIK')) type = 'iç lastik';
    else if (name.includes('TEKER') || name.includes('TEKERLEK')) type = 'teker/tekerlek';
    else if (name.includes('RULMAN') || name.includes('LAGRMAN')) type = 'rulman';
    else if (name.includes('MBT') || name.includes('MAKARA')) type = 'makara';
    else if (name.includes('KAPAK')) type = 'kapak';
    else if (name.includes('SHRINK') || name.includes('ORS')) type = 'ors/shrink';
    else if (name.includes('ZMR') || name.includes('ZMZ') || name.includes('ZMT')) type = 'zamak teker';
    else if (name.includes('PNÖM') || name.includes('PNOM')) type = 'pnömatik';
    types[type] = (types[type] || 0) + 1;
  });
  
  console.log('\nTip dağılımı:');
  Object.entries(types).sort((a,b) => b[1]-a[1]).forEach(([t,c]) => console.log(`  ${t}: ${c}`));
  
  // Örnek 3-5 ürün her tipten
  const shown = new Set<string>();
  data?.slice(0, 50).forEach(p => {
    const attrs = p.attributes as any;
    console.log(`\n[${p.sku}] ${p.name}`);
    if (attrs) console.log('  attrs:', JSON.stringify(attrs).substring(0, 120));
  });
}
main().catch(console.error);

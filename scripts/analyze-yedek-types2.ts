import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await supabase
    .from('products')
    .select('id, name, sku')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('description', null)
    .limit(1000);
  
  const types: Record<string, { count: number; examples: string[] }> = {};
  data?.forEach(p => {
    const name = (p.name as string) || '';
    // SKU'dan YEDEK- kısmını çıkar, sonraki kısım tip kodu
    // Ürün adından tip çıkar
    let type = 'OTHER';
    if (name.includes('İÇ LASTİK') || name.includes('IC LASTIK')) type = 'IC_LASTIK';
    else if (name.includes('DIŞ LASTİK') || name.includes('DIS LASTIK')) type = 'DIS_LASTIK';
    else if (name.includes('TEKER') && !name.includes('KAPAK')) type = 'TEKER';
    else if (name.includes('TEKERLEK')) type = 'TEKER';
    else if (name.includes('MBT') || name.includes('MAKARA')) type = 'MBT_MAKARA';
    else if (name.includes('KAPAK') && !name.includes('TEKER')) type = 'KAPAK';
    else if (name.includes('ZMR') || name.includes('ZMZ') || name.includes('ZMT')) type = 'ZAMAK_TEKER';
    else if (name.includes('DBP') || name.includes('ABP') || name.includes('HBZ') || name.includes('ABR') || name.includes('OBP') || name.includes('PBZ')) type = 'PLASTIK_TEKER';
    else if (name.includes('RULMAN') || name.includes('BEARING')) type = 'RULMAN';
    
    if (!types[type]) types[type] = { count: 0, examples: [] };
    types[type].count++;
    if (types[type].examples.length < 3) types[type].examples.push(name);
  });
  
  Object.entries(types).sort((a,b) => b[1].count-a[1].count).forEach(([t, info]) => {
    console.log(`\n${t} (${info.count}):`);
    info.examples.forEach(e => console.log(`  - ${e}`));
  });
}
main().catch(console.error);

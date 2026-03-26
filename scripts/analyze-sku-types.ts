import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function getType(sku: string): string {
  const s = sku.toUpperCase();
  if (s.includes('İÇ LASTİK') || s.includes('IC LASTIK')) return 'IC_LASTIK';
  if (s.includes('DIŞ LASTİK') || s.includes('DIS LASTIK')) return 'DIS_LASTIK';
  if (s.includes('MBT')) return 'MBT'; // Monoblock teker
  if (s.includes('ZMR') || s.includes('ZMZ') || s.includes('ZMT')) return 'ZAMAK';
  if (s.includes('ABP') || s.includes('ABR') || s.includes('OBP') || s.includes('OBR')) return 'ALU_PNÖM';
  if (s.includes('DBP') || s.includes('DBR')) return 'DOK_PLAST';
  if (s.includes('HBZ') || s.includes('HBR')) return 'HAFIF_BOT';
  if (s.includes('PBZ') || s.includes('PBR')) return 'PLASTIK_BOT';
  if (s.includes('TEKER') || s.includes('TEKERLEK')) return 'GENEL_TEKER';
  if (s.includes('RULMAN') || s.includes('BEARING')) return 'RULMAN';
  if (s.includes('KAPAK')) return 'KAPAK';
  return 'DIGER';
}

async function main() {
  const { data } = await supabase
    .from('products')
    .select('sku')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('description', null)
    .limit(1000);
  
  const types: Record<string, { count: number; examples: string[] }> = {};
  data?.forEach(p => {
    const type = getType(p.sku || '');
    if (!types[type]) types[type] = { count: 0, examples: [] };
    types[type].count++;
    if (types[type].examples.length < 2) types[type].examples.push(p.sku);
  });
  
  Object.entries(types).sort((a,b) => b[1].count-a[1].count).forEach(([t, info]) => {
    console.log(`${t} (${info.count}): ${info.examples.join(' | ')}`);
  });
}
main().catch(console.error);

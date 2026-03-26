import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// EMES teker kodu sözlüğü
const codeMap: Record<string, string> = {
  'VBP': 'Volan Bantlı Pnömatik Teker',
  'VBR': 'Volan Bantlı Rulman Teker',
  'VBV': 'Volan Bantlı Vites Teker',
  'ZBZ': 'Çinko Bantlı Zorlu Teker',
  'ZBP': 'Çinko Bantlı Pnömatik Teker',
  'ZKZ': 'Çinko Kauçuk Zorlu Teker',
  'ZKP': 'Çinko Kauçuk Pnömatik Teker',
  'ZMP': 'Çinko Mafsallı Pnömatik Teker',
  'ZMZ': 'Çinko Mafsallı Zorlu Teker',
  'ZMRm': 'Çinko Mafsallı Rulman Teker',
  'MKT': 'Metal Kauçuk Teker',
  'MKR': 'Metal Kauçuk Rulman Teker',
  'MKM': 'Metal Kauçuk Mafsallı Teker',
  'MBT': 'Monoblock Teker',
  'MBC': 'Monoblock Çarklı Teker',
  'MBR': 'Monoblock Rulman Teker',
  'MMR': 'Metal Mafsallı Rulman Teker',
  'MMRG': 'Metal Mafsallı Rulman Galvaniz Teker',
  'MKRG': 'Metal Kauçuk Rulman Galvaniz Teker',
  'HBZ': 'Hafif Bantlı Zorlu Teker',
  'HBR': 'Hafif Bantlı Rulman Teker',
  'ABP': 'Alüminyum Bantlı Pnömatik Teker',
  'ABR': 'Alüminyum Bantlı Rulman Teker',
  'OBP': 'Oval Bantlı Pnömatik Teker',
  'OBR': 'Oval Bantlı Rulman Teker',
  'DBP': 'Döküm Bantlı Pnömatik Teker',
  'DBR': 'Döküm Bantlı Rulman Teker',
  'PBZ': 'Plastik Bantlı Zorlu Teker',
  'PBR': 'Plastik Bantlı Rulman Teker',
  'SPR': 'Sanayi Pnömatik Rulman Teker',
  'SPRG': 'Sanayi Pnömatik Rulman Galvaniz Teker',
  'SMR': 'Sanayi Mafsallı Rulman Teker',
  'SMRG': 'Sanayi Mafsallı Rulman Galvaniz Teker',
  'SBRH': 'Sanayi Bantlı Rulman Havalı Teker',
  'VKP': 'Volan Kauçuk Pnömatik Teker',
  'VKV': 'Volan Kauçuk Vites Teker',
  'VBPb': 'Volan Bantlı Pnömatik Bilya Teker',
  'ZKP': 'Çinko Kauçuk Pnömatik Teker',
  'BKB': 'Bant Kauçuk Bantlı Teker',
  'HKZ': 'Hafif Kauçuk Zorlu Teker',
  'T': 'Teker',
  'MBRm': 'Monoblock Rulman Teker',
  'ZMT': 'Çinko Mafsallı Teker',
  'ZMR': 'Çinko Mafsallı Rulman Teker',
};

async function main() {
  const { data } = await supabase
    .from('products')
    .select('sku')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('description', null)
    .limit(1000);

  let covered = 0, total = data?.length || 0;
  data?.forEach(p => {
    const sku = p.sku || '';
    const code = sku.replace('YEDEK-', '').match(/^([A-ZÇŞĞÜÖİa-zçşğüöıb]+)/)?.[1] || '';
    if (codeMap[code]) covered++;
  });
  
  console.log(`Kapsanan: ${covered}/${total} (${Math.round(covered/total*100)}%)`);
}
main().catch(console.error);

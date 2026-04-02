import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const codeMap: Record<string, string> = {
  'VBP': 'Volan Bantlı Pnömatik Teker',
  'VBR': 'Volan Bantlı Rulman Teker',
  'VBV': 'Volan Bantlı Vites Teker',
  'VBPb': 'Volan Bantlı Pnömatik Bilya Teker',
  'VKP': 'Volan Kauçuk Pnömatik Teker',
  'VKV': 'Volan Kauçuk Vites Teker',
  'ZBZ': 'Çinko Bantlı Zorlu Teker',
  'ZBP': 'Çinko Bantlı Pnömatik Teker',
  'ZKZ': 'Çinko Kauçuk Zorlu Teker',
  'ZKP': 'Çinko Kauçuk Pnömatik Teker',
  'ZMP': 'Çinko Mafsallı Pnömatik Teker',
  'ZMZ': 'Çinko Mafsallı Zorlu Teker',
  'ZMR': 'Çinko Mafsallı Rulman Teker',
  'ZMRm': 'Çinko Mafsallı Rulman Teker',
  'ZMT': 'Çinko Mafsallı Teker',
  'MKT': 'Metal Kauçuk Teker',
  'MKR': 'Metal Kauçuk Rulman Teker',
  'MKM': 'Metal Kauçuk Mafsallı Teker',
  'MKRG': 'Metal Kauçuk Rulman Galvaniz Teker',
  'MBT': 'Monoblock Teker',
  'MBC': 'Monoblock Çarklı Teker',
  'MBR': 'Monoblock Rulman Teker',
  'MBRm': 'Monoblock Rulman Teker',
  'MMR': 'Metal Mafsallı Rulman Teker',
  'MMRG': 'Metal Mafsallı Rulman Galvaniz Teker',
  'HBZ': 'Hafif Bantlı Zorlu Teker',
  'HBR': 'Hafif Bantlı Rulman Teker',
  'HKZ': 'Hafif Kauçuk Zorlu Teker',
  'ABP': 'Alüminyum Bantlı Pnömatik Teker',
  'ABR': 'Alüminyum Bantlı Rulman Teker',
  'OBP': 'Oval Bantlı Pnömatik Teker',
  'OBR': 'Oval Bantlı Rulman Teker',
  'DBP': 'Döküm Bantlı Pnömatik Teker',
  'DBR': 'Döküm Bantlı Rulman Teker',
  'PBZ': 'Plastik Bantlı Zorlu Teker',
  'PBR': 'Plastik Bantlı Rulman Teker',
  'BKB': 'Bantlı Kauçuk Teker',
  'SPR': 'Sanayi Pnömatik Rulman Teker',
  'SPRG': 'Sanayi Pnömatik Rulman Galvaniz Teker',
  'SMR': 'Sanayi Mafsallı Rulman Teker',
  'SMRG': 'Sanayi Mafsallı Rulman Galvaniz Teker',
  'SBRH': 'Sanayi Bantlı Rulman Havalı Teker',
};

function buildName(sku: string): string {
  const raw = sku.replace(/^YEDEK-/i, '').trim();
  
  if (/İÇ LASTİK/i.test(raw)) {
    const size = raw.match(/^([\d./\-]+)/)?.[1] || '';
    return `${size} İç Lastik`.trim();
  }
  if (/DIŞ LASTİK/i.test(raw)) {
    const size = raw.match(/^([\d./-]+)/)?.[1] || '';
    const pr = raw.match(/(\d+\s*PR)/i)?.[1] || '';
    return `${size}${pr ? ' ' + pr : ''} Dış Lastik`.trim();
  }
  
  const code = raw.match(/^([A-ZÇŞĞÜÖİa-zçşğüöıb]+)/)?.[1] || '';
  const typeName = codeMap[code];
  
  if (typeName) {
    const size = raw.match(/(\d+[Xx]\d+)/)?.[1]?.toUpperCase() || '';
    const bearing = raw.match(/(6[0-9]{3}[^)]*)/)?.[1] || '';
    const kapakli = /KAPAKLI/i.test(raw) ? ' Kapaklı' : '';
    const rulmansiz = /RULMANSIZ/i.test(raw) ? ' Rulmansız' : '';
    const delik = raw.match(/(\d+\s*DELİK)/i)?.[1] ? ` ${raw.match(/(\d+\s*DELİK)/i)![1]}` : '';
    const renk = raw.match(/\(([A-ZÇŞĞÜÖİa-zçşğüöı]+)\)/)?.[1];
    const renkStr = renk && !['ED','EM','ZZ'].some(x => renk.includes(x)) ? ` ${renk}` : '';
    
    let name = typeName;
    if (size) name += ` ${size}`;
    if (bearing) name += ` (${bearing})`;
    name += kapakli + rulmansiz + delik + renkStr;
    return name;
  }
  
  return raw;
}

async function main() {
  // Name'i sayı gibi görünen tüm YEDEK ürünleri bul
  const { data } = await supabase
    .from('products')
    .select('id, sku, name')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .limit(1000);
  
  const broken = data?.filter(p => /^\d+(\.\d+)?$/.test(p.name)) || [];
  console.log(`Name bozuk olan: ${broken.length} ürün`);
  
  let updated = 0;
  for (const product of broken) {
    const newName = buildName(product.sku);
    const { error } = await supabase
      .from('products')
      .update({ name: newName })
      .eq('id', product.id);
    if (!error) updated++;
    else console.error(`HATA ${product.sku}:`, error.message);
  }
  
  console.log(`✅ ${updated} ürün adı düzeltildi`);
  
  // Kontrol
  const { data: sample } = await supabase
    .from('products')
    .select('sku, name')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .limit(5);
  console.log('\nÖrnek:');
  sample?.forEach(p => console.log(`  ${p.sku} → ${p.name}`));
}
main().catch(console.error);

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// EMES kod sözlüğü — kod → Türkçe tip adı
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

// SKU → okunabilir ürün adı üret
function buildName(sku: string): string {
  // YEDEK- prefix'ini at
  const raw = sku.replace(/^YEDEK-/i, '').trim();
  
  // İÇ/DIŞ LASTİK özel durumu
  if (/İÇ LASTİK/i.test(raw)) {
    const size = raw.match(/^([\d./\-]+)/)?.[1] || '';
    return `${size} İç Lastik`.trim();
  }
  if (/DIŞ LASTİK/i.test(raw)) {
    const size = raw.match(/^([\d./-]+)/)?.[1] || '';
    const pr = raw.match(/(\d+\s*PR)/i)?.[1] || '';
    return `${size}${pr ? ' ' + pr : ''} Dış Lastik`.trim();
  }
  
  // Kod bazlı teker
  const codeMatch = raw.match(/^([A-ZÇŞĞÜÖİa-zçşğüöıb]+)/);
  const code = codeMatch?.[1] || '';
  const typeName = codeMap[code];
  
  if (typeName) {
    // Boyut: ilk sayısal kısım (örn: 200X50, 125X32)
    const size = raw.match(/(\d+[Xx]\d+)/)?.[1]?.toUpperCase() || '';
    // Rulman kodu (örn: 6202-Ø15)
    const bearing = raw.match(/(6[0-9]{3}[^)]*)/)?.[1] || '';
    const kapakli = /KAPAKLI/i.test(raw) ? ' Kapaklı' : '';
    const shrink = /SHRINK/i.test(raw) ? ' Shrink' : '';
    const rulmansiz = /RULMANSIZ/i.test(raw) ? ' Rulmansız' : '';
    const delik = raw.match(/(\d+\s*DELİK)/i)?.[1] ? ` ${raw.match(/(\d+\s*DELİK)/i)![1]}` : '';
    const renk = raw.match(/\(([A-ZÇŞĞÜÖİa-zçşğüöı]+)\)/)?.[1];
    const renkStr = renk && !['ED','EM','ZZ','Ø'].some(x => renk.includes(x)) ? ` ${renk}` : '';
    
    let name = typeName;
    if (size) name += ` ${size}`;
    if (bearing) name += ` (${bearing})`;
    name += kapakli + shrink + rulmansiz + delik + renkStr;
    return name;
  }
  
  // Bilinmeyen — ham SKU'dan YEDEK- at
  return raw;
}

// Açıklama üret
function buildDescription(sku: string, name: string): string {
  const raw = sku.replace(/^YEDEK-/i, '').trim();
  
  // İç lastik
  if (/İÇ LASTİK/i.test(raw)) {
    const size = raw.match(/^([\d./\-]+)/)?.[1] || '';
    return `${size} ölçüsünde yüksek kaliteli iç lastik. Endüstriyel araçlar, el arabaları ve tarım ekipmanlarında kullanım için uygundur. EMES üretimi, uzun ömürlü ve dayanıklı kauçuk yapısıyla güvenilir performans sunar.`;
  }
  // Dış lastik
  if (/DIŞ LASTİK/i.test(raw)) {
    const size = raw.match(/^([\d./-]+)/)?.[1] || '';
    const pr = raw.match(/(\d+\s*PR)/i)?.[1] || '';
    return `${size}${pr ? ' ' + pr : ''} dış lastik. Yük taşıma araçları ve endüstriyel ekipmanlar için tasarlanmıştır. Derin diş yapısı sayesinde her zeminde üstün tutuş ve uzun ömür sağlar.`;
  }
  
  const codeMatch = raw.match(/^([A-ZÇŞĞÜÖİa-zçşğüöıb]+)/);
  const code = codeMatch?.[1] || '';
  const typeName = codeMap[code];
  const size = raw.match(/(\d+[Xx]\d+)/)?.[1]?.toUpperCase() || '';
  const bearing = raw.match(/(6[0-9]{3}[^)]*)/)?.[1] || '';
  
  if (!typeName) {
    return `EMES Yedek kalitesinde endüstriyel teker. Yük taşıma ve depolama ekipmanlarında kullanım için idealdir.`;
  }
  
  // Tip bazlı açıklama
  const isPnomatik = typeName.includes('Pnömatik') || typeName.includes('Havalı');
  const isRulman = typeName.includes('Rulman');
  const isMetal = typeName.includes('Metal') || typeName.includes('Alüminyum') || typeName.includes('Çinko') || typeName.includes('Döküm');
  const isPlastik = typeName.includes('Plastik') || typeName.includes('Monoblock');
  const isGalvaniz = typeName.includes('Galvaniz');
  
  let desc = `${name} — EMES Yedek serisi endüstriyel teker.`;
  
  if (size) desc += ` ${size} mm boyutlarında`;
  if (bearing) desc += `, ${bearing} rulman`;
  desc += ' ile üretilmiştir.';
  
  if (isPnomatik) desc += ' Pnömatik yapısı sayesinde titreşimi emer, hassas zeminlerde ürün koruması sağlar.';
  if (isRulman && !isPnomatik) desc += ' Rulman sistemi düşük gürültü ve uzun ömür sağlar.';
  if (isMetal) desc += ' Metal gövde yüksek yük kapasitesi ve uzun kullanım ömrü sunar.';
  if (isPlastik) desc += ' Hafif yapısı kolay manevra imkânı sağlar.';
  if (isGalvaniz) desc += ' Galvaniz kaplama korozyon direnci sağlar.';
  
  desc += ' El arabaları, platform arabalar ve depo ekipmanlarında kullanım için idealdir.';
  
  return desc;
}

async function main() {
  // Tüm sorunlu YEDEK ürünleri çek
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('description', null)
    .limit(1000);
  
  if (error || !data) { console.error(error); return; }
  console.log(`Toplam: ${data.length} ürün`);
  
  // Batch güncelleme (50'şer)
  const BATCH = 50;
  let updated = 0;
  
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    
    for (const product of batch) {
      const newName = buildName(product.sku);
      const desc = buildDescription(product.sku, newName);
      const shortDesc = desc.split('.')[0] + '.';
      
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: newName,
          description: desc,
          short_description: shortDesc,
        })
        .eq('id', product.id);
      
      if (updateError) {
        console.error(`HATA ${product.sku}:`, updateError.message);
      } else {
        updated++;
      }
    }
    
    process.stdout.write(`\r${updated}/${data.length} güncellendi...`);
  }
  
  console.log(`\n✅ Tamamlandı: ${updated} ürün güncellendi`);
  
  // Örnek kontrol
  const { data: sample } = await supabase
    .from('products')
    .select('sku, name, description')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .limit(3);
  
  console.log('\n--- ÖRNEK ---');
  sample?.forEach(p => {
    console.log(`SKU: ${p.sku}`);
    console.log(`Ad:  ${p.name}`);
    console.log(`Açıklama: ${p.description?.substring(0, 120)}...`);
    console.log();
  });
}

main().catch(console.error);

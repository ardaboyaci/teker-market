import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const products: Record<string, { description: string; short_description: string }> = {
  'MERTSAN-200-x-50-rulmanli': {
    short_description: 'Rulmanlı sanayi el arabası tekerleği, 200x50 mm',
    description: '200x50 mm ölçülerinde rulmanlı sanayi el arabası tekerleği. Yüksek yük kapasiteli rulman sistemi sayesinde kolay yuvarlanma ve uzun ömür sağlar. Depo, fabrika ve atölye gibi sanayi ortamlarında platform arabaları ve el arabaları için idealdir. Dayanıklı kauçuk dış yüzeyi aşınmaya karşı dirençlidir.',
  },
  'MERTSAN-200x80-rulmanli': {
    short_description: 'Rulmanlı sanayi el arabası tekerleği, 200x80 mm',
    description: '200x80 mm ölçülerinde rulmanlı, geniş yüzeyli sanayi tekerleği. Geniş taban profili sayesinde yük dağılımını optimize eder; pürüzlü ve düz zemin yüzeylerinde kararlı hareket sağlar. Depo, lojistik ve üretim tesislerinde ağır el arabaları için uygundur. Yüksek kaliteli rulman ile sessiz ve sürtünmesiz çalışma.',
  },
  'MERTSAN-250-x-50-rulmanli': {
    short_description: 'Rulmanlı sanayi el arabası tekerleği, 250x50 mm',
    description: '250x50 mm ölçülerinde rulmanlı sanayi el arabası tekerleği. Orta genişlikte profil ile dar koridor ve geçişlerde kolaylık sağlar. Yük taşıma araçları, platform arabaları ve çeşitli sanayi ekipmanları için uygundur. Rulman sistemi düşük sürtünme ile uzun süreli kullanımda performansını korur.',
  },
  'MERTSAN-250x80-rulmanli': {
    short_description: 'Rulmanlı sanayi el arabası tekerleği, 250x80 mm',
    description: '250x80 mm geniş profilli rulmanlı sanayi tekerleği. Büyük çap ve geniş yüzey kombinasyonu, pürüzlü zemin koşullarında üstün stabilite sağlar. Ağır yüklü platform arabaları ve sanayi el arabaları için tasarlanmıştır. Kaliteli kauçuk yüzey ve hassas rulman sistemi ile yüksek dayanıklılık sunar.',
  },
  'MERTSAN-300-x-50-rulmanli': {
    short_description: 'Rulmanlı sanayi el arabası tekerleği, 300x50 mm',
    description: '300x50 mm ölçülerinde rulmanlı sanayi tekerleği. Büyük çaplı yapısı engellerden kolaylıkla geçmeyi sağlarken dar profil koridor geçişlerini kolaylaştırır. Depo ve fabrika ortamlarında ağır yük taşıma araçları için idealdir. Hassas rulman sistemi ile düşük yuvarlanma direnci ve uzun servis ömrü sunar.',
  },
  'MERTSAN-300-x-60-rulmanli': {
    short_description: 'Rulmanlı sanayi el arabası tekerleği, 300x60 mm',
    description: '300x60 mm ölçülerinde dengeli profilli rulmanlı sanayi tekerleği. Büyük çap ve orta genişlik kombinasyonu, ağır yükler altında kararlı ve sorunsuz hareket sağlar. Sanayi el arabaları, platform arabaları ve çekici vagonlar için uygundur. Yüksek kalite kauçuk ve rulman bileşenleri ile uzun ömürlü performans.',
  },
  'MERTSAN-350-x-60-rulmanli': {
    short_description: 'Rulmanlı sanayi el arabası tekerleği, 350x60 mm',
    description: '350x60 mm büyük çaplı rulmanlı sanayi tekerleği. Geniş çapı sayesinde yüzey düzensizliklerini kolayca aşar; ağır yükler altında bile yüksek mobilite sağlar. Büyük platform arabaları, çekici araçlar ve ağır sanayi ekipmanları için tasarlanmıştır. Yüksek kapasiteli rulman sistemi ve sağlam kauçuk yapısıyla uzun ömürlüdür.',
  },
  'MERTSAN-350-x-60-25-rulmanli': {
    short_description: 'Rulmanlı sanayi el arabası tekerleği, 350x60 mm (25 mm mil)',
    description: '350x60 mm ölçülerinde, 25 mm mil çaplı rulmanlı sanayi tekerleği. Büyük çap ve geniş profil, ağır zemin koşullarında üstün stabilite sağlar. 25 mm mil deliği özelliği, ağır kapasiteli sanayi araçlarına güvenli montaj imkânı sunar. Dayanıklı kauçuk yüzey ve yüksek kapasiteli rulman ile yoğun sanayi kullanımına uygundur.',
  },
};

async function main() {
  let success = 0;
  for (const [sku, content] of Object.entries(products)) {
    const { error } = await sb.from('products')
      .update({ ...content, updated_at: new Date().toISOString() })
      .eq('sku', sku)
      .is('deleted_at', null);
    if (error) console.log(`❌ ${sku}: ${error.message}`);
    else { console.log(`✅ ${sku}`); success++; }
  }
  console.log(`\n${success}/${Object.keys(products).length} ürün güncellendi.`);
}
main().catch(console.error);

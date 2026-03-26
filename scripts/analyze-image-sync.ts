import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const PAGE = 1000;
  let offset = 0;
  const stats = { total:0, noImageUrl:0, hasImageUrl:0, hasMetaImages:0, mismatch:0 };
  const examples: any[] = [];

  while(true) {
    const { data, error } = await sb.from('products')
      .select('id, sku, image_url, meta')
      .is('deleted_at', null)
      .range(offset, offset+PAGE-1);
    if (error) { console.error(error.message); break; }
    if (!data || data.length === 0) break;

    for (const p of data) {
      stats.total++;
      const hasImgUrl = !!p.image_url;
      const metaImages = p.meta?.images as string[] | undefined;
      const hasMetaImg = Array.isArray(metaImages) && metaImages.length > 0;

      if (hasImgUrl) stats.hasImageUrl++;
      else stats.noImageUrl++;
      if (hasMetaImg) stats.hasMetaImages++;

      // Mismatch: meta.images[0] var ama image_url farklı veya yok
      if (hasMetaImg) {
        const firstMeta = metaImages![0];
        if (!hasImgUrl) {
          stats.mismatch++;
          if (examples.length < 3) examples.push({ id: p.id, sku: p.sku, image_url: null, meta_images_0: firstMeta });
        } else if (p.image_url !== firstMeta) {
          stats.mismatch++;
          if (examples.length < 3) examples.push({ id: p.id, sku: p.sku, image_url: p.image_url, meta_images_0: firstMeta });
        }
      }
    }

    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log('=== IMAGE SYNC ANALİZİ ===');
  console.log(`Toplam ürün       : ${stats.total}`);
  console.log(`image_url var     : ${stats.hasImageUrl} (%${Math.round(stats.hasImageUrl/stats.total*100)})`);
  console.log(`image_url YOK     : ${stats.noImageUrl} (%${Math.round(stats.noImageUrl/stats.total*100)})`);
  console.log(`meta.images var   : ${stats.hasMetaImages} (%${Math.round(stats.hasMetaImages/stats.total*100)})`);
  console.log(`MISMATCH          : ${stats.mismatch} (%${Math.round(stats.mismatch/stats.total*100)})`);
  console.log('');
  console.log('Örnek mismatch kayıtlar:');
  for (const e of examples) console.log(JSON.stringify(e, null, 2));
}
main().catch(console.error);

/**
 * Görev 6: product_media → image_url senkronizasyonu
 * 
 * Durum analizi sonucu:
 * - meta.images: 0 ürün (hiç kullanılmıyor)
 * - image_url: sadece %16 ürün var (2801/17284)
 * - product_media tablosu var mı? Kontrol edilecek.
 * 
 * Bu script:
 * 1. product_media tablosunu kontrol eder
 * 2. Orada görsel olan ama image_url boş olan ürünleri bulur
 * 3. --fix parametresiyle günceller
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FIX = process.argv.includes('--fix');

async function main() {
  // 1. product_media tablosu mevcut mu?
  const { data: tableCheck, error: tableErr } = await sb.from('product_media').select('id').limit(1);
  if (tableErr) {
    console.log('product_media tablosu YOK veya erişilemiyor:', tableErr.message);
    console.log('\nÇözüm: Görseller zaten image_url kolonuna bakıyor.');
    console.log('Sadece %16 ürünün image_url\'si var. Tedarikçi sync scriptleri image_url dolduruyor.');
    return;
  }

  console.log('product_media tablosu MEVCUT — analiz yapılıyor...\n');

  // 2. product_media'dan ana görselleri al (is_primary=true veya sırası 1)
  const { data: media, error: mediaErr } = await sb.from('product_media')
    .select('product_id, url, is_primary, sort_order')
    .order('product_id')
    .order('sort_order');
  if (mediaErr) { console.error(mediaErr.message); return; }

  // product_id → url haritası (en üstteki görsel)
  const mediaMap = new Map<string, string>();
  for (const m of (media ?? [])) {
    if (!mediaMap.has(m.product_id)) mediaMap.set(m.product_id, m.url);
  }
  console.log(`product_media'da görsel olan ürün: ${mediaMap.size}`);

  // 3. Bu ürünlerin image_url durumunu kontrol et
  const ids = [...mediaMap.keys()];
  let noImageUrl = 0;
  let toUpdate: {id: string, url: string}[] = [];

  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i+500);
    const { data } = await sb.from('products').select('id, image_url').in('id', chunk).is('deleted_at', null);
    for (const p of (data ?? [])) {
      const mediaUrl = mediaMap.get(p.id);
      if (!p.image_url && mediaUrl) {
        noImageUrl++;
        toUpdate.push({ id: p.id, url: mediaUrl });
      }
    }
  }

  console.log(`image_url boş ama product_media'da görsel var: ${noImageUrl}`);

  if (!FIX) {
    console.log('\nDry run. --fix ile çalıştırın → image_url kolonunu günceller.');
    return;
  }

  // 4. Güncelle
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += 100) {
    const batch = toUpdate.slice(i, i+100);
    for (const item of batch) {
      await sb.from('products').update({ image_url: item.url }).eq('id', item.id);
      updated++;
    }
    process.stdout.write(`\rGüncellendi: ${updated}/${toUpdate.length}`);
  }
  console.log(`\n✅ Tamamlandı: ${updated} ürün güncellendi.`);
}
main().catch(console.error);

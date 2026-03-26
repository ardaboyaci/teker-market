import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // YEDEK_EMES örnekleri
  const { data: yedek } = await sb.from('products')
    .select('id, sku, name, description, meta, categories, price')
    .eq('meta->>source', 'YEDEK_EMES_2026')
    .is('deleted_at', null)
    .limit(5);

  console.log('=== YEDEK_EMES_2026 — 5 örnek ===');
  for (const p of (yedek ?? [])) {
    console.log(`SKU: ${p.sku}`);
    console.log(`İsim: ${p.name}`);
    console.log(`Açıklama: "${p.description ?? ''}"`);
    console.log(`Meta keys: ${Object.keys(p.meta ?? {}).join(', ')}`);
    console.log(`Fiyat: ${p.price}`);
    console.log('---');
  }

  // MERTSAN örnekleri
  const { data: mertsan } = await sb.from('products')
    .select('id, sku, name, description, meta, categories, price')
    .eq('meta->>source', 'MERTSAN_2026')
    .is('deleted_at', null)
    .limit(8);

  console.log('\n=== MERTSAN_2026 — tüm kayıtlar ===');
  for (const p of (mertsan ?? [])) {
    console.log(`SKU: ${p.sku}`);
    console.log(`İsim: ${p.name}`);
    console.log(`Açıklama: "${p.description ?? ''}"`);
    console.log(`Meta keys: ${Object.keys(p.meta ?? {}).join(', ')}`);
    console.log(`Fiyat: ${p.price}`);
    console.log('---');
  }
}
main().catch(console.error);

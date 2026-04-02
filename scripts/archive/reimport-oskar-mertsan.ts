import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import * as path from 'path';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

async function main() {
  const excelFile = path.join(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx');
  const wb = XLSX.readFile(excelFile);

  // --- OSKAR ---
  console.log('OSKAR import başlıyor...');
  const oskarRaw = XLSX.utils.sheet_to_json(wb.Sheets['OSKAR2026'], { defval: '', header: 1 }) as any[][];
  
  const oskarProducts: any[] = [];
  const oskarSkuSeen = new Set<string>();
  
  for (const row of oskarRaw) {
    const sku = String(row[1] ?? '').trim();
    const name = String(row[2] ?? '').trim();
    const price = parseFloat(String(row[4] ?? '').replace(',','.'));
    
    if (!sku || !name || isNaN(price) || price <= 0) continue;
    if (sku.length < 3 || sku === 'www.oskarlocks.com') continue;
    if (oskarSkuSeen.has(sku)) continue;
    oskarSkuSeen.add(sku);
    
    const slug = slugify(`oskar-${sku}-${name}`).slice(0, 200);
    
    oskarProducts.push({
      sku,
      name,
      slug,
      base_price: price,
      status: 'draft',
      meta: { source: 'oskar_2026', raw_sku: sku }
    });
  }
  
  console.log(`Oskar: ${oskarProducts.length} ürün hazır`);
  
  let oskarInserted = 0;
  for (let i = 0; i < oskarProducts.length; i += 200) {
    const batch = oskarProducts.slice(i, i + 200);
    const { error } = await sb.from('products').upsert(batch, { onConflict: 'sku', ignoreDuplicates: true });
    if (error) console.error('Oskar batch error:', error.message);
    else oskarInserted += batch.length;
  }
  console.log(`Oskar: ${oskarInserted} ürün insert edildi`);

  // --- MERTSAN ---
  // Önce mevcut Mertsan kayıtlarını temizle
  console.log('\nMertsan mevcut kayıtlar siliniyor...');
  await sb.from('products').delete().filter('meta->>source', 'eq', 'mertsan_2026');
  
  const mertsanRaw = XLSX.utils.sheet_to_json(wb.Sheets['MERTSAN 2026'], { defval: '', header: 1 }) as any[][];
  const mertsanProducts: any[] = [];
  
  for (const row of mertsanRaw) {
    const name = String(row[0] ?? '').trim();
    const perakende = parseFloat(String(row[1] ?? '').replace(',','.'));
    const toptan = parseFloat(String(row[2] ?? '').replace(',','.'));
    
    if (!name || isNaN(perakende) || perakende <= 0) continue;
    if (name === 'PERAKENDE' || name === 'TOPTAN') continue;
    
    const sku = `MERTSAN-${slugify(name).slice(0,30)}`;
    const slug = slugify(`mertsan-${name}`).slice(0, 200);
    
    mertsanProducts.push({
      sku,
      name: `MERTSAN ${name}`,
      slug,
      base_price: perakende,
      status: 'draft',
      meta: { source: 'mertsan_2026', toptan_price: toptan, birim: 'adet', kdv_haric: true }
    });
  }
  
  console.log(`Mertsan: ${mertsanProducts.length} ürün hazır`);
  const { error: mertsanErr } = await sb.from('products').upsert(mertsanProducts, { onConflict: 'sku', ignoreDuplicates: true });
  if (mertsanErr) console.error('Mertsan error:', mertsanErr.message);
  else console.log(`Mertsan: ${mertsanProducts.length} ürün insert edildi`);

  // --- Final ---
  console.log('\n--- Final Sayım ---');
  const sources = ['emes_2026','emes_kulp_2026','yedek_emes_2026','zet_2026','ciftel_2026','oskar_2026','kaucuk_takoz_2026','falo_2026','mertsan_2026'];
  let total = 0;
  for (const src of sources) {
    const { count } = await sb.from('products').select('*', { count: 'exact', head: true }).filter('meta->>source', 'eq', src);
    console.log(` ${src.padEnd(25)} ${count}`);
    total += count ?? 0;
  }
  const { count } = await sb.from('products').select('*', { count: 'exact', head: true });
  console.log(`\nToplam DB: ${count}`);
  console.log(`Excel kaynaklı: ${total}`);
}
main().catch(console.error);

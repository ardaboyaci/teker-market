import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const PAGE = 1000;
  let offset = 0;
  
  const stats: any = { total: 0, empty: 0, tooShort: 0, ok: 0, bySupplier: {} };
  
  while(true) {
    const { data, error } = await sb.from('products')
      .select('id, description, meta, status')
      .is('deleted_at', null)
      .range(offset, offset+PAGE-1);
    if (error) { console.error(error.message); break; }
    if (!data || data.length === 0) break;
    
    for (const p of data) {
      stats.total++;
      const sup = String(p.meta?.source ?? p.meta?.supplier ?? 'UNKNOWN').toUpperCase();
      if (!stats.bySupplier[sup]) stats.bySupplier[sup] = {total:0, empty:0, short:0};
      stats.bySupplier[sup].total++;
      
      const desc = (p.description ?? '').trim();
      if (!desc) {
        stats.empty++;
        stats.bySupplier[sup].empty++;
      } else if (desc.length < 80) {
        stats.tooShort++;
        stats.bySupplier[sup].short++;
      } else {
        stats.ok++;
      }
    }
    
    offset += PAGE;
    if (data.length < PAGE) break;
  }
  
  console.log('=== AÇIKLAMA KALİTE ANALİZİ ===');
  console.log(`Toplam ürün: ${stats.total}`);
  console.log(`Boş açıklama: ${stats.empty} (%${Math.round(stats.empty/stats.total*100)})`);
  console.log(`Çok kısa (<80kr): ${stats.tooShort} (%${Math.round(stats.tooShort/stats.total*100)})`);
  console.log(`İyi (≥80 karakter): ${stats.ok} (%${Math.round(stats.ok/stats.total*100)})`);
  console.log('');
  console.log('=== KAYNAK BAZLI ===');
  const sorted = Object.entries(stats.bySupplier).sort((a: any, b: any) => b[1].total - a[1].total);
  for (const [sup, s] of sorted.slice(0, 20)) {
    const sv = s as any;
    const sorunlu = sv.empty + sv.short;
    const pct = Math.round(sorunlu/sv.total*100);
    console.log(`${sup.padEnd(14)}: ${String(sv.total).padStart(5)} ürün | boş:${String(sv.empty).padStart(4)} | kısa:${String(sv.short).padStart(4)} | sorunlu: %${pct}`);
  }
}
main().catch(console.error);

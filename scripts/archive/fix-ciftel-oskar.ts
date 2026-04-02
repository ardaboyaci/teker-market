import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import * as path from 'path';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fetchAll(source: string) {
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from('products').select('id, sku, name, base_price, meta').filter('meta->>source', 'eq', source).range(from, from + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function main() {
  const excelFile = path.join(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx');
  const wb = XLSX.readFile(excelFile);

  // --- CİFTEL ---
  // Excel'deki gerçek ürün kodları
  const ciftelSheet = wb.Sheets['ÇİFTEL2026'];
  const ciftelRows = XLSX.utils.sheet_to_json(ciftelSheet, { defval: '' }) as any[];
  
  // Başlık satırını atla, gerçek ürün kodlarını topla
  const ciftelValidSkus = new Set<string>();
  for (const row of ciftelRows) {
    const code = String(row['ÜRÜN KODU'] ?? row[Object.keys(row)[0]] ?? '').trim();
    if (code && !isNaN(Number(code))) {
      ciftelValidSkus.add(code);
      ciftelValidSkus.add(`CIFTEL-${code.padStart(4,'0')}`);
    }
  }
  console.log(`Çiftel Excel geçerli SKU sayısı: ${ciftelValidSkus.size / 2}`);

  // DB'deki tüm ciftel kayıtları
  const ciftelDb = await fetchAll('ciftel_2026');
  console.log(`Çiftel DB kayıt sayısı: ${ciftelDb.length}`);

  // Geçersiz kayıtları bul (footer metinleri, tekrar eden CIFTEL- prefix'liler)
  const toDelete: string[] = [];
  const seenOriginal = new Set<string>();
  
  // Önce CIFTEL-XXXX formatındakileri grupla
  const prefixed = ciftelDb.filter(r => r.sku.startsWith('CIFTEL-'));
  const original = ciftelDb.filter(r => !r.sku.startsWith('CIFTEL-'));
  
  console.log(`  CIFTEL-prefix: ${prefixed.length}, orijinal: ${original.length}`);
  
  // Orijinal SKU'lardan geçersiz olanları sil (footer metinleri vb)
  for (const row of original) {
    const isNumeric = !isNaN(Number(row.sku)) && row.sku.trim() !== '';
    if (!isNumeric) {
      toDelete.push(row.id);
      console.log(`  Geçersiz SKU silinecek: "${row.sku}"`);
    }
  }
  
  // CIFTEL-prefix'li olup orijinali de varsa prefix'liyi sil (duplicate)
  for (const row of prefixed) {
    const origCode = row.sku.replace('CIFTEL-', '').replace(/^0+/, '') || '0';
    const hasOriginal = original.some(r => r.sku === origCode || r.sku === origCode.padStart(4,'0'));
    if (hasOriginal) {
      toDelete.push(row.id);
    }
  }

  console.log(`Çiftel silinecek: ${toDelete.length}`);
  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 500) {
      await sb.from('products').delete().in('id', toDelete.slice(i, i + 500));
    }
    console.log('Çiftel temizlendi.');
  }

  // --- OSKAR ---
  const oskarSheet = wb.Sheets['OSKAR2026'];
  const oskarRows = XLSX.utils.sheet_to_json(oskarSheet, { defval: '' }) as any[];
  const oskarValidSkus = new Set<string>();
  for (const row of oskarRows) {
    const code = String(row['SİPARİŞ KODU'] ?? '').trim();
    if (code) oskarValidSkus.add(code);
  }
  console.log(`\nOskar Excel geçerli SKU sayısı: ${oskarValidSkus.size}`);

  const oskarDb = await fetchAll('oskar_2026');
  console.log(`Oskar DB kayıt sayısı: ${oskarDb.length}`);
  
  const oskarToDelete: string[] = [];
  for (const row of oskarDb) {
    if (!oskarValidSkus.has(row.sku)) {
      oskarToDelete.push(row.id);
    }
  }
  
  console.log(`Oskar silinecek (Excel'de olmayan): ${oskarToDelete.length}`);
  if (oskarToDelete.length > 0) {
    const sample = oskarDb.filter(r => oskarToDelete.includes(r.id)).slice(0,5);
    console.log('Örnek:', sample.map(r => r.sku));
    for (let i = 0; i < oskarToDelete.length; i += 500) {
      await sb.from('products').delete().in('id', oskarToDelete.slice(i, i + 500));
    }
    console.log('Oskar temizlendi.');
  }

  // --- MERTSAN ---
  const mertsanDb = await fetchAll('mertsan_2026');
  console.log(`\nMertsan DB: ${mertsanDb.length} (Excel: 8)`);
  const mertsanToDelete: string[] = [];
  const mertsanSeen = new Set<string>();
  for (const row of mertsanDb.sort((a,b) => a.sku.localeCompare(b.sku))) {
    if (mertsanSeen.has(row.sku)) {
      mertsanToDelete.push(row.id);
    } else {
      mertsanSeen.add(row.sku);
    }
  }
  if (mertsanToDelete.length > 0) {
    await sb.from('products').delete().in('id', mertsanToDelete);
    console.log(`Mertsan: ${mertsanToDelete.length} duplicate silindi`);
  }

  // Final
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

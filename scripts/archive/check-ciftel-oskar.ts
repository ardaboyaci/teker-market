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
    const { data } = await sb.from('products').select('sku').filter('meta->>source', 'eq', source).range(from, from + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function main() {
  // Excel'deki ciftel ve oskar ürün sayılarını bul
  const files = ['2026 BÜTÜN LİSTELER 5.xlsx'];
  let excelFile = '';
  for (const f of files) {
    try {
      const p = path.join(process.cwd(), f);
      require('fs').accessSync(p);
      excelFile = p;
    } catch {}
  }
  // Glob ile bul
  if (!excelFile) {
    const { execSync } = require('child_process');
    const found = execSync('find . -name "*.xlsx" -not -path "*/node_modules/*" 2>/dev/null').toString().trim();
    excelFile = found.split('\n')[0];
  }
  
  console.log('Excel:', excelFile);
  const wb = XLSX.readFile(excelFile);
  console.log('Sheet isimleri:', wb.SheetNames.join(', '));
  
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
    console.log(`  ${sheetName}: ${data.length} satır`);
  }
  
  // DB'deki ciftel kayıtlarının bir kısmını göster
  const ciftel = await fetchAll('ciftel_2026');
  console.log(`\nciftel_2026 DB kayıtları: ${ciftel.length}`);
  console.log('İlk 5 SKU:', ciftel.slice(0,5).map(r => r.sku));
  console.log('Son 5 SKU:', ciftel.slice(-5).map(r => r.sku));
}
main().catch(console.error);

import * as XLSX from 'xlsx';
import * as path from 'path';

const wb = XLSX.readFile(path.join(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx'));
const oskar = XLSX.utils.sheet_to_json(wb.Sheets['OSKAR2026'], { defval: '', header: 1 }) as any[][];
console.log(`OSKAR toplam satır: ${oskar.length}`);
// İlk dolu satırı bul
for (let i = 0; i < oskar.length; i++) {
  const row = oskar[i];
  const hasContent = row.some(c => String(c).trim() !== '');
  if (hasContent) {
    console.log(`İlk dolu satır ${i}:`, row);
    if (i < oskar.length - 1) console.log(`Sonraki satır ${i+1}:`, oskar[i+1]);
    if (i < oskar.length - 2) console.log(`Sonraki satır ${i+2}:`, oskar[i+2]);
    break;
  }
}
// Son 5 satır
console.log('\nSon 5 satır:');
oskar.slice(-5).forEach((r,i) => console.log(oskar.length-5+i, r));
// 10-20 arası
console.log('\nSatır 10-20:');
oskar.slice(10,20).forEach((r,i) => console.log(10+i, r));

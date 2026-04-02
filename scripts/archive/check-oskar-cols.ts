import * as XLSX from 'xlsx';
import * as path from 'path';

const wb = XLSX.readFile(path.join(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx'));

// Oskar
const oskar = XLSX.utils.sheet_to_json(wb.Sheets['OSKAR2026'], { defval: '', header: 1 }) as any[][];
console.log('OSKAR ilk 5 satır (raw):');
oskar.slice(0,5).forEach((r,i) => console.log(i, r));

// Mertsan
const mertsan = XLSX.utils.sheet_to_json(wb.Sheets['MERTSAN 2026'], { defval: '', header: 1 }) as any[][];
console.log('\nMERTSAN ilk 5 satır (raw):');
mertsan.slice(0,5).forEach((r,i) => console.log(i, r));

/**
 * ZET ÜRÜN IMPORT
 *
 * ZET Excel sheet'inden ürünleri okuyup Supabase'e import eder.
 * Sheet yapısı: R6+ kategori başlıkları, R8+ ürün satırları
 * Kolon 0: SKU/AD (örn: "1001 MEB 050*20"), Kolon 1: Fiyat
 *
 * Flags:
 *   --dry-run   DB'ye yazmadan loglar
 *   --limit=N   İlk N ürünü işle
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const EXCEL_FILE = path.resolve(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx');
const SHEET_NAME = 'ZET';

interface ZetProduct {
    sku: string;
    name: string;
    sale_price: number;
    category: string;
}

function parseZetSheet(): ZetProduct[] {
    const wb = XLSX.readFile(EXCEL_FILE);
    const ws = wb.Sheets[SHEET_NAME];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 }) as any[][];

    const products: ZetProduct[] = [];
    let currentCategory = 'ZET Tekerlekler';

    for (const row of rows) {
        const col0 = String(row[0] ?? '').trim();
        const col1 = row[1];

        // Boş satır atla
        if (!col0 && !col1) continue;

        // Kategori başlığı: col1 boş, col0 büyük harf metin
        if (col0 && (!col1 || typeof col1 !== 'number') && col0 === col0.toUpperCase() && col0.length > 5) {
            // Tarih satırı veya başlık satırını atla
            if (col0.includes('Fiyat') || col0.includes('Zet Endüstriyel') || col0.includes('2025') || col0.includes('2026')) continue;
            currentCategory = col0;
            continue;
        }

        // Ürün satırı: col0 SKU ve col1 fiyat (number)
        if (col0 && typeof col1 === 'number' && col1 > 0) {
            products.push({
                sku: col0,
                name: col0, // ZET sheet'inde ayrı isim kolonu yok, SKU = isim
                sale_price: Math.round(col1 * 100) / 100,
                category: currentCategory,
            });
        }
    }

    return products;
}

async function main() {
    console.log('━━━ ZET ÜRÜN IMPORT ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN — DB\'ye yazılmıyor\n');

    const products = parseZetSheet();
    console.log(`[Excel] ${products.length} ZET ürünü okundu\n`);

    const toProcess = LIMIT ? products.slice(0, LIMIT) : products;

    let inserted = 0, skipped = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const p = toProcess[i];
        process.stdout.write(`\r[${i + 1}/${toProcess.length}] ${p.sku.slice(0, 40)}...`);

        // Zaten var mı?
        const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('sku', p.sku)
            .is('deleted_at', null);

        if ((count ?? 0) > 0) {
            skipped++;
            continue;
        }

        if (DRY_RUN) {
            console.log(`\n  ✓ [DRY] ${p.sku} — ₺${p.sale_price}`);
            inserted++;
            continue;
        }

        const slug = p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const { error } = await supabase.from('products').insert({
            sku: p.sku,
            name: p.name,
            slug: `zet-${slug}-${Date.now()}`,
            sale_price: p.sale_price,
            base_price: p.sale_price,
            status: 'draft',
            meta: { source: 'zet_2026', imported_at: new Date().toISOString(), category: p.category },
        });

        if (error) {
            console.error(`\n  ✗ ${p.sku}: ${error.message}`);
            errors++;
        } else {
            inserted++;
        }
    }

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Eklendi': { Adet: inserted },
        'Zaten vardı (atlandı)': { Adet: skipped },
        'Hata': { Adet: errors },
        'Toplam': { Adet: toProcess.length },
    });
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

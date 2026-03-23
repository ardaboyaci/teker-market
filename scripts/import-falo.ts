/**
 * FALO MAKARA ÜRÜN IMPORT
 *
 * Excel yapısı: Header R2, veri R3+
 * Col 0: Stok Kodu (SKU), Col 1: Stok İsmi (isim), Col 4: Satış Fiyatı-1
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
const SHEET_NAME = 'FALO MAKARA 2026';

async function main() {
    console.log('━━━ FALO MAKARA ÜRÜN IMPORT ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN — DB\'ye yazılmıyor\n');

    const wb = XLSX.readFile(EXCEL_FILE);
    const ws = wb.Sheets[SHEET_NAME];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 }) as any[][];

    // Header R2'de, veriler R3'ten başlıyor
    const products = rows.slice(3).filter(row => {
        const sku = String(row[0] ?? '').trim();
        const name = String(row[1] ?? '').trim();
        return sku && name;
    }).map(row => ({
        sku: String(row[0]).trim(),
        name: String(row[1]).trim(),
        base_price: typeof row[4] === 'number' && row[4] > 0 ? Math.round(row[4] * 100) / 100 : null,
    }));

    console.log(`[Excel] ${products.length} FALO ürünü okundu\n`);
    const toProcess = LIMIT ? products.slice(0, LIMIT) : products;

    let inserted = 0, skipped = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const p = toProcess[i];
        process.stdout.write(`\r[${i + 1}/${toProcess.length}] ${p.sku.slice(0, 40)}...`);

        const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('sku', p.sku)
            .is('deleted_at', null);

        if ((count ?? 0) > 0) { skipped++; continue; }

        if (DRY_RUN) {
            console.log(`\n  ✓ [DRY] ${p.sku} — ${p.name} — ₺${p.base_price ?? '?'}`);
            inserted++;
            continue;
        }

        const slug = p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const { error } = await supabase.from('products').insert({
            sku: p.sku,
            name: p.name,
            slug: `falo-${slug}-${Date.now()}`,
            base_price: p.base_price,
            sale_price: p.base_price,
            status: 'draft',
            meta: { source: 'falo_2026', imported_at: new Date().toISOString() },
        });

        if (error) { console.error(`\n  ✗ ${p.sku}: ${error.message}`); errors++; }
        else inserted++;
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

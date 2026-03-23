/**
 * MERTSAN 2026 IMPORT — 8 ürün
 * Flags: --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const DRY_RUN = process.argv.includes('--dry-run');
const EXCEL = path.resolve(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx');

async function main() {
    console.log('━━━ MERTSAN 2026 IMPORT ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN\n');

    const rows = XLSX.utils.sheet_to_json<any[]>(
        XLSX.readFile(EXCEL).Sheets['MERTSAN 2026'], { defval: '', header: 1 }
    ) as any[][];

    const products = rows.slice(1).filter(r => String(r[0] ?? '').trim() && typeof r[1] === 'number').map(r => ({
        sku: `MERTSAN-${String(r[0]).trim().replace(/\s+/g, '').replace(/[^A-Z0-9X]/gi, '').toUpperCase()}`,
        name: `${String(r[0]).trim()} Endüstriyel Teker`,
        base_price: typeof r[1] === 'number' ? r[1] : null,
        wholesale_price: typeof r[2] === 'number' ? r[2] : null,
    }));

    const existingSet = new Set<string>();
    const { data } = await supabase.from('products').select('sku').in('sku', products.map(p => p.sku)).is('deleted_at', null);
    (data ?? []).forEach((r: any) => existingSet.add(r.sku));

    const toInsert = products.filter(p => !existingSet.has(p.sku));
    console.log(`[Excel] ${products.length} ürün | Zaten var: ${products.length - toInsert.length} | Eklenecek: ${toInsert.length}`);

    if (DRY_RUN || toInsert.length === 0) {
        toInsert.forEach(p => console.log(`  [DRY] ${p.sku} — ₺${p.base_price} / ₺${p.wholesale_price}`));
        return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('products').upsert(toInsert.map(p => ({
        sku: p.sku, name: p.name,
        slug: `mertsan-${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        base_price: p.base_price, sale_price: p.base_price, wholesale_price: p.wholesale_price,
        vat_rate: 20, currency: 'TRY', quantity_on_hand: 50,
        status: 'draft', tags: ['mertsan', 'rulman'],
        attributes: { 'Ürün Tipi': 'Rulman Teker' },
        meta: { source: 'mertsan_2026', imported_at: now },
    })));

    if (error) console.error(`✗ ${error.message}`);
    else console.log(`\nEklendi: ${toInsert.length}`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

/**
 * CİFTEL 2026 IMPORT — Batch insert
 * Flags: --dry-run, --limit=N
 */
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const BATCH = 100;
const EXCEL = path.resolve(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx');

async function main() {
    console.log('━━━ CİFTEL 2026 IMPORT ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN\n');

    const rows = XLSX.utils.sheet_to_json<any[]>(
        XLSX.readFile(EXCEL).Sheets['ÇİFTEL2026'], { defval: '', header: 1 }
    ) as any[][];

    const all = rows.slice(1).filter(r => String(r[0] ?? '').trim() && String(r[1] ?? '').trim() && String(r[0]) !== 'ÜRÜN KODU').map(r => ({
        sku: `CIFTEL-${String(r[0]).trim()}`,
        name: String(r[1]).trim(),
        base_price: typeof r[2] === 'number' ? Math.round(Math.abs(r[2]) * 100) / 100 : null,
        cost_price: typeof r[3] === 'number' ? Math.round(Math.abs(r[3]) * 100) / 100 : null,
    }));

    const products = LIMIT ? all.slice(0, LIMIT) : all;
    console.log(`[Excel] ${products.length} ürün`);

    const existingSet = new Set<string>();
    for (let i = 0; i < products.length; i += 1000) {
        const { data } = await supabase.from('products').select('sku').in('sku', products.slice(i, i + 1000).map(p => p.sku)).is('deleted_at', null);
        (data ?? []).forEach((r: any) => existingSet.add(r.sku));
    }

    const toInsert = products.filter(p => !existingSet.has(p.sku));
    console.log(`  Zaten var: ${products.length - toInsert.length} | Eklenecek: ${toInsert.length}`);
    if (DRY_RUN) { console.log('  [DRY-RUN]'); return; }

    let inserted = 0, errors = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH);
        process.stdout.write(`\r  [${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}]...`);

        const { error } = await supabase.from('products').upsert(batch.map(p => ({
            sku: p.sku, name: p.name,
            slug: `ciftel-${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            base_price: p.base_price, sale_price: p.base_price, cost_price: p.cost_price,
            vat_rate: 20, currency: 'TRY', quantity_on_hand: 50,
            status: 'draft', tags: ['ciftel'], attributes: {},
            meta: { source: 'ciftel_2026', imported_at: now },
        })));

        if (error) { console.error(`\n  ✗ ${error.message}`); errors += batch.length; }
        else { inserted += batch.length; }
    }
    console.log(`\n\nEklendi: ${inserted} | Atlandı: ${products.length - toInsert.length} | Hata: ${errors}`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

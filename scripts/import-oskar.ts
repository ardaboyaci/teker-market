/**
 * OSKAR 2026 IMPORT — Batch insert
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
    console.log('━━━ OSKAR 2026 IMPORT ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN\n');

    const rows = XLSX.utils.sheet_to_json<any[]>(
        XLSX.readFile(EXCEL).Sheets['OSKAR2026'], { defval: '', header: 1 }
    ) as any[][];

    let currentCategory = '';
    const all: { sku: string; name: string; base_price: number | null; ambalaj: string; category: string }[] = [];

    for (let i = 9; i < rows.length; i++) {
        const r = rows[i];
        const col1 = String(r[1] ?? '').trim();
        const col2 = String(r[2] ?? '').trim();
        const col4 = r[4];
        if (!col1 && !col2) continue;
        // Kategori satırı
        if (!col1 && col2 && col2 === col2.toUpperCase() && typeof col4 !== 'number') { currentCategory = col2; continue; }
        if (col1 && typeof col4 === 'number' && col4 > 0) {
            all.push({ sku: `OSKAR-${col1}`, name: col2 || col1, base_price: Math.round(col4 * 100) / 100, ambalaj: String(r[3] ?? '').trim(), category: currentCategory });
        }
    }

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
            slug: `oskar-${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            base_price: p.base_price, sale_price: p.base_price,
            vat_rate: 20, currency: 'TRY', quantity_on_hand: 50,
            status: 'draft', tags: ['oskar'],
            attributes: { ...(p.category ? { 'Kategori': p.category } : {}), ...(p.ambalaj ? { 'Ambalaj Adedi': p.ambalaj } : {}) },
            meta: { source: 'oskar_2026', category: p.category, imported_at: now },
        })));

        if (error) { console.error(`\n  ✗ ${error.message}`); errors += batch.length; }
        else { inserted += batch.length; }
    }
    console.log(`\n\nEklendi: ${inserted} | Atlandı: ${products.length - toInsert.length} | Hata: ${errors}`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

/**
 * EMES TAM IMPORT — EMES 2026, YEDEK EMES 2026, EMES KULP 2026
 * Batch insert (100'er) ile hızlı çalışır.
 * Flags: --dry-run, --limit=N, --sheet=emes|yedek|kulp
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
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const SHEET_FILTER = process.argv.find(a => a.startsWith('--sheet='))?.split('=')[1]?.toLowerCase() ?? null;
const BATCH = 100;
const EXCEL = path.resolve(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx');

function p(val: any) {
    if (typeof val !== 'number') return null;
    const v = Math.abs(val);
    return v > 0 ? Math.round(v * 100) / 100 : null;
}

function slug(prefix: string, sku: string) {
    return `${prefix}-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

function readEmes(sheetName: string, source: string) {
    const rows = XLSX.utils.sheet_to_json<any[]>(
        XLSX.readFile(EXCEL).Sheets[sheetName], { defval: '', header: 1 }
    ) as any[][];
    const isYedek = sheetName.includes('YEDEK');
    const [start, skuC, nameC, typeC, amb, p40, p50, minC] = isYedek
        ? [1, 6, 8, 5, 7, 10, 12, 14]
        : [2, 8, 10, 7, 9, 12, 14, 16];

    return rows.slice(start).filter(r => String(r[skuC] ?? '').trim() && String(r[nameC] ?? '').trim()).map(r => ({
        sku: String(r[skuC]).trim(),
        name: String(r[nameC]).trim(),
        urun_tipi: String(r[typeC] ?? '').trim(),
        base_price: p(r[p40]),
        wholesale_price: p(r[p50]),
        min_stock: typeof r[minC] === 'number' && r[minC] > 0 ? r[minC] : 0,
        ambalaj: typeof r[amb] === 'number' ? r[amb] : null,
        attrs: isYedek ? {
            ...(r[0] ? { 'Lastik Tipi': String(r[0]).trim() } : {}),
            ...(r[3] === '*' ? { 'Fren': 'Var' } : {}),
        } : {
            ...(r[0] ? { 'Seri': String(r[0]).trim() } : {}),
            ...(r[3] ? { 'Teker Çap (mm)': String(r[3]).trim() } : {}),
            ...(r[5] === '*' ? { 'Fren': 'Var' } : {}),
            ...(r[6] === '*' ? { 'Inox': 'Var' } : {}),
            ...(r[7] ? { 'Ürün Tipi': String(r[7]).trim() } : {}),
        },
        source,
    }));
}

function readKulp() {
    const rows = XLSX.utils.sheet_to_json<any[]>(
        XLSX.readFile(EXCEL).Sheets['EMES KULP 2026'], { defval: '', header: 1 }
    ) as any[][];
    return rows.slice(1).filter(r => String(r[0] ?? '').trim() && String(r[1] ?? '').trim()).map(r => ({
        sku: String(r[0]).trim(),
        name: String(r[1]).trim(),
        urun_tipi: 'KULP',
        base_price: p(r[6]),
        wholesale_price: p(r[7]),
        cost_price: typeof r[3] === 'number' ? Math.round(r[3] * 100) / 100 : null,
        min_stock: 0,
        ambalaj: typeof r[2] === 'number' ? r[2] : null,
        attrs: { 'Ürün Tipi': 'Kulp' },
        source: 'emes_kulp_2026',
    }));
}

async function importAll(products: ReturnType<typeof readEmes>, label: string, prefix: string) {
    const all = LIMIT ? products.slice(0, LIMIT) : products;
    console.log(`\n━━━ ${label} — ${all.length} ürün ━━━`);

    // Mevcut SKU'ları 1000'lik parçalarda çek
    const existingSet = new Set<string>();
    for (let i = 0; i < all.length; i += 1000) {
        const { data } = await supabase.from('products').select('sku')
            .in('sku', all.slice(i, i + 1000).map(p => p.sku)).is('deleted_at', null);
        (data ?? []).forEach((r: any) => existingSet.add(r.sku));
    }

    const toInsert = all.filter(p => !existingSet.has(p.sku));
    console.log(`  Zaten var: ${all.length - toInsert.length} | Eklenecek: ${toInsert.length}`);
    if (DRY_RUN) { console.log(`  [DRY-RUN] işlem yapılmadı`); return { inserted: 0, skipped: all.length - toInsert.length, errors: 0 }; }

    let inserted = 0, errors = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH);
        process.stdout.write(`\r  [${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}] insert ediliyor...`);

        const rows = batch.map((pp: any) => ({
            sku: pp.sku,
            name: pp.name,
            slug: slug(prefix, pp.sku),
            base_price: pp.base_price,
            sale_price: pp.base_price,
            wholesale_price: pp.wholesale_price,
            cost_price: pp.cost_price ?? null,
            vat_rate: 20,
            currency: 'TRY',
            quantity_on_hand: 50,
            min_stock_level: pp.min_stock ?? 0,
            attributes: pp.attrs ?? {},
            status: 'draft',
            tags: ['emes', pp.urun_tipi?.toLowerCase()].filter(Boolean),
            meta: { source: pp.source, urun_tipi: pp.urun_tipi, ambalaj_adet: pp.ambalaj, imported_at: now },
        }));

        const { error } = await supabase.from('products').upsert(rows, { onConflict: 'sku', ignoreDuplicates: true });
        if (error) { console.error(`\n  ✗ Batch ${i}-${i + BATCH}: ${error.message}`); errors += batch.length; }
        else { inserted += batch.length; }
    }

    console.log(`\n  Eklendi: ${inserted} | Atlandı: ${all.length - toInsert.length} | Hata: ${errors}`);
    return { inserted, skipped: all.length - toInsert.length, errors };
}

async function main() {
    console.log('━━━ EMES TAM IMPORT ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN\n');

    let totI = 0, totS = 0, totE = 0;

    if (!SHEET_FILTER || SHEET_FILTER === 'emes') {
        const r = await importAll(readEmes('EMES 2026 ', 'emes_2026'), 'EMES 2026 (Ana)', 'emes');
        totI += r.inserted; totS += r.skipped; totE += r.errors;
    }
    if (!SHEET_FILTER || SHEET_FILTER === 'yedek') {
        const r = await importAll(readEmes('YEDEK EMES 2026', 'emes_yedek_2026'), 'YEDEK EMES', 'emes-yedek');
        totI += r.inserted; totS += r.skipped; totE += r.errors;
    }
    if (!SHEET_FILTER || SHEET_FILTER === 'kulp') {
        const r = await importAll(readKulp() as any, 'EMES KULP', 'emes-kulp');
        totI += r.inserted; totS += r.skipped; totE += r.errors;
    }

    console.log('\n━━━ GENEL ÖZET ━━━');
    console.table({ Eklendi: { Adet: totI }, Atlandı: { Adet: totS }, Hata: { Adet: totE } });
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

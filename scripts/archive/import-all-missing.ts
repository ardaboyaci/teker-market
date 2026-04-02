/**
 * MASTER IMPORT — Tüm eksik tedarikçiler
 *
 * Tedarikçiler: EMES, EMES KULP, YEDEK EMES, ZET, KAUÇUK TAKOZ, ÇİFTEL, OSKAR, FALO, MERTSAN
 *
 * Flags:
 *   --dry-run        DB'ye yazmadan loglar
 *   --supplier=XXX   Sadece belirtilen tedarikçiyi import et (emes, emes-kulp, yedek-emes, zet, kaucuk, ciftel, oskar, falo, mertsan)
 *   --limit=N        İlk N ürünü işle
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
const supplierArg = process.argv.find(a => a.startsWith('--supplier='));
const SUPPLIER_FILTER = supplierArg ? supplierArg.split('=')[1].toLowerCase() : null;
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const EXCEL_FILE = path.resolve(process.cwd(), '2026 BÜTÜN LİSTELER 5.xlsx');

interface Product {
    sku: string;
    name: string;
    base_price: number | null;
    supplier: string;
    meta?: Record<string, unknown>;
}

function makeSlug(sku: string, prefix: string): string {
    const cleaned = sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${prefix}-${cleaned}-${Date.now()}`;
}

// ─── OKUYUCULAR ────────────────────────────────────────────────────────────

function readEmes(wb: XLSX.WorkBook): Product[] {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['EMES 2026 '], { header: 1, defval: '' }) as any[][];
    return rows.slice(2).filter(r => {
        const sku = String(r[8] ?? '').trim();
        return sku && sku.length > 2;
    }).map(r => ({
        sku: String(r[8]).trim(),
        name: String(r[10]).trim(),
        base_price: typeof r[12] === 'number' && r[12] > 0 ? Math.round(r[12] * 100) / 100 : null,
        supplier: 'EMES',
        meta: {
            source: 'emes_2026',
            type: String(r[7] ?? '').trim(),
            package_qty: r[9] || null,
            list_price: typeof r[11] === 'number' ? Math.abs(Math.round(r[11] * 100) / 100) : null,
            price_40: typeof r[12] === 'number' && r[12] > 0 ? Math.round(r[12] * 100) / 100 : null,
            price_45: typeof r[13] === 'number' && r[13] > 0 ? Math.round(r[13] * 100) / 100 : null,
            price_50: typeof r[14] === 'number' && r[14] > 0 ? Math.round(r[14] * 100) / 100 : null,
        },
    }));
}

function readEmesCulp(wb: XLSX.WorkBook): Product[] {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['EMES KULP 2026'], { header: 1, defval: '' }) as any[][];
    return rows.slice(1).filter(r => {
        const sku = String(r[0] ?? '').trim();
        return sku && sku.length > 1;
    }).map(r => ({
        sku: String(r[0]).trim(),
        name: String(r[1]).trim(),
        base_price: typeof r[3] === 'number' && r[3] > 0 ? Math.round(r[3] * 100) / 100 : null,
        supplier: 'EMES KULP',
        meta: {
            source: 'emes_kulp_2026',
            package_qty: r[2] || null,
            net_price: typeof r[3] === 'number' ? Math.round(r[3] * 100) / 100 : null,
            // %30 iskontolu perakende (col6 negatif iskonto tutarı)
            retail_price: typeof r[6] === 'number' ? Math.round((Number(r[3]) + Number(r[6])) * 100) / 100 : null,
        },
    }));
}

function readYedekEmes(wb: XLSX.WorkBook): Product[] {
    const sheetName = 'YEDEK EMES 2026';
    if (!wb.Sheets[sheetName]) return [];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' }) as any[][];
    return rows.slice(2).filter(r => {
        const sku = String(r[8] ?? '').trim();
        return sku && sku.length > 2;
    }).map(r => ({
        sku: `YEDEK-${String(r[8]).trim()}`,
        name: String(r[10]).trim(),
        base_price: typeof r[12] === 'number' && r[12] > 0 ? Math.round(r[12] * 100) / 100 : null,
        supplier: 'EMES YEDEK',
        meta: {
            source: 'yedek_emes_2026',
            type: String(r[7] ?? '').trim(),
            package_qty: r[9] || null,
        },
    }));
}

function readZet(wb: XLSX.WorkBook): Product[] {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['ZET'], { header: 1, defval: '' }) as any[][];
    let currentCategory = '';
    const products: Product[] = [];

    for (const row of rows) {
        const col0 = String(row[0] ?? '').trim();
        const col1 = row[1];

        // Kategori başlığı — fiyatı olmayan, metin olan satırlar
        if (col0 && typeof col1 !== 'number') {
            currentCategory = col0;
            continue;
        }

        // Ürün satırı — col0 ürün kodu, col1 sayısal fiyat
        if (col0 && typeof col1 === 'number' && col1 > 0) {
            const fiyat = Math.round(col1 * 100) / 100;
            products.push({
                sku: col0,
                name: col0, // ZET sadece kod sağlıyor, isim olarak kodu kullan
                base_price: fiyat,
                supplier: 'ZET',
                meta: {
                    source: 'zet_2026',
                    category: currentCategory,
                    net_price: fiyat,
                    retail_price: Math.round(fiyat * 0.85 * 100) / 100,   // %15 perakende iskonto
                    wholesale_price: Math.round(fiyat * 0.80 * 100) / 100, // %20 toptan iskonto
                },
            });
        }
    }
    return products;
}

function readKaucuk(wb: XLSX.WorkBook): Product[] {
    const sheetName = 'KAUÇUK TAKOZ';
    if (!wb.Sheets[sheetName]) return [];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' }) as any[][];
    return rows.slice(2).filter(r => {   // slice(2) → header atlıyoruz
        const sku = String(r[0] ?? '').trim();
        return sku && sku.length > 1 && sku !== 'Stok Kodu';
    }).map(r => ({
        sku: String(r[0]).trim(),
        name: String(r[1]).trim(),
        base_price: typeof r[4] === 'number' && r[4] > 0 ? Math.round(r[4] * 100) / 100 : null,
        supplier: 'KAUÇUK TAKOZ',
        meta: {
            source: 'kaucuk_takoz_2026',
            barcode: String(r[6] ?? '').trim() || null,
            kdv: 20,
        },
    }));
}

function readCiftel(wb: XLSX.WorkBook): Product[] {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['ÇİFTEL2026'], { header: 1, defval: '' }) as any[][];
    return rows.slice(1).filter(r => {
        const sku = String(r[0] ?? '').trim();
        return sku && sku.length > 1;
    }).map(r => {
        const listeFiyat = typeof r[2] === 'number' ? r[2] : 0;
        const iskonto = typeof r[3] === 'number' ? r[3] : 0; // negatif
        const netFiyat = Math.round((listeFiyat + iskonto) * 100) / 100; // liste + negatif iskonto
        return {
            sku: String(r[0]).trim(),
            name: String(r[1]).trim(),
            base_price: netFiyat > 0 ? netFiyat : null,
            supplier: 'ÇİFTEL',
            meta: {
                source: 'ciftel_2026',
                list_price: Math.round(listeFiyat * 100) / 100,
                net_price_excl_kdv: netFiyat > 0 ? netFiyat : null,
            },
        };
    });
}

function readOskar(wb: XLSX.WorkBook): Product[] {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['OSKAR2026'], { header: 1, defval: '' }) as any[][];
    return rows.filter(r => {
        const sku = String(r[1] ?? '').trim();
        const fiyat = r[4];
        return sku && sku.length > 2 && typeof fiyat === 'number' && fiyat > 0;
    }).map(r => ({
        sku: String(r[1]).trim(),
        name: String(r[2]).trim(),
        base_price: Math.round(Number(r[4]) * 100) / 100,
        supplier: 'OSKAR',
        meta: {
            source: 'oskar_2026',
            package_qty: r[3] || null,
        },
    }));
}

function readFalo(wb: XLSX.WorkBook): Product[] {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['FALO MAKARA 2026'], { header: 1, defval: '' }) as any[][];
    return rows.slice(3).filter(r => {
        const sku = String(r[0] ?? '').trim();
        const name = String(r[1] ?? '').trim();
        return sku && name;
    }).map(r => ({
        sku: String(r[0]).trim(),
        name: String(r[1]).trim(),
        base_price: typeof r[4] === 'number' && r[4] > 0 ? Math.round(r[4] * 100) / 100 : null,
        supplier: 'FALO',
        meta: { source: 'falo_2026' },
    }));
}

function readMertsan(wb: XLSX.WorkBook): Product[] {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['MERTSAN 2026'], { header: 1, defval: '' }) as any[][];
    return rows.slice(1).filter(r => {
        const name = String(r[0] ?? '').trim();
        return name && typeof r[1] === 'number';
    }).map((r, i) => {
        const name = String(r[0]).trim();
        const sku = `MERTSAN-${name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9-]/g, '').toUpperCase()}-${i}`;
        return {
            sku,
            name: `${name} RULMANLI`,
            base_price: typeof r[2] === 'number' ? Math.round(r[2] * 100) / 100 : (typeof r[1] === 'number' ? Math.round(r[1] * 100) / 100 : null),
            supplier: 'MERTSAN',
            meta: {
                source: 'mertsan_2026',
                retail_price: typeof r[1] === 'number' ? Math.round(r[1] * 100) / 100 : null,
                wholesale_price: typeof r[2] === 'number' ? Math.round(r[2] * 100) / 100 : null,
            },
        };
    });
}

// ─── IMPORT ────────────────────────────────────────────────────────────────

async function importProducts(products: Product[], prefix: string) {
    const toProcess = LIMIT ? products.slice(0, LIMIT) : products;
    let inserted = 0, skipped = 0, errors = 0;

    // Excel içinde duplicate SKU'ları deduplicate et (son satır kazanır)
    const dedupedMap = new Map<string, Product>();
    for (const p of toProcess) dedupedMap.set(p.sku, p);
    const deduped = Array.from(dedupedMap.values());
    const excelDupes = toProcess.length - deduped.length;
    if (excelDupes > 0) console.log(`  ⚠ Excel'de ${excelDupes} duplicate SKU bulundu, deduplicate edildi`);

    // Mevcut SKU'ları 500'er batch'te çek (Supabase .in() limiti)
    const existingSkus = new Set<string>();
    const SKU_FETCH_BATCH = 500;
    const allSkus = deduped.map(p => p.sku);
    for (let i = 0; i < allSkus.length; i += SKU_FETCH_BATCH) {
        const chunk = allSkus.slice(i, i + SKU_FETCH_BATCH);
        const { data } = await supabase
            .from('products')
            .select('sku')
            .in('sku', chunk)
            .is('deleted_at', null);
        (data ?? []).forEach((r: any) => existingSkus.add(r.sku));
    }

    const toInsert = deduped.filter(p => !existingSkus.has(p.sku));
    skipped = deduped.length - toInsert.length;

    if (DRY_RUN) {
        console.log(`  [DRY] ${toInsert.length} ürün eklenecek, ${skipped} zaten var`);
        toInsert.slice(0, 5).forEach(p => console.log(`    ✓ ${p.sku} — ${p.name.slice(0, 50)} — ₺${p.base_price ?? '?'}`));
        if (toInsert.length > 5) console.log(`    ... ve ${toInsert.length - 5} ürün daha`);
        inserted = toInsert.length;
    } else {
        // upsert kullan (ON CONFLICT DO NOTHING) — batch içinde kalan duplicate'lere karşı güvenli
        const BATCH = 50;
        for (let i = 0; i < toInsert.length; i += BATCH) {
            const batch = toInsert.slice(i, i + BATCH);
            process.stdout.write(`\r  [${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}] import ediliyor...`);

            const rows = batch.map(p => ({
                sku: p.sku,
                name: p.name,
                slug: makeSlug(p.sku, prefix),
                base_price: p.base_price,
                sale_price: p.base_price,
                status: 'draft' as const,
                meta: { ...(p.meta ?? {}), supplier: p.supplier, imported_at: new Date().toISOString() },
            }));

            const { error } = await supabase
                .from('products')
                .upsert(rows, { onConflict: 'sku', ignoreDuplicates: true });
            if (error) {
                console.error(`\n  ✗ Batch hatası: ${error.message}`);
                errors += batch.length;
            } else {
                inserted += batch.length;
            }
        }
        process.stdout.write('\n');
    }

    return { inserted, skipped, errors, total: toProcess.length };
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
    console.log('━━━ MASTER IMPORT ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN — DB\'ye yazılmıyor\n');
    if (SUPPLIER_FILTER) console.log(`🎯 Sadece: ${SUPPLIER_FILTER}\n`);

    const wb = XLSX.readFile(EXCEL_FILE);

    const suppliers: { key: string; label: string; prefix: string; reader: () => Product[] }[] = [
        { key: 'emes',       label: 'EMES 2026',      prefix: 'emes',    reader: () => readEmes(wb) },
        { key: 'emes-kulp',  label: 'EMES KULP 2026', prefix: 'emes-kulp', reader: () => readEmesCulp(wb) },
        { key: 'yedek-emes', label: 'YEDEK EMES 2026',prefix: 'yedek-emes', reader: () => readYedekEmes(wb) },
        { key: 'zet',        label: 'ZET',             prefix: 'zet',     reader: () => readZet(wb) },
        { key: 'kaucuk',     label: 'KAUÇUK TAKOZ',    prefix: 'kaucuk',  reader: () => readKaucuk(wb) },
        { key: 'ciftel',     label: 'ÇİFTEL',          prefix: 'ciftel',  reader: () => readCiftel(wb) },
        { key: 'oskar',      label: 'OSKAR',            prefix: 'oskar',   reader: () => readOskar(wb) },
        { key: 'falo',       label: 'FALO',             prefix: 'falo',    reader: () => readFalo(wb) },
        { key: 'mertsan',    label: 'MERTSAN',          prefix: 'mertsan', reader: () => readMertsan(wb) },
    ];

    const summary: Record<string, { inserted: number; skipped: number; errors: number; total: number }> = {};

    for (const s of suppliers) {
        if (SUPPLIER_FILTER && s.key !== SUPPLIER_FILTER) continue;

        console.log(`\n▶ ${s.label}`);
        const products = s.reader();
        console.log(`  Excel'den okunan: ${products.length} ürün`);

        if (products.length === 0) {
            console.log('  ⚠ Sheet bulunamadı veya boş, atlandı.');
            continue;
        }

        const result = await importProducts(products, s.prefix);
        summary[s.label] = result;
        console.log(`  ✓ Eklendi: ${result.inserted} | Zaten vardı: ${result.skipped} | Hata: ${result.errors}`);
    }

    console.log('\n\n━━━ GENEL ÖZET ━━━');
    let totalInserted = 0, totalSkipped = 0, totalErrors = 0, totalTotal = 0;
    for (const [label, r] of Object.entries(summary)) {
        console.log(`  ${label.padEnd(20)} → Eklendi: ${String(r.inserted).padStart(5)} | Atlandı: ${String(r.skipped).padStart(5)} | Hata: ${r.errors}`);
        totalInserted += r.inserted;
        totalSkipped += r.skipped;
        totalErrors += r.errors;
        totalTotal += r.total;
    }
    console.log(`${'─'.repeat(60)}`);
    console.log(`  ${'TOPLAM'.padEnd(20)} → Eklendi: ${String(totalInserted).padStart(5)} | Atlandı: ${String(totalSkipped).padStart(5)} | Hata: ${totalErrors}`);
    console.log(`\n  DB'ye eklenen toplam ürün: ${totalInserted}`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

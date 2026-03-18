/**
 * EMES SUPPLIER SKU SYNC
 *
 * DB'deki EMES serisi ürünleri Excel kataloğuyla fuzzy eşleştirir ve
 * meta.supplier_skus.emes / meta.supplier_price_lists.emes_40_isk alanlarını günceller.
 *
 * Flags:
 *   --dry-run   DB'ye yazmadan sadece log
 *   --limit=N   İlk N ürünü işle
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import XLSX from 'xlsx';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Supabase credentials eksik (.env.local)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN  = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const EXCEL_PATH = path.resolve(__dirname, '../2026 BÜTÜN LİSTELER 5.xlsx');
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const UNMATCHED_FILE = path.join(OUTPUT_DIR, 'unmatched-emes.json');

// EMES prefix'leri — bu prefix'lerle başlayan SKU'lar işlenecek
const EMES_PREFIXES = ['EA', 'EB', 'ED', 'EH', 'EK', 'EM', 'EP', 'ER', 'ET', 'EU', 'EV', 'EW', 'EZ', 'YT'];

// ── Token tabanlı eşleşme skoru (scrape-pricing.ts:70-78 ile aynı) ────────────
function tokenMatchScore(query: string, productName: string): number {
    const tokens = query.toUpperCase().match(/[A-Z]+|\d+/g) ?? [];
    const nameUp = productName.toUpperCase();
    if (!tokens.length) return 0;
    let hits = 0;
    for (const t of tokens) {
        if (t.length >= 2 && nameUp.includes(t)) hits++;
    }
    return hits / tokens.length;
}

// ── Excel satırları ───────────────────────────────────────────────────────────
interface ExcelRow {
    sku:         string;
    name:        string;
    price_40isk: number | null;
}

function loadExcelRows(): ExcelRow[] {
    const wb = XLSX.readFile(EXCEL_PATH);
    const rows: ExcelRow[] = [];

    // Sheet 1: 'EMES 2026 ' — row 3+ (0-based index 2+), col8=sku, col10=name, col12=price_40isk
    const ws1 = wb.Sheets['EMES 2026 '];
    if (ws1) {
        const data: unknown[][] = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' }) as unknown[][];
        for (let i = 2; i < data.length; i++) {
            const r = data[i];
            const sku  = String(r[8] ?? '').trim();
            const name = String(r[10] ?? '').trim();
            const raw  = r[12];
            const price = typeof raw === 'number' && raw > 0 ? raw : null;
            if (sku && name) rows.push({ sku, name, price_40isk: price });
        }
    }

    // Sheet 2: 'EMES KULP 2026' — row 2+ (0-based index 1+), col0=sku, col1=name, col3=price
    const ws2 = wb.Sheets['EMES KULP 2026'];
    if (ws2) {
        const data: unknown[][] = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' }) as unknown[][];
        for (let i = 1; i < data.length; i++) {
            const r = data[i];
            const sku  = String(r[0] ?? '').trim();
            const name = String(r[1] ?? '').trim();
            const raw  = r[3];
            const price = typeof raw === 'number' && raw > 0 ? raw : null;
            if (sku && name) rows.push({ sku, name, price_40isk: price });
        }
    }

    return rows;
}

// ── DB ürünleri ───────────────────────────────────────────────────────────────
interface DbProduct {
    id:   string;
    sku:  string;
    name: string;
    meta: Record<string, unknown> | null;
}

async function fetchEmesProducts(): Promise<DbProduct[]> {
    const prefixFilters = EMES_PREFIXES.map(p => `sku.ilike.${p}%`).join(',');

    const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, meta')
        .or(prefixFilters)
        .is('deleted_at', null)
        .order('sku');

    if (error) {
        console.error('[DB] Hata:', error.message);
        process.exit(1);
    }

    return (data ?? []) as DbProduct[];
}

// ── Ana akış ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ EMES SUPPLIER SKU SYNC ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN modu — DB\'ye yazılmıyor\n');

    // Excel satırlarını yükle
    console.log('[Excel] Yükleniyor...');
    const excelRows = loadExcelRows();
    console.log(`[Excel] ${excelRows.length} satır yüklendi (EMES 2026 + EMES KULP 2026)\n`);

    // DB'den EMES ürünleri çek
    console.log('[DB] EMES serisi ürünler çekiliyor...');
    let products = await fetchEmesProducts();

    if (LIMIT) {
        products = products.slice(0, LIMIT);
        console.log(`[DB] --limit=${LIMIT} uygulandı`);
    }

    console.log(`[Sync] ${products.length} EMES ürünü işlenecek\n`);

    const CHUNK = 10;
    const totalChunks = Math.ceil(products.length / CHUNK);

    let matched   = 0;
    let unmatched = 0;
    let errors    = 0;
    const unmatchedList: { sku: string; name: string }[] = [];

    for (let i = 0; i < products.length; i += CHUNK) {
        const chunk    = products.slice(i, i + CHUNK);
        const chunkNum = Math.floor(i / CHUNK) + 1;
        console.log(`[Chunk ${chunkNum}/${totalChunks}] ${chunk.length} ürün...`);

        for (const product of chunk) {
            // En iyi Excel eşini bul
            let bestRow: ExcelRow | null = null;
            let bestScore = 0;

            for (const row of excelRows) {
                const score = tokenMatchScore(product.name, row.name);
                if (score >= 0.65 && score > bestScore) {
                    bestScore = score;
                    bestRow   = row;
                }
            }

            if (!bestRow) {
                console.log(`  ✗ ${product.sku} → eşleşme yok`);
                unmatched++;
                unmatchedList.push({ sku: product.sku, name: product.name });
                continue;
            }

            console.log(`  ✓ ${product.sku} → ${bestRow.sku} (skor: ${bestScore.toFixed(2)})`);
            matched++;

            if (DRY_RUN) continue;

            // meta JSONB güncelle (mevcut alanları koruyarak)
            const existingMeta = (product.meta as Record<string, unknown>) ?? {};
            const existingSupplierSkus   = (existingMeta.supplier_skus   as Record<string, unknown>) ?? {};
            const existingSupplierPrices = (existingMeta.supplier_price_lists as Record<string, unknown>) ?? {};

            const newMeta: Record<string, unknown> = {
                ...existingMeta,
                supplier_skus: {
                    ...existingSupplierSkus,
                    emes: bestRow.sku,
                },
            };

            if (bestRow.price_40isk !== null) {
                newMeta.supplier_price_lists = {
                    ...existingSupplierPrices,
                    emes_40_isk: Math.round(bestRow.price_40isk * 100) / 100,
                };
            }

            const { error } = await supabase
                .from('products')
                .update({ meta: newMeta })
                .eq('id', product.id);

            if (error) {
                console.error(`    -> DB hatası: ${error.message}`);
                errors++;
            }
        }

        await sleep(200);
    }

    // Eşleşmeyen ürünleri dosyaya yaz
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(UNMATCHED_FILE, JSON.stringify(unmatchedList, null, 2), 'utf-8');

    console.log('\n━━━ ÖZET ━━━');
    console.table({
        'Eşleşen':     { Adet: matched },
        'Eşleşmeyen':  { Adet: unmatched },
        'Hata':        { Adet: errors },
    });
    console.log(`[Çıktı] ${UNMATCHED_FILE} yazıldı (${unmatchedList.length} ürün)`);
}

main().catch((err: unknown) => {
    if (err instanceof Error) console.error('[FATAL]', err.message);
    process.exit(1);
});

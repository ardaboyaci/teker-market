/**
 * KAUÇUK TAKOZ 2026 IMPORT
 *
 * KAUÇUK TAKOZ sheet'inden ürünleri Supabase'e draft statüsüyle import eder.
 * col0=sku, col1=name, col4=satis_fiyati (row 2+)
 *
 * Flags:
 *   --dry-run   DB'ye yazmadan sadece log
 *   --limit=N   İlk N ürünü işle
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import XLSX from 'xlsx';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Supabase credentials eksik (.env.local)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DRY_RUN  = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const EXCEL_PATH = path.resolve(__dirname, '../2026 BÜTÜN LİSTELER 5.xlsx');

function makeSlug(sku: string, name: string): string {
    return (sku + '-' + name)
        .toLowerCase()
        .replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u').replace(/[ş]/g, 's')
        .replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const usedSlugs = new Set<string>();
function uniqueSlug(sku: string, name: string): string {
    const base = makeSlug(sku, name);
    if (!usedSlugs.has(base)) { usedSlugs.add(base); return base; }
    let n = 2;
    while (usedSlugs.has(`${base}-${n}`)) n++;
    const slug = `${base}-${n}`;
    usedSlugs.add(slug);
    return slug;
}

interface Row { sku: string; name: string; price: number; }

function loadRows(): { valid: Row[]; skipped: number } {
    const wb = XLSX.readFile(EXCEL_PATH);
    const ws = wb.Sheets['KAUÇUK TAKOZ'];
    if (!ws) { console.error('[Excel] KAUÇUK TAKOZ sheet bulunamadı'); process.exit(1); }

    const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    const valid: Row[] = [];
    let skipped = 0;

    // Row 0 = boş başlık, Row 1 = header, Row 2+ = veri
    for (let i = 2; i < data.length; i++) {
        const r = data[i];
        const sku  = String(r[0] ?? '').trim();
        const name = String(r[1] ?? '').trim();
        const raw  = r[4]; // SATIŞ FİYATI
        const price = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));

        if (!sku || !name) { skipped++; continue; }
        if (!price || price <= 0 || isNaN(price)) { skipped++; continue; }

        valid.push({ sku, name, price });
    }

    return { valid, skipped };
}

async function main() {
    console.log('━━━ KAUÇUK TAKOZ 2026 IMPORT ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN modu — DB\'ye yazılmıyor\n');

    const { valid, skipped } = loadRows();
    console.log(`[Import] KAUÇUK TAKOZ — ${valid.length + skipped} satır okundu`);
    console.log(`[Validasyon] ${valid.length} geçerli | ${skipped} atlandı\n`);

    let rows = LIMIT ? valid.slice(0, LIMIT) : valid;
    if (LIMIT) console.log(`[Limit] --limit=${LIMIT} uygulandı\n`);

    const CHUNK = 20;
    const totalChunks = Math.ceil(rows.length / CHUNK);
    const importedAt  = new Date().toISOString();
    let inserted = 0, errors = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk    = rows.slice(i, i + CHUNK);
        const chunkNum = Math.floor(i / CHUNK) + 1;
        console.log(`[Chunk ${chunkNum}/${totalChunks}] ${chunk.length} ürün upsert...`);

        const payload = chunk.map(row => ({
            sku:        row.sku,
            name:       row.name,
            slug:       uniqueSlug(row.sku, row.name),
            base_price: row.price,
            sale_price: row.price,
            status:     'draft',
            vat_rate:   20,
            currency:   'TRY',
            meta: { source: 'kaucuk_takoz_2026', imported_at: importedAt },
        }));

        if (DRY_RUN) {
            payload.forEach(p => console.log(`  [DRY] ${p.sku} — ${p.name} — ₺${p.sale_price}`));
            inserted += chunk.length;
            continue;
        }

        const { error } = await supabase.from('products').upsert(payload, { onConflict: 'sku' });
        if (error) { console.error(`  -> Chunk hatası: ${error.message}`); errors += chunk.length; }
        else inserted += chunk.length;
        await sleep(200);
    }

    console.log('\n━━━ ÖZET ━━━');
    console.table({ 'Eklenen': { Adet: inserted }, 'Hata': { Adet: errors }, 'Atlanan': { Adet: skipped } });
}

main().catch((err: unknown) => { if (err instanceof Error) console.error('[FATAL]', err.message); process.exit(1); });

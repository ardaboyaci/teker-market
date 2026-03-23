/**
 * KAUÇUK TAKOZ GÖRSEL BOTU
 * cifteltakoz.com'dan tip bazlı görsel eşleştirme.
 * DB ürün adından "TİP X" çıkarılır, o tipe ait görsel kullanılır.
 * Flags: --dry-run, --limit=N, --reset
 */
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { downloadAndProcess, uploadToStorage, linkToProduct, sleep } from './lib/image-pipeline.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes('--dry-run');
const RESET = process.argv.includes('--reset');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output/kaucuk-images');
const LOG_FILE = path.resolve(process.cwd(), 'scripts/output/kaucuk-images-log.json');
const CHECKPOINT_FILE = path.resolve(process.cwd(), 'scripts/output/kaucuk-checkpoint.json');
const BASE_URL = 'https://www.cifteltakoz.com';

const TIP_IMAGE_MAP: Record<string, string> = {
    'A': `${BASE_URL}/upload/urunler/kucuk/cift-vidali-takoz-c-tipi.jpg`,
    'B': `${BASE_URL}/upload/urunler/kucuk/sacli-pullu-vidali-sarsinti-giderici-kaucuk-takoz.jpg`,
    'C': `${BASE_URL}/upload/urunler/kucuk/cift-somunlu-takoz-c-tipi_1.jpg`,
    'D': `${BASE_URL}/upload/urunler/kucuk/tek-vidali-takoz-d-tipi.jpg`,
    'E': `${BASE_URL}/upload/urunler/kucuk/lift-kaldirma-lastigi-takozu.jpg`,
};

interface Checkpoint {
    processedIds: string[];
    stats: { matched: number; notFound: number; errors: number };
}

async function loadCheckpoint(): Promise<Checkpoint> {
    if (RESET) {
        try { await fs.unlink(CHECKPOINT_FILE); } catch { }
        return { processedIds: [], stats: { matched: 0, notFound: 0, errors: 0 } };
    }
    try {
        const cp = JSON.parse(await fs.readFile(CHECKPOINT_FILE, 'utf-8')) as Checkpoint;
        console.log(`[Checkpoint] Devam — ${cp.processedIds.length} işlendi`);
        return cp;
    } catch {
        return { processedIds: [], stats: { matched: 0, notFound: 0, errors: 0 } };
    }
}
async function saveCheckpoint(cp: Checkpoint) {
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
}

function extractTip(name: string): string | null {
    const m = name.match(/TİP\s+([A-E])/i);
    return m ? m[1].toUpperCase() : null;
}

async function main() {
    console.log('━━━ KAUÇUK TAKOZ GÖRSEL BOTU ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN');

    console.log('\n[Tip Haritası]:');
    for (const [tip, url] of Object.entries(TIP_IMAGE_MAP)) {
        console.log(`  TİP ${tip} → ${url.split('/').pop()}`);
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .is('deleted_at', null)
        .is('image_url', null)
        .eq('meta->>source', 'kaucuk_takoz_2026');

    if (error) { console.error('[DB Hata]', error.message); process.exit(1); }
    console.log(`\n[DB] ${dbProducts?.length ?? 0} kauçuk takoz ürünü görsel bekliyor`);

    const cp = await loadCheckpoint();
    const processedSet = new Set(cp.processedIds);
    let toProcess = (dbProducts ?? []).filter(p => !processedSet.has(p.id));
    if (LIMIT) toProcess = toProcess.slice(0, LIMIT);
    console.log(`[İşlenecek] ${toProcess.length} ürün\n`);

    const log: any[] = [];
    let { matched, notFound, errors } = cp.stats;
    const localPaths: Record<string, string> = {};

    for (let i = 0; i < toProcess.length; i++) {
        const product = toProcess[i];
        const nameShort = (product.name || product.sku).slice(0, 30);
        process.stdout.write(`\r[${i + 1}/${toProcess.length}] ${nameShort.padEnd(30)} ...`);

        const tip = extractTip(product.name || product.sku);
        const imageUrl = tip ? TIP_IMAGE_MAP[tip] : null;

        if (!imageUrl) {
            log.push({ sku: product.sku, name: product.name, status: 'no_tip' });
            notFound++;
            processedSet.add(product.id);
            cp.processedIds.push(product.id);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        if (DRY_RUN) {
            console.log(`\n  ✓ [TİP ${tip}] "${product.name}"`);
            log.push({ sku: product.sku, name: product.name, status: `dry:tip${tip}`, url: imageUrl });
            matched++;
            processedSet.add(product.id);
            cp.processedIds.push(product.id);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        if (!localPaths[tip]) {
            const localPath = path.join(OUTPUT_DIR, `tip-${tip}.webp`);
            const processed = await downloadAndProcess(imageUrl, localPath);
            if (processed) localPaths[tip] = localPath;
        }

        if (!localPaths[tip]) {
            log.push({ sku: product.sku, name: product.name, status: 'download_error' });
            errors++;
            processedSet.add(product.id);
            cp.processedIds.push(product.id);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        const publicUrl = await uploadToStorage(supabase, localPaths[tip], product.sku);
        if (!publicUrl) {
            log.push({ sku: product.sku, name: product.name, status: 'upload_error' });
            errors++;
            processedSet.add(product.id);
            cp.processedIds.push(product.id);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        const linked = await linkToProduct(supabase, product.id, publicUrl);
        if (linked) {
            log.push({ sku: product.sku, name: product.name, status: `ok:tip${tip}`, url: publicUrl });
            matched++;
            process.stdout.write(`\r  ✅ [TİP ${tip}] ${nameShort}\n`);
        } else {
            log.push({ sku: product.sku, name: product.name, status: 'link_error' });
            errors++;
        }

        processedSet.add(product.id);
        cp.processedIds.push(product.id);
        cp.stats = { matched, notFound, errors };
        await saveCheckpoint(cp);
        if ((i + 1) % 100 === 0) await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
        await sleep(100);
    }

    for (const p of Object.values(localPaths)) {
        try { await fs.unlink(p); } catch { }
    }
    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklendi': { Adet: matched },
        'Tip Yok': { Adet: notFound },
        'Hata': { Adet: errors },
        'Toplam': { Adet: toProcess.length },
    });
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

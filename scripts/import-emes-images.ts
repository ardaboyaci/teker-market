/**
 * EMES GÖRSEL BOTU v4 — Seri+Boyut bazlı eşleştirme
 *
 * DB'deki EMES ürün adından seri+no ve boyut çıkarılır,
 * katalogda bu ikisini içeren ilk ürünün görseli kullanılır.
 *
 * Öncelik sırası: F (frenli) olmayan → VBP > SMR > SPR > HBZ > diğer
 *
 * Flags:
 *   --dry-run     Storage/DB'ye yazmadan logla
 *   --limit=N     İlk N ürünü işle
 *   --reset       Checkpoint'i sıfırla
 *   --source=X    Belirli kaynak: emes_2026 | emes_kulp_2026 | yedek_emes_2026
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
const sourceArg = process.argv.find(a => a.startsWith('--source='));
const SOURCE_FILTER = sourceArg ? sourceArg.split('=')[1] : null;

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output/emes-images');
const LOG_FILE = path.resolve(process.cwd(), 'scripts/output/emes-images-log.json');
const CHECKPOINT_FILE = path.resolve(process.cwd(), 'scripts/output/emes-checkpoint.json');
const CATALOG_FILE = path.resolve(process.cwd(), 'scripts/output/emes-site-catalog.json');

// Bağlantı tipi öncelik sırası (düşük = daha öncelikli)
const CONN_PRIORITY: Record<string, number> = {
    VBP: 1, SMR: 2, SPR: 3, MBT: 4, MKT: 5, HBZ: 6, ZBP: 7,
    VBV: 8, VBR: 9, HKZ: 10, ZKP: 11, ZKZ: 12, ZKC: 13,
};

interface SiteProduct {
    name: string;
    compact: string;
    imageUrl: string;
    detailUrl: string;
}

interface Checkpoint {
    processedIds: string[];
    stats: { matched: number; notFound: number; errors: number };
}

async function loadCheckpoint(): Promise<Checkpoint> {
    if (RESET) {
        try { await fs.unlink(CHECKPOINT_FILE); } catch { /* yok */ }
        return { processedIds: [], stats: { matched: 0, notFound: 0, errors: 0 } };
    }
    try {
        const raw = await fs.readFile(CHECKPOINT_FILE, 'utf-8');
        const cp = JSON.parse(raw) as Checkpoint;
        console.log(`[Checkpoint] Devam — ${cp.processedIds.length} ürün işlendi`);
        return cp;
    } catch {
        return { processedIds: [], stats: { matched: 0, notFound: 0, errors: 0 } };
    }
}

async function saveCheckpoint(cp: Checkpoint) {
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
}

/**
 * DB ürün adından eşleşen katalog ürününü bul.
 *
 * Adımlar:
 * 1. Tam compact eşleşme (adı boşluksuz büyük harf → katalogda var mı)
 * 2. Seri+No çıkar (EA01, EM01 vb.) + boyut → kataloğu filtrele
 *    Birden fazla eşleşmede: F (frenli) olmayanı önceliklendir,
 *    sonra bağlantı tipi önceliğine göre sırala.
 */
function findMatch(
    name: string,
    sku: string,
    catalog: SiteProduct[],
    catalogMap: Map<string, SiteProduct>,
): { product: SiteProduct; strategy: string } | null {
    const dbName = (name || sku).trim();

    // ── 1. Tam compact eşleşme ──────────────────────────────────────────────
    const compact = dbName.replace(/\s+/g, '').toUpperCase();
    if (catalogMap.has(compact)) {
        return { product: catalogMap.get(compact)!, strategy: 'exact' };
    }

    // ── 2. Token bazlı: ilk N token'ı compact yapıp katalogda ara ──────────
    const tokens = dbName.split(/\s+/);
    for (let take = tokens.length; take >= 2; take--) {
        const partial = tokens.slice(0, take).join('').toUpperCase();
        if (catalogMap.has(partial)) {
            return { product: catalogMap.get(partial)!, strategy: `tokens${take}` };
        }
    }

    // ── 3. Seri+No + Boyut filtresi ────────────────────────────────────────
    // Örn: "EA 02 150" → seriNo="EA02", boyut="150"
    // Örn: "EM05 MBTM 100X35 5/8" → seriNo="EM05", boyut="100" (X öncesi)
    // Örn: "EH01 VBV 150X50F" → seriNo="EH01" boyut="150"
    const seriMatch = dbName.match(/^([A-ZÇĞİÖŞÜa-zçğışöü]+)\s*(\d{2})\b/i);
    if (!seriMatch) return null;

    const seriNo = (seriMatch[1] + seriMatch[2]).toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Boyutu bul: seri numarasından (01/02/03...) SONRA gelen 2-3 haneli sayı
    // "EA 02 150" → seriNo=EA02, sonrası "150" → boyut=150
    // "EM05 MBTM 100X35" → seriNo=EM05, sonrası "MBTM 100X35" → boyut=100
    // "EP 01 75 F." → seriNo=EP01, sonrası "75 F." → boyut=75
    // Seri numarasını atlayarak geri kalandaki ilk sayıyı al
    const afterSeri = dbName.replace(/^[A-ZÇĞİÖŞÜa-zçğışöü\s]*\d{2}\s*/i, '');
    const boyutMatch = afterSeri.match(/\b(\d{2,3})(?:[Xx\/]|\b)/);
    const boyut = boyutMatch ? boyutMatch[1] : null;

    if (!boyut) return null;

    // Katalogda seriNo ile başlayan ve boyutu içeren ürünleri filtrele
    const candidates = catalog.filter(p =>
        p.compact.startsWith(seriNo) && p.compact.includes(boyut)
    );

    if (candidates.length === 0) return null;
    if (candidates.length === 1) {
        return { product: candidates[0], strategy: `seri+boyut:${seriNo}+${boyut}` };
    }

    // Birden fazla: önce F (frenli) olmayanları tercih et
    const withoutF = candidates.filter(p => !p.compact.endsWith('F'));
    const pool = withoutF.length > 0 ? withoutF : candidates;

    // Bağlantı tipi önceliğine göre sırala
    pool.sort((a, b) => {
        // compact'dan bağlantı tipi tokenini çıkar: "EA01VBP150" → "VBP"
        const connA = a.compact.replace(seriNo, '').match(/^([A-Z]+)/)?.[1] || 'ZZZ';
        const connB = b.compact.replace(seriNo, '').match(/^([A-Z]+)/)?.[1] || 'ZZZ';
        return (CONN_PRIORITY[connA] ?? 99) - (CONN_PRIORITY[connB] ?? 99);
    });

    return { product: pool[0], strategy: `seri+boyut:${seriNo}+${boyut}(best-of-${candidates.length})` };
}

async function main() {
    console.log('━━━ EMES GÖRSEL BOTU v4 (Seri+Boyut) ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN — Storage/DB\'ye yazılmıyor');
    if (SOURCE_FILTER) console.log(`[Filter] Kaynak: ${SOURCE_FILTER}`);

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const catalog: SiteProduct[] = JSON.parse(await fs.readFile(CATALOG_FILE, 'utf-8'));
    console.log(`[Katalog] ${catalog.length} ürün`);

    const catalogMap = new Map<string, SiteProduct>(catalog.map(p => [p.compact, p]));

    let query = supabase
        .from('products')
        .select('id, sku, name, image_url, meta')
        .is('deleted_at', null)
        .is('image_url', null);

    if (SOURCE_FILTER) {
        query = query.eq('meta->>source', SOURCE_FILTER);
    } else {
        query = query.in('meta->>source', ['emes_2026', 'emes_kulp_2026', 'yedek_emes_2026']);
    }

    const { data: dbProducts, error } = await query;
    if (error) { console.error('[DB Hata]', error.message); process.exit(1); }
    console.log(`[DB] ${dbProducts?.length ?? 0} EMES ürünü görsel bekliyor`);

    const cp = await loadCheckpoint();
    const processedSet = new Set(cp.processedIds);

    let toProcess = (dbProducts ?? []).filter(p => !processedSet.has(p.id));
    if (LIMIT) toProcess = toProcess.slice(0, LIMIT);
    console.log(`[İşlenecek] ${toProcess.length} ürün\n`);

    const log: any[] = [];
    let { matched, notFound, errors } = cp.stats;

    for (let i = 0; i < toProcess.length; i++) {
        const product = toProcess[i];
        const progress = `[${i + 1}/${toProcess.length}]`;
        const nameShort = (product.name || product.sku).slice(0, 26);

        process.stdout.write(`\r${progress} ${nameShort.padEnd(26)} ...`);

        const match = findMatch(product.name || '', product.sku, catalog, catalogMap);

        if (!match) {
            log.push({ sku: product.sku, name: product.name, status: 'not_found' });
            notFound++;
            processedSet.add(product.id);
            cp.processedIds.push(product.id);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        const { product: site, strategy } = match;

        if (DRY_RUN) {
            console.log(`\n  ✓ [${strategy}] "${product.name}" → "${site.compact}"`);
            log.push({ sku: product.sku, name: product.name, status: `dry:${strategy}`, siteCompact: site.compact, url: site.imageUrl });
            matched++;
            processedSet.add(product.id);
            cp.processedIds.push(product.id);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        // İndir + watermark + WebP
        const safeName = (product.name || product.sku).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const localPath = path.join(OUTPUT_DIR, `${safeName}.webp`);

        const processed = await downloadAndProcess(site.imageUrl, localPath);
        if (!processed) {
            log.push({ sku: product.sku, name: product.name, status: 'download_error', url: site.imageUrl });
            errors++;
            processedSet.add(product.id);
            cp.processedIds.push(product.id);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            await sleep(300);
            continue;
        }

        const publicUrl = await uploadToStorage(supabase, localPath, product.sku);
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
            log.push({ sku: product.sku, name: product.name, status: `ok:${strategy}`, siteCompact: site.compact, url: publicUrl });
            matched++;
            process.stdout.write(`\r  ✅ ${nameShort}\n`);
        } else {
            log.push({ sku: product.sku, name: product.name, status: 'link_error' });
            errors++;
        }

        processedSet.add(product.id);
        cp.processedIds.push(product.id);
        cp.stats = { matched, notFound, errors };
        await saveCheckpoint(cp);

        try { await fs.unlink(localPath); } catch { /* önemsiz */ }
        if ((i + 1) % 50 === 0) await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
        await sleep(350 + Math.random() * 150);
    }

    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklendi': { Adet: matched },
        'Eşleşme Yok': { Adet: notFound },
        'Hata': { Adet: errors },
        'Toplam': { Adet: toProcess.length },
    });
    console.log(`[Log] ${LOG_FILE}`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

/**
 * ZET GÖRSEL BOTU
 *
 * zet-teker.com'dan ZET ürünlerinin görsellerini çeker.
 *
 * Strateji:
 *   1. Tüm ZET kategori sayfalarını tara → görsel URL katalogu oluştur
 *      Format: /uploads/resim/{ID}-1/{KOD}.jpg → KOD çıkar (MAB, MLB, ADB vb.)
 *   2. DB'deki ZET ürün adından bağlantı tipi kodunu çıkar
 *      "3002 ADB 125*40" → "ADB"
 *   3. Eşleşen görsel URL'yi bul → indir → watermark → Storage → DB
 *
 * Flags:
 *   --dry-run    Storage/DB'ye yazmadan logla
 *   --limit=N    İlk N ürünü işle
 *   --reset      Checkpoint'i sıfırla
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
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

const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output/zet-images');
const LOG_FILE = path.resolve(process.cwd(), 'scripts/output/zet-images-log.json');
const CHECKPOINT_FILE = path.resolve(process.cwd(), 'scripts/output/zet-checkpoint.json');
const CATALOG_FILE = path.resolve(process.cwd(), 'scripts/output/zet-catalog.json');

const BASE_URL = 'https://zet-teker.com';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

interface ZetCatalogItem {
    code: string;       // "ADB", "MLB", "3000MEB" vb. (büyük harf)
    imageUrl: string;   // tam URL
    filename: string;   // "ADB.JPG"
}

interface Checkpoint {
    processedIds: string[];
    stats: { matched: number; notFound: number; errors: number };
}

// ─── Katalog oluştur ──────────────────────────────────────────────────────────
async function buildCatalog(): Promise<ZetCatalogItem[]> {
    const categories = [
        '/tr/urunler/endustriyel-tekerlekler/hafif-yukler',
        '/tr/urunler/endustriyel-tekerlekler/orta-yukler',
        '/tr/urunler/endustriyel-tekerlekler/agir-yukler',
        '/tr/urunler',
    ];

    const catalog: ZetCatalogItem[] = [];
    const seenUrls = new Set<string>();

    for (const cat of categories) {
        try {
            const { data } = await http.get(`${BASE_URL}${cat}`, { validateStatus: () => true });
            const $ = cheerio.load(data);

            $('img[src*="/uploads/resim/"]').each((_, el) => {
                const src = $(el).attr('src') || '';
                if (!src || seenUrls.has(src)) return;
                seenUrls.add(src);

                const fullUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
                // Dosya adını çıkar: "/uploads/resim/1153-1/ADB.JPG" → "ADB.JPG"
                const filename = src.split('/').pop() || '';
                // Kod: uzantıyı ve boyut bilgisini kaldır
                // "ADB.JPG" → "ADB"
                // "MMLB 100x32_k.jpg" → "MMLB"
                // "DUR_100x35_k.JPG 2.JPG" → "DUR"
                const rawCode = filename.split('.')[0].trim();
                const code = rawCode.replace(/[\s_].*/, '').toUpperCase();

                if (code.length >= 2) {
                    catalog.push({ code, imageUrl: fullUrl, filename });
                }
            });
        } catch { /* devam */ }

        await sleep(400);
    }

    return catalog;
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────
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

// ─── Eşleştirme ───────────────────────────────────────────────────────────────
/**
 * ZET ürün adından görsel bul.
 * "3002 ADB 125*40 F31" → kod="ADB" → katalogda "ADB" ara
 * "3000 MLB 100*35"    → kod="MLB"
 * "DUR 200*50"         → kod="DUR"
 */
function findImage(
    name: string,
    catalog: ZetCatalogItem[],
    codeMap: Map<string, ZetCatalogItem>,
): { item: ZetCatalogItem; strategy: string } | null {
    const tokens = name.trim().split(/\s+/);

    // Token'ları sırayla dene — seri no (sayısal) tokenları atla
    // "3002 ADB 125*40" → token0=3002(sayı,atla), token1=ADB(eşleşir)
    // "DUR 200*50"      → token0=DUR(eşleşir)
    // "6000 MEB 100*35" → token0=6000(sayı,atla), token1=MEB(eşleşir)
    for (let i = 0; i < tokens.length; i++) {
        const raw = tokens[i].toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (raw.length < 2) continue;
        // Tamamen sayısal token'ları atla (seri numarası)
        if (/^\d+$/.test(raw)) continue;

        // Tam eşleşme: "ADB", "MLB", "SLB" vb.
        if (codeMap.has(raw)) {
            return { item: codeMap.get(raw)!, strategy: `exact:${raw}` };
        }

        // "6000MEB" gibi bileşik kodlar için: sayı+harf kombinasyonu
        const combined = tokens.slice(0, i + 1).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (combined !== raw && codeMap.has(combined)) {
            return { item: codeMap.get(combined)!, strategy: `combined:${combined}` };
        }
    }

    return null;
}

// ─── Ana ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ ZET GÖRSEL BOTU ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 1. Katalog oluştur (veya yükle)
    let catalog: ZetCatalogItem[];
    try {
        catalog = JSON.parse(await fs.readFile(CATALOG_FILE, 'utf-8'));
        console.log(`[Katalog] ${catalog.length} ürün yüklendi (cache)`);
    } catch {
        console.log('[Katalog] zet-teker.com taranıyor...');
        catalog = await buildCatalog();
        await fs.writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf-8');
        console.log(`[Katalog] ${catalog.length} görsel bulundu`);
    }

    // Kod → item map
    const codeMap = new Map<string, ZetCatalogItem>();
    for (const item of catalog) {
        if (!codeMap.has(item.code)) codeMap.set(item.code, item);
    }

    console.log('[Katalog] Örnekler:');
    catalog.slice(0, 8).forEach(i => console.log(`  ${i.code.padEnd(12)} → ${i.filename}`));

    // 2. DB'den ZET ürünlerini çek
    const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .is('deleted_at', null)
        .is('image_url', null)
        .eq('meta->>source', 'zet_2026');

    if (error) { console.error('[DB Hata]', error.message); process.exit(1); }
    console.log(`\n[DB] ${dbProducts?.length ?? 0} ZET ürünü görsel bekliyor`);

    const cp = await loadCheckpoint();
    const processedSet = new Set(cp.processedIds);

    let toProcess = (dbProducts ?? []).filter(p => !processedSet.has(p.id));
    if (LIMIT) toProcess = toProcess.slice(0, LIMIT);
    console.log(`[İşlenecek] ${toProcess.length} ürün\n`);

    const log: any[] = [];
    let { matched, notFound, errors } = cp.stats;

    for (let i = 0; i < toProcess.length; i++) {
        const product = toProcess[i];
        const nameShort = (product.name || product.sku).slice(0, 26);
        process.stdout.write(`\r[${i + 1}/${toProcess.length}] ${nameShort.padEnd(26)} ...`);

        const match = findImage(product.name || product.sku, catalog, codeMap);

        if (!match) {
            log.push({ sku: product.sku, name: product.name, status: 'not_found' });
            notFound++;
            processedSet.add(product.id);
            cp.processedIds.push(product.id);
            cp.stats = { matched, notFound, errors };
            await saveCheckpoint(cp);
            continue;
        }

        const { item, strategy } = match;

        if (DRY_RUN) {
            console.log(`\n  ✓ [${strategy}] "${product.name}" → ${item.filename}`);
            log.push({ sku: product.sku, name: product.name, status: `dry:${strategy}`, url: item.imageUrl });
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

        const processed = await downloadAndProcess(item.imageUrl, localPath);
        if (!processed) {
            log.push({ sku: product.sku, name: product.name, status: 'download_error', url: item.imageUrl });
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
            log.push({ sku: product.sku, name: product.name, status: `ok:${strategy}`, url: publicUrl });
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

        try { await fs.unlink(localPath); } catch { }
        if ((i + 1) % 50 === 0) await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
        await sleep(300 + Math.random() * 150);
    }

    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');

    console.log('\n\n━━━ ÖZET ━━━');
    console.table({
        'Görsel Eklendi': { Adet: matched },
        'Eşleşme Yok': { Adet: notFound },
        'Hata': { Adet: errors },
        'Toplam': { Adet: toProcess.length },
    });
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

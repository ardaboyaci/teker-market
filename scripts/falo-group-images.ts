/**
 * FALO GROUP IMAGE ATAMA
 *
 * FAL site'si bireysel SKU sayfası sunmuyor — sadece ürün grubu (kategori) görselleri var.
 * Bu script:
 *   1. falometal.com'un kategori sayfalarından grup görseli + grup adını çeker
 *   2. DB'deki falo_2026 ürünlerini grup adına göre eşleştirir (fuzzy keyword matching)
 *   3. Grup görselini tüm eşleşen DB ürünlerine atar (watermark + WebP işleme ile)
 *
 * Flags:
 *   --dry-run    DB'ye yazma, sadece eşleşmeyi göster
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { BOT_CONFIG, withRetry } from './config/bot-config';
import { downloadAndProcess, uploadToStorage, sleep } from './lib/image-pipeline';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN  = process.argv.includes('--dry-run');
const OUTPUT_DIR = path.resolve(__dirname, 'output', 'falo-group-images');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const http = axios.create({
    httpsAgent,
    timeout: BOT_CONFIG.http.timeout,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
});

const CATEGORY_SLUGS = [
    'wheel-group',
    'hinge-group',
    'latch%20group',
    'guide-roller-group',
    'karsor-ekipmanlar',
];

// ── Normalize ──────────────────────────────────────────────────────────────────
function norm(s: string): string {
    return s.toLowerCase()
        .replace(/İ/g, 'i').replace(/ı/g, 'i').replace(/Ç/g, 'c').replace(/ç/g, 'c')
        .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
        .replace(/Ü/g, 'u').replace(/ü/g, 'u').replace(/Ö/g, 'o').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Çoğul → tekil basit stemming
function stem(word: string): string {
    return word
        .replace(/ler$/, '').replace(/lar$/, '')
        .replace(/leri$/, '').replace(/lari$/, '');
}

function keywords(s: string): Set<string> {
    return new Set(
        norm(s).split(' ')
            .filter(w => w.length >= 3 && !/^\d+$/.test(w))
            .map(stem)
    );
}

function similarity(a: string, b: string): number {
    const ka = keywords(a);
    const kb = keywords(b);
    if (ka.size === 0 || kb.size === 0) return 0;
    let overlap = 0;
    for (const w of ka) {
        if (kb.has(w)) overlap++;
    }
    return overlap / Math.max(ka.size, kb.size);
}

// ── Site tarama ────────────────────────────────────────────────────────────────
interface SiteGroup {
    groupName: string;   // Site'deki kategori adı
    imageUrl:  string;   // Görselin tam URL'si
    category:  string;   // Hangi category slug'ından geldi
}

async function collectSiteGroups(): Promise<SiteGroup[]> {
    const groups: SiteGroup[] = [];
    const seen = new Set<string>();

    for (const slug of CATEGORY_SLUGS) {
        const url = `https://falometal.com/urunlerimiz/${slug}`;
        try {
            const { data } = await withRetry(
                () => http.get(url, { validateStatus: () => true }),
                { label: `kategori ${slug}` }
            );
            const $ = cheerio.load(data);
            $('.l-product__search-list-item').each((_, el) => {
                const $el      = $(el);
                const imgSrc   = $el.find('img[src*="/storage/products/"]').first().attr('src') ?? '';
                const groupName = $el.find('a.l-product__search-list-item-code').first().text().trim();
                if (!imgSrc || !groupName || seen.has(groupName)) return;
                seen.add(groupName);
                const imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://falometal.com${imgSrc}`;
                groups.push({ groupName, imageUrl, category: slug });
            });
            console.log(`  ${slug}: ${groups.filter(g => g.category === slug).length} grup`);
        } catch (err) {
            console.error(`  [Hata] ${slug}: ${err instanceof Error ? err.message : err}`);
        }
        await sleep(400);
    }
    return groups;
}

// ── Ana akış ───────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ FALO GROUP IMAGE ATAMA ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN\n');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 1. Site gruplarını topla
    console.log('[Adım 1] Site kategori sayfaları taranıyor...');
    const siteGroups = await collectSiteGroups();
    console.log(`  Toplam: ${siteGroups.length} benzersiz grup görseli\n`);

    // 2. DB'den tüm FAL ürünlerini çek
    console.log('[Adım 2] DB FAL ürünleri çekiliyor...');
    const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id, sku, name, image_url')
        .eq('meta->>source', 'falo_2026')
        .is('deleted_at', null);
    if (error) { console.error('[Fatal]', error.message); process.exit(1); }

    const allDb = (dbProducts ?? []) as { id: string; sku: string; name: string; image_url: string | null }[];
    console.log(`  ${allDb.length} ürün\n`);

    // 3. Her DB ürünü için en iyi site grubunu bul (score >= 0.5)
    const THRESHOLD = 0.45;
    const assignments: { db: typeof allDb[0]; group: SiteGroup; score: number }[] = [];

    for (const dbProd of allDb) {
        let best: SiteGroup | null = null;
        let bestScore = 0;
        for (const g of siteGroups) {
            const s = similarity(g.groupName, dbProd.name);
            if (s > bestScore) { bestScore = s; best = g; }
        }
        if (best && bestScore >= THRESHOLD) {
            assignments.push({ db: dbProd, group: best, score: bestScore });
        }
    }

    console.log(`[Adım 3] ${assignments.length} / ${allDb.length} ürün eşleşti (threshold: ${THRESHOLD})\n`);

    if (DRY_RUN) {
        // Grup bazında özet
        const byGroup: Record<string, string[]> = {};
        for (const a of assignments) {
            const k = a.group.groupName;
            byGroup[k] = byGroup[k] ?? [];
            byGroup[k].push(a.db.sku);
        }
        Object.entries(byGroup).sort((x,y)=>y[1].length-x[1].length).forEach(([g, skus]) => {
            console.log(`  ${String(skus.length).padStart(3)}  ${g.padEnd(40)} → ${skus.slice(0,5).join(', ')}${skus.length>5?'...':''}`);
        });
        const unmatched = allDb.filter(p => !assignments.find(a => a.db.id === p.id));
        console.log(`\nEşleşmeyen: ${unmatched.length} ürün`);
        unmatched.slice(0,15).forEach(p => console.log('  ', p.sku, p.name));
        return;
    }

    // 4. Grup görsellerini indir + watermark + yükle (her grup için tek seferlik)
    console.log('[Adım 4] Grup görselleri işleniyor...\n');
    const groupUrlCache = new Map<string, string | null>(); // groupName → publicUrl

    let updated = 0, skipped = 0, errors = 0;

    for (let i = 0; i < assignments.length; i++) {
        const { db, group } = assignments[i];
        process.stdout.write(`\r  [${i + 1}/${assignments.length}] ${db.sku.padEnd(15)} ${db.name.substring(0, 35)}`);

        // Grup görseli zaten işlendiyse cache'ten al
        if (!groupUrlCache.has(group.groupName)) {
            const safeName = norm(group.groupName).replace(/\s+/g, '_').substring(0, 40);
            const localPath = path.join(OUTPUT_DIR, `${safeName}.webp`);
            const processed = await downloadAndProcess(group.imageUrl, localPath);
            if (!processed) {
                groupUrlCache.set(group.groupName, null);
            } else {
                const publicUrl = await uploadToStorage(supabase, localPath, `falo-group-${safeName}`);
                groupUrlCache.set(group.groupName, publicUrl);
            }
        }

        const publicUrl = groupUrlCache.get(group.groupName);
        if (!publicUrl) { errors++; continue; }

        const { error: upErr } = await supabase
            .from('products')
            .update({ image_url: publicUrl })
            .eq('id', db.id);

        if (upErr) { errors++; }
        else { updated++; }

        await sleep(50);
    }

    console.log(`\n\n✅ Tamamlandı`);
    console.log(`  Güncellenen: ${updated}`);
    console.log(`  Hata:        ${errors}`);

    const unmatched = allDb.filter(p => !assignments.find(a => a.db.id === p.id));
    console.log(`  Eşleşmeyen: ${unmatched.length}`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

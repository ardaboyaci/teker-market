/**
 * EMES Specs Scraper
 *
 * emes-site-catalog.json'daki URL'leri tek tek ziyaret eder,
 * her ürün sayfasından teknik specs (çap, genişlik, kapasite, malzeme, kaplama vb.) çeker.
 *
 * Çıktı: scripts/output/emes-specs.json
 *   { [sku]: { diameter, width, capacity, material, coating, height, tableSize, type, description } }
 *
 * Kullanım:
 *   npx ts-node scripts/scrape-emes-specs.ts
 *   npx ts-node scripts/scrape-emes-specs.ts --limit=50   # test
 *   npx ts-node scripts/scrape-emes-specs.ts --resume     # kaldığı yerden devam
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import https from 'https';

const CATALOG_FILE = path.resolve(process.cwd(), 'scripts/output/emes-site-catalog.json');
const OUTPUT_FILE  = path.resolve(process.cwd(), 'scripts/output/emes-specs.json');
const CHECKPOINT   = path.resolve(process.cwd(), 'scripts/output/emes-specs-checkpoint.json');

const DELAY_MS = 600 + Math.random() * 600; // 0.6-1.2s arası
const CONCURRENCY = 3;

const limitArg = process.argv.find(a => a.startsWith('--limit='));
const MAX_LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;
const RESUME    = process.argv.includes('--resume');

interface CatalogItem {
    name: string;
    compact: string;
    imageUrl: string;
    detailUrl: string;
}

interface EmesSku {
    sku: string;
    name: string;
    diameter?: string;
    width?: string;
    capacity?: string;
    totalHeight?: string;
    tableSize?: string;
    tableDrillSize?: string;
    material?: string;
    coating?: string;
    bearingType?: string;
    type?: string;           // Döner Tablalı, Sabit, Frenli vs
    shortDesc?: string;      // meta description
}

const http = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    }
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function extractNumber(text: string): string | undefined {
    const m = text.match(/(\d+(?:[.,]\d+)?)/);
    return m ? m[1].replace(',', '.') : undefined;
}

async function scrapeDetail(url: string, name: string): Promise<EmesSku | null> {
    try {
        const { data: html } = await http.get(url);
        const $ = cheerio.load(html);

        const result: EmesSku = { sku: '', name };

        // SKU: URL'den çek (son segment, rakam öncesi)
        const urlSku = url.match(/\/([a-z0-9-]+)-\d+\.html$/i)?.[1]
            ?.replace(/-/g, ' ')
            ?.toUpperCase() ?? name;
        result.sku = urlSku;

        // Meta description → shortDesc
        result.shortDesc = $('meta[name="description"]').attr('content')?.trim();

        // Teknik specs: cheerio text node pattern matching
        const allTexts: string[] = [];
        $('*').each((_, el) => {
            const t = $(el).clone().children().remove().end().text().trim();
            if (t.length > 1 && t.length < 200) allTexts.push(t);
        });

        const joined = allTexts.join('\n');

        // Çap
        const diaMatch = joined.match(/(\d+)\s*\n?\s*mm\s+Tekerlek\s+Çapı/i) ||
                         joined.match(/Tekerlek\s+Çapı\s*\n?\s*(\d+)\s*mm/i) ||
                         joined.match(/Teker\s+Çapı\s*\n?\s*(\d+)\s*mm/i);
        if (diaMatch) result.diameter = diaMatch[1] + ' mm';

        // Genişlik
        const widMatch = joined.match(/(\d+)\s*\n?\s*mm\s+Tekerlek\s+Genişliği/i) ||
                         joined.match(/Tekerlek\s+Genişliği\s*\n?\s*(\d+)\s*mm/i);
        if (widMatch) result.width = widMatch[1] + ' mm';

        // Taşıma kapasitesi
        const capMatch = joined.match(/(\d+)\s*\n?\s*KG\s+Taşıma\s+Kapasitesi/i) ||
                         joined.match(/Taşıma\s+Kapasitesi\s*\n?\s*(\d+)\s*(?:kg|KG)/i);
        if (capMatch) result.capacity = capMatch[1] + ' kg';

        // Toplam yükseklik
        const hMatch = joined.match(/Tüm\s+Yükseklik\s*\n[\s\S]{0,20}?(\d+)\s*\n?\s*mm/i) ||
                       joined.match(/Toplam\s+Yükseklik\s*\n?\s*(\d+)\s*mm/i);
        if (hMatch) result.totalHeight = hMatch[1] + ' mm';

        // Tabla ebatları
        const tblMatch = joined.match(/Tabla\s+Ebatları\s*\n[\s\S]{0,20}?(\d+[xX×]\d+)\s*mm/i) ||
                         joined.match(/(\d+[xX×]\d+)\s*mm\s*\n?\s*Tabla\s+Ebatları/i);
        if (tblMatch) result.tableSize = tblMatch[1] + ' mm';

        // Tabla delik çapı
        const drillMatch = joined.match(/Tabla\s+Delik\s+Çapı\s*\n[\s\S]{0,20}?(\d+[xX×]\d+)\s*mm/i) ||
                           joined.match(/(\d+[xX×]\d+)\s*mm\s*\n?\s*Tabla\s+Delik/i);
        if (drillMatch) result.tableDrillSize = drillMatch[1] + ' mm';

        // Malzeme / Kaplama — uzun metin satırları
        const materialLine = allTexts.find(t =>
            /kauçuk|poliüret|poliamid|naylon|çelik|döküm|demir|kasnak|pp\b|plastik/i.test(t) &&
            t.length > 10 && t.length < 150
        );
        if (materialLine) result.material = materialLine.trim();

        // Kaplama cinsi (kısa)
        const coatMatch = joined.match(/Kaplama\s+Cinsi\s*[:=]?\s*([A-Za-zÇçĞğİıÖöŞşÜü\s]+)/i);
        if (coatMatch) result.coating = coatMatch[1].trim().split('\n')[0].trim();

        // Rulman tipi
        const bearMatch = joined.match(/(?:rulman|burç)\s*(?:yataklı|tipi)?[:\s]*([A-Za-zÇçĞğİıÖöŞşÜü\s]+)/i);
        if (bearMatch) result.bearingType = bearMatch[1].trim().split('\n')[0].trim().slice(0, 50);

        // Tip (Döner Tablalı, Sabit, Frenli)
        const typeMatch = joined.match(/(Döner\s*Tablalı|Sabit|Frenli|Frensiz)/i);
        if (typeMatch) result.type = typeMatch[1].trim();

        return result;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [Hata] ${url}: ${msg}`);
        return null;
    }
}

async function main() {
    console.log('━━━ EMES SPECS SCRAPER ━━━');

    // Catalog'u yükle
    const catalog: CatalogItem[] = JSON.parse(await fs.readFile(CATALOG_FILE, 'utf-8'));
    console.log(`Katalog: ${catalog.length} ürün URL`);

    // Checkpoint
    let done = new Set<string>();
    let results: Record<string, EmesSku> = {};

    if (RESUME) {
        try {
            const cp = JSON.parse(await fs.readFile(CHECKPOINT, 'utf-8'));
            done = new Set(cp.done);
            results = cp.results;
            console.log(`Devam: ${done.size} tamamlandı, ${Object.keys(results).length} spec kaydedildi.`);
        } catch { /* Sıfırdan başla */ }
    }

    // Limit uygula
    const targets = catalog
        .filter(c => c.detailUrl && !done.has(c.detailUrl))
        .slice(0, MAX_LIMIT);

    console.log(`İşlenecek: ${targets.length} ürün\n`);

    let count = 0;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const chunk = targets.slice(i, i + CONCURRENCY);

        await Promise.all(chunk.map(async (item) => {
            const spec = await scrapeDetail(item.detailUrl, item.name);
            if (spec) {
                results[item.compact] = spec;
                done.add(item.detailUrl);
                count++;
            }
        }));

        const pct = Math.round(((i + chunk.length) / targets.length) * 100);
        process.stdout.write(`\r  İlerleme: ${i + chunk.length}/${targets.length} (%${pct}) — ${count} spec toplandı`);

        // Checkpoint kaydet
        await fs.writeFile(CHECKPOINT, JSON.stringify({ done: [...done], results }, null, 2), 'utf-8');

        await delay(DELAY_MS);
    }

    console.log('\n');

    // Final çıktı
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`✓ ${Object.keys(results).length} EMES ürün spec'i → ${OUTPUT_FILE}`);

    // Özet istatistik
    const specs = Object.values(results);
    const withDia = specs.filter(s => s.diameter).length;
    const withCap = specs.filter(s => s.capacity).length;
    const withMat = specs.filter(s => s.material).length;
    console.log(`\nDoluluk oranı:`);
    console.log(`  Çap: ${withDia}/${specs.length} (%${Math.round(withDia/specs.length*100)})`);
    console.log(`  Kapasite: ${withCap}/${specs.length} (%${Math.round(withCap/specs.length*100)})`);
    console.log(`  Malzeme: ${withMat}/${specs.length} (%${Math.round(withMat/specs.length*100)})`);
    console.log('━━━ TAMAMLANDI ━━━');
}

main().catch(err => {
    console.error('[Fatal]', err instanceof Error ? err.message : err);
    process.exit(1);
});

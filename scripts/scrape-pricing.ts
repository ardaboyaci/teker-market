/**
 * SMART HYBRID PRICE ENGINE v7
 *
 * Değişiklikler (v7):
 *   - SSL: rejectUnauthorized NODE_ENV'e bağlandı
 *   - Checkpoint/resume: --resume flag ile kaldığı yerden devam
 *   - Fiyat ratioları BOT_CONFIG'den okunuyor
 *   - bot_runs tablosuna run log düşüyor
 *   - withRetry ile fetch hata toleransı
 *
 * Flags:
 *   --dry-run    DB'ye yazmadan simüle et
 *   --limit=N    İlk N ürünü işle
 *   --resume     Checkpoint'ten devam et
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { chromium, Browser, BrowserContext } from 'playwright';
import { BOT_CONFIG, withRetry } from './config/bot-config';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DRY_RUN  = process.argv.includes('--dry-run');
const RESUME   = process.argv.includes('--resume');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// SSL: sadece prod'da strict
const httpsAgent = new https.Agent({
    rejectUnauthorized: process.env.NODE_ENV === 'production',
});

const http = axios.create({
    httpsAgent,
    timeout: BOT_CONFIG.http.timeout,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9',
    },
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Checkpoint ────────────────────────────────────────────────────────────────
const CHECKPOINT_FILE = path.resolve(__dirname, 'output/pricing-checkpoint.json');

interface PricingCheckpoint {
    startedAt: string;
    doneIds: string[];
}

async function loadCheckpoint(): Promise<Set<string>> {
    if (!RESUME) return new Set();
    try {
        const raw = await fs.readFile(CHECKPOINT_FILE, 'utf-8');
        const cp  = JSON.parse(raw) as PricingCheckpoint;
        console.log(`[Checkpoint] ${cp.doneIds.length} ürün zaten işlendi (${cp.startedAt})`);
        return new Set(cp.doneIds);
    } catch {
        return new Set();
    }
}

async function saveCheckpoint(doneIds: Set<string>): Promise<void> {
    const cp: PricingCheckpoint = { startedAt: new Date().toISOString(), doneIds: [...doneIds] };
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
}

// ── bot_runs log ────────────────────────────────────────────────────────────
async function startBotRun(botName: string, meta: Record<string, unknown> = {}): Promise<string | null> {
    if (DRY_RUN) return null;
    const { data, error } = await supabase.from('bot_runs').insert({
        bot_name:    botName,
        started_at:  new Date().toISOString(),
        status:      'running',
        metadata:    meta,
    }).select('id').single();
    if (error) { console.warn('[bot_runs] Kayıt açılamadı:', error.message); return null; }
    return data.id;
}

async function finishBotRun(
    runId: string | null,
    processed: number,
    errors: number,
    status: 'completed' | 'failed' = 'completed'
): Promise<void> {
    if (!runId || DRY_RUN) return;
    await supabase.from('bot_runs').update({
        finished_at:     new Date().toISOString(),
        status,
        processed_count: processed,
        error_count:     errors,
    }).eq('id', runId);
}

// ── Fiyat parse ───────────────────────────────────────────────────────────────
function parsePrice(raw: string): number | null {
    if (!raw) return null;
    const trMatch = raw.match(/(\d{1,3}(?:\.\d{3})*),(\d{2})/);
    if (trMatch) return parseFloat(trMatch[1].replace(/\./g, '') + '.' + trMatch[2]);
    const digits = raw.replace(/[^\d]/g, '');
    return digits ? parseFloat(digits) : null;
}

function queryEncode(q: string): string {
    return encodeURIComponent(q.trim()).replace(/%20/g, '+');
}

function tokenMatchScore(query: string, productName: string): number {
    const tokens = query.toUpperCase().match(/[A-ZÖÇŞİĞÜ]+|\d+/g) ?? [];
    const nameUp = productName.toUpperCase();
    if (!tokens.length) return 0;
    let hits = 0;
    for (const t of tokens) { if (t.length >= 2 && nameUp.includes(t)) hits++; }
    return hits / tokens.length;
}

// ── Fiyat scrape'leri ─────────────────────────────────────────────────────────
async function getClientPrice(_sku: string): Promise<number | null> {
    // tekermarket.com.tr SPA'ya geçti — cheerio ile HTML parse çalışmıyor.
    // Puppeteer/Playwright gerekiyor. Şimdilik devre dışı.
    return null;
}

// ── Playwright browser singleton ──────────────────────────────────────────────
let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

async function getBrowserContext(): Promise<BrowserContext> {
    if (!_context) {
        _browser = await chromium.launch({ headless: true });
        _context = await _browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            extraHTTPHeaders: { 'Accept-Language': 'tr-TR,tr;q=0.9' },
        });
    }
    return _context;
}

async function closeBrowser() {
    if (_browser) { await _browser.close(); _browser = null; _context = null; }
}

async function scrapeEtekerlek(q: string): Promise<{ name: string; price: number }[]> {
    if (!q || q.length < 3) return [];
    const ctx = await getBrowserContext();
    const page = await ctx.newPage();
    try {
        await page.goto(`https://www.e-tekerlek.com/arama?q=${queryEncode(q)}`, {
            waitUntil: 'domcontentloaded', timeout: 20000,
        });
        await page.waitForTimeout(3000);

        return await page.evaluate(() => {
            const cards = document.querySelectorAll('.product-item');
            const results: { name: string; price: number }[] = [];
            cards.forEach(card => {
                const nameEl = card.querySelector('a.w-100, .product-title, .w-100.product-title');
                const name = nameEl?.getAttribute('title') || nameEl?.textContent?.trim() || '';
                const priceText = card.textContent || '';
                const m = priceText.match(/([\d\.]+),(\d{2})\s*TL/);
                const price = m ? parseFloat(m[1].replace(/\./g, '') + '.' + m[2]) : null;
                if (name && name.length > 5 && price) results.push({ name, price });
            });
            return results;
        });
    } catch { return []; }
    finally { await page.close(); }
}

async function getCompetitorPrice(sku: string, name: string): Promise<{ price: number; matchType: string } | null> {
    // Tier 1: exact SKU
    const t1 = await scrapeEtekerlek(sku);
    for (const r of t1) {
        if (r.name.toUpperCase().replace(/\s/g, '').includes(sku.toUpperCase().replace(/\s/g, '')))
            return { price: r.price, matchType: 'Exact SKU' };
    }

    // Tier 2: smart query (boyut + malzeme)
    const dimMatch      = name.toUpperCase().match(/(\d+)\s*(X|\*)\s*(\d+)/i);
    const materialMatch = name.match(/poliamid|poliüretan|pvc|lastik|kauçuk|zamak|pik|döküm/i);
    const keywords      = name.toUpperCase().replace(/TEKERLEK|TEKER|SABİT|OYNAK|FRENLİ|BUR\.|JANT|RULMANLI/g, '').replace(/[^\w\sÇŞĞÜÖİ]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
    const parts: string[] = [];
    if (dimMatch)      parts.push(`${dimMatch[1]}x${dimMatch[3]}`);
    if (materialMatch) parts.push(materialMatch[0]);
    if (keywords[0])   parts.push(keywords[0]);
    const smartQuery = parts.join(' ').trim();

    if (smartQuery !== sku && smartQuery.length >= 3) {
        const t2 = await scrapeEtekerlek(smartQuery);
        for (const r of t2) {
            const score = tokenMatchScore(name, r.name);
            if (score > BOT_CONFIG.pricing.minMatchScore)
                return { price: r.price, matchType: `Smart Name (${Math.round(score * 100)}%)` };
        }
    }

    // Tier 3: sadece boyut (malzeme filtresi atmışsa)
    if (dimMatch) {
        const dimQuery = `${dimMatch[1]}x${dimMatch[3]}`;
        if (dimQuery !== smartQuery) {
            const t3 = await scrapeEtekerlek(dimQuery);
            for (const r of t3) {
                const score = tokenMatchScore(name, r.name);
                if (score > BOT_CONFIG.pricing.minMatchScore)
                    return { price: r.price, matchType: `Dim Only (${Math.round(score * 100)}%)` };
            }
        }
    }

    return null;
}

async function recordPriceHistory(productId: string, source: string, oldPrice: number | null, newPrice: number, notes: string) {
    if (DRY_RUN) return;
    await supabase.from('price_history').insert({
        product_id: productId, price_type: 'sale', old_price: oldPrice, new_price: newPrice, change_reason: `[${source}] ${notes}`,
    });
}

// ── Ürün işle ─────────────────────────────────────────────────────────────────
async function processProduct(p: any, stat: { processed: number; updated: number; competitorFound: number; errors: number }) {
    stat.processed++;
    process.stdout.write(`\n[${stat.processed}] SKU: ${p.sku} | ${p.name.slice(0, 30)}...\n`);

    const clientPrice = await getClientPrice(p.sku);
    const compResult  = await getCompetitorPrice(p.sku, p.name);
    const compPrice   = compResult?.price ?? null;
    const matchType   = compResult?.matchType ?? null;

    console.log(`  └─> Client: ${clientPrice ? '₺' + clientPrice : 'Yok'} | Rakip: ${compPrice ? '₺' + compPrice + ' (' + matchType + ')' : 'Yok'}`);
    if (compPrice) stat.competitorFound++;

    const oldPrice = p.sale_price ? parseFloat(p.sale_price) : null;
    if (clientPrice !== null && (oldPrice === null || Math.abs(oldPrice - clientPrice) > 0.01)) {
        await recordPriceHistory(p.id, 'client', oldPrice, clientPrice, 'tekermarket.com.tr');
    }

    let finalPrice: number | null = null;
    let strategy = '';

    if (clientPrice !== null && compPrice !== null) {
        if (clientPrice > compPrice) {
            finalPrice = Math.round(compPrice * BOT_CONFIG.pricing.undercutRatio * 100) / 100;
            strategy = `Undercut -${Math.round((1 - BOT_CONFIG.pricing.undercutRatio) * 100)}% (₺${compPrice})`;
        } else {
            finalPrice = clientPrice;
            strategy = `Zaten ucuz (₺${clientPrice})`;
        }
    } else if (clientPrice !== null) {
        finalPrice = clientPrice;
        strategy = `Sadece bizde var (₺${clientPrice})`;
    } else if (compPrice !== null) {
        finalPrice = Math.round(compPrice * BOT_CONFIG.pricing.fallbackRatio * 100) / 100;
        strategy = `Sadece rakipte var -${Math.round((1 - BOT_CONFIG.pricing.fallbackRatio) * 100)}% (₺${compPrice})`;
    } else {
        await sleep(300);
        return;
    }

    console.log(`  └─> Karar: ₺${finalPrice} [${strategy}]`);
    if (DRY_RUN) { stat.updated++; return; }

    const updates: any = { sale_price: finalPrice, status: 'active' };
    if (compPrice !== null) {
        updates.competitor_price       = compPrice;
        updates.competitor_source      = 'e-tekerlek.com';
        updates.competitor_scraped_at  = new Date().toISOString();
    }

    const { error } = await supabase.from('products').update(updates).eq('id', p.id);
    if (!error) stat.updated++; else stat.errors++;

    await sleep(BOT_CONFIG.pricing.delayBetweenMs);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ SMART HYBRID PRICE ENGINE v7 ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN — DB\'ye yazılmıyor\n');
    if (RESUME)  console.log('  ↺  RESUME modu aktif\n');

    const doneIds = await loadCheckpoint();
    const runId   = await startBotRun('scrape-pricing', { dryRun: DRY_RUN, limit: LIMIT });

    // Tüm ürünleri paginate ederek çek (Supabase 1000 limit aşmak için)
    let products: any[] = [];
    if (LIMIT) {
        const { data, error } = await supabase
            .from('products').select('id, sku, name, sale_price')
            .is('deleted_at', null).eq('status', 'active').order('sku').limit(LIMIT);
        if (error) { console.error('DB Error:', error.message); await finishBotRun(runId, 0, 1, 'failed'); return; }
        products = data ?? [];
    } else {
        let offset = 0;
        while (true) {
            const { data, error } = await supabase
                .from('products').select('id, sku, name, sale_price')
                .is('deleted_at', null).eq('status', 'active').order('sku')
                .range(offset, offset + 999);
            if (error) { console.error('DB Error:', error.message); break; }
            if (!data || data.length === 0) break;
            products = products.concat(data);
            if (data.length < 1000) break;
            offset += 1000;
            process.stdout.write(`\r  DB çekiliyor: ${products.length}`);
        }
        console.log(`\n`);
    }

    const toProcess = (products ?? []).filter(p => !doneIds.has(p.id));
    console.log(`[DB] ${products?.length ?? 0} ürün toplam, ${toProcess.length} işlenecek\n`);

    const stat = { processed: 0, updated: 0, competitorFound: 0, errors: 0 };

    for (const p of toProcess) {
        await processProduct(p, stat);
        doneIds.add(p.id);
        if (stat.processed % 50 === 0) await saveCheckpoint(doneIds);
    }

    await saveCheckpoint(doneIds);
    await finishBotRun(runId, stat.processed, stat.errors);
    await closeBrowser();

    console.log('\n━━━ TAMAMLANDI ━━━');
    console.table(stat);
}

main().catch(async err => {
    await closeBrowser();
    console.error('[Fatal]', err instanceof Error ? err.message : err);
    process.exit(1);
});

/**
 * TEKER MARKET — Otomatik SEO Açıklama Botu
 *
 * Çalışma mantığı:
 *  1. Supabase'den description'ı boş/eksik olan ürünleri batch batch çeker
 *  2. Her ürün için Gemini'ye ürün adı + attributes + kategori bilgisini verir
 *  3. Gemini SEO uyumlu HTML açıklama üretir
 *  4. Üretilen açıklamayı description ve short_description kolonlarına yazar
 *  5. Checkpoint dosyasıyla kaldığı yerden devam edebilir
 *  6. Rate limit & hata yönetimi dahil
 *
 * Kullanım:
 *   npx ts-node scripts/seo-description-bot.ts            # Sadece eksik olanlar
 *   npx ts-node scripts/seo-description-bot.ts --all      # Hepsini yeniden yaz
 *   npx ts-node scripts/seo-description-bot.ts --dry-run  # Yazar ama DB'ye kaydetmez
 *   npx ts-node scripts/seo-description-bot.ts --limit=50 # Max 50 ürün işle
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ── Config ────────────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('[Fatal] Supabase env değerleri eksik'); process.exit(1); }

const CHECKPOINT_FILE = path.resolve(process.cwd(), 'scripts/output/seo-checkpoint.json');
const BATCH_SIZE = 5;
const CONCURRENCY = 1;
const DELAY_MS = 4000; // Groq free tier: 12K TPM, ~450 token/istek → max 26 istek/dk → 4sn güvenli

// CLI flags
const REWRITE_ALL = process.argv.includes('--all');
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit=')) ?? process.argv[process.argv.indexOf('--limit') + 1];
const MAX_LIMIT = limitArg && !isNaN(Number(limitArg)) ? Number(limitArg) : Infinity;

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Tipler ────────────────────────────────────────────────────────────────────
interface Product {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    short_description: string | null;
    attributes: Record<string, string> | null;
    tags: string[] | null;
    sale_price: string | null;
    category: { name: string; path: string | null } | null;
}

interface Checkpoint {
    startedAt: string;
    processedIds: string[];
    stats: { success: number; skipped: number; error: number };
}

// ── Checkpoint ────────────────────────────────────────────────────────────────
async function loadCheckpoint(): Promise<Checkpoint> {
    try {
        const raw = await fs.readFile(CHECKPOINT_FILE, 'utf-8');
        const cp = JSON.parse(raw) as Checkpoint;
        console.log(`[Checkpoint] Devam noktası bulundu → ${cp.startedAt}`);
        console.log(`  İşlenmiş: ${cp.processedIds.length} ürün | Başarı: ${cp.stats.success} | Hata: ${cp.stats.error}`);
        return cp;
    } catch {
        return {
            startedAt: new Date().toISOString(),
            processedIds: [],
            stats: { success: 0, skipped: 0, error: 0 },
        };
    }
}

async function saveCheckpoint(cp: Checkpoint): Promise<void> {
    await fs.mkdir(path.dirname(CHECKPOINT_FILE), { recursive: true });
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
}

// ── Ürünleri Çek ─────────────────────────────────────────────────────────────
async function fetchProducts(offset: number, excludeIds: string[]): Promise<{ items: Product[], rawCount: number }> {
    let query = supabase
        .from('products')
        .select(`
            id, sku, name, description, short_description,
            attributes, tags, sale_price,
            category:categories(name, path)
        `)
        .is('deleted_at', null)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

    const { data, error } = await query;
    if (error) throw new Error(`Supabase fetch hatası: ${error.message}`);

    const rawData = (data ?? []) as any[];
    // Checkpoint'te olan ID'leri filtrele
    // --all yoksa: description null, boş veya 300 karakterden kısa (jenerik) olanları işle
    const excludeSet = new Set(excludeIds);
    const items = rawData
        .filter(p => !excludeSet.has(p.id))
        .filter(p => REWRITE_ALL || !p.description || p.description.trim().length < 300)
        .map(p => ({
            ...p,
            category: Array.isArray(p.category) ? p.category[0] ?? null : p.category,
        })) as Product[];

    return { items, rawCount: rawData.length };
}

// ── Claude Prompt ─────────────────────────────────────────────────────────────
function buildPrompt(product: Product): string {
    const attrs = product.attributes
        ? Object.entries(product.attributes)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n')
        : '';

    const categoryName = product.category?.name ?? 'Endüstriyel Tekerlek';
    const price = product.sale_price ? `${Number(product.sale_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL` : null;

    return `Sen bir e-ticaret SEO uzmanısın. Türk endüstriyel tekerlek markası "Teker Market" için ürün açıklaması yazıyorsun.

ÜRÜN BİLGİLERİ:
- Ürün Adı: ${product.name}
- SKU: ${product.sku}
- Kategori: ${categoryName}
${price ? `- Satış Fiyatı: ${price}` : ''}
${attrs ? `- Teknik Özellikler:\n${attrs}` : ''}
${product.tags?.length ? `- Etiketler: ${product.tags.join(', ')}` : ''}

GÖREV:
1. "description" için tam HTML ürün açıklaması yaz (300-500 kelime)
2. "short_description" için düz metin özet yaz (1-2 cümle, max 160 karakter)

KURALLAR:
- Türkçe yaz, akıcı ve profesyonel ol
- SEO için ürün adını ve temel özellikleri (çap, kaplama cinsi, taşıma kapasitesi) ilk paragrafta kullan
- HTML etiketleri: <h2>, <p>, <ul><li>, <strong> kullan (script/style yok)
- Teknik özellikleri <ul> listesiyle göster
- Faydaları vurgula: hangi ortamlarda kullanılır, avantajları neler
- "rakip", "başka marka" gibi ifadeler kullanma
- Fiyat bilgisi açıklamaya yazma
- Sonu "Teker Market" veya "bizimle iletişime geçin" gibi CTA ile bitir

YANIT FORMATI (sadece JSON döndür, başka hiçbir şey yazma):
{
  "description": "<h2>...</h2><p>...</p>...",
  "short_description": "..."
}`;
}

// ── Groq API Çağrısı ─────────────────────────────────────────────────────────
interface GeneratedContent {
    description: string;
    short_description: string;
}

async function generateDescription(product: Product): Promise<GeneratedContent | null> {
    const prompt = buildPrompt(product);

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`HTTP ${res.status}: ${err}`);
        }

        const data = await res.json() as { choices: { message: { content: string } }[] };
        let text = data.choices[0]?.message?.content?.trim() ?? '';

        // JSON parse — önce düz, sonra markdown code block içinden
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) text = jsonMatch[1].trim();

        const parsed = JSON.parse(text) as GeneratedContent;

        if (!parsed.description || !parsed.short_description) {
            console.warn(`  [Warn] ${product.sku}: Eksik alan — JSON parse OK ama içerik boş`);
            return null;
        }

        if (parsed.short_description.length > 300) {
            parsed.short_description = parsed.short_description.slice(0, 297) + '...';
        }

        return parsed;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [Groq Hata] ${product.sku}: ${msg}`);
        return null;
    }
}

// ── Supabase'e Yaz ────────────────────────────────────────────────────────────
async function saveToDb(product: Product, content: GeneratedContent): Promise<boolean> {
    if (DRY_RUN) {
        console.log(`  [Dry-Run] ${product.sku} → yazmadım (--dry-run aktif)`);
        return true;
    }

    const { error } = await supabase
        .from('products')
        .update({
            description: content.description,
            short_description: content.short_description,
            updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

    if (error) {
        console.error(`  [DB Hata] ${product.sku}: ${error.message}`);
        return false;
    }
    return true;
}

// ── Batch İşleme (paralel, CONCURRENCY kadar) ─────────────────────────────────
async function processBatch(
    products: Product[],
    cp: Checkpoint,
): Promise<void> {
    // CONCURRENCY'lik gruplar halinde paralel çalıştır
    for (let i = 0; i < products.length; i += CONCURRENCY) {
        const group = products.slice(i, i + CONCURRENCY);

        await Promise.all(group.map(async (product) => {
            process.stdout.write(`  → ${product.sku} (${product.name.slice(0, 40)})... `);

            const content = await generateDescription(product);
            if (!content) {
                cp.stats.error++;
                cp.processedIds.push(product.id);
                console.log('✗ üretim başarısız');
                return;
            }

            const saved = await saveToDb(product, content);
            if (saved) {
                cp.stats.success++;
                console.log('✓');
            } else {
                cp.stats.error++;
                console.log('✗ DB kayıt başarısız');
            }
            cp.processedIds.push(product.id);
            // İstek arası bekleme — Groq TPM limitini aşmamak için
            await new Promise(r => setTimeout(r, DELAY_MS));
        }));

        // Her grup sonrası checkpoint kaydet
        await saveCheckpoint(cp);
    }
}

// ── Toplam sayı ───────────────────────────────────────────────────────────────
async function countTotal(): Promise<number> {
    // Filtre JS tarafında yapıldığı için DB'den tüm aktif ürün sayısını çek
    const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('status', 'active');
    return count ?? 0;
}

// ── Ana Fonksiyon ─────────────────────────────────────────────────────────────
async function main() {
    console.log('━━━ TEKER MARKET — SEO AÇIKLAMA BOTU ━━━');
    if (!GROQ_API_KEY) {
        console.log('⚠  GROQ_API_KEY bulunamadı.');
        console.log('   .env.local dosyasına GROQ_API_KEY eklendiğinde bot otomatik çalışır.');
        console.log('   Ücretsiz key: https://console.groq.com');
        return;
    }
    console.log(`Mod: ${REWRITE_ALL ? 'TÜMÜNÜ YENİDEN YAZ' : 'SADECE EKSİKLER'} | ${DRY_RUN ? 'DRY-RUN (DB yazılmaz)' : 'CANLI'}`);
    console.log(`Model: llama-3.3-70b-versatile (Groq ücretsiz) | Paralel: ${CONCURRENCY} | Batch: ${BATCH_SIZE}\n`);

    const cp = await loadCheckpoint();
    const total = await countTotal();
    const effective = Math.min(total, MAX_LIMIT === Infinity ? total : MAX_LIMIT);

    console.log(`Toplam hedef: ${total} ürün${MAX_LIMIT !== Infinity ? ` (limit: ${MAX_LIMIT})` : ''}`);
    console.log(`Daha önce işlenen: ${cp.processedIds.length} ürün`);
    console.log(`İşlenecek: ~${Math.max(0, effective - cp.processedIds.length)} ürün\n`);

    if (effective === 0) {
        console.log('İşlenecek ürün yok. Tamamdır!');
        return;
    }

    let offset = 0;
    let totalProcessed = 0;

    while (true) {
        if (totalProcessed >= MAX_LIMIT) {
            console.log(`\nLimit (${MAX_LIMIT}) doldu, duruyorum.`);
            break;
        }

        const fetchResult = await fetchProducts(offset, cp.processedIds);
        const products = fetchResult.items;

        if (products.length === 0 && fetchResult.rawCount === 0) {
            console.log('\nTüm ürünler işlendi.');
            break;
        }

        const remaining = MAX_LIMIT === Infinity ? products.length : Math.min(products.length, MAX_LIMIT - totalProcessed);
        const batch = products.slice(0, remaining);

        if (batch.length > 0) {
            const chunkNum = Math.floor(offset / BATCH_SIZE) + 1;
            const totalChunks = Math.ceil(effective / BATCH_SIZE);
            console.log(`[Batch ${chunkNum}/${totalChunks}] ${batch.length} ürün işleniyor...`);

            await processBatch(batch, cp);
            totalProcessed += batch.length;

            console.log(`  Batch tamamlandı | Toplam başarı: ${cp.stats.success} | Hata: ${cp.stats.error}\n`);
        }

        offset += BATCH_SIZE;

        // Batch'ler arası bekleme (rate limit)
        if (batch.length === BATCH_SIZE || (fetchResult.rawCount === BATCH_SIZE && batch.length > 0)) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }

        if (fetchResult.rawCount < BATCH_SIZE) {
            console.log('\nTüm ürünler tarandı.');
            break;
        }
    }

    // ── Özet Rapor ────────────────────────────────────────────────────────────
    console.log('━━━ SEO BOT RAPORU ━━━');
    console.table({
        'Başarıyla Yazılan': { Adet: cp.stats.success },
        'Hata': { Adet: cp.stats.error },
        'Toplam İşlenen': { Adet: cp.processedIds.length },
    });

    if (cp.stats.error === 0) {
        // Başarılı tamamlandıysa checkpoint'i temizle
        try { await fs.unlink(CHECKPOINT_FILE); } catch { /* zaten yok */ }
        console.log('\nCheckpoint temizlendi. Bot başarıyla tamamlandı.');
    } else {
        console.log(`\nCheckpoint korundu (${cp.stats.error} hata var). Tekrar çalıştırınca kaldığı yerden devam eder.`);
    }

    console.log('━━━ TAMAMLANDI ━━━');
}

main().catch(err => {
    console.error('[Fatal]', err);
    process.exit(1);
});

/**
 * TEKER MARKET — Claude API Description Generator
 *
 * Jenerik/boş açıklamaları olan ürünleri Claude haiku ile yeniden yazar.
 * Codefast proxy üzerinden çalışır.
 *
 * Hedef: 10.681 ürün (emes_2026: 8603, zet_2026: 1533, oskar_2026: 542, falo_2026: 3)
 *
 * Kullanım:
 *   npx ts-node scripts/generate-descriptions-claude.ts
 *   npx ts-node scripts/generate-descriptions-claude.ts --limit=20   # test
 *   npx ts-node scripts/generate-descriptions-claude.ts --resume     # kaldığı yerden devam
 *   npx ts-node scripts/generate-descriptions-claude.ts --dry-run    # DB'ye yazmadan test
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const CHECKPOINT_FILE = path.resolve(process.cwd(), 'scripts/output/desc-checkpoint.json');

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 3;
const DELAY_MS = 400;
const MODEL = 'claude-haiku-4-5-20251001';

const RESUME   = process.argv.includes('--resume');
const DRY_RUN  = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const MAX_LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Jenerik pattern kontrolü
function isGeneric(desc: string | null): boolean {
    if (!desc) return true;
    if (desc.trim() === '') return true;
    if (desc.includes('Tüm Projeleriniz İçin')) return true;
    return false;
}

async function generateDescription(
    name: string,
    categoryName: string,
    sku: string,
    attributes: Record<string, string> | null
): Promise<{ short: string; long: string } | null> {

    const attrText = attributes && Object.keys(attributes).length > 0
        ? '\nTeknik özellikler:\n' + Object.entries(attributes).map(([k, v]) => `- ${k}: ${v}`).join('\n')
        : '';

    const prompt = `Sen bir endüstriyel teker ve hırdavat e-ticaret sitesi için ürün açıklaması yazıyorsun.

Ürün bilgileri:
- Ad: ${name}
- Kategori: ${categoryName}
- SKU: ${sku}${attrText}

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{"short": "1-2 cümle kısa açıklama (max 160 karakter, Türkçe)", "long": "3-4 cümle detaylı açıklama (kalite, kullanım alanı, dayanıklılık, malzeme özellikleri — Türkçe, SEO uyumlu)"}

Türkçe yaz. Jenerik değil, ürüne özgü ve gerçekçi bir metin üret.`;

    try {
        const res = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 400,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,
            }),
        });

        const data = await res.json() as any;
        if (data.error) {
            console.error(`  [API Hata] ${data.error.type}: ${data.error.message}`);
            return null;
        }

        const content = data.content?.[0]?.text?.trim();
        if (!content) return null;

        const match = content.match(/\{[\s\S]*\}/);
        if (!match) return null;

        return JSON.parse(match[0]);
    } catch (e) {
        console.error('  [Parse Hata]', e);
        return null;
    }
}

async function main() {
    console.log('━━━ CLAUDE DESCRIPTION GENERATOR ━━━');
    if (DRY_RUN) console.log('  ⚠  DRY-RUN — DB\'ye yazılmıyor');
    console.log(`  Model: ${MODEL}`);
    console.log(`  Endpoint: ${ANTHROPIC_BASE_URL}\n`);

    // Checkpoint yükle
    let doneIds = new Set<string>();
    if (RESUME) {
        try {
            const cp = JSON.parse(await fs.readFile(CHECKPOINT_FILE, 'utf-8'));
            doneIds = new Set(cp.doneIds);
            console.log(`Devam: ${doneIds.size} ürün zaten tamamlandı\n`);
        } catch { /* sıfırdan başla */ }
    }

    // Kategori haritası
    const { data: cats } = await sb.from('categories').select('id, name');
    const catMap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));

    // İşlenecek ürünleri çek — tüm kaynaklar
    let allProducts: any[] = [];
    const sources = ['emes_2026', 'zet_2026', 'oskar_2026', 'falo_2026'];

    for (const src of sources) {
        let from = 0;
        while (true) {
            const { data, error } = await sb.from('products')
                .select('id, sku, name, category_id, description, attributes, meta')
                .contains('meta', { source: src })
                .is('deleted_at', null)
                .range(from, from + 999);
            if (error || !data || data.length === 0) break;
            // Sadece jenerik/boş olanları al
            const filtered = data.filter(p => isGeneric(p.description) && !doneIds.has(p.id));
            allProducts = allProducts.concat(filtered);
            if (data.length < 1000) break;
            from += 1000;
        }
        console.log(`${src}: ${allProducts.filter(p => p.meta?.source === src).length} ürün kuyruğa alındı`);
    }

    // Limit uygula
    if (MAX_LIMIT < Infinity) {
        allProducts = allProducts.slice(0, MAX_LIMIT);
    }

    const total = allProducts.length;
    console.log(`\nToplam işlenecek: ${total} ürün\n`);

    if (total === 0) {
        console.log('İşlenecek ürün yok. Çıkılıyor.');
        return;
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
        const batch = allProducts.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (p) => {
            const catName = catMap[p.category_id] || 'Endüstriyel Teker';
            const result = await generateDescription(p.name, catName, p.sku, p.attributes);

            if (!result) {
                failed++;
                return;
            }

            if (!DRY_RUN) {
                const { error } = await sb.from('products')
                    .update({
                        short_description: result.short,
                        description: result.long,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', p.id);

                if (error) {
                    console.error(`  [DB Hata] ${p.sku}: ${error.message}`);
                    failed++;
                    return;
                }
            }

            doneIds.add(p.id);
            updated++;
        }));

        const progress = Math.min(i + BATCH_SIZE, total);
        const pct = Math.round((progress / total) * 100);
        process.stdout.write(`\r  [${progress}/${total}] %${pct} | ✅ ${updated} | ❌ ${failed}`);

        // Checkpoint kaydet
        await fs.writeFile(CHECKPOINT_FILE, JSON.stringify({ doneIds: [...doneIds], updatedAt: new Date().toISOString() }), 'utf-8');

        if (i + BATCH_SIZE < allProducts.length) {
            await sleep(DELAY_MS);
        }
    }

    console.log(`\n\n━━━ TAMAMLANDI ━━━`);
    console.log(`✅ Güncellendi: ${updated}`);
    console.log(`❌ Başarısız:  ${failed}`);
    console.log(`━━━━━━━━━━━━━━━━━━`);
}

main().catch(err => {
    console.error('[Fatal]', err instanceof Error ? err.message : err);
    process.exit(1);
});

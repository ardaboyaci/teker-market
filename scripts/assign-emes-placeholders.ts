/**
 * EMES Placeholder Görsel Atama
 * Görselsiz EMES ürünlerine urun_tipi bazında placeholder atar.
 *
 * Eşleştirme:
 *   TAM MAMUL, MAŞA, YEDEK TEKER → /placeholder-teker.svg
 *   KULP                          → /placeholder-kulp.svg
 *   TAMİR TAKIMI, JANT*, BORU    → /placeholder-aksesuar.svg
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DRY_RUN = process.argv.includes('--dry-run');

function pickPlaceholder(source: string, urun_tipi: string): string {
    if (source === 'emes_kulp_2026' || urun_tipi === 'KULP') {
        return '/placeholder-kulp.svg';
    }
    if (['TAM MAMUL', 'MAŞA', 'YEDEK TEKER'].includes(urun_tipi)) {
        return '/placeholder-teker.svg';
    }
    return '/placeholder-aksesuar.svg';
}

async function main() {
    console.log('━━━ EMES PLACEHOLDER GÖRSEL ATAMA ━━━');
    if (DRY_RUN) console.log('⚠  DRY-RUN — DB\'ye yazılmıyor\n');

    const { data, error } = await supabase
        .from('products')
        .select('id, name, meta')
        .is('deleted_at', null)
        .is('image_url', null)
        .in('meta->>source', ['emes_2026', 'emes_kulp_2026', 'yedek_emes_2026']);

    if (error) { console.error('[DB Hata]', error.message); process.exit(1); }
    console.log(`[DB] ${data.length} görselsiz EMES ürünü bulundu\n`);

    const stats: Record<string, number> = { teker: 0, kulp: 0, aksesuar: 0 };

    const batches: { ids: string[]; url: string; label: string }[] = [];
    const groups: Record<string, string[]> = {};

    for (const p of data) {
        const source = (p.meta as any)?.source || '';
        const urun_tipi = ((p.meta as any)?.urun_tipi || '').trim();
        const url = pickPlaceholder(source, urun_tipi);
        groups[url] = groups[url] || [];
        groups[url].push(p.id);

        if (url.includes('teker')) stats.teker++;
        else if (url.includes('kulp')) stats.kulp++;
        else stats.aksesuar++;
    }

    console.log('Dağılım:');
    console.log(`  Teker placeholder:    ${stats.teker} ürün`);
    console.log(`  Kulp placeholder:     ${stats.kulp} ürün`);
    console.log(`  Aksesuar placeholder: ${stats.aksesuar} ürün`);
    console.log();

    if (DRY_RUN) {
        console.log('[DRY-RUN] İşlem yapılmadı.');
        return;
    }

    let updated = 0;
    for (const [url, ids] of Object.entries(groups)) {
        // 500'lük batch'lerle güncelle
        for (let i = 0; i < ids.length; i += 500) {
            const batch = ids.slice(i, i + 500);
            const { error: upErr } = await supabase
                .from('products')
                .update({ image_url: url })
                .in('id', batch);

            if (upErr) {
                console.error(`[Hata] ${url}: ${upErr.message}`);
            } else {
                updated += batch.length;
                process.stdout.write(`\r  Güncellendi: ${updated}/${data.length}`);
            }
        }
    }

    console.log(`\n\n✅ Tamamlandı — ${updated} ürüne placeholder atandı.`);
}

main().catch(err => { console.error('[Fatal]', err); process.exit(1); });

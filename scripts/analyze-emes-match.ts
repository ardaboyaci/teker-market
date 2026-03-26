/**
 * Katalog → DB ters eşleştirme analizi
 * Her katalog ürününü DB'deki EMES ürünleriyle karşılaştırır
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // DB ürünlerini çek
    const { data } = await sb.from('products')
        .select('id, sku, name')
        .in('meta->>source', ['emes_2026', 'emes_kulp_2026', 'yedek_emes_2026'])
        .is('image_url', null)
        .limit(2000);

    const catalog: any[] = JSON.parse(fs.readFileSync('scripts/output/emes-site-catalog.json', 'utf-8'));

    // DB ürün adları → id map (boşlukları normalize ederek)
    const dbByCompact = new Map<string, any>();
    const dbByName = new Map<string, any>();
    for (const p of (data ?? [])) {
        const c = (p.name || p.sku).trim().replace(/\s+/g, '').toUpperCase();
        dbByCompact.set(c, p);
        dbByName.set((p.name || p.sku).trim().toUpperCase(), p);
    }

    let matched = 0;
    const examples: string[] = [];

    for (const item of catalog) {
        // Katalog compact → DB compact tam eşleşme
        if (dbByCompact.has(item.compact)) {
            matched++;
            const p = dbByCompact.get(item.compact)!;
            examples.push(`"${p.name}" ↔ "${item.compact}" | img: ...${item.imageUrl.slice(-25)}`);
            continue;
        }
        // Katalog adı → DB adı eşleşme
        const nameUpper = item.name.trim().toUpperCase();
        if (dbByName.has(nameUpper)) {
            matched++;
            const p = dbByName.get(nameUpper)!;
            examples.push(`"${p.name}" ↔ [nameMatch] "${item.name}" | img: ...${item.imageUrl.slice(-25)}`);
        }
    }

    console.log(`\n=== KATALOG → DB EŞLEŞTİRME ===`);
    console.log(`Katalog: ${catalog.length} | DB: ${(data ?? []).length}`);
    console.log(`Eşleşen: ${matched}`);
    console.log(`\n=== ÖRNEKLER ===`);
    examples.slice(0, 30).forEach(e => console.log(' ', e));
}
main().catch(console.error);

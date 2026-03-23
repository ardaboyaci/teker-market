import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function count(sb: any, source: string, imageNull: boolean) {
    let q = sb.from('products').select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('meta->>source', source);
    if (imageNull) q = q.is('image_url', null);
    const { count } = await q;
    return count ?? 0;
}

async function main() {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const sources = [
        'emes_2026', 'emes_kulp_2026', 'yedek_emes_2026',
        'oskar_2026', 'ciftel_2026', 'kaucuk_takoz_2026',
        'falo_2026', 'zet_2026', 'mertsan_2026'
    ];

    console.log('\n┌─────────────────────────┬────────┬────────────┐');
    console.log('│ Kaynak                  │ Toplam │ Görselsiz  │');
    console.log('├─────────────────────────┼────────┼────────────┤');

    const rows: [string, number, number][] = [];
    for (const src of sources) {
        const total = await count(sb, src, false);
        const noImg = await count(sb, src, true);
        if (total > 0) rows.push([src, total, noImg]);
    }

    rows.sort((a, b) => b[1] - a[1]);
    for (const [src, total, noImg] of rows) {
        console.log(`│ ${src.padEnd(23)} │ ${String(total).padStart(6)} │ ${String(noImg).padStart(10)} │`);
    }
    console.log('└─────────────────────────┴────────┴────────────┘');
}
main().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Error] Invalid Supabase Credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const B2B_CATEGORIES = [
    { name: "Endüstriyel Tekerlekler", slug: "endustriyel" },
    { name: "Hafif Sanayi Tekerlekleri", slug: "hafif-sanayi" },
    { name: "Ağır Yük Tekerlekleri", slug: "agir-yuk" },
    { name: "Mobilya Tekerlekleri", slug: "mobilya" },
    { name: "Havalı Tekerlekler", slug: "havali" },
    { name: "Isıya Dayanıklı Tekerlekler", slug: "isiya-dayanikli" },
    { name: "Paslanmaz Tekerlekler (INOX)", slug: "paslanmaz-inox" },
    { name: "Transpalet Tekerlekleri", slug: "transpalet" },
    { name: "Medikal & Hastane Tekerlekleri", slug: "medikal" },
    { name: "Yedek Tekerlekler", slug: "yedek" }
];

async function main() {
    console.log("1. Ensuring B2B Categories exist...");

    const { data: rootCat } = await supabase.from('categories').select('id').eq('slug', 'tekerlekler').maybeSingle();
    const parentId = rootCat?.id || null;

    const categoryMap: Record<string, string> = {};

    for (const cat of B2B_CATEGORIES) {
        const { data: existing } = await supabase.from('categories').select('id').eq('slug', cat.slug).maybeSingle();
        if (existing) {
            categoryMap[cat.name] = existing.id;
        } else {
            console.log(`Inserting category: ${cat.name}`);
            const pathValue = parentId ? `tekerlekler.${cat.slug}` : cat.slug;

            const { data: newCat, error } = await supabase.from('categories').insert({
                name: cat.name,
                slug: cat.slug,
                parent_id: parentId,
                path: pathValue,
                is_active: true
            }).select('id').single();
            if (newCat) categoryMap[cat.name] = newCat.id;
            if (error) console.error("Error inserting", cat.name, error.message);
        }
    }

    console.log("2. Fetching all products to re-categorize...");
    const { data: products } = await supabase.from('products').select('id, sku, name');

    if (!products) {
        console.log("No products found.");
        return;
    }

    console.log(`Analyzing ${products.length} products...`);
    let updatedCount = 0;

    for (const p of products) {
        let assignedCat = '';
        const sku = p.sku.toUpperCase();
        const name = p.name.toUpperCase();

        // Very basic heuristic classification based on standard series
        if (name.includes('PASLANMAZ') || name.includes('INOX')) assignedCat = 'Paslanmaz Tekerlekler (INOX)';
        else if (sku.startsWith('HQP') || sku.startsWith('HQR') || sku.startsWith('EJ') || sku.startsWith('EW')) assignedCat = 'Ağır Yük Tekerlekleri';
        else if (sku.startsWith('YT')) assignedCat = 'Yedek Tekerlekler';
        else if (sku.startsWith('EC') || name.includes('MEDİKAL') || name.includes('HASTANE')) assignedCat = 'Medikal & Hastane Tekerlekleri';
        else if (name.includes('HAVALI') || name.includes('ŞAMBREL') || name.includes('LASTİK')) assignedCat = 'Havalı Tekerlekler';
        else if (name.includes('YÜKSEK SICAKLIK') || name.includes('ISIYA DAYANIKLI') || name.includes('YANMAZ')) assignedCat = 'Isıya Dayanıklı Tekerlekler';
        else if (sku.startsWith('EF') || sku.startsWith('EL') || sku.startsWith('EP') || name.includes('MOBİLYA')) assignedCat = 'Mobilya Tekerlekleri';
        else if (name.includes('TRANSPALET')) assignedCat = 'Transpalet Tekerlekleri';
        else if (sku.startsWith('EB') || sku.startsWith('EN')) assignedCat = 'Hafif Sanayi Tekerlekleri';
        else assignedCat = 'Endüstriyel Tekerlekler'; // Default fallback

        const catId = categoryMap[assignedCat];
        if (catId) {
            await supabase.from('products').update({ category_id: catId }).eq('id', p.id);
            updatedCount++;
        }
    }

    console.log(`Successfully categorized ${updatedCount} products!`);
}

main();

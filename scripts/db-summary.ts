import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { count: total }      = await supabase.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null);
    const { count: active }     = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null);
    const { count: draft }      = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'draft').is('deleted_at', null);
    const { count: withPrice }  = await supabase.from('products').select('*', { count: 'exact', head: true }).not('sale_price', 'is', null).is('deleted_at', null);
    const { count: withImage }  = await supabase.from('products').select('*', { count: 'exact', head: true }).not('image_url', 'is', null).is('deleted_at', null);
    const { count: withDesc }   = await supabase.from('products').select('*', { count: 'exact', head: true }).not('description', 'is', null).is('deleted_at', null);
    const { count: emesSynced } = await supabase.from('products').select('*', { count: 'exact', head: true }).not('meta->supplier_skus', 'is', null).is('deleted_at', null);

    console.table({
        'Toplam Ürün':       { Adet: total },
        'Active':            { Adet: active },
        'Draft':             { Adet: draft },
        'Fiyatı Olan':       { Adet: withPrice },
        'Görseli Olan':      { Adet: withImage },
        'Açıklaması Olan':   { Adet: withDesc },
        "EMES SKU Sync'li":  { Adet: emesSynced },
    });
}

main();

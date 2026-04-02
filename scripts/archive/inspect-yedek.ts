import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await supabase
    .from('products')
    .select('*')
    .filter('meta->>source', 'eq', 'yedek_emes_2026')
    .is('description', null)
    .limit(5);
  
  data?.forEach(p => {
    console.log(JSON.stringify(p, null, 2));
    console.log('---');
  });
}
main().catch(console.error);

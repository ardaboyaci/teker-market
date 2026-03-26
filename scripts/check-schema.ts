import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await sb.from('products').select('*').range(0, 2);
  console.log('error:', error);
  if (data?.[0]) console.log('kolonlar:', Object.keys(data[0]).join(', '));
  console.log('sample:', JSON.stringify(data?.[0], null, 2));
}
main();

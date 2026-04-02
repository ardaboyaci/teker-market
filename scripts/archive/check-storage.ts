import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data, error } = await supabase.storage.from('product-media').list('', { limit: 10 })
  console.log('Bucket "product-media" items:', data)
  
  const { data: d2, error: e2 } = await supabase.storage.from('products').list('', { limit: 10 })
  console.log('Bucket "products" items:', d2)
}
run()

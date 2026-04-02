import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data, error } = await supabase.storage.from('product-media').list('products', { limit: 10, offset: 0 })
  console.log('Files in product-media/products:', data?.map(d => d.name))
  if (error) console.error(error)

  const { data: d2, error: e2 } = await supabase.storage.from('products').list('', { limit: 10 })
  console.log('Files in products bucket root:', d2?.map(d => d.name))
}
run()

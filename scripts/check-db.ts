import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // ya da NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Eksik Supabase bilgileri!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  // Ürün sayısı
  const { count: productCount, error: err1 } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    
  console.log('Total Products in DB:', productCount)

  // product_media örnekleri
  const { data: mediaData, error: err2 } = await supabase
    .from('product_media')
    .select('product_id, url')
    .limit(5)
    
  console.log('Product Media Examples:', mediaData?.length, 'found.')
  if (mediaData && mediaData.length > 0) {
      console.log('Sample format:', mediaData[0])
  }

  // ürünlerin meta JSON yapısına bakalım
  const { data: metaData } = await supabase
    .from('products')
    .select('id, meta')
    .not('meta', 'is', null)
    .limit(3)
    
  console.log('Product Meta Examples:', JSON.stringify(metaData, null, 2))
}

run()

import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Need direct postgres URL, not REST API
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("HATA: .env.local dosyasında postgresql:// ile başlayan bir DATABASE_URL bulunamadı.");
  console.error("Tablo ve fonksiyon oluşturma (DDL) komutları için bu gereklidir.");
  process.exit(1);
}

const sql = postgres(dbUrl);

async function main() {
  try {
    console.log("SQL komutları çalıştırılıyor...");
    await sql`
      CREATE TABLE IF NOT EXISTS public.product_media (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          is_primary BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    console.log("✅ product_media tablosu eklendi.");
    
    // ... Devamı
  } catch (err) {
    console.error("SQL Hatası:", err);
  } finally {
    process.exit();
  }
}
main();

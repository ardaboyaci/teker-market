-- product-media bucket public erişim + authenticated upload policy
-- Supabase Dashboard > SQL Editor'da çalıştır

-- 1. Bucket'ı public yap (görsel URL'leri browser'dan erişilebilsin)
UPDATE storage.buckets
SET public = true
WHERE name = 'product-media';

-- Bucket yoksa oluştur
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Authenticated + service_role kullanıcıları için upload/update izni
-- (Önce var olanları temizle, sonra yeniden ekle)
DELETE FROM storage.policies
WHERE bucket_id = 'product-media'
  AND name IN ('allow_authenticated_upload', 'allow_authenticated_update', 'allow_public_select');

INSERT INTO storage.policies (name, bucket_id, operation, definition) VALUES
  ('allow_public_select',        'product-media', 'SELECT', 'true'),
  ('allow_authenticated_upload', 'product-media', 'INSERT', '(role() = ''authenticated'' OR role() = ''service_role'')'),
  ('allow_authenticated_update', 'product-media', 'UPDATE', '(role() = ''authenticated'' OR role() = ''service_role'')');

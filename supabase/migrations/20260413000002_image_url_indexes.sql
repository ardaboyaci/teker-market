-- Partial index: image_url IS NULL olan aktif ürünleri hızlı bulmak için
-- Görsel botu bu sorguyu çok sık çalıştırıyor, full scan'ı engeller
CREATE INDEX IF NOT EXISTS idx_products_image_url_null
ON products (image_url)
WHERE image_url IS NULL AND deleted_at IS NULL;

-- Composite index: source + image_url → tedarikçiye göre görselsiz ürün filtrelemesi
CREATE INDEX IF NOT EXISTS idx_products_source_image
ON products ((meta->>'source'), image_url)
WHERE deleted_at IS NULL;

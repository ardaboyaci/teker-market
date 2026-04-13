-- Ürün sıralama ağırlığı: görsel+stok olanlar önce, görselsizler sona
-- Önce: image_url IS NOT NULL ve quantity_on_hand > 0 → 1
-- Sonra: image_url IS NOT NULL ve quantity_on_hand = 0 → 2
-- En sona: image_url IS NULL                           → 3

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sort_weight integer GENERATED ALWAYS AS (
    CASE
      WHEN image_url IS NOT NULL AND quantity_on_hand > 0 THEN 1
      WHEN image_url IS NOT NULL AND quantity_on_hand = 0 THEN 2
      ELSE 3
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_sort_weight ON products (sort_weight ASC, created_at DESC);

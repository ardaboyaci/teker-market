-- ════════════════════════════════════════════════════════
-- SİSTEM OLGUNLAŞTIRMA — DB MİGRATION
-- Supabase SQL Editor'da çalıştır
-- ════════════════════════════════════════════════════════

-- ── 1. JSONB GIN index — meta->>'source' ILIKE sorgularını hızlandırır ────────
CREATE INDEX IF NOT EXISTS idx_products_meta_gin
    ON products USING GIN (meta);

-- meta->>'source' için ayrıca expression index (ILIKE için optimal)
CREATE INDEX IF NOT EXISTS idx_products_meta_source
    ON products ((meta->>'source'));

-- ── 2. Temel sorgular için eksik index'ler ─────────────────────────────────────
-- status + deleted_at kombinasyonu (en çok kullanılan filtre)
CREATE INDEX IF NOT EXISTS idx_products_status_deleted
    ON products (status, deleted_at)
    WHERE deleted_at IS NULL;

-- sale_price filtresi (fiyatlı/fiyatsız sorgular)
CREATE INDEX IF NOT EXISTS idx_products_sale_price
    ON products (sale_price)
    WHERE deleted_at IS NULL;

-- quantity_on_hand sıralama ve filtresi
CREATE INDEX IF NOT EXISTS idx_products_qty
    ON products (quantity_on_hand)
    WHERE deleted_at IS NULL AND status = 'active';

-- ── 3. audit_log INSERT/DELETE trigger ────────────────────────────────────────
-- Mevcut trigger fonksiyonu yoksa oluştur
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (action, table_name, record_id, new_data)
        VALUES ('INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (action, table_name, record_id, old_data, new_data,
            changed_fields)
        VALUES (
            'UPDATE', TG_TABLE_NAME, NEW.id,
            row_to_json(OLD), row_to_json(NEW),
            ARRAY(
                SELECT key FROM jsonb_each(row_to_json(OLD)::jsonb) old_fields
                JOIN jsonb_each(row_to_json(NEW)::jsonb) new_fields USING (key)
                WHERE old_fields.value IS DISTINCT FROM new_fields.value
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (action, table_name, record_id, old_data)
        VALUES ('DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- products tablosuna trigger ekle (önce mevcut varsa düşür)
DROP TRIGGER IF EXISTS products_audit_trigger ON products;
CREATE TRIGGER products_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ── 4. price_history otomatik trigger ─────────────────────────────────────────
-- sale_price değiştiğinde price_history'e otomatik yaz
CREATE OR REPLACE FUNCTION price_history_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.sale_price IS DISTINCT FROM NEW.sale_price THEN
        INSERT INTO price_history (product_id, price_type, old_price, new_price, change_reason)
        VALUES (
            NEW.id,
            'sale',
            OLD.sale_price::text,
            NEW.sale_price::text,
            'auto_trigger'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS products_price_history_trigger ON products;
CREATE TRIGGER products_price_history_trigger
    AFTER UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION price_history_trigger();

-- ── 5. Kontrol sorgusu — index'lerin oluştuğunu doğrula ───────────────────────
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'products'
  AND indexname LIKE 'idx_products_%'
ORDER BY indexname;

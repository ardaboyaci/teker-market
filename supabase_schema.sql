-- ============================================================================
-- TEKER MARKET — PIM & ENVANTER TAKİP SİSTEMİ
-- Supabase (PostgreSQL) Veritabanı Şeması
-- Versiyon: 1.0 | Tarih: 2 Mart 2026
-- ============================================================================
-- DİKKAT: Tüm finansal sütunlar NUMERIC(12,4) kullanır.
-- Asla FLOAT veya DOUBLE PRECISION kullanmayın.
-- ============================================================================

-- ============================================================================
-- 0. UZANTILAR (Extensions)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID üretimi
CREATE EXTENSION IF NOT EXISTS "ltree";           -- Hiyerarşik kategori ağaçları
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Trigram arama (fuzzy search)

-- ============================================================================
-- 1. ENUM TİPLERİ
-- ============================================================================

CREATE TYPE product_status AS ENUM ('active', 'inactive', 'draft', 'archived');
CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'adjustment', 'transfer', 'return');
CREATE TYPE attribute_data_type AS ENUM ('text', 'number', 'boolean', 'select', 'multi_select', 'unit');
CREATE TYPE price_type AS ENUM ('base', 'sale', 'wholesale', 'dealer');

-- ============================================================================
-- 2. KATEGORİ TABLOSU (ltree ile Hiyerarşik Ağaç)
-- ============================================================================

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT,
    path            LTREE NOT NULL,               -- Materialize edilmiş yol: 'tekerlekler.poliuretan.agir_yuk'
    parent_id       UUID REFERENCES categories(id) ON DELETE RESTRICT,
    depth           INT GENERATED ALWAYS AS (nlevel(path)) STORED,  -- Otomatik derinlik hesaplama
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    image_url       TEXT,
    meta            JSONB DEFAULT '{}',           -- Esnek ek veriler (SEO, açıklama vb.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT uq_categories_path UNIQUE (path)
);

-- Hiyerarşik sorgular için GiST indeksi
CREATE INDEX idx_categories_path_gist ON categories USING GIST (path);
CREATE INDEX idx_categories_parent ON categories (parent_id);
CREATE INDEX idx_categories_active ON categories (is_active) WHERE is_active = true;

COMMENT ON TABLE categories IS 'Derin iç içe geçmiş kategori ağacı. ltree ile materialize edilmiş yol.';
COMMENT ON COLUMN categories.path IS 'ltree yol — ör: tekerlekler.poliuretan.agir_yuk';

-- ============================================================================
-- 3. ÖZELLİK (ATTRIBUTE) TANIMLAMA SİSTEMİ
-- ============================================================================

-- 3a. Özellik Grupları (ör: "Fiziksel Özellikler", "Teknik Detaylar")
CREATE TABLE attribute_groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE attribute_groups IS 'Ürün özelliklerini mantıksal gruplara ayırır (ör: Fiziksel, Teknik, Mekanik).';

-- 3b. Özellik Tanımları (ör: "Çap", "Malzeme", "Fren Tipi")
CREATE TABLE attributes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id        UUID REFERENCES attribute_groups(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,                 -- "Çap"
    slug            TEXT NOT NULL UNIQUE,           -- "cap"
    data_type       attribute_data_type NOT NULL,   -- text, number, boolean, select, multi_select, unit
    unit            TEXT,                           -- "mm", "kg", "°C" (yalnızca number/unit tipleri için)
    options         JSONB,                         -- select/multi_select seçenekleri: ["Poliüretan", "Kauçuk", "PA"]
    is_required     BOOLEAN NOT NULL DEFAULT false,
    is_filterable   BOOLEAN NOT NULL DEFAULT true,  -- Ürün listesinde filtre olarak gösterilsin mi?
    is_searchable   BOOLEAN NOT NULL DEFAULT false, -- Full-text aramaya dahil edilsin mi?
    validation      JSONB,                         -- Doğrulama kuralları: { "min": 10, "max": 500, "pattern": "^[A-Z]" }
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attributes_group ON attributes (group_id);
CREATE INDEX idx_attributes_filterable ON attributes (is_filterable) WHERE is_filterable = true;

COMMENT ON TABLE attributes IS 'Dinamik özellik tanımları. EAV pattern — kategori bazlı farklı özellik setleri.';
COMMENT ON COLUMN attributes.options IS 'select/multi_select için seçenek listesi: ["Poliüretan", "Kauçuk", "Naylon"]';
COMMENT ON COLUMN attributes.validation IS 'Doğrulama kuralları: {"min": 10, "max": 500}';

-- 3c. Kategori ↔ Özellik İlişkisi (Hangi kategori hangi özelliklere sahip)
CREATE TABLE category_attributes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    attribute_id    UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    is_inherited    BOOLEAN NOT NULL DEFAULT false,  -- Üst kategoriden mi miras alındı?
    sort_order      INT NOT NULL DEFAULT 0,

    CONSTRAINT uq_category_attribute UNIQUE (category_id, attribute_id)
);

CREATE INDEX idx_ca_category ON category_attributes (category_id);
CREATE INDEX idx_ca_attribute ON category_attributes (attribute_id);

COMMENT ON TABLE category_attributes IS 'Hangi kategorinin hangi dinamik özelliklere sahip olduğunu belirler.';

-- ============================================================================
-- 4. ÜRÜN TABLOSU (Ana Tablo)
-- ============================================================================

CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku                 TEXT NOT NULL,
    barcode             TEXT,
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL,
    description         TEXT,
    short_description   TEXT,

    -- Kategori İlişkisi
    category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Fiyatlandırma (NUMERIC — Floating Point YASAK)
    cost_price          NUMERIC(12,4),             -- Alış fiyatı (KDV hariç)
    base_price          NUMERIC(12,4),             -- Baz satış fiyatı (KDV hariç)
    sale_price          NUMERIC(12,4),             -- İndirimli satış fiyatı
    wholesale_price     NUMERIC(12,4),             -- Toptan satış fiyatı
    dealer_price        NUMERIC(12,4),             -- Bayi fiyatı
    vat_rate            NUMERIC(5,2) NOT NULL DEFAULT 20.00,  -- KDV oranı (%)
    currency            TEXT NOT NULL DEFAULT 'TRY',

    -- Stok Bilgisi (Denormalize — performans için)
    quantity_on_hand    INT NOT NULL DEFAULT 0,     -- Mevcut stok
    min_stock_level     INT NOT NULL DEFAULT 0,     -- Minimum stok seviyesi (alarm eşiği)
    max_stock_level     INT,                        -- Maksimum stok kapasitesi

    -- Fiziksel Bilgiler
    weight              NUMERIC(10,3),             -- Ağırlık (kg)
    width               NUMERIC(10,2),             -- Genişlik (mm)
    height              NUMERIC(10,2),             -- Yükseklik (mm)
    depth_cm            NUMERIC(10,2),             -- Derinlik (mm)

    -- Dinamik Özellikler (JSONB — EAV Değerleri)
    attributes          JSONB DEFAULT '{}',         -- { "cap": "200", "malzeme": "Poliüretan", "fren_tipi": "sabit" }

    -- Durum & Meta
    status              product_status NOT NULL DEFAULT 'draft',
    is_featured         BOOLEAN NOT NULL DEFAULT false,
    tags                TEXT[] DEFAULT '{}',        -- Etiketler: {"endüstriyel", "ağır-yük"}
    meta                JSONB DEFAULT '{}',         -- SEO, dış platform eşlemeleri vb.
    external_id         TEXT,                       -- Dış platform ID'si (İkas, Ticimax vb.)
    external_url        TEXT,                       -- Dış platform ürün URL'si

    -- Soft Delete
    deleted_at          TIMESTAMPTZ,

    -- Zaman Damgaları
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Kısıtlar
    CONSTRAINT uq_products_sku UNIQUE (sku),
    CONSTRAINT uq_products_slug UNIQUE (slug),
    CONSTRAINT uq_products_barcode UNIQUE (barcode),
    CONSTRAINT chk_products_stock_nonneg CHECK (quantity_on_hand >= 0),
    CONSTRAINT chk_products_cost_nonneg CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT chk_products_base_nonneg CHECK (base_price IS NULL OR base_price >= 0),
    CONSTRAINT chk_products_sale_nonneg CHECK (sale_price IS NULL OR sale_price >= 0),
    CONSTRAINT chk_products_vat_range CHECK (vat_rate >= 0 AND vat_rate <= 100)
);

-- Performans İndeksleri
CREATE INDEX idx_products_category ON products (category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_sku ON products (sku);

-- Tam metin araması — Türkçe yapılandırma
CREATE INDEX idx_products_search ON products
    USING gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(barcode, '')));

-- Fiyat aralığı sorguları
CREATE INDEX idx_products_sale_price ON products (sale_price) WHERE deleted_at IS NULL AND status = 'active';

-- Stok uyarıları — düşük stok sorgusu
CREATE INDEX idx_products_low_stock ON products (quantity_on_hand, min_stock_level)
    WHERE deleted_at IS NULL AND status = 'active';

-- JSONB özellik sorguları
CREATE INDEX idx_products_attributes ON products USING gin (attributes jsonb_path_ops);

-- Soft delete filtresi (çoğu sorgu sadece aktif kayıtlara bakar)
CREATE INDEX idx_products_not_deleted ON products (id) WHERE deleted_at IS NULL;

COMMENT ON TABLE products IS 'Ana ürün tablosu. Tüm finansal veriler NUMERIC(12,4) tipindedir. Floating point kullanılmaz.';
COMMENT ON COLUMN products.attributes IS 'EAV değerleri: {"cap": "200", "malzeme": "Poliüretan"}';
COMMENT ON COLUMN products.quantity_on_hand IS 'Denormalize stok miktarı. stock_movements trigger ile güncellenir.';

-- ============================================================================
-- 5. ÜRÜN MEDYASI
-- ============================================================================

CREATE TABLE product_media (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,                  -- Supabase Storage CDN URL
    thumbnail_url   TEXT,                           -- Küçük önizleme URL'si
    original_url    TEXT,                           -- Dış kaynak orijinal URL'si
    alt_text        TEXT,
    file_name       TEXT,
    file_size       INT,                            -- Byte cinsinden
    mime_type       TEXT,
    width           INT,
    height          INT,
    sort_order      INT NOT NULL DEFAULT 0,
    is_primary      BOOLEAN NOT NULL DEFAULT false, -- Ana görsel mi?
    source          TEXT DEFAULT 'upload',          -- 'upload', 'url_import', 'api_import'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_product ON product_media (product_id);
CREATE INDEX idx_media_primary ON product_media (product_id, is_primary) WHERE is_primary = true;

-- Her ürünün yalnızca bir ana görseli olabilir
CREATE UNIQUE INDEX uq_media_primary_per_product ON product_media (product_id)
    WHERE is_primary = true;

COMMENT ON TABLE product_media IS 'Ürün görselleri. Dış kaynaktan URL/API ile çekilir, Supabase Storage''a yüklenir.';

-- ============================================================================
-- 6. DEPO (WAREHOUSE) YÖNETİMİ
-- ============================================================================

CREATE TABLE warehouses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    code            TEXT NOT NULL UNIQUE,           -- "ANA", "YDK", "SUBE-01"
    address         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Yalnızca bir varsayılan depo olabilir
CREATE UNIQUE INDEX uq_warehouses_default ON warehouses (is_default) WHERE is_default = true;

COMMENT ON TABLE warehouses IS 'Depo tanımları. Çoklu depo stok takibi için.';

-- ============================================================================
-- 7. STOK HAREKETLERİ (Stock Movements)
-- ============================================================================

CREATE TABLE stock_movements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id          UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id        UUID REFERENCES warehouses(id) ON DELETE SET NULL,

    movement_type       stock_movement_type NOT NULL,  -- in, out, adjustment, transfer, return
    quantity            INT NOT NULL,                    -- Pozitif: giriş, negatif: çıkış
    quantity_before     INT NOT NULL,                    -- Hareket öncesi stok
    quantity_after      INT NOT NULL,                    -- Hareket sonrası stok

    -- Transfer için hedef depo
    target_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,

    -- Referans bilgileri
    reference_type      TEXT,                           -- 'purchase_order', 'sale', 'manual', 'import'
    reference_id        TEXT,                           -- Dış referans ID'si
    reference_note      TEXT,                           -- Hareket açıklaması

    -- Finansal
    unit_cost           NUMERIC(12,4),                 -- Birim maliyet (giriş hareketlerinde)

    -- Meta
    created_by          UUID,                           -- Auth user ID (Supabase Auth)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Kısıtlar
    CONSTRAINT chk_movement_quantity CHECK (
        (movement_type IN ('in', 'return') AND quantity > 0) OR
        (movement_type IN ('out') AND quantity < 0) OR
        (movement_type IN ('adjustment', 'transfer'))
    ),
    CONSTRAINT chk_movement_transfer CHECK (
        (movement_type = 'transfer' AND target_warehouse_id IS NOT NULL) OR
        (movement_type != 'transfer')
    )
);

CREATE INDEX idx_movements_product ON stock_movements (product_id);
CREATE INDEX idx_movements_warehouse ON stock_movements (warehouse_id);
CREATE INDEX idx_movements_type ON stock_movements (movement_type);
CREATE INDEX idx_movements_created ON stock_movements (created_at DESC);
CREATE INDEX idx_movements_product_date ON stock_movements (product_id, created_at DESC);
CREATE INDEX idx_movements_reference ON stock_movements (reference_type, reference_id)
    WHERE reference_type IS NOT NULL;

COMMENT ON TABLE stock_movements IS 'Tüm stok hareketlerinin değişmez (immutable) kaydı. Audit log niteliğindedir.';
COMMENT ON COLUMN stock_movements.quantity IS 'Giriş: pozitif, Çıkış: negatif.';

-- ============================================================================
-- 8. FİYAT DEĞİŞİKLİK GEÇMİŞİ
-- ============================================================================

CREATE TABLE price_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_type      price_type NOT NULL,           -- base, sale, wholesale, dealer
    old_price       NUMERIC(12,4),
    new_price       NUMERIC(12,4),
    change_reason   TEXT,                           -- "Toplu %10 zam", "Manuel düzeltme"
    changed_by      UUID,                           -- Auth user ID
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_product ON price_history (product_id, created_at DESC);
CREATE INDEX idx_price_history_type ON price_history (price_type);

COMMENT ON TABLE price_history IS 'Tüm fiyat değişikliklerinin kaydı. Denetim ve analiz amaçlıdır.';

-- ============================================================================
-- 9. DENETİM KAYITLARI (Audit Log)
-- ============================================================================

CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name      TEXT NOT NULL,
    record_id       UUID NOT NULL,
    action          TEXT NOT NULL,                  -- 'INSERT', 'UPDATE', 'DELETE'
    old_data        JSONB,
    new_data        JSONB,
    changed_fields  TEXT[],                         -- Değişen alan adları
    user_id         UUID,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_created ON audit_log (created_at DESC);
CREATE INDEX idx_audit_user ON audit_log (user_id) WHERE user_id IS NOT NULL;

-- Eski kayıtları otomatik temizlemek için partitioning düşünülebilir
COMMENT ON TABLE audit_log IS 'Tüm tabloların değişiklik kaydı. Trigger ile otomatik doldurulur.';

-- ============================================================================
-- 10. TETİKLEYİCİLER (Triggers) ve FONKSİYONLAR
-- ============================================================================

-- 10a. updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_attributes_updated_at
    BEFORE UPDATE ON attributes
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_attribute_groups_updated_at
    BEFORE UPDATE ON attribute_groups
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- 10b. Stok hareketi → ürün stok güncelleme
CREATE OR REPLACE FUNCTION fn_update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET quantity_on_hand = quantity_on_hand + NEW.quantity
    WHERE id = NEW.product_id;

    -- Stok negatife düşmemeli (CHECK constraint da korur ama burada anlamlı hata verelim)
    IF (SELECT quantity_on_hand FROM products WHERE id = NEW.product_id) < 0 THEN
        RAISE EXCEPTION 'Yetersiz stok: Ürün % için stok negatife düşemez.', NEW.product_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movement_update
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION fn_update_product_stock();

-- 10c. Fiyat değişiklik geçmişi otomatik kayıt
CREATE OR REPLACE FUNCTION fn_track_price_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- base_price değişikliği
    -- NULL fiyat price_history'ye kaydedilmez (seed/draft ürünler için)
    IF OLD.base_price IS DISTINCT FROM NEW.base_price AND NEW.base_price IS NOT NULL THEN
        INSERT INTO price_history (product_id, price_type, old_price, new_price, change_reason)
        VALUES (NEW.id, 'base', OLD.base_price, NEW.base_price, 'Otomatik kayıt');
    END IF;

    -- sale_price değişikliği
    IF OLD.sale_price IS DISTINCT FROM NEW.sale_price AND NEW.sale_price IS NOT NULL THEN
        INSERT INTO price_history (product_id, price_type, old_price, new_price, change_reason)
        VALUES (NEW.id, 'sale', OLD.sale_price, NEW.sale_price, 'Otomatik kayıt');
    END IF;

    -- wholesale_price değişikliği
    IF OLD.wholesale_price IS DISTINCT FROM NEW.wholesale_price AND NEW.wholesale_price IS NOT NULL THEN
        INSERT INTO price_history (product_id, price_type, old_price, new_price, change_reason)
        VALUES (NEW.id, 'wholesale', OLD.wholesale_price, NEW.wholesale_price, 'Otomatik kayıt');
    END IF;

    -- dealer_price değişikliği
    IF OLD.dealer_price IS DISTINCT FROM NEW.dealer_price AND NEW.dealer_price IS NOT NULL THEN
        INSERT INTO price_history (product_id, price_type, old_price, new_price, change_reason)
        VALUES (NEW.id, 'dealer', OLD.dealer_price, NEW.dealer_price, 'Otomatik kayıt');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_price_changes
    AFTER UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_track_price_changes();

-- 10d. Genel denetim kaydı (audit log)
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    changed TEXT[];
    col TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_data, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Değişen alanları tespit et
        changed := ARRAY[]::TEXT[];
        FOR col IN SELECT key FROM jsonb_each(to_jsonb(NEW))
        LOOP
            IF to_jsonb(OLD) ->> col IS DISTINCT FROM to_jsonb(NEW) ->> col THEN
                changed := array_append(changed, col);
            END IF;
        END LOOP;

        -- Sadece updated_at değiştiyse loglama
        IF array_length(changed, 1) IS NOT NULL AND changed != ARRAY['updated_at'] THEN
            INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
            VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), changed, auth.uid());
        END IF;

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Denetim tetikleyicilerini kritik tablolara ekle
CREATE TRIGGER trg_audit_products
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_categories
    AFTER INSERT OR UPDATE OR DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_stock_movements
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- 11. RPC FONKSİYONLARI (Toplu İşlemler)
-- ============================================================================

-- 11a. Toplu fiyat güncelleme
CREATE OR REPLACE FUNCTION rpc_bulk_update_prices(
    p_product_ids UUID[],
    p_operation TEXT,           -- 'percent_increase', 'percent_decrease', 'fixed_increase', 'fixed_decrease'
    p_value NUMERIC(12,4),
    p_price_column TEXT DEFAULT 'sale_price',  -- Hangi fiyat sütunu güncellenir
    p_reason TEXT DEFAULT 'Toplu güncelleme'
)
RETURNS TABLE (
    product_id UUID,
    old_price NUMERIC(12,4),
    new_price NUMERIC(12,4)
) AS $$
DECLARE
    r RECORD;
    v_new_price NUMERIC(12,4);
    v_old_price NUMERIC(12,4);
BEGIN
    -- Güvenlik: Yalnızca izin verilen sütunlar
    IF p_price_column NOT IN ('base_price', 'sale_price', 'wholesale_price', 'dealer_price') THEN
        RAISE EXCEPTION 'Geçersiz fiyat sütunu: %', p_price_column;
    END IF;

    FOR r IN
        SELECT p.id,
            CASE p_price_column
                WHEN 'base_price' THEN p.base_price
                WHEN 'sale_price' THEN p.sale_price
                WHEN 'wholesale_price' THEN p.wholesale_price
                WHEN 'dealer_price' THEN p.dealer_price
            END AS current_price
        FROM products p
        WHERE p.id = ANY(p_product_ids) AND p.deleted_at IS NULL
    LOOP
        v_old_price := r.current_price;

        IF v_old_price IS NULL THEN
            CONTINUE;
        END IF;

        -- Hesaplama
        v_new_price := CASE p_operation
            WHEN 'percent_increase' THEN v_old_price * (1 + p_value / 100)
            WHEN 'percent_decrease' THEN v_old_price * (1 - p_value / 100)
            WHEN 'fixed_increase'   THEN v_old_price + p_value
            WHEN 'fixed_decrease'   THEN v_old_price - p_value
            ELSE v_old_price
        END;

        -- Negatif fiyat engelle
        IF v_new_price < 0 THEN
            v_new_price := 0;
        END IF;

        -- 4 ondalık hassasiyetle yuvarla
        v_new_price := ROUND(v_new_price, 4);

        -- Güncelle
        EXECUTE format(
            'UPDATE products SET %I = $1 WHERE id = $2',
            p_price_column
        ) USING v_new_price, r.id;

        -- Sonuç döndür
        product_id := r.id;
        old_price := v_old_price;
        new_price := v_new_price;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11b. Stok transfer (depodan depoya)
CREATE OR REPLACE FUNCTION rpc_transfer_stock(
    p_product_id UUID,
    p_from_warehouse_id UUID,
    p_to_warehouse_id UUID,
    p_quantity INT,
    p_note TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Çıkış hareketi
    INSERT INTO stock_movements (
        product_id, warehouse_id, movement_type, quantity,
        quantity_before, quantity_after, target_warehouse_id,
        reference_type, reference_note, created_by
    )
    SELECT
        p_product_id, p_from_warehouse_id, 'transfer', -p_quantity,
        p.quantity_on_hand, p.quantity_on_hand - p_quantity, p_to_warehouse_id,
        'transfer', p_note, auth.uid()
    FROM products p WHERE p.id = p_product_id;

    -- Giriş hareketi (hedef depoya)
    INSERT INTO stock_movements (
        product_id, warehouse_id, movement_type, quantity,
        quantity_before, quantity_after, target_warehouse_id,
        reference_type, reference_note, created_by
    )
    SELECT
        p_product_id, p_to_warehouse_id, 'transfer', p_quantity,
        p.quantity_on_hand, p.quantity_on_hand + p_quantity, p_from_warehouse_id,
        'transfer', p_note, auth.uid()
    FROM products p WHERE p.id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11c. Ürün arama (full-text + trigram)
CREATE OR REPLACE FUNCTION rpc_search_products(
    p_search TEXT,
    p_category_id UUID DEFAULT NULL,
    p_status product_status DEFAULT NULL,
    p_min_price NUMERIC DEFAULT NULL,
    p_max_price NUMERIC DEFAULT NULL,
    p_low_stock_only BOOLEAN DEFAULT false,
    p_cursor UUID DEFAULT NULL,
    p_limit INT DEFAULT 50
)
RETURNS SETOF products AS $$
BEGIN
    RETURN QUERY
    SELECT p.*
    FROM products p
    WHERE p.deleted_at IS NULL
      AND (p_search IS NULL OR
           to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.sku, '') || ' ' || coalesce(p.barcode, ''))
           @@ plainto_tsquery('simple', p_search)
           OR p.name ILIKE '%' || p_search || '%'
           OR p.sku ILIKE '%' || p_search || '%'
          )
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_status IS NULL OR p.status = p_status)
      AND (p_min_price IS NULL OR p.sale_price >= p_min_price)
      AND (p_max_price IS NULL OR p.sale_price <= p_max_price)
      AND (NOT p_low_stock_only OR (p.quantity_on_hand <= p.min_stock_level))
      AND (p_cursor IS NULL OR p.id > p_cursor)
    ORDER BY p.id
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 12. MATERIALIZED VIEW (Rapor Performansı)
-- ============================================================================

-- 12a. Kategori bazlı stok özeti
CREATE MATERIALIZED VIEW mv_category_stock_summary AS
SELECT
    c.id                  AS category_id,
    c.name                AS category_name,
    c.path                AS category_path,
    COUNT(p.id)           AS product_count,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) AS active_count,
    SUM(p.quantity_on_hand)                          AS total_stock,
    SUM(CASE WHEN p.quantity_on_hand <= p.min_stock_level AND p.status = 'active' THEN 1 ELSE 0 END) AS critical_count,
    AVG(p.sale_price)     AS avg_sale_price,
    SUM(p.quantity_on_hand * COALESCE(p.cost_price, 0)) AS total_stock_value
FROM categories c
LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
GROUP BY c.id, c.name, c.path
WITH DATA;

CREATE UNIQUE INDEX idx_mv_category_stock ON mv_category_stock_summary (category_id);

-- 12b. Eksik verili ürünler
CREATE MATERIALIZED VIEW mv_incomplete_products AS
SELECT
    p.id,
    p.sku,
    p.name,
    p.status,
    CASE WHEN p.base_price IS NULL OR p.base_price = 0 THEN true ELSE false END AS missing_price,
    CASE WHEN p.description IS NULL OR p.description = '' THEN true ELSE false END AS missing_description,
    CASE WHEN p.category_id IS NULL THEN true ELSE false END AS missing_category,
    CASE WHEN p.weight IS NULL THEN true ELSE false END AS missing_weight,
    CASE WHEN NOT EXISTS (SELECT 1 FROM product_media pm WHERE pm.product_id = p.id) THEN true ELSE false END AS missing_image,
    (
        (CASE WHEN p.base_price IS NULL OR p.base_price = 0 THEN 1 ELSE 0 END) +
        (CASE WHEN p.description IS NULL OR p.description = '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.category_id IS NULL THEN 1 ELSE 0 END) +
        (CASE WHEN p.weight IS NULL THEN 1 ELSE 0 END) +
        (CASE WHEN NOT EXISTS (SELECT 1 FROM product_media pm WHERE pm.product_id = p.id) THEN 1 ELSE 0 END)
    ) AS missing_field_count
FROM products p
WHERE p.deleted_at IS NULL
  AND (
    p.base_price IS NULL OR p.base_price = 0
    OR p.description IS NULL OR p.description = ''
    OR p.category_id IS NULL
    OR p.weight IS NULL
    OR NOT EXISTS (SELECT 1 FROM product_media pm WHERE pm.product_id = p.id)
  )
WITH DATA;

CREATE UNIQUE INDEX idx_mv_incomplete ON mv_incomplete_products (id);

-- ============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- ============================================================================

-- Tüm tabloları RLS ile koru
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media     ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Kimliği doğrulanmış kullanıcılar (authenticated) — Tam CRUD erişimi
-- Bu basit bir başlangıç politikasıdır. İlerleyen aşamalarda rol tabanlı
-- erişim kontrolü (RBAC) eklenebilir.
-- ----------------------------------------

-- Products
CREATE POLICY "Authenticated users can view products"
    ON products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert products"
    ON products FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
    ON products FOR UPDATE
    TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
    ON products FOR DELETE
    TO authenticated
    USING (true);

-- Categories
CREATE POLICY "Authenticated users can manage categories"
    ON categories FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- Attributes
CREATE POLICY "Authenticated users can manage attributes"
    ON attributes FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- Attribute Groups
CREATE POLICY "Authenticated users can manage attribute_groups"
    ON attribute_groups FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- Category Attributes
CREATE POLICY "Authenticated users can manage category_attributes"
    ON category_attributes FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- Product Media
CREATE POLICY "Authenticated users can manage product_media"
    ON product_media FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- Warehouses
CREATE POLICY "Authenticated users can manage warehouses"
    ON warehouses FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- Stock Movements (YAZ: herkes, SİL: kimse — değişmez kayıt)
CREATE POLICY "Authenticated users can view stock_movements"
    ON stock_movements FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert stock_movements"
    ON stock_movements FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Stock Movements UPDATE ve DELETE yasak — immutable audit trail
-- (Politika tanımlanmadığı için varsayılan DENY)

-- Price History (Sadece okuma — yazma trigger ile yapılır)
CREATE POLICY "Authenticated users can view price_history"
    ON price_history FOR SELECT
    TO authenticated
    USING (true);

-- Audit Log (Sadece okuma — yazma trigger ile yapılır)
CREATE POLICY "Authenticated users can view audit_log"
    ON audit_log FOR SELECT
    TO authenticated
    USING (true);

-- ----------------------------------------
-- Anonim erişim — TAMAMEN ENGELLE
-- (Supabase varsayılan olarak anon rolüne erişim verir;
--  RLS bu erişimi tamamen kapatır çünkü anon için politika tanımlanmadı)
-- ----------------------------------------

-- ============================================================================
-- 14. SUPABASE STORAGE BUCKET (Medya Dosyaları)
-- ============================================================================

-- Not: Bu SQL, Supabase Dashboard'da Storage bucket oluşturmak için
-- kullanılabilir veya Supabase CLI ile:
--   supabase storage create product-media --public

-- Storage RLS politikaları:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-media', 'product-media', true);

-- Politikalar (storage.objects tablosunda):
-- CREATE POLICY "Authenticated users can upload media"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'product-media');

-- CREATE POLICY "Anyone can view media"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'product-media');

-- CREATE POLICY "Authenticated users can delete media"
--   ON storage.objects FOR DELETE
--   TO authenticated
--   USING (bucket_id = 'product-media');

-- ============================================================================
-- 15. BAŞLANGIÇ VERİLERİ (Seed Data)
-- ============================================================================

-- Varsayılan depo
INSERT INTO warehouses (name, code, is_default) VALUES
    ('Ana Depo', 'ANA', true);

-- Örnek özellik grupları
INSERT INTO attribute_groups (name, slug, sort_order) VALUES
    ('Fiziksel Özellikler', 'fiziksel', 1),
    ('Teknik Detaylar', 'teknik', 2),
    ('Bağlantı & Montaj', 'baglanti', 3);

-- Örnek özellikler (endüstriyel teker spesifik)
INSERT INTO attributes (group_id, name, slug, data_type, unit, options, is_filterable, sort_order) VALUES
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Çap', 'cap', 'unit', 'mm', NULL, true, 1),
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Genişlik', 'genislik', 'unit', 'mm', NULL, true, 2),
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Yükseklik', 'yukseklik', 'unit', 'mm', NULL, true, 3),
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Ağırlık', 'agirlik', 'unit', 'kg', NULL, true, 4),
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Malzeme', 'malzeme', 'select', NULL,
        '["Poliüretan", "Kauçuk", "Naylon (PA)", "Polipropilen (PP)", "Döküm Demir", "Paslanmaz Çelik", "Fenol", "Poliamid"]',
        true, 5),
    ((SELECT id FROM attribute_groups WHERE slug = 'teknik'), 'Taşıma Kapasitesi', 'tasima_kapasitesi', 'unit', 'kg', NULL, true, 1),
    ((SELECT id FROM attribute_groups WHERE slug = 'teknik'), 'Sertlik (Shore A)', 'sertlik', 'unit', 'Shore A', NULL, false, 2),
    ((SELECT id FROM attribute_groups WHERE slug = 'teknik'), 'Çalışma Sıcaklığı Min', 'sicaklik_min', 'unit', '°C', NULL, false, 3),
    ((SELECT id FROM attribute_groups WHERE slug = 'teknik'), 'Çalışma Sıcaklığı Max', 'sicaklik_max', 'unit', '°C', NULL, false, 4),
    ((SELECT id FROM attribute_groups WHERE slug = 'teknik'), 'Yatak Tipi', 'yatak_tipi', 'select', NULL,
        '["Bilya Yataklı", "Düz Yataklı", "İğne Yataklı", "Yatak Yok"]',
        true, 5),
    ((SELECT id FROM attribute_groups WHERE slug = 'teknik'), 'Fren Tipi', 'fren_tipi', 'select', NULL,
        '["Frensiz", "Sabit Frenli", "Yönlü Frenli", "Toplam Frenli"]',
        true, 6),
    ((SELECT id FROM attribute_groups WHERE slug = 'baglanti'), 'Bağlantı Şekli', 'baglanti_sekli', 'select', NULL,
        '["Sabit Plaka", "Döner Plaka", "Cıvata Bağlantılı (Threaded Stem)", "Delik Bağlantılı", "Yaylı (Spring Loaded)", "Flanşlı"]',
        true, 1),
    ((SELECT id FROM attribute_groups WHERE slug = 'baglanti'), 'Plaka Ölçüsü', 'plaka_olcusu', 'text', NULL, NULL, false, 2),
    ((SELECT id FROM attribute_groups WHERE slug = 'baglanti'), 'Cıvata Çapı', 'civata_capi', 'unit', 'mm', NULL, false, 3);

-- Örnek kategori ağacı (ltree)
INSERT INTO categories (name, slug, path, parent_id, sort_order) VALUES
    ('Tekerlekler', 'tekerlekler', 'tekerlekler', NULL, 1),
    ('Aparatlar', 'aparatlar', 'aparatlar', NULL, 2),
    ('Aksesuarlar', 'aksesuarlar', 'aksesuarlar', NULL, 3);

INSERT INTO categories (name, slug, path, parent_id, sort_order) VALUES
    ('Poliüretan Tekerlekler', 'poliuretan-tekerlekler', 'tekerlekler.poliuretan',
        (SELECT id FROM categories WHERE slug = 'tekerlekler'), 1),
    ('Kauçuk Tekerlekler', 'kaucuk-tekerlekler', 'tekerlekler.kaucuk',
        (SELECT id FROM categories WHERE slug = 'tekerlekler'), 2),
    ('Naylon Tekerlekler', 'naylon-tekerlekler', 'tekerlekler.naylon',
        (SELECT id FROM categories WHERE slug = 'tekerlekler'), 3),
    ('Döküm Demir Tekerlekler', 'dokum-demir-tekerlekler', 'tekerlekler.dokum_demir',
        (SELECT id FROM categories WHERE slug = 'tekerlekler'), 4);

INSERT INTO categories (name, slug, path, parent_id, sort_order) VALUES
    ('Hafif Yük PU', 'hafif-yuk-pu', 'tekerlekler.poliuretan.hafif_yuk',
        (SELECT id FROM categories WHERE slug = 'poliuretan-tekerlekler'), 1),
    ('Ağır Yük PU', 'agir-yuk-pu', 'tekerlekler.poliuretan.agir_yuk',
        (SELECT id FROM categories WHERE slug = 'poliuretan-tekerlekler'), 2),
    ('Ekstra Ağır Yük PU', 'ekstra-agir-yuk-pu', 'tekerlekler.poliuretan.ekstra_agir_yuk',
        (SELECT id FROM categories WHERE slug = 'poliuretan-tekerlekler'), 3);

-- ============================================================================
-- NOTLAR
-- ============================================================================
-- 1. Bu şema, Supabase Dashboard > SQL Editor'da doğrudan çalıştırılabilir.
-- 2. Supabase CLI ile migration olarak da kullanılabilir:
--    supabase migration new initial_schema
--    (migrations/ klasörüne kopyalayın)
-- 3. ltree eklentisi Supabase'de varsayılan olarak yüklüdür, yalnızca CREATE EXTENSION gerekir.
-- 4. Materialized View'lar periyodik yenileme gerektirir:
--    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stock_summary;
-- 5. Storage politikaları Supabase Dashboard > Storage > Policies'dan da yönetilebilir.
-- ============================================================================

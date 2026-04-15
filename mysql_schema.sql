-- ============================================================================
-- TEKER MARKET — PIM & ENVANTER TAKİP SİSTEMİ
-- MySQL 8.0 Şeması (Docker Versiyonu)
-- PostgreSQL/Supabase şemasından dönüştürülmüştür.
-- Versiyon: 1.0 | Tarih: 2026
-- ============================================================================
-- NOT: Bu şema mysql_schema.sql — PostgreSQL supabase_schema.sql'in
--      MySQL 8.0+ uyumlu karşılığıdır. Docker ortamı için tasarlanmıştır.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. KATEGORİ TABLOSU (Hiyerarşik Ağaç — path string ile)
-- ============================================================================
-- Not: PostgreSQL'deki ltree tipi yerine VARCHAR(500) path kullanılır.
--      Alt kategori sorguları path LIKE 'parent.%' ile yapılır.

CREATE TABLE categories (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name            TEXT NOT NULL,
    slug            VARCHAR(255) NOT NULL,
    description     TEXT,
    path            VARCHAR(500) NOT NULL,
    parent_id       CHAR(36) NULL,
    depth           INT GENERATED ALWAYS AS (
                        LENGTH(path) - LENGTH(REPLACE(path, '.', '')) + 1
                    ) STORED,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    image_url       TEXT,
    meta            JSON,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT uq_categories_path UNIQUE (path),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_categories_parent ON categories (parent_id);
CREATE INDEX idx_categories_active ON categories (is_active);
CREATE INDEX idx_categories_path ON categories (path);

-- ============================================================================
-- 2. ÖZELLİK (ATTRIBUTE) TANIMLAMA SİSTEMİ
-- ============================================================================

CREATE TABLE attribute_groups (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name            TEXT NOT NULL,
    slug            VARCHAR(255) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uq_ag_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attributes (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    group_id        CHAR(36) NULL,
    name            TEXT NOT NULL,
    slug            VARCHAR(255) NOT NULL,
    data_type       ENUM('text','number','boolean','select','multi_select','unit') NOT NULL,
    unit            TEXT,
    options         JSON,
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    is_filterable   BOOLEAN NOT NULL DEFAULT TRUE,
    is_searchable   BOOLEAN NOT NULL DEFAULT FALSE,
    validation      JSON,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uq_attributes_slug UNIQUE (slug),
    CONSTRAINT fk_attributes_group FOREIGN KEY (group_id) REFERENCES attribute_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_attributes_group ON attributes (group_id);
CREATE INDEX idx_attributes_filterable ON attributes (is_filterable);

CREATE TABLE category_attributes (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    category_id     CHAR(36) NOT NULL,
    attribute_id    CHAR(36) NOT NULL,
    is_inherited    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,

    CONSTRAINT uq_category_attribute UNIQUE (category_id, attribute_id),
    CONSTRAINT fk_ca_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT fk_ca_attribute FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_ca_category ON category_attributes (category_id);
CREATE INDEX idx_ca_attribute ON category_attributes (attribute_id);

-- ============================================================================
-- 3. ÜRÜN TABLOSU (Ana Tablo)
-- ============================================================================
-- Not: PostgreSQL TEXT[] → JSON (tags), JSONB → JSON (attributes, meta)
--      product_status ENUM inline tanımlandı

CREATE TABLE products (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sku                 VARCHAR(255) NOT NULL,
    barcode             VARCHAR(255),
    name                TEXT NOT NULL,
    slug                VARCHAR(255) NOT NULL,
    description         TEXT,
    short_description   TEXT,

    category_id         CHAR(36) NULL,

    -- Fiyatlandırma (DECIMAL — Floating Point YASAK)
    cost_price          DECIMAL(12,4),
    base_price          DECIMAL(12,4),
    sale_price          DECIMAL(12,4),
    wholesale_price     DECIMAL(12,4),
    dealer_price        DECIMAL(12,4),
    vat_rate            DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    currency            VARCHAR(10) NOT NULL DEFAULT 'TRY',

    -- Stok
    quantity_on_hand    INT NOT NULL DEFAULT 0,
    min_stock_level     INT NOT NULL DEFAULT 0,
    max_stock_level     INT,

    -- Fiziksel
    weight              DECIMAL(10,3),
    width               DECIMAL(10,2),
    height              DECIMAL(10,2),
    depth_cm            DECIMAL(10,2),

    -- EAV özellikler (JSON)
    attributes          JSON,

    -- Durum & Meta
    status              ENUM('active','inactive','draft','archived') NOT NULL DEFAULT 'draft',
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
    tags                JSON,
    meta                JSON,
    external_id         TEXT,
    external_url        TEXT,

    -- Rakip fiyat (scraping)
    competitor_price    DECIMAL(12,4),
    competitor_source   TEXT,

    -- Soft Delete
    deleted_at          DATETIME(6),

    -- Zaman Damgaları
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uq_products_sku   UNIQUE (sku),
    CONSTRAINT uq_products_slug  UNIQUE (slug),
    CONSTRAINT chk_products_stock_nonneg CHECK (quantity_on_hand >= 0),
    CONSTRAINT chk_products_cost_nonneg  CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT chk_products_base_nonneg  CHECK (base_price IS NULL OR base_price >= 0),
    CONSTRAINT chk_products_sale_nonneg  CHECK (sale_price IS NULL OR sale_price >= 0),
    CONSTRAINT chk_products_vat_range    CHECK (vat_rate >= 0 AND vat_rate <= 100),

    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_products_category  ON products (category_id);
CREATE INDEX idx_products_status    ON products (status);
CREATE INDEX idx_products_sku       ON products (sku);
CREATE INDEX idx_products_sale_price ON products (sale_price);
CREATE INDEX idx_products_low_stock ON products (quantity_on_hand, min_stock_level);
CREATE INDEX idx_products_deleted   ON products (deleted_at);
-- FULLTEXT arama indexi
CREATE FULLTEXT INDEX idx_products_search ON products (name, sku, barcode);

-- ============================================================================
-- 4. ÜRÜN MEDYASI
-- ============================================================================

CREATE TABLE product_media (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id      CHAR(36) NOT NULL,
    url             TEXT NOT NULL,
    thumbnail_url   TEXT,
    original_url    TEXT,
    alt_text        TEXT,
    file_name       TEXT,
    file_size       INT,
    mime_type       TEXT,
    width           INT,
    height          INT,
    sort_order      INT NOT NULL DEFAULT 0,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    source          VARCHAR(50) DEFAULT 'upload',
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT fk_media_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_media_product  ON product_media (product_id);
CREATE INDEX idx_media_primary  ON product_media (product_id, is_primary);

-- ============================================================================
-- 5. DEPO (WAREHOUSE) YÖNETİMİ
-- ============================================================================

CREATE TABLE warehouses (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name            TEXT NOT NULL,
    code            VARCHAR(50) NOT NULL,
    address         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT uq_warehouses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. STOK HAREKETLERİ
-- ============================================================================

CREATE TABLE stock_movements (
    id                  CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id          CHAR(36) NOT NULL,
    warehouse_id        CHAR(36),
    movement_type       ENUM('in','out','adjustment','transfer','return') NOT NULL,
    quantity            INT NOT NULL,
    quantity_before     INT NOT NULL,
    quantity_after      INT NOT NULL,
    target_warehouse_id CHAR(36),
    reference_type      TEXT,
    reference_id        TEXT,
    reference_note      TEXT,
    unit_cost           DECIMAL(12,4),
    created_by          CHAR(36),
    created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT chk_movement_quantity CHECK (
        (movement_type IN ('in','return') AND quantity > 0) OR
        (movement_type = 'out'           AND quantity < 0) OR
        (movement_type IN ('adjustment','transfer'))
    ),
    CONSTRAINT fk_movement_product          FOREIGN KEY (product_id)          REFERENCES products(id)   ON DELETE RESTRICT,
    CONSTRAINT fk_movement_warehouse        FOREIGN KEY (warehouse_id)        REFERENCES warehouses(id) ON DELETE SET NULL,
    CONSTRAINT fk_movement_target_warehouse FOREIGN KEY (target_warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_movements_product      ON stock_movements (product_id);
CREATE INDEX idx_movements_warehouse    ON stock_movements (warehouse_id);
CREATE INDEX idx_movements_type         ON stock_movements (movement_type);
CREATE INDEX idx_movements_created      ON stock_movements (created_at DESC);
CREATE INDEX idx_movements_product_date ON stock_movements (product_id, created_at DESC);

-- ============================================================================
-- 7. FİYAT DEĞİŞİKLİK GEÇMİŞİ
-- ============================================================================

CREATE TABLE price_history (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    product_id      CHAR(36) NOT NULL,
    price_type      ENUM('base','sale','wholesale','dealer') NOT NULL,
    old_price       DECIMAL(12,4),
    new_price       DECIMAL(12,4),
    change_reason   TEXT,
    changed_by      CHAR(36),
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT fk_ph_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_price_history_product ON price_history (product_id, created_at DESC);
CREATE INDEX idx_price_history_type    ON price_history (price_type);

-- ============================================================================
-- 8. DENETİM KAYITLARI (Audit Log)
-- ============================================================================
-- Not: PostgreSQL INET → VARCHAR(45), TEXT[] → JSON, auth.uid() → NULL

CREATE TABLE audit_log (
    id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    table_name      VARCHAR(100) NOT NULL,
    record_id       CHAR(36) NOT NULL,
    action          VARCHAR(10) NOT NULL,
    old_data        JSON,
    new_data        JSON,
    changed_fields  JSON,
    user_id         CHAR(36),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_audit_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_created      ON audit_log (created_at DESC);
CREATE INDEX idx_audit_user         ON audit_log (user_id);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 9. TETİKLEYİCİLER (MySQL Triggers)
-- ============================================================================

DELIMITER $$

-- 9a. Stok hareketi → ürün stok güncelleme
CREATE TRIGGER trg_stock_movement_update
AFTER INSERT ON stock_movements
FOR EACH ROW
BEGIN
    UPDATE products
    SET quantity_on_hand = quantity_on_hand + NEW.quantity
    WHERE id = NEW.product_id;

    IF (SELECT quantity_on_hand FROM products WHERE id = NEW.product_id) < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Yetersiz stok: stok negatife düşemez.';
    END IF;
END$$

-- 9b. Fiyat değişiklik geçmişi otomatik kayıt
-- Not: MySQL'de <=> operatörü NULL-safe eşitlik karşılaştırmasıdır (PostgreSQL IS DISTINCT FROM karşılığı)
CREATE TRIGGER trg_price_changes
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    IF NOT (OLD.base_price <=> NEW.base_price) AND NEW.base_price IS NOT NULL THEN
        INSERT INTO price_history (id, product_id, price_type, old_price, new_price, change_reason)
        VALUES (UUID(), NEW.id, 'base', OLD.base_price, NEW.base_price, 'Otomatik kayıt');
    END IF;

    IF NOT (OLD.sale_price <=> NEW.sale_price) AND NEW.sale_price IS NOT NULL THEN
        INSERT INTO price_history (id, product_id, price_type, old_price, new_price, change_reason)
        VALUES (UUID(), NEW.id, 'sale', OLD.sale_price, NEW.sale_price, 'Otomatik kayıt');
    END IF;

    IF NOT (OLD.wholesale_price <=> NEW.wholesale_price) AND NEW.wholesale_price IS NOT NULL THEN
        INSERT INTO price_history (id, product_id, price_type, old_price, new_price, change_reason)
        VALUES (UUID(), NEW.id, 'wholesale', OLD.wholesale_price, NEW.wholesale_price, 'Otomatik kayıt');
    END IF;

    IF NOT (OLD.dealer_price <=> NEW.dealer_price) AND NEW.dealer_price IS NOT NULL THEN
        INSERT INTO price_history (id, product_id, price_type, old_price, new_price, change_reason)
        VALUES (UUID(), NEW.id, 'dealer', OLD.dealer_price, NEW.dealer_price, 'Otomatik kayıt');
    END IF;
END$$

-- 9c. Audit log — products INSERT
CREATE TRIGGER trg_audit_products_insert
AFTER INSERT ON products
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (id, table_name, record_id, action, new_data)
    VALUES (UUID(), 'products', NEW.id, 'INSERT',
        JSON_OBJECT('id', NEW.id, 'sku', NEW.sku, 'name', NEW.name, 'status', NEW.status));
END$$

-- 9d. Audit log — products DELETE
CREATE TRIGGER trg_audit_products_delete
AFTER DELETE ON products
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (id, table_name, record_id, action, old_data)
    VALUES (UUID(), 'products', OLD.id, 'DELETE',
        JSON_OBJECT('id', OLD.id, 'sku', OLD.sku, 'name', OLD.name, 'status', OLD.status));
END$$

DELIMITER ;

-- ============================================================================
-- 10. GÖRÜNÜMLER (Views — PostgreSQL Materialized View yerine)
-- ============================================================================

CREATE VIEW v_category_stock_summary AS
SELECT
    c.id                  AS category_id,
    c.name                AS category_name,
    c.path                AS category_path,
    COUNT(p.id)           AS product_count,
    SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS active_count,
    SUM(COALESCE(p.quantity_on_hand, 0))                  AS total_stock,
    SUM(CASE WHEN p.quantity_on_hand <= p.min_stock_level
              AND p.status = 'active' THEN 1 ELSE 0 END)  AS critical_count,
    AVG(p.sale_price)                                      AS avg_sale_price,
    SUM(p.quantity_on_hand * COALESCE(p.cost_price, 0))   AS total_stock_value
FROM categories c
LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
GROUP BY c.id, c.name, c.path;

CREATE VIEW v_incomplete_products AS
SELECT
    p.id,
    p.sku,
    p.name,
    p.status,
    CASE WHEN p.base_price IS NULL OR p.base_price = 0  THEN TRUE ELSE FALSE END AS missing_price,
    CASE WHEN p.description IS NULL OR p.description = '' THEN TRUE ELSE FALSE END AS missing_description,
    CASE WHEN p.category_id IS NULL                      THEN TRUE ELSE FALSE END AS missing_category,
    CASE WHEN p.weight IS NULL                           THEN TRUE ELSE FALSE END AS missing_weight,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM product_media pm WHERE pm.product_id = p.id
    ) THEN TRUE ELSE FALSE END AS missing_image,
    (
        (CASE WHEN p.base_price IS NULL OR p.base_price = 0    THEN 1 ELSE 0 END) +
        (CASE WHEN p.description IS NULL OR p.description = '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.category_id IS NULL                       THEN 1 ELSE 0 END) +
        (CASE WHEN p.weight IS NULL                            THEN 1 ELSE 0 END) +
        (CASE WHEN NOT EXISTS (
            SELECT 1 FROM product_media pm WHERE pm.product_id = p.id
        ) THEN 1 ELSE 0 END)
    ) AS missing_field_count
FROM products p
WHERE p.deleted_at IS NULL
  AND (
    p.base_price IS NULL OR p.base_price = 0
    OR p.description IS NULL OR p.description = ''
    OR p.category_id IS NULL
    OR p.weight IS NULL
    OR NOT EXISTS (SELECT 1 FROM product_media pm WHERE pm.product_id = p.id)
  );

-- ============================================================================
-- 11. BAŞLANGIÇ VERİLERİ (Seed Data)
-- ============================================================================

-- Varsayılan depo
INSERT INTO warehouses (name, code, is_default) VALUES ('Ana Depo', 'ANA', TRUE);

-- Özellik grupları
INSERT INTO attribute_groups (name, slug, sort_order) VALUES
    ('Fiziksel Özellikler', 'fiziksel', 1),
    ('Teknik Detaylar',     'teknik',   2),
    ('Bağlantı & Montaj',  'baglanti', 3);

-- Özellikler
INSERT INTO attributes (group_id, name, slug, data_type, unit, options, is_filterable, sort_order) VALUES
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Çap',      'cap',      'unit',   'mm',  NULL,
        TRUE, 1),
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Genişlik', 'genislik', 'unit',   'mm',  NULL,
        TRUE, 2),
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Yükseklik','yukseklik','unit',   'mm',  NULL,
        TRUE, 3),
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Ağırlık',  'agirlik',  'unit',   'kg',  NULL,
        TRUE, 4),
    ((SELECT id FROM attribute_groups WHERE slug = 'fiziksel'), 'Malzeme',  'malzeme',  'select', NULL,
        '["Poliüretan", "Kauçuk", "Naylon (PA)", "Polipropilen (PP)", "Döküm Demir"]',
        TRUE, 5),
    ((SELECT id FROM attribute_groups WHERE slug = 'teknik'),   'Taşıma Kapasitesi', 'tasima_kapasitesi', 'unit', 'kg', NULL,
        TRUE, 1),
    ((SELECT id FROM attribute_groups WHERE slug = 'teknik'),   'Fren Tipi', 'fren_tipi', 'select', NULL,
        '["Frensiz", "Sabit Frenli", "Yönlü Frenli", "Toplam Frenli"]',
        TRUE, 6),
    ((SELECT id FROM attribute_groups WHERE slug = 'baglanti'), 'Bağlantı Şekli', 'baglanti_sekli', 'select', NULL,
        '["Sabit Plaka", "Döner Plaka", "Cıvata Bağlantılı", "Delik Bağlantılı"]',
        TRUE, 1);

-- Kök kategoriler
INSERT INTO categories (name, slug, path, parent_id, sort_order) VALUES
    ('Tekerlekler', 'tekerlekler', 'tekerlekler', NULL, 1),
    ('Aparatlar',   'aparatlar',   'aparatlar',   NULL, 2),
    ('Aksesuarlar', 'aksesuarlar', 'aksesuarlar', NULL, 3);

-- Alt kategoriler (tekerlekler)
SET @parent_tekerlekler = (SELECT id FROM (SELECT id FROM categories WHERE slug = 'tekerlekler') AS t);

INSERT INTO categories (name, slug, path, parent_id, sort_order) VALUES
    ('Poliüretan Tekerlekler', 'poliuretan-tekerlekler', 'tekerlekler.poliuretan', @parent_tekerlekler, 1),
    ('Kauçuk Tekerlekler',     'kaucuk-tekerlekler',     'tekerlekler.kaucuk',     @parent_tekerlekler, 2),
    ('Naylon Tekerlekler',     'naylon-tekerlekler',     'tekerlekler.naylon',     @parent_tekerlekler, 3),
    ('Döküm Demir Tekerlekler','dokum-demir-tekerlekler','tekerlekler.dokum_demir',@parent_tekerlekler, 4);

-- Alt-alt kategoriler (poliuretan)
SET @parent_pu = (SELECT id FROM (SELECT id FROM categories WHERE slug = 'poliuretan-tekerlekler') AS t);

INSERT INTO categories (name, slug, path, parent_id, sort_order) VALUES
    ('Hafif Yük PU',      'hafif-yuk-pu',      'tekerlekler.poliuretan.hafif_yuk',      @parent_pu, 1),
    ('Ağır Yük PU',       'agir-yuk-pu',        'tekerlekler.poliuretan.agir_yuk',       @parent_pu, 2),
    ('Ekstra Ağır Yük PU','ekstra-agir-yuk-pu', 'tekerlekler.poliuretan.ekstra_agir_yuk',@parent_pu, 3);

-- ============================================================================
-- NOTLAR
-- ============================================================================
-- 1. Bu şema MySQL 8.0.13+ gerektirir (DEFAULT (UUID()), CHECK constraints, JSON).
-- 2. Docker ortamında: docker-compose up komutu bu dosyayı otomatik çalıştırır.
-- 3. PostgreSQL farkları:
--    - ltree → VARCHAR(500), alt kategori sorgularında path LIKE 'parent.%'
--    - JSONB → JSON (MySQL 8 native JSON destekler)
--    - TEXT[] → JSON array
--    - TIMESTAMPTZ → DATETIME(6)
--    - RLS politikaları → Docker versiyonunda API key ile basit koruma
--    - Materialized view → regular VIEW
-- ============================================================================

# Teker Market — PIM & Envanter Takip Sistemi: Proje Planı

> **Versiyon:** 1.0  
> **Tarih:** 2 Mart 2026  
> **Proje Türü:** Ürün Bilgi Yönetimi (PIM) + Envanter Takip Paneli  
> **Hedef:** Endüstriyel teker ve donanım ürünleri için "Tek Gerçeklik Kaynağı" (Single Source of Truth)

---

## 1. Teknoloji Yığını (Tech Stack) ve Gerekçeler

### 1.1 Veritabanı Katmanı

| Teknoloji | Gerekçe |
|-----------|---------|
| **Supabase (PostgreSQL 15+)** | Proje gereksinimi. Gerçek zamanlı abonelikler (Realtime), Row Level Security (RLS), JSONB desteği, `NUMERIC` tipi ile finansal hassasiyet, `ltree` ile hiyerarşik kategori ağaçları. |
| **PostgreSQL `ltree` Eklentisi** | Derin kategori ağaçları (ör. Tekerlekler > Poliüretan > Ağır Yük > 200mm) için kök-yaprak arasında tek sorguyla ata/torun sorgusu. `gist` indeksi ile O(log n) performans. |
| **PostgreSQL `NUMERIC(12,4)`** | Floating point hatalarını sıfıra indirir. 4 ondalık hassasiyet, toplu fiyat güncellemelerinde kuruş kaybı olmaz. |

### 1.2 Frontend Katmanı

| Teknoloji | Versiyon | Gerekçe |
|-----------|----------|---------|
| **Next.js (App Router)** | 15.x | Server Components ile ilk render'da sıfır JS yükü. Route Handlers ile API katmanı. ISR/SSR esnekliği. Supabase SSR entegrasyonu. |
| **TypeScript** | 5.x | End-to-end type safety. Supabase CLI ile otomatik tip üretimi (`supabase gen types`). |
| **React** | 19.x | Server Components, Suspense, `use()` hook desteği. |

### 1.3 State Management & Data Fetching

| Teknoloji | Gerekçe |
|-----------|---------|
| **TanStack Query (React Query) v5** | Sunucu durumu yönetimi. Otomatik önbellekleme, arka plan yenileme, optimistik güncelleme, sayfalama (infinite/offset). Binlerce ürün sorgusunda zaman aşımını engeller. |
| **Zustand** | Minimal istemci durumu (UI state: sidebar, modal, filtre paneli, seçim). Redux'un karmaşıklığı olmadan. |
| **Supabase Realtime** | Stok hareketlerinde anlık güncelleme. Overselling önleme için PubSub. |

### 1.4 UI Kütüphanesi & Data Grid

| Teknoloji | Gerekçe |
|-----------|---------|
| **shadcn/ui** | Radix UI primitifleri üzerine kurulu, tam özelleştirilebilir komponent seti. Kopyala-yapıştır modeli sayesinde bundle boyutuna minimum etki. Dark mode desteği dahili. |
| **TanStack Table v8** | Headless tablo motoru. Sanal kaydırma (virtualization) ile 10.000+ satır. Sütun sabitleme, inline düzenleme, çoklu sıralama, sunucu taraflı sayfalama/filtreleme. Mevcut alandaki en performanslı çözüm. |
| **TanStack Virtual** | TanStack Table ile entegre sanal kaydırma. Yalnızca görünen satırları DOM'a render eder. |
| **Tailwind CSS v4** | Utility-first CSS. shadcn/ui ile doğal uyum. JIT compiler ile sıfır kullanılmayan CSS. |

### 1.5 Dışa Aktarım & Raporlama

| Teknoloji | Gerekçe |
|-----------|---------|
| **SheetJS (xlsx)** | Excel (`.xlsx`) ve CSV dışa aktarımı. Formatlama, birden çok sayfa, hücre stilleri. |
| **jsPDF + jsPDF-AutoTable** | PDF dışa aktarımı. Türkçe karakter desteği için özel font embedleme. |
| **Recharts** | Operasyonel raporlar için grafikler (stok seviyeleri, hareket trendleri). React uyumu ve performansı. |

### 1.6 Medya & Dosya Yönetimi

| Teknoloji | Gerekçe |
|-----------|---------|
| **Supabase Storage** | Ürün görselleri için CDN destekli nesne deposu. Otomatik resim dönüştürme (transform). RLS ile güvenlik. |
| **Sharp (sunucu taraflı)** | Toplu medya import sırasında thumbnail oluşturma ve boyut optimizasyonu. |

### 1.7 Doğrulama & Form Yönetimi

| Teknoloji | Gerekçe |
|-----------|---------|
| **Zod** | Şema tabanlı doğrulama. Sunucu ve istemci arasında paylaşılabilir. Supabase tiplerine doğrudan eşleme. |
| **React Hook Form** | Performanslı form yönetimi. Kontrollü olmayan (uncontrolled) mimari ile gereksiz yeniden render yok. Zod resolver entegrasyonu. |

### 1.8 Yardımcı Araçlar

| Teknoloji | Gerekçe |
|-----------|---------|
| **decimal.js** | Finansal hesaplamalarda tam hassasiyet. `NUMERIC` tipine dönüşüm güvenliği. Toplu fiyat güncellemelerinde kümülatif hata sıfır. |
| **date-fns** | Tarih formatlama ve manipülasyonu. Türkçe yerelleştirme. Tree-shakeable yapısı sayesinde Moment.js'e göre çok daha hafif. |
| **nuqs** | URL query string state yönetimi. Tablo filtreleri ve sayfalama durumunun URL'e yansıması. Paylaşılabilir filtre linkleri. |

---

## 2. Geliştirme Aşamaları (Sprint Planı)

### Sprint 0 — Temel Altyapı (1 Hafta)
- [x] Proje planı, skills dokümanı ve veritabanı şeması oluşturma
- [ ] Next.js projesi kurulumu (App Router, TypeScript, Tailwind v4)
- [ ] Supabase projesi oluşturma ve bağlantı
- [ ] Supabase CLI ile tip üretimi pipeline'ı
- [ ] shadcn/ui kurulumu ve temel tema (renk paleti, tipografi)
- [ ] Kimlik doğrulama (Supabase Auth) — E-posta/şifre ile giriş
- [ ] Layout yapısı: Sidebar, Header, ana içerik alanı
- [ ] Veritabanı migrasyonları (DDL) çalıştırma

### Sprint 1 — Kategori Yönetimi (1 Hafta)
- [ ] Kategori CRUD işlemleri (API Routes + Server Actions)
- [ ] İç içe geçmiş (nested) kategori ağacı bileşeni (tree view)
- [ ] Sürükle-bırak ile kategori sıralama
- [ ] Kategori-özellik (attribute) ilişkilendirme arayüzü
- [ ] Dinamik özellik (attribute) tanımlama sistemi (tip, birim, seçenekler)
- [ ] Breadcrumb navigasyonu

### Sprint 2 — Ürün Yönetimi: Temel (2 Hafta)
- [ ] Ürün listeleme sayfası — TanStack Table ile Data Grid
  - Sunucu taraflı sayfalama (cursor-based pagination)
  - Çoklu sütuna göre sıralama
  - Global arama ve gelişmiş filtreler (kategori, stok durumu, fiyat aralığı)
  - Sütun sabitleme (pinning) ve gizleme
  - Sanal kaydırma (virtualization)
- [ ] Ürün ekleme formu (kategori seçimi, dinamik özellikler, fiyatlandırma)
- [ ] Ürün detay/düzenleme sayfası
- [ ] Satır içi (inline) düzenleme — hızlı fiyat ve stok düzeltmeleri
- [ ] Toplu seçim ve toplu işlemler altyapısı

### Sprint 3 — Fiyatlandırma & Toplu İşlemler (1 Hafta)
- [ ] Fiyatlandırma motoru (`decimal.js` tabanlı)
  - Alış fiyatı → Satış fiyatı (kar marjı hesaplama)
  - Toplu fiyat güncelleme (yüzde artış/azalış, sabit tutar ekleme)
  - KDV dahil/hariç otomatik hesaplama
- [ ] Toplu ürün aksiyon paneli
  - Kategori değiştirme
  - Durum güncelleme (aktif/pasif/taslak)
  - Toplu silme (soft delete)
- [ ] Dışa aktarım motoru (Excel, CSV, PDF)
- [ ] İçe aktarım — Excel'den toplu ürün yükleme (şablon + validasyon)

### Sprint 4 — Stok / Envanter Yönetimi (2 Hafta)
- [ ] Stok hareket kayıtları (giriş, çıkış, düzeltme, transfer, iade)
- [ ] Depo (warehouse) yönetimi
- [ ] Gerçek zamanlı stok güncelleme (Supabase Realtime + Triggers)
- [ ] Overselling koruması — DB seviyesinde `CHECK` constraint ve optimistik kilitleme
- [ ] Stok alarm sistemi (minimum stok seviyesi, kritik stok uyarıları)
- [ ] Stok hareket geçmişi ve audit log

### Sprint 5 — Medya Yönetimi (1 Hafta)
- [ ] Dış kaynak URL/API entegrasyonu ile görsel çekme
- [ ] Supabase Storage'a yükleme pipeline'ı
- [ ] Toplu görsel import (URL listesinden)
- [ ] Görsel önizleme, sıralama ve ana görsel seçimi
- [ ] Otomatik thumbnail oluşturma (Sharp)
- [ ] Drag & drop görsel yükleme arayüzü

### Sprint 6 — Raporlama & Dashboard (1 Hafta)
- [ ] Operasyonel Dashboard (KPI kartları)
  - Toplam ürün sayısı / aktif-pasif dağılımı
  - Stok doluluk oranı
  - Kategori bazlı ürün dağılımı (donut chart)
  - Son 7/30 gün stok hareketleri (line chart)
- [ ] Kritik stok raporu (minimum seviye altındaki ürünler)
- [ ] Eksik verili ürünler raporu (görsel yok, fiyat yok, açıklama yok)
- [ ] Stok hareket logları raporu (filtrelenebilir, dışa aktarılabilir)
- [ ] Fiyat değişiklik geçmişi raporu

### Sprint 7 — Entegrasyon & Polish (1 Hafta)
- [ ] İkas / dış platform entegrasyon API katmanı (REST endpoint'ler)
- [ ] Webhook altyapısı (stok değişikliklerinde dış bildirim)
- [ ] Performans optimizasyonu (Lighthouse, bundle analizi)
- [ ] Son UX iyileştirmeleri ve kullanıcı testi
- [ ] Hata yönetimi ve loglama (Sentry veya benzeri)
- [ ] Deployment yapılandırması (Vercel)

---

## 3. Proje Klasör / Mimari Yapısı

```
teker-market/
├── .env.local                          # Supabase URL, Anon Key, Service Role Key
├── .env.example                        # Örnek çevre değişkenleri
├── next.config.ts                      # Next.js yapılandırması
├── tailwind.config.ts                  # Tailwind tema genişletmeleri
├── tsconfig.json                       # TypeScript yapılandırması
├── package.json
│
├── supabase/
│   ├── config.toml                     # Supabase yerel yapılandırma
│   ├── seed.sql                        # Test verileri
│   └── migrations/
│       ├── 00001_enable_extensions.sql # ltree, pgcrypto, uuid-ossp
│       ├── 00002_create_categories.sql
│       ├── 00003_create_attributes.sql
│       ├── 00004_create_products.sql
│       ├── 00005_create_inventory.sql
│       ├── 00006_create_media.sql
│       ├── 00007_create_audit_log.sql
│       └── 00008_create_rls_policies.sql
│
├── public/
│   ├── fonts/                          # Yerel fontlar (Inter, özel fontlar)
│   └── images/                         # Statik görseller (logo, placeholder)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (providers, sidebar)
│   │   ├── page.tsx                    # Dashboard / Ana sayfa
│   │   ├── loading.tsx                 # Global loading UI
│   │   ├── error.tsx                   # Global error boundary
│   │   ├── not-found.tsx
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx             # Auth layout (no sidebar)
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # Dashboard layout (sidebar + header)
│   │   │   │
│   │   │   ├── products/
│   │   │   │   ├── page.tsx           # Ürün listesi (Data Grid)
│   │   │   │   ├── new/page.tsx       # Yeni ürün ekleme
│   │   │   │   ├── [id]/page.tsx      # Ürün detay/düzenleme
│   │   │   │   ├── import/page.tsx    # Toplu içe aktarım
│   │   │   │   └── loading.tsx
│   │   │   │
│   │   │   ├── categories/
│   │   │   │   ├── page.tsx           # Kategori ağacı yönetimi
│   │   │   │   └── loading.tsx
│   │   │   │
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx           # Stok hareketleri listesi
│   │   │   │   ├── warehouses/page.tsx # Depo yönetimi
│   │   │   │   └── loading.tsx
│   │   │   │
│   │   │   ├── media/
│   │   │   │   └── page.tsx           # Medya kütüphanesi
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx           # Rapor dashboard'u
│   │   │   │   ├── critical-stock/page.tsx
│   │   │   │   ├── incomplete-products/page.tsx
│   │   │   │   ├── stock-movements/page.tsx
│   │   │   │   └── price-history/page.tsx
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx           # Genel ayarlar
│   │   │       └── attributes/page.tsx # Özellik tanımlama
│   │   │
│   │   └── api/
│   │       ├── products/
│   │       │   └── route.ts           # Dış entegrasyon API (İkas vb.)
│   │       ├── inventory/
│   │       │   └── route.ts
│   │       └── webhook/
│   │           └── route.ts           # Webhook endpoint
│   │
│   ├── components/
│   │   ├── ui/                        # shadcn/ui bileşenleri (button, input, dialog...)
│   │   │
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── sidebar-nav.tsx
│   │   │   ├── header.tsx
│   │   │   ├── breadcrumbs.tsx
│   │   │   └── theme-toggle.tsx
│   │   │
│   │   ├── products/
│   │   │   ├── product-data-grid.tsx       # Ana tablo bileşeni
│   │   │   ├── product-columns.tsx         # Sütun tanımları
│   │   │   ├── product-toolbar.tsx         # Filtre çubuğu
│   │   │   ├── product-filters.tsx         # Gelişmiş filtre paneli
│   │   │   ├── product-form.tsx            # Ürün ekleme/düzenleme formu
│   │   │   ├── product-attributes-form.tsx # Dinamik özellik formu
│   │   │   ├── product-pricing-card.tsx    # Fiyatlandırma kartı
│   │   │   ├── inline-edit-cell.tsx        # Satır içi düzenleme hücresi
│   │   │   ├── bulk-actions-bar.tsx        # Toplu işlem çubuğu
│   │   │   └── export-menu.tsx             # Dışa aktarım menüsü
│   │   │
│   │   ├── categories/
│   │   │   ├── category-tree.tsx           # Ağaç görünümü
│   │   │   ├── category-node.tsx           # Tek düğüm
│   │   │   ├── category-form.tsx           # Kategori ekleme/düzenleme
│   │   │   └── attribute-assignment.tsx    # Özellik atama paneli
│   │   │
│   │   ├── inventory/
│   │   │   ├── stock-movement-form.tsx
│   │   │   ├── stock-movement-table.tsx
│   │   │   ├── stock-alert-badge.tsx
│   │   │   └── warehouse-card.tsx
│   │   │
│   │   ├── media/
│   │   │   ├── media-gallery.tsx
│   │   │   ├── media-uploader.tsx
│   │   │   ├── media-url-importer.tsx
│   │   │   └── sortable-image-grid.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── kpi-card.tsx
│   │   │   ├── stock-level-chart.tsx
│   │   │   ├── movement-trend-chart.tsx
│   │   │   └── category-distribution-chart.tsx
│   │   │
│   │   └── shared/
│   │       ├── data-table/
│   │       │   ├── data-table.tsx           # Genel amaçlı tablo wrapper
│   │       │   ├── data-table-pagination.tsx
│   │       │   ├── data-table-column-header.tsx
│   │       │   ├── data-table-faceted-filter.tsx
│   │       │   └── data-table-view-options.tsx
│   │       ├── confirm-dialog.tsx
│   │       ├── empty-state.tsx
│   │       ├── currency-input.tsx
│   │       └── search-input.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Tarayıcı istemcisi (createBrowserClient)
│   │   │   ├── server.ts              # Sunucu istemcisi (createServerClient)
│   │   │   ├── admin.ts               # Service Role istemcisi (yönetici işlemleri)
│   │   │   └── middleware.ts          # Auth middleware
│   │   │
│   │   ├── utils/
│   │   │   ├── cn.ts                  # Tailwind sınıf birleştirme (clsx + twMerge)
│   │   │   ├── currency.ts            # Para birimi formatlama ve hesaplama
│   │   │   ├── decimal.ts             # decimal.js wrapper — finansal işlemler
│   │   │   ├── export.ts              # Excel/CSV/PDF dışa aktarım yardımcıları
│   │   │   ├── validators.ts          # Zod şema tanımları (paylaşılan)
│   │   │   └── constants.ts           # Sabitler (para birimi, KDV oranları vb.)
│   │   │
│   │   ├── hooks/
│   │   │   ├── use-products.ts        # TanStack Query — ürün sorguları
│   │   │   ├── use-categories.ts      # TanStack Query — kategori sorguları
│   │   │   ├── use-inventory.ts       # TanStack Query — stok sorguları
│   │   │   ├── use-debounce.ts        # Arama gecikmesi
│   │   │   ├── use-media-query.ts     # Responsive breakpoint
│   │   │   └── use-realtime.ts        # Supabase Realtime hook
│   │   │
│   │   └── stores/
│   │       ├── ui-store.ts            # Zustand — sidebar, modals, tema
│   │       └── filter-store.ts        # Zustand — tablo filtre durumu
│   │
│   ├── types/
│   │   ├── supabase.ts                # Otomatik üretilen Supabase tipleri
│   │   ├── product.ts                 # Ürün domain tipleri
│   │   ├── category.ts                # Kategori domain tipleri
│   │   ├── inventory.ts               # Stok domain tipleri
│   │   └── common.ts                  # Paylaşılan tipler (PaginatedResponse, ApiError vb.)
│   │
│   └── middleware.ts                  # Next.js middleware (Auth koruması)
│
├── scripts/
│   ├── seed-categories.ts             # Test kategorisi oluşturma scripti
│   ├── seed-products.ts               # Test ürünü oluşturma scripti
│   └── migrate-from-excel.ts          # Excel'den veri göçü scripti
│
└── docs/
    ├── project_plan.md                # Bu dosya
    ├── skills.md                      # Kodlama standartları ve kuralları
    └── supabase_schema.sql            # Veritabanı şeması
```

---

## 4. Mimari Kararlar ve Tasarım Prensipleri

### 4.1 Veri Akışı Mimarisi

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Browser    │────▶│  Next.js     │────▶│   Supabase    │
│  (TanStack   │◀────│  App Router  │◀────│  (PostgreSQL) │
│   Query)     │     │  (RSC + API) │     │               │
└─────────────┘     └──────────────┘     └───────────────┘
       │                    │                     │
       │              Server Actions          Realtime
       │              Route Handlers         Subscriptions
       ▼                    ▼                     ▼
  ┌──────────┐      ┌───────────┐        ┌──────────────┐
  │ Zustand   │      │ Zod        │        │ RLS Policies │
  │ (UI State)│      │ Validation │        │ Triggers     │
  └──────────┘      └───────────┘        │ Functions    │
                                          └──────────────┘
```

### 4.2 Sayfalama Stratejisi (Ürün Tablosu)

1. **Cursor-based pagination**: `keyset pagination` ile `id > last_id` yaklaşımı. `OFFSET` tabanlı sorgudan çok daha performanslı (binlerce üründe O(k) vs O(n+k)).
2. **Sunucu taraflı filtreleme**: Filtre ve arama sorguları Supabase RPC / Views kullanılarak sunucu tarafında çalışır, istemciye yalnızca sonuç gönderilir.
3. **Önceden getirme (prefetch)**: Sonraki sayfa TanStack Query ile arka planda önceden getirilir.

### 4.3 Kategori Ağacı Mimarisi

PostgreSQL `ltree` eklentisi kullanılarak materialize edilmiş yol (materialized path) yaklaşımı:

```sql
-- Örnek: Tekerlekler > Poliüretan > Ağır Yük
path: 'tekerlekler.poliuretan.agir_yuk'

-- Tüm alt kategorileri getir:
SELECT * FROM categories WHERE path <@ 'tekerlekler';

-- Belirli derinlikteki kategorileri getir:
SELECT * FROM categories WHERE nlevel(path) = 2;
```

### 4.4 Finansal Hesaplama Pipeline'ı

```
                  decimal.js (hassas aritmetik)
                           │
  Kullanıcı Girişi ──▶ Doğrulama (Zod) ──▶ Hesaplama ──▶ NUMERIC(12,4)
       (string)        (format kontrolü)    (.toFixed(4))   (Supabase)
                                                │
                                          Görüntüleme ──▶ Intl.NumberFormat
                                          (2 ondalık)      ('tr-TR', 'TRY')
```

### 4.5 Overselling Koruması (Çok Katmanlı)

| Katman | Mekanizma | Açıklama |
|--------|-----------|----------|
| **1. UI** | Satışa uygunluk kontrolü | Stok sıfır ise satış butonu devre dışı |
| **2. API** | Optimistik kilitleme | `SELECT ... FOR UPDATE` ile stok seviyesi kontrolü |
| **3. DB** | `CHECK` constraint | `quantity_on_hand >= 0` — negatif stok engellenir |
| **4. DB** | Trigger | Stok hareketi kaydedildiğinde `products.quantity_on_hand` otomatik güncellenir |
| **5. Realtime** | Supabase Realtime | Stok değişikliği tüm aktif oturumlara yayınlanır |

---

## 5. Dış Entegrasyon Mimarisi

### 5.1 İkas / E-Ticaret Platformu Entegrasyonu

```
PIM Sistemi (Kaynak)              İkas (Hedef)
       │                              │
       ├─ REST API (/api/products) ───▶ Pull (sync)
       │                              │
       ├─ Webhook (/api/webhook) ◀──── Push (order/stok geri bildirimi)
       │                              │
       └─ CSV/Excel Export ───────────▶ Manuel import
```

- **Push Model**: Ürün değişikliğinde webhook tetikle → İkas'a HTTP POST
- **Pull Model**: İkas belirli aralıklarla `/api/products` endpoint'ini çağırır
- **Batch Model**: Planlanmış görevlerle (cron) toplu senkronizasyon

### 5.2 Medya Entegrasyonu

```
Dış Kaynak (URL/API)
       │
       ▼
  Fetch Worker ──▶ Sharp (resize/optimize) ──▶ Supabase Storage
       │                                             │
       └── Thumbnail (200x200)                       │
       └── Medium (800x800)                          │
       └── Original (saklama)                        │
                                                     ▼
                                              CDN URL → product_media tablosu 
```

# Teker Market — PIM & Envanter Takip Sistemi: Skills (Kodlama Standartları & Kurallar)

> **Versiyon:** 1.0  
> **Tarih:** 2 Mart 2026  
> Tüm geliştiriciler bu dokümanı referans alarak tutarlı, performanslı ve güvenli kod yazmalıdır.

---

## 1. Kodlama Standartları & İsimlendirme Kuralları (Clean Code)

### 1.1 Genel Prensipler

- **DRY (Don't Repeat Yourself):** Tekrar eden mantık `lib/utils/` altında ortak yardımcılara çıkarılır.
- **SRP (Single Responsibility Principle):** Her dosya, fonksiyon ve bileşen tek bir sorumluluğa sahiptir.
- **YAGNI (You Ain't Gonna Need It):** Şu anda ihtiyaç duyulmayan özellikler kodlanmaz.
- **Fail Fast:** Hatalı girdi olduğunda hemen hata döndür; sessizce yutma.
- **Immutability:** State güncellemelerinde her zaman yeni obje/dizi oluştur. Asla doğrudan mutasyon yapma.

### 1.2 Dosya & Klasör İsimlendirme

| Kategori | Kural | Örnek |
|----------|-------|-------|
| **Klasörler** | `kebab-case` | `product-data-grid/`, `stock-movements/` |
| **React Bileşenleri** | `kebab-case` dosya, `PascalCase` export | `product-form.tsx` → `export function ProductForm()` |
| **Utility / Hooks** | `kebab-case` dosya, `camelCase` export | `use-products.ts` → `export function useProducts()` |
| **Tipler** | `kebab-case` dosya, `PascalCase` export | `product.ts` → `export type Product = {...}` |
| **Sabitler** | `SCREAMING_SNAKE_CASE` | `MAX_DECIMAL_PLACES`, `DEFAULT_PAGE_SIZE` |
| **Veritabanı tabloları** | `snake_case` | `product_attributes`, `stock_movements` |
| **Veritabanı sütunları** | `snake_case` | `unit_price`, `quantity_on_hand` |
| **API Route'ları** | `kebab-case` URL | `/api/products`, `/api/stock-movements` |

### 1.3 TypeScript Kuralları

```typescript
// ✅ DOĞRU: Açık tip tanımı, düzgün ayrıştırma
interface CreateProductInput {
  name: string;
  sku: string;
  categoryId: string;
  basePrice: string; // NUMERIC olarak string gelir
}

async function createProduct(input: CreateProductInput): Promise<Product> {
  const validated = createProductSchema.parse(input);
  // ...
}

// ❌ YANLIŞ: any kullanımı, belirsiz tipler
async function createProduct(data: any) {
  // ...
}
```

**Kurallar:**
- `any` tipi **kesinlikle yasaktır**. `unknown` kullanılıp type guard ile daraltılır.
- Fonksiyon dönüş tipleri her zaman açıkça belirtilir.
- `interface` yerine `type` tercih edilir — yalnızca genişletme gerektiğinde `interface`.
- Barrel exports (`index.ts`) kullanılmaz — tree-shaking'i bozar.
- `enum` yerine `as const` nesneleri tercih edilir.

### 1.4 React Bileşen Kuralları

```typescript
// ✅ DOĞRU: Server Component (varsayılan)
// app/products/page.tsx
export default async function ProductsPage() {
  const products = await getProducts();
  return <ProductDataGrid initialData={products} />;
}

// ✅ DOĞRU: Client Component (yalnızca gerektiğinde)
// components/products/product-data-grid.tsx
'use client';
export function ProductDataGrid({ initialData }: Props) {
  // TanStack Table, interaktif işlemler...
}
```

**Kurallar:**
- Server Components varsayılan; `'use client'` yalnızca gerektiğinde eklenir.
- `useEffect` içinde veri çekme yasak — TanStack Query hook'ları kullanılır.
- Bileşen prop'ları 3'ten fazlaysa ayrı `Props` tipi tanımlanır.
- `key` prop'u olarak `index` asla kullanılmaz; her zaman benzersiz `id`.
- Büyük listeler için `React.memo` ve `useMemo` uygulanır.

### 1.5 Import Sıralaması

```typescript
// 1. React ve Next.js
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

// 2. Üçüncü parti kütüphaneler
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Dahili kütüphaneler (lib/)
import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils/currency';

// 4. Bileşenler
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/products/product-form';

// 5. Tipler
import type { Product } from '@/types/product';
```

---

## 2. UI/UX Prensipleri

### 2.1 Tasarım Sistemi Temeli

| Özellik | Değer | Gerekçe |
|---------|-------|---------|
| **Renk Paleti** | Slate tonları (arka plan) + Indigo (vurgu) + Emerald (başarı) + Amber (uyarı) + Rose (hata) | Endüstriyel ürün yönetimi için profesyonel, göz yormayan palette. Koyu mod öncelikli. |
| **Tipografi** | Inter (UI), JetBrains Mono (fiyatlar/kodlar) | Inter: En iyi ekran okunabilirliği. JetBrains Mono: Sayısal verilerde tabular lining ile hizalı sütunlar. |
| **Boşluk Sistemi** | 4px grid (4, 8, 12, 16, 24, 32, 48, 64) | Tutarlı ritim ve hizalama. |
| **Köşe Yuvarlaklığı** | `rounded-lg` (8px) varsayılan | Modern, yumuşak görünüm. |
| **Animasyon** | 150ms ease-out (hover), 200ms ease-in-out (modal/drawer) | Hızlı ama fark edilebilir. Uzun animasyonlar üretkenliği düşürür. |

### 2.2 Data Grid UX Kuralları

1. **Sayfa Boyutu Seçenekleri:** 25 / 50 / 100 / 250 satır. Varsayılan: 50.
2. **Sütun Genişliği:** Kullanıcı tarafından sürükleyerek ayarlanabilir. Tercihler `localStorage`'a kaydedilir.
3. **Sabit Sütunlar:** İlk sütun (checkbox) ve ikinci sütun (SKU / ürün adı) her zaman sabit (pinned).
4. **Satır İçi Düzenleme:** Çift tıkla hücreyi düzenleme moduna geçir. `Enter` → kaydet, `Escape` → iptal. Değişen hücreler sarı arka plan ile vurgulanır.
5. **Toplu Seçim:** Checkbox ile çoklu seçim. `Shift+Click` ile aralık seçimi. Seçim sonrası alt çubukta (floating bar) toplu aksiyonlar göster.
6. **Boş Durum:** Hiç ürün yoksa; anlamlı illüstrasyon + "İlk ürünü ekle" CTA butonu.
7. **Yükleme Durumu:** Skeleton satırları göster (3-5 satır). Spinner değil.
8. **Filtre Göstergesi:** Aktif filtreler, tablo üstünde chip/badge olarak gösterilir. Her biri tek tıkla kaldırılabilir. "Tümünü Temizle" seçeneği.

### 2.3 Form UX Kuralları

1. **Adım Adım:** Karmaşık formlar (ürün ekleme) sekmelere / adımlara bölünür (Temel → Fiyat → Özellikler → Medya).
2. **Anlık Doğrulama:** Her alan blur olduğunda anlık hata mesajı (Zod + React Hook Form).
3. **Kaydetme Geri Bildirimi:** Başarılı kaydetme → yeşil toast (2sn otomatik kaybolma). Hata → kırmızı toast (kullanıcı kapatana kadar kalır).
4. **Kaydedilmemiş Değişiklikler:** Formda değişiklik varken sayfadan çıkma denemesinde `beforeunload` uyarısı.
5. **Otomatik Kaydetme:** Satır içi düzenleme değişiklikleri 500ms debounce ile otomatik kaydedilir.

### 2.4 Responsive Tasarım

| Breakpoint | Hedef | Öncelik |
|-----------|-------|---------|
| **≥1280px (xl)** | Masaüstü — Tam sidebar + tam data grid | **Birincil** |
| **1024-1279px (lg)** | Dar masaüstü — Daraltılmış sidebar (icon-only) | İkincil |
| **768-1023px (md)** | Tablet — Drawer sidebar + basitleştirilmiş grid | Üçüncül |
| **<768px (sm)** | Mobil — Card tabanlı liste, grid gizli | Son |

> **Not:** Bu bir yönetim paneli olduğu için birincil kullanım masaüstünden olacaktır. Mobil desteği her zaman sağlanır ama form ve tablo deneyimi masaüstüne optimize edilir.

### 2.5 Erişilebilirlik (a11y) Minimum Standartları

- Tüm interaktif öğelerde `aria-label` veya açık metin etiketi.
- Renk kontrastı WCAG AA standartı (4.5:1 metin, 3:1 büyük metin).
- Klavye ile tam navigasyon (Tab, Enter, Escape, Arrow keys).
- Focus göstergesi her zaman görünür (`focus-visible` outline).
- Ekran okuyucu ile uyumluluk (shadcn/ui Radix primitifleri ile garanti).

---

## 3. Para Birimi Hesaplama & Veri Formatlama Kuralları

### 3.1 KESİN KURAL: Floating Point Kullanmayın

```typescript
// ❌ YASAK — Floating Point Hatası
const price = 19.99;
const tax = price * 0.20; // 3.9980000000000002
const total = price + tax; // 23.988000000000003

// ✅ ZORUNLU — decimal.js ile Hassas Aritmetik
import Decimal from 'decimal.js';

const price = new Decimal('19.99');
const tax = price.mul('0.20');       // 3.998
const total = price.plus(tax);       // 23.988
const rounded = total.toFixed(2);    // "23.99" (bankers rounding)
```

### 3.2 decimal.js Yapılandırması

```typescript
// lib/utils/decimal.ts
import Decimal from 'decimal.js';

Decimal.set({
  precision: 20,        // Dahili hassasiyet
  rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding (kuruş kaybını minimize eder)
  toExpNeg: -9,          // Bilimsel gösterim eşiği
  toExpPos: 20,
});

// Yardımcı fonksiyonlar
export function safeDecimal(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(String(value));
}

export function calculateMargin(costPrice: string, marginPercent: string): string {
  const cost = safeDecimal(costPrice);
  const margin = safeDecimal(marginPercent);
  return cost.mul(Decimal.add(1, margin.div(100))).toFixed(4);
}

export function calculateVat(price: string, vatRate: string = '20'): { net: string; vat: string; gross: string } {
  const p = safeDecimal(price);
  const rate = safeDecimal(vatRate).div(100);
  const vat = p.mul(rate);
  return {
    net: p.toFixed(4),
    vat: vat.toFixed(4),
    gross: p.plus(vat).toFixed(4),
  };
}
```

### 3.3 Veritabanı ↔ Uygulama ↔ Görüntüleme Pipeline'ı

| Katman | Veri Tipi | Açıklama |
|--------|-----------|----------|
| **Veritabanı** | `NUMERIC(12,4)` | 12 toplam basamak, 4 ondalık. Maks: 99.999.999,9999 |
| **API / Server** | `string` | Supabase, NUMERIC'i string olarak döndürür. HİÇBİR ZAMAN `parseFloat()` yapmayın! |
| **İş Mantığı** | `Decimal` (decimal.js) | Tüm hesaplamalar Decimal nesneleri üzerinde yapılır. |
| **Kaydetme** | `string` (`.toFixed(4)`) | DB'ye gönderilmeden önce 4 ondalıklı string'e dönüştürülür. |
| **Görüntüleme** | `Intl.NumberFormat` | Kullanıcıya gösterilirken 2 ondalık TRY formatı. |

### 3.4 Para Birimi Formatlama

```typescript
// lib/utils/currency.ts

const TRY_FORMATTER = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TRY_FORMATTER_PRECISE = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '₺0,00';
  const num = typeof value === 'string' ? Number(value) : value;
  return TRY_FORMATTER.format(num);
}

export function formatCurrencyPrecise(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '₺0,0000';
  const num = typeof value === 'string' ? Number(value) : value;
  return TRY_FORMATTER_PRECISE.format(num);
}

// Görüntüleme formatı: ₺1.234,56
// Düzenleme formatı:   1234.56 (nokta ondalık ayracı, input alanlarında)
export function parseCurrencyInput(input: string): string {
  // Türkçe formatı temizle: "1.234,56" → "1234.56"
  return input.replace(/\./g, '').replace(',', '.');
}
```

### 3.5 Toplu Fiyat Güncelleme Algoritması

```typescript
// Toplu fiyat güncelleme senaryoları
type BulkPriceOperation =
  | { type: 'percent_increase'; value: string }   // %10 zam: "10"
  | { type: 'percent_decrease'; value: string }   // %5 indirim: "5"
  | { type: 'fixed_increase'; value: string }      // ₺50 ekleme: "50"
  | { type: 'fixed_decrease'; value: string }      // ₺25 çıkarma: "25"
  | { type: 'set_margin'; value: string }          // Maliyet üzerine %30 kar: "30"
  | { type: 'round_to'; value: '0.01' | '0.10' | '1' | '5' | '10' }; // Yuvarlama

function applyBulkPriceUpdate(
  currentPrice: string,
  costPrice: string | null,
  operation: BulkPriceOperation
): string {
  const price = safeDecimal(currentPrice);

  switch (operation.type) {
    case 'percent_increase':
      return price.mul(Decimal.add(1, safeDecimal(operation.value).div(100))).toFixed(4);
    case 'percent_decrease':
      return price.mul(Decimal.sub(1, safeDecimal(operation.value).div(100))).toFixed(4);
    case 'fixed_increase':
      return price.plus(safeDecimal(operation.value)).toFixed(4);
    case 'fixed_decrease':
      return price.minus(safeDecimal(operation.value)).toFixed(4);
    case 'set_margin':
      if (!costPrice) throw new Error('Maliyet fiyatı olmadan kar marjı uygulanamaz');
      return calculateMargin(costPrice, operation.value);
    case 'round_to':
      const unit = safeDecimal(operation.value);
      return price.div(unit).round().mul(unit).toFixed(4);
  }
}
```

### 3.6 Sayı & Tarih Formatlama

```typescript
// Miktar formatlama (stok)
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value);
}

// Yüzde formatlama
export function formatPercent(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('tr-TR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(num / 100);
}

// Tarih formatlama
// Kısa: "02.03.2026"
// Uzun: "2 Mart 2026, 22:44"
// Relatif: "3 dakika önce"
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'dd.MM.yyyy', { locale: tr });
}

export function formatDateLong(date: string | Date): string {
  return format(new Date(date), 'd MMMM yyyy, HH:mm', { locale: tr });
}

export function formatDateRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: tr });
}
```

---

## 4. Büyük Veri Tabloları İçin Performans Optimizasyonu

### 4.1 Sunucu Taraflı Stratejiler

#### Cursor-Based Pagination (Keyset Pagination)
```sql
-- ❌ OFFSET tabanlı (yavaş — büyük offset'lerde tüm satırları tarar)
SELECT * FROM products ORDER BY id LIMIT 50 OFFSET 10000;

-- ✅ Cursor tabanlı (her zaman sabit O(k) performans)
SELECT * FROM products
WHERE id > 'last_seen_id'
ORDER BY id
LIMIT 50;
```

#### Composite Index Stratejisi
```sql
-- Sık kullanılan filtre kombinasyonları için bileşik indeksler
CREATE INDEX idx_products_category_status
  ON products (category_id, status) WHERE deleted_at IS NULL;

CREATE INDEX idx_products_search
  ON products USING gin (to_tsvector('turkish', name || ' ' || sku || ' ' || COALESCE(barcode, '')));

-- Fiyat aralığı sorgularını hızlandırmak için
CREATE INDEX idx_products_price
  ON products (sale_price) WHERE deleted_at IS NULL AND status = 'active';
```

#### Materialized View (Ağır Raporlar)
```sql
-- Kategori bazlı stok özeti — sadece rapor sayfalarında yenilenir
CREATE MATERIALIZED VIEW mv_category_stock_summary AS
SELECT
  c.id AS category_id,
  c.name AS category_name,
  COUNT(p.id) AS product_count,
  SUM(p.quantity_on_hand) AS total_stock,
  SUM(CASE WHEN p.quantity_on_hand <= p.min_stock_level THEN 1 ELSE 0 END) AS critical_count
FROM categories c
LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
GROUP BY c.id, c.name;

-- Otomatik yenileme (15 dakikada bir veya stok hareketi sonrası trigger ile)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stock_summary;
```

### 4.2 İstemci Taraflı Stratejiler

#### TanStack Query Önbellek Konfigürasyonu
```typescript
// lib/hooks/use-products.ts
export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => fetchProducts(filters),
    staleTime: 30_000,        // 30 saniye — gereksiz yeniden çekim yok
    gcTime: 5 * 60_000,       // 5 dakika — bellekte tut
    placeholderData: keepPreviousData, // Sayfa geçişinde boş tablo gösterme
    refetchOnWindowFocus: false,       // Yönetim panelinde gereksiz traffic üretme
  });
}
```

#### Sanal Kaydırma (Virtualization)
```typescript
// TanStack Virtual ile yalnızca görünen satırları render et
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 48,   // Her satır ~48px
  overscan: 10,              // Ekranın üstüne/altına 10 ekstra satır
});

// DOM'da yalnızca ~30-40 satır render edilir, 10.000 satır da olsa
```

#### Debounced Arama
```typescript
// Arama her tuş vuruşunda değil, 300ms duraklamadan sonra ateşlenir
function useProductSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const query = useProducts({ search: debouncedSearch, ...otherFilters });
  // ...
}
```

### 4.3 Ağ Optimizasyonu

| Strateji | Uygulama |
|----------|----------|
| **Kolon seçimi** | `supabase.from('products').select('id, name, sku, sale_price, quantity_on_hand')` — yalnızca görünen sütunları çek |
| **İlişki lazy loading** | Ürün listesinde özellikler çekilmez; yalnızca detay sayfasında çekilir |
| **Batch güncelleme** | Toplu düzenlemeler tek bir RPC çağrısı ile işlenir, N ayrı UPDATE değil |
| **Optimistik güncelleme** | Satır içi düzenleme anında UI'a yansır, arka planda kaydedilir; hata olursa geri alınır |
| **Prefetch** | Sayfalama: sonraki sayfa arka planda önceden getirilir |

### 4.4 Bundle Boyutu Optimizasyonu

```typescript
// ✅ Tree-shakeable import
import { format } from 'date-fns';          // Sadece format fonksiyonu
import { Button } from '@/components/ui/button'; // Sadece Button

// ❌ Barrel import (tüm modülü yükler)
import * as dateFns from 'date-fns';
import * as UI from '@/components/ui';
```

- **Dynamic Import:** Ağır bileşenler (PDF export, chart kütüphaneleri) `next/dynamic` ile lazy load edilir.
- **Route Segments:** Her sayfa kendi bundle'ını oluşturur (App Router otomatik code splitting).

### 4.5 Veritabanı Bağlantı Yönetimi

- **Connection Pooling:** Supabase varsayılan olarak PgBouncer ile bağlantı havuzu sunar. `transaction` modu kullanılır.
- **RPC Fonksiyonları:** Karmaşık sorgular (toplu fiyat güncelleme, stok transfer) tek bir `rpc()` çağrısı ile yapılır — round-trip sayısı minimize edilir.
- **Timeout:** Her sorgu için 10 saniye zaman aşımı. Aşılırsa kullanıcıya "Bağlantı zaman aşımı" hatası gösterilir ve tekrar deneme seçeneği sunulur.

---

## 5. Hata Yönetimi Standartları

### 5.1 Hata Katmanları

```typescript
// lib/utils/errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 422, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} bulunamadı`, 'NOT_FOUND', 404);
  }
}

export class StockInsufficientError extends AppError {
  constructor(productName: string, available: number, requested: number) {
    super(
      `"${productName}" için yeterli stok yok. Mevcut: ${available}, İstenen: ${requested}`,
      'STOCK_INSUFFICIENT',
      409,
      { available, requested }
    );
  }
}
```

### 5.2 Sunucu Aksiyonu Hata Şablonu

```typescript
// Her server action bu pattern'i takip eder
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function updateProductPrice(
  productId: string,
  newPrice: string
): Promise<ActionResult<Product>> {
  try {
    const validated = updatePriceSchema.parse({ productId, newPrice });
    // ... iş mantığı ...
    return { success: true, data: updatedProduct };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message, code: 'VALIDATION_ERROR' };
    }
    console.error('[updateProductPrice]', error);
    return { success: false, error: 'Beklenmeyen bir hata oluştu' };
  }
}
```

---

## 6. Güvenlik Kuralları

1. **RLS Her Zaman Aktif:** Tüm tablolarda Row Level Security açık olmalıdır. `anon` rolüne hiçbir tablo erişimi verilmez.
2. **Service Role Yalnızca Sunucuda:** `SUPABASE_SERVICE_ROLE_KEY` asla istemciye gönderilmez. Yalnızca sunucu aksiyonları ve API route'larında kullanılır.
3. **Input Sanitization:** Tüm kullanıcı girdileri Zod ile doğrulanır. Ham SQL sorguları yasaktır — her zaman Supabase client veya parametreli RPC kullanılır.
4. **CORS:** API route'ları belirli origin'lere kısıtlanır (üretimde yalnızca kendi domain'i).
5. **Rate Limiting:** Toplu işlem endpoint'lerinde (bulk update, import) Rate limit uygulanır.

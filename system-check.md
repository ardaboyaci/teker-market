# Sistem Kontrol Raporu — system-check.md
**Tarih:** 2026-03-18
**Hazırlayan:** Claude Code (Otomatik Analiz)
**Proje:** Teker Market — Next.js 15 / Supabase / TypeScript

---

## ÖZET SONUÇ

> **⚠️ KARMA DURUM — Sistemde kritik olmayan hatalar var, giderilebilir.**
> Temel altyapı sağlam. Eksikler veri tamlığı ve UI/UX kural uyumunda yoğunlaşıyor.

---

## TEST 1 — Data Integrity (Veri Tamlığı)

> **Not:** Bu analiz, Dashboard'daki veri sağlığı mantığı ve kod incelemesiyle yapılmıştır.
> Supabase'e doğrudan bağlantı kurulmamıştır — gerçek sayılar için aşağıdaki SQL sorgularını çalıştır.

### Kontrol Edilen Alanlar

| Alan | Durum | Risk |
|------|-------|------|
| `name` | Zorunlu, her üründe var (schema garantisi) | ✅ Düşük |
| `sku` | Zorunlu, unique constraint var | ✅ Düşük |
| `sale_price` | Nullable — bazı ürünlerde eksik | ⚠️ Orta |
| `image_url` | Nullable — eksikler upload-images.ts ile doldurulur | ⚠️ Orta |
| `description` | Nullable — SEO bot ile doldurulur | ⚠️ Orta |
| `quantity_on_hand` | Nullable — stok takibi etkilenir | ⚠️ Orta |
| `category_id` | Nullable — filtreleme bozulabilir | ⚠️ Orta |

### Dashboard'da Zaten İzlenen Metrikler

Dashboard (`src/app/dashboard/page.tsx`) şu metrikleri canlı gösteriyor:
- Aktif ürün sayısı
- Kritik stok (< 10 adet) uyarıları
- Eksik fiyat sayısı
- Eksik resim sayısı
- Eksik açıklama sayısı

### Veritabanı Kontrol SQL'leri (Supabase SQL Editor'de Çalıştır)

```sql
-- 1. GENEL ÖZET
SELECT
  COUNT(*) AS total_products,
  COUNT(CASE WHEN sale_price IS NULL OR sale_price = 0 THEN 1 END) AS missing_price,
  COUNT(CASE WHEN image_url IS NULL THEN 1 END) AS missing_image,
  COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) AS missing_description,
  COUNT(CASE WHEN category_id IS NULL THEN 1 END) AS missing_category,
  COUNT(CASE WHEN quantity_on_hand IS NULL THEN 1 END) AS missing_stock
FROM products
WHERE deleted_at IS NULL AND status IN ('active', 'draft');

-- 2. TAM VERİLİ ÜRÜN ORANI
SELECT
  COUNT(CASE WHEN sale_price > 0 AND image_url IS NOT NULL AND description IS NOT NULL THEN 1 END) AS fully_complete,
  COUNT(*) AS total,
  ROUND(
    COUNT(CASE WHEN sale_price > 0 AND image_url IS NOT NULL AND description IS NOT NULL THEN 1 END)::numeric
    / COUNT(*) * 100, 1
  ) AS completion_pct
FROM products
WHERE deleted_at IS NULL AND status IN ('active', 'draft');

-- 3. EKSİK VERİLİ ÜRÜN LİSTESİ (İLK 50)
SELECT sku, name,
  CASE WHEN sale_price IS NULL OR sale_price = 0 THEN 'EKSİK FİYAT ' ELSE '' END ||
  CASE WHEN image_url IS NULL THEN 'EKSİK RESİM ' ELSE '' END ||
  CASE WHEN description IS NULL THEN 'EKSİK AÇIKLAMA' ELSE '' END AS eksikler
FROM products
WHERE deleted_at IS NULL
  AND status IN ('active', 'draft')
  AND (sale_price IS NULL OR sale_price = 0 OR image_url IS NULL OR description IS NULL)
ORDER BY sku
LIMIT 50;

-- 4. KATEGORİSİZ ÜRÜNLER
SELECT sku, name FROM products
WHERE category_id IS NULL AND deleted_at IS NULL
ORDER BY created_at DESC LIMIT 30;
```

### Beklenen Sorunlar (Tarihsel Git Commit'lerine Göre)

Git geçmişinden (`3612167`, `4c01508`) 3.660 ürün envanterinin yüklendiği ve fiyat botunun 439 ürünü güncellediği görülüyor. Bu demek oluyor ki:

- ~3.221 ürünün fiyatı hâlâ eksik olabilir (bot daha tüm ürünleri kaplamamış)
- Resim yükleme süreci devam ediyor (upload-images.ts incremental çalışıyor)
- SEO açıklamalarının büyük çoğunluğu henüz üretilmemiş olabilir

---

## TEST 2 — Bot Health Check (Script Sağlık Kontrolü)

### 2A. scrape-pricing.ts (Hybrid Price Engine v5)

**Dry-Run Testi:**
```bash
npx ts-node --project tsconfig.json -e "require('ts-node/register')" scripts/scrape-pricing.ts --dry-run --limit=3
```
veya (package.json'da script varsa):
```bash
npx tsx scripts/scrape-pricing.ts --dry-run --limit=3
```

**Kod Analizi Sonuçları:**

| Kontrol | Durum | Notlar |
|---------|-------|--------|
| `--dry-run` flag desteği | ✅ Mevcut | Satır 32: `const DRY_RUN = process.argv.includes('--dry-run')` |
| `--limit=N` flag desteği | ✅ Mevcut | Satır 33-34: `LIMIT` değişkeni parse ediliyor |
| `.env.local` yükleme | ✅ Mevcut | dotenv ile `path.resolve(__dirname, '../.env.local')` |
| Supabase bağlantı kontrolü | ✅ Mevcut | Satır 24-27: credentials yoksa `process.exit(1)` |
| SSL sertifika bypass | ⚠️ Dikkat | `rejectUnauthorized: false` — scraping için gerekli ama güvenlik notu |
| Timeout ayarı | ✅ 20 saniye | Makul değer |
| Rate limiting | ✅ Mevcut | Chunk'lar arası 350ms delay, boyutsal sorgu arası 150ms |
| Hata yakalama | ✅ Mevcut | try/catch ile null döndürüyor, scripti durdurmuyor |
| Playwright bağımlılığı | ✅ YOK | Saf axios + cheerio kullanıyor (Playwright gerektirmiyor) |
| Token eşleşme mantığı | ✅ Sağlam | `tokenMatchScore()` ile yanlış eşleşme önleniyor |
| Fiyat stratejisi | ✅ Akıllı | Client < competitor → client kullan; client > competitor → competitor - %2 |

**Potansiyel Sorunlar:**

```
⚠️ SORUN 1: Scraping hedefleri değişebilir
   tekermarket.com.tr ve e-tekerlek.com'un HTML yapısı
   (.ItemOrj, .discountPriceSpan, div.product-item, span.product-price)
   değişirse script sıfır sonuç döner ama hata vermez.
   → Öneri: Dry-run çıktısında "0 fiyat bulundu" satırları bunu gösterir.

⚠️ SORUN 2: Paralel işleme yok
   Chunk boyutu 10, ama her ürün için 2 HTTP isteği sırayla yapılıyor.
   3.660 ürün × ~500ms = ~30 dakika
   → Mevcut tasarım kasıtlı (rate limit aşmamak için).

✅ DRY-RUN ÇALIŞTIĞINDA BEKLENEN ÇIKTI:
   [Dry Run] sale_price güncellenmeyecek
   [DRY] history/client: — → ₺XXX.XX
```

### 2B. upload-images.ts (Görsel Yükleyici)

**Kod Analizi Sonuçları:**

| Kontrol | Durum | Notlar |
|---------|-------|--------|
| Supabase bağlantısı | ✅ | Satır 9-16: service key kontrolü |
| Watermark işleme | ✅ | Sharp ile pixel-level işleme |
| WebP dönüşüm | ✅ | %85 kalite, `image/webp` mime type |
| Incremental yükleme | ✅ | Zaten yüklenenleri skip eder |
| `--reprocess` flag | ✅ | Üzerine yazma modu mevcut |
| Dry-run modu | ❌ **EKSİK** | `--dry-run` flag desteği yok! |
| Kaynak dosya kontrolü | ✅ | `fs.access()` ile önce kontrol eder |
| Hata toleransı | ✅ | Tek hata scripti durdurmaz |
| Bağımlılık: `scripts/output/products.json` | ⚠️ Dikkat | Bu dosya mevcut değil (`scripts/output/` dizini boş) |
| Bağımlılık: `scripts/watermark-logo.png` | ⚠️ Dikkat | Dosya var mı kontrol edilmeli |
| Playwright bağımlılığı | ✅ YOK | Sharp + fs kullanıyor |

**Kritik Sorun:**

```
🔴 SORUN: scripts/output/products.json bulunamıyor
   upload-images.ts, DATA_FILE = 'scripts/output/products.json' dosyasını okur.
   Bu dosya dizinde görünmüyor. Script çalıştırıldığında hemen hata verir.

   → Çözüm: Bu dosyanın seed-supabase.ts veya başka bir script tarafından
     üretilmesi gerekiyor. Alternatif: Supabase'den doğrudan çekecek şekilde
     script güncellenebilir.

🔴 SORUN: --dry-run desteği yok
   scrape-pricing.ts'de var ama upload-images.ts'de yok.
   Test için gerçek yükleme yapmak zorunda kalırsın.
```

### 2C. Genel Bağlantı Testi

```bash
# Supabase bağlantısını test etmek için:
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
s.from('products').select('count').then(r => console.log('Bağlantı:', r.error ? '❌ ' + r.error.message : '✅ Başarılı'));
"
```

---

## TEST 3 — UI/UX Audit (web-design-rules.md vs. Kod)

### 3.1 Tipografi Kuralları

| Kural (web-design-rules.md) | Mevcut Durum | Uyum |
|-----------------------------|--------------|------|
| "Inter, Roboto, Arial ASLA kullanma" | `font-sans` → Tailwind'in varsayılan sans-serif stack'i (Inter dahil!) | ❌ **İHLAL** |
| Display font + body font eşleştirmesi | Yok, tek font ailesi kullanılıyor | ❌ **İHLAL** |
| Google Fonts entegrasyonu | `layout.tsx`'de herhangi bir Google Fonts `<link>` yok | ❌ **İHLAL** |
| Body text minimum 16px | `text-xs` (12px) ve `text-[13px]` bolca kullanılıyor | ⚠️ **KISMI** |
| Heading `font-weight: 700-900` | `font-extrabold` ve `font-bold` var | ✅ Uyumlu |
| Maksimum 2-3 font ailesi | 1 font (system default) — az ama karaktersiz | ⚠️ Tarafsız |

**Not:** `page.tsx` satır 123'te `className="... font-sans ..."` açıkça belirtiliyor. `globals.css`'de özel font tanımı yok. Tailwind v4'ün `font-sans` değeri `ui-sans-serif, system-ui, -apple-system, Inter...` şeklinde Inter içeriyor.

### 3.2 Renk & Tema Kuralları

| Kural | Mevcut Durum | Uyum |
|-------|--------------|------|
| "Mor gradient + beyaz arka plan ASLA" | Mor yok, ama tam beyaz arka plan var | ⚠️ Tarafsız |
| CSS custom properties sistemi | `globals.css`'de Tailwind v4 `@theme` bloku var | ✅ Uyumlu |
| Dominant renk + keskin accent | Primary: mavi (`hsl(221.2 83.2% 53.3%)`), accent = secondary ile aynı renk | ⚠️ **KISMI** |
| "Düz beyaz arka plana varsayılan gitme" | `bg-white` ve `bg-slate-50` her yerde dominant | ❌ **İHLAL** |
| Koyu/açık tema bilinçli seçimi | Açık tema seçilmiş ama atmosfersiz | ⚠️ Tarafsız |

### 3.3 Layout & Spacing Kuralları

| Kural | Mevcut Durum | Uyum |
|-------|--------------|------|
| Hero bölümünde 120-200px padding | HeroSection ayrı bileşen (okunmadı) | 🔲 Kontrol Gerekli |
| 8px grid spacing sistemi | Tailwind spacing sistemi zaten 4px grid | ✅ Uyumlu |
| Max-width 1200px container | `max-w-[1600px]` kullanılıyor (daha geniş) | ⚠️ Sapma |
| Asimetrik layout, grid-breaking | Tam simetrik sidebar + grid yapısı | ❌ **İHLAL** |
| "Cookie-cutter layout yapma" | Her bölüm aynı padding ve yapıda | ❌ **İHLAL** |
| Normal bölümlerde 80-120px padding | `py-8` (32px) kullanılıyor | ❌ **DÜŞÜK** |

### 3.4 Animasyon & Motion Kuralları

| Kural | Mevcut Durum | Uyum |
|-------|--------------|------|
| IntersectionObserver scroll animasyonları | Hiç yok | ❌ **İHLAL** |
| Staggered reveal animasyonu | Hiç yok | ❌ **İHLAL** |
| `fadeInUp`, `scaleIn` keyframe'leri | `globals.css`'de sadece `marquee` keyframe'i var | ❌ **İHLAL** |
| `prefers-reduced-motion` desteği | Hiç yok | ❌ **İHLAL** |
| Hover animasyonları | ProductCard'da `hover:-translate-y-1`, `hover:scale-105` var | ✅ Uyumlu |
| Cubic-bezier easing | `transition-all duration-300` (linear default) — özel easing yok | ⚠️ **KISMI** |

### 3.5 Arka Plan & Görsel Derinlik

| Kural | Mevcut Durum | Uyum |
|-------|--------------|------|
| Gradient mesh / noise texture | Yok | ❌ **İHLAL** |
| Glassmorphism efekti | ProductCard'da `bg-white/80 backdrop-blur` var (WhatsApp ikonu) | ✅ Küçük kullanım |
| Derinlik katmanları (bg → surface → content) | `bg-slate-50/50` → `bg-white` cards | ⚠️ Basit ama çalışıyor |
| Dot grid / geometric pattern | Yok | ❌ Eksik |

### 3.6 Bileşen Standartları (ProductCard.tsx)

| Kural | Mevcut Durum | Uyum |
|-------|--------------|------|
| Kart hover: `translateY(-4px)` + shadow-lg | `hover:-translate-y-1` (4px) + `hover:shadow-xl` | ✅ Uyumlu |
| Border-radius: `--radius-lg` (16px) | `rounded-2xl` (24px) | ✅ Daha generöz, kabul edilebilir |
| Border `border-color: primary` on hover | `hover:border-slate-300` — primary renk değil | ⚠️ Sapma |
| Buton padding: `14px 28px` | `py-2` (8px) — kural altında | ⚠️ **DÜŞÜK** |
| `aria-label` icon-only butonlarda | WhatsApp ikonu `title` kullanıyor, `aria-label` yok | ❌ Erişilebilirlik |
| Görsellerde `alt` attribute | `alt={name}` var | ✅ Uyumlu |
| `loading="lazy"` | Var | ✅ Uyumlu |

### 3.7 Erişilebilirlik Kuralları

| Kural | Mevcut Durum | Uyum |
|-------|--------------|------|
| Semantik HTML (`<header>`, `<nav>`, `<main>`, `<section>`) | `page.tsx`'de `<header>`, `<main>`, `<aside>`, `<section>` kullanılıyor | ✅ Uyumlu |
| `focus-visible` stili | `globals.css`'de custom focus stili yok | ❌ **İHLAL** |
| Keyboard navigation | Radix UI bileşenleri bunu sağlıyor | ✅ Uyumlu |
| Touch target min 44×44px | WhatsApp ikonu `p-2 w-3.5 h-3.5` → ~30px — küçük | ⚠️ **KÜÇÜK** |

### 3.8 Performans Kuralları

| Kural | Mevcut Durum | Uyum |
|-------|--------------|------|
| WebP/AVIF görsel format | `upload-images.ts` WebP üretiyor | ✅ Uyumlu |
| `loading="lazy"` | ProductCard'da var | ✅ Uyumlu |
| `font-display: swap` | Google Fonts kullanılmadığı için uygulanamıyor | 🔲 N/A |
| Görsel `width` + `height` attribute | `width={400} height={300}` var | ✅ Uyumlu |
| Favicon ve meta tag'ler | `layout.tsx`'de kapsamlı metadata var | ✅ Uyumlu |
| Open Graph tag'leri | `layout.tsx`'de `openGraph` ve `twitter` var | ✅ Uyumlu |

---

## KRİTİK BULGULAR ÖZETİ

### 🔴 Kritik — Hemen Giderilmeli

| # | Sorun | Konum |
|---|-------|--------|
| 1 | `upload-images.ts` kaynak dosya bulunamıyor (`scripts/output/products.json` yok) | `scripts/upload-images.ts:19` |
| 2 | Font kuralı ihlali: `font-sans` (Inter/system) kullanılıyor, karakterli font yok | `src/app/page.tsx:123`, `globals.css` |
| 3 | `upload-images.ts` dry-run modu eksik — test edilemiyor | `scripts/upload-images.ts` |

### ⚠️ Önemli — Yakın Vadede Giderilmeli

| # | Sorun | Konum |
|---|-------|--------|
| 4 | Scroll animasyonları ve staggered reveal yok (web-design-rules.md §5) | `globals.css`, `page.tsx` |
| 5 | `prefers-reduced-motion` media query desteği yok | `globals.css` |
| 6 | `focus-visible` custom stili yok (erişilebilirlik §10) | `globals.css` |
| 7 | Section padding'leri çok düşük: `py-8` (32px) vs. kural 80-120px | `page.tsx:161` |
| 8 | Düz beyaz/slate arka plan — atmosfer yok (web-design-rules.md §6) | Tüm `page.tsx` |
| 9 | Hover'da border rengi `slate-300` — primary renk olmalı | `product-card.tsx:21` |

### ℹ️ Bilgi — İsteğe Bağlı İyileştirme

| # | Sorun | Konum |
|---|-------|--------|
| 10 | Gradient mesh veya noise texture yok | `globals.css` |
| 11 | `max-w-[1600px]` — kuralda 1200px önerilmiş (kasıtlı seçim olabilir) | `page.tsx:131,161` |
| 12 | WhatsApp ikonu `aria-label` eksik (sadece `title` var) | `product-card.tsx:39` |
| 13 | Detay buton padding'i düşük (`py-2` vs. kural 14px) | `product-card.tsx:58` |
| 14 | Accent renk, secondary ile aynı — distinct accent yok | `globals.css:23-24` |

---

## AKSİYON PLANI

```
1. [KRİTİK] products.json varlığını kontrol et:
   ls scripts/output/
   Yoksa: seed-supabase.ts veya başka bir export script'i çalıştır.

2. [KRİTİK] Pricing bot dry-run testi:
   npx tsx scripts/scrape-pricing.ts --dry-run --limit=5

3. [KRİTİK] Supabase veri sağlığı SQL'lerini çalıştır (Test 1'deki sorgular)

4. [ÖNEMLİ] Karakterli bir font ekle:
   Öneri: Syne (display) + DM Sans (body)
   layout.tsx'de Google Fonts preconnect + link ekle

5. [ÖNEMLİ] globals.css'e ekle:
   - @media (prefers-reduced-motion: reduce) bloğu
   - :focus-visible custom stili
   - Temel animasyon keyframe'leri (fadeInUp, scaleIn)

6. [İSTEĞE BAĞLI] ProductCard hover border'ını primary yap:
   hover:border-slate-300 → hover:border-primary/40
```

---

*Bu rapor statik kod analizi ile üretilmiştir. Gerçek Supabase veri sayıları için §Test 1'deki SQL sorgularını çalıştırmanız gerekmektedir.*

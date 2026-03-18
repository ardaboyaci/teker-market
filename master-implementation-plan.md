# Teker Market — Master Implementation Plan
**Versiyon:** 1.0 | **Tarih:** 2026-03-18
**Temel Kaynaklar:** `web-design-rules.md` (Industrial/Utilitarian estetik) · `2026 BÜTÜN LİSTELER 5.xlsx` (Master Data)

---

## Mevcut Durum Özeti

| Metrik | Değer |
|--------|-------|
| DB'deki mevcut ürün | 3.661 (EMES serisi `EA/EM/EZ...`) |
| Excel'de import-hazır ürün | 15.171 |
| Excel SKU çakışması (ham) | 0 — farklı katalog sistemi |
| Excel SKU çakışması (fuzzy) | ~%89 örtüşme — EMES ürünleri aynı seri |
| Eksik fiyatlı ürün (DB) | Büyük kısmı — bot henüz tamamlanmamış |
| Tasarım kural ihlali | Font, animasyon, spacing, arka plan |

---

## Hibrit SKU Mimarisi

### Sorun
DB'de `EA 01 VBP 150` (insan-okunabilir, varyant bazlı)
Excel'de `80-2520P` (tedarikçi katalog numarası, seri bazlı)
→ Aynı ürün ailesini iki farklı sistemle kodluyoruz.

### Çözüm: `supplier_sku` Alanı + `meta` JSONB

Mevcut `products` tablosunda zaten `meta JSONB DEFAULT '{}'` alanı var.
Yeni sütun eklemeye gerek yok — `meta` içine yazacağız:

```json
{
  "supplier_skus": {
    "emes": "80-2520P",
    "ciftel": "0001"
  },
  "supplier_price_lists": {
    "emes_list": 124.99,
    "emes_40_isk": 74.99
  }
}
```

### Eşleştirme Kuralları

```
1. DB'deki EMES ürünleri (EA/EB/ED/EH/EK/EM/EP/ER/ET/EU/EV/EW/EZ/YT prefiksleri)
   → Excel'deki EMES satırlarıyla isim fuzzy match (token_overlap ≥ 0.65)
   → Eşleşirse: meta.supplier_skus.emes = "80-XXXXP" yaz, YENİ KAYIT OLUŞTURMA

2. Excel'deki ÇİFTEL / KAUÇUK / OSKAR / FALO ürünleri
   → DB'de hiç yok (457 EMES-dışı ürün hariç)
   → Bunlar gerçekten YENİ ürünler — import edilecek
   → SKU olarak Excel'deki orijinal kodu kullan: "0001", "KTÇTP 6*7", "001.2.11.01.CM"

3. ZET ve MERTSAN
   → SKU yok — import edilemez
   → Tedarikçiden SKU'lu liste gelene kadar beklet
```

### Hangi Fiyatı Kullanacağız?

| Tedarikçi | Kullanılacak Sütun | Mantık |
|-----------|-------------------|--------|
| EMES 2026 | `%40 İSK +KDV` | Liste fiyatı negatif — bu sütun gerçek alış |
| YEDEK EMES | `%40 İSK +KDV` | Aynı yapı |
| EMES KULP | `Peşin Net FİYAT` | Zaten net ve pozitif |
| ÇİFTEL | `LİSTE FİYATI` | Pozitif sütun |
| KAUÇUK TAKOZ | `SATIŞ FİYATI` | Doğrudan kullanılabilir |
| OSKAR | `FİYAT` | Doğrudan kullanılabilir |
| FALO | `Satış Fiyatı-1` (>1 olanlar) | 13 placeholder satır atla |

---

## Fazlar

---

### FAZ 1 — Veri Senkronizasyonu
**Süre tahmini:** 1-2 gün | **Risk:** Orta (mevcut DB'ye dokunuluyor)

#### 1A. Supabase Şema Güncellemesi

Aşağıdaki SQL'i Supabase SQL Editor'da çalıştır:

```sql
-- Tedarikçi eşleşme indeksi için (fuzzy match hızlandırma)
CREATE INDEX IF NOT EXISTS idx_products_meta_gin
  ON products USING GIN (meta);

-- Mevcut ürünlerin supplier_skus alanını kontrol et
SELECT id, sku, name, meta->>'supplier_skus' AS supplier_skus
FROM products
WHERE meta ? 'supplier_skus'
LIMIT 10;
```

#### 1B. EMES Eşleştirme Scripti (`scripts/sync-emes-supplier-skus.ts`)

Bu script:
1. DB'deki EMES serisi 3.204 ürünü çeker
2. Excel'deki EMES satırlarıyla token fuzzy match yapar (eşik: 0.65)
3. Eşleşenlere `meta.supplier_skus.emes` yazar
4. Eşleşme bulunamayanları `scripts/output/unmatched-emes.json`'a yazar
5. **`--dry-run` modu zorunlu** — önce çıktıyı gözden geçir

```
npx tsx scripts/sync-emes-supplier-skus.ts --dry-run
npx tsx scripts/sync-emes-supplier-skus.ts --dry-run --limit=50
# Çıktıyı onayla, sonra:
npx tsx scripts/sync-emes-supplier-skus.ts
```

**Beklenen çıktı:**
- ~2.800 eşleşme (token overlap ≥ 0.65)
- ~400 eşleşemeyen (varyant farkı — bunlar zaten DB'ye özgü varyantlar)

#### 1C. Yeni Ürün İmport Scripti (`scripts/import-new-suppliers.ts`)

Sırayla işlenecek tedarikçiler:

```
Öncelik 1: ÇİFTEL (1.180 ürün) — En temiz yapı, hızlı import
Öncelik 2: KAUÇUK TAKOZ (1.135 ürün, 23 fiyatsız atla)
Öncelik 3: OSKAR (1.198 ürün, 515 boş satır filtrele)
Öncelik 4: FALO (205 ürün, 13 placeholder atla)
Öncelik 5: YEDEK EMES (731 ürün) — DB'deki mevcut YEDEK seriyle çakışma yok
```

Her import öncesi checklist:
- [ ] `--dry-run` ile çalıştır, log kontrol et
- [ ] `status: 'draft'` olarak ekle (canlıya almadan önce gözden geçir)
- [ ] `sale_price` pozitif mi? CHECK constraint çalışacak
- [ ] `sku` unique mi? UNIQUE constraint varsa hata verir — önce kontrol et

#### 1D. Fiyat Güncelleme

EMES eşleştirmesi tamamlandıktan sonra `scrape-pricing.ts` botunu çalıştır:
```bash
npx tsx scripts/scrape-pricing.ts --dry-run --limit=20
# Kontrol et, sonra:
npx tsx scripts/scrape-pricing.ts --limit=100
```

---

### FAZ 2 — Eksik Veri Tamamlama (Sıralı Bot Stratejisi)
**Süre tahmini:** 3-5 gün (botlar arka planda çalışır)

Botları şu sırayla çalıştır. Her bot bir sonrakinin girdisini hazırlar.

```
┌─────────────────────────────────────────────────────────┐
│  ADIM 1: Fiyat Botu (scrape-pricing.ts)                │
│  → Önce fiyatları doldur, çünkü SEO bot fiyatı kullanır │
│  Hedef: ~15.000 ürün × 2 kaynak = ~30.000 HTTP istek   │
│  Süre: ~8 saat (350ms delay, 10'luk chunk'lar)         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  ADIM 2: Görsel Bot (upload-images.ts)                 │
│  → ÖNCE: scripts/output/products.json'u güncelle       │
│  → Watermark + WebP dönüşüm + Supabase storage upload  │
│  Not: --dry-run modu yok, test için --limit mantığı ekle│
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  ADIM 3: SEO Bot (seo-description-bot.ts / Gemini)     │
│  → Fiyat + görsel olan ürünlere önce description yaz   │
│  → Checkpoint sistemi zaten var (seo-checkpoint.json)  │
│  Hedef: ~15.000 description × Gemini 2.0 Flash Lite    │
└─────────────────────────────────────────────────────────┘
```

#### Önceliklendirme Mantığı

Her bot şu sırayla ürünleri işlemeli:

```sql
-- Bot için öncelik sırası:
-- 1. active + fiyatı var + resmi yok → görsel bot hedefi
-- 2. active + fiyatı yok → fiyat botu hedefi
-- 3. draft + her şey tamam → SEO bot, sonra active'e çek
SELECT sku, name,
  CASE
    WHEN status = 'active' AND sale_price IS NOT NULL AND image_url IS NULL THEN 1
    WHEN status = 'active' AND sale_price IS NULL THEN 2
    WHEN status = 'draft' AND sale_price IS NOT NULL AND image_url IS NOT NULL THEN 3
    ELSE 4
  END AS bot_priority
FROM products
WHERE deleted_at IS NULL
ORDER BY bot_priority, created_at DESC;
```

---

### FAZ 3 — Tasarım Refactor (Industrial/Utilitarian)
**Süre tahmini:** 2-3 gün | **Risk:** Düşük (görsel değişiklik, veri yok)

Web-design-rules.md §12 "YAPMA Listesi" baz alınarak yapılacak değişiklikler:

#### 3A. Font Sistemi (`src/app/layout.tsx`)

**Mevcut (İHLAL):** `font-sans` = Inter/system-ui
**Hedef (Industrial/Utilitarian):** `Syne` (display) + `DM Sans` (body)

```tsx
// layout.tsx — Google Fonts entegrasyonu
import { Syne, DM_Sans } from 'next/font/google'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['700', '800'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
  display: 'swap',
})

// <body className={`${syne.variable} ${dmSans.variable} antialiased`}>
```

```css
/* globals.css — @theme bloğuna ekle */
--font-display: var(--font-display), 'Syne', sans-serif;
--font-body: var(--font-body), 'DM Sans', sans-serif;
```

Kullanım: başlıklara `font-display`, gövde metne `font-body` Tailwind class'ı.

#### 3B. Animasyon Sistemi (`src/app/globals.css`)

web-design-rules.md §5'ten alınan keyframe'ler + prefers-reduced-motion:

```css
/* globals.css'e eklenecek */

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}

.animate-fade-in-up {
  animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-scale-in {
  animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Stagger sistemi */
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.10s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.20s; }

/* Focus stili */
:focus-visible {
  outline: 2px solid hsl(221.2 83.2% 53.3%);
  outline-offset: 3px;
  border-radius: 4px;
}

/* Erişilebilirlik */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### 3C. ProductCard Düzeltmeleri (`src/components/storefront/product-card.tsx`)

| Mevcut | Hedef | Satır |
|--------|-------|-------|
| `hover:border-slate-300` | `hover:border-primary/50` | 21 |
| WhatsApp: sadece `title` | `title` + `aria-label` ekle | 39 |
| `py-2` (Detaylı İncele btn) | `py-2.5` — min 44px touch target'a yaklaştır | 58 |

#### 3D. HeroSection Refactor (`src/components/storefront/hero-section.tsx`)

**Mevcut:** `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900`
**Sorun:** Sıradan gradient, kural §6'ya göre atmosfersiz.
**Hedef (Industrial):** Koyu arka plan + subtle dot grid + sert tipografi + Syne font

```
Mevcut stat: "600+ Ürün Çeşidi"
Güncelle  : "15.000+ Ürün" (import sonrası)
```

#### 3E. Spacing Düzeltmesi (`src/app/page.tsx`)

Mevcut: `py-8` (32px) — kural §4: normal bölüm 80-120px
Geçiş: `py-12 md:py-20` — mobile-first uyumlu orta yol

#### 3F. Arka Plan Atmosferi

web-design-rules.md §6'ya göre Industrial için dot grid öneriliyor:

```css
/* Page arka planına subtle grid */
.bg-industrial-grid {
  background-color: #f8f9fa;
  background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px);
  background-size: 24px 24px;
}
```

`page.tsx` satır 123'teki `bg-slate-50/50` → `bg-industrial-grid`

---

### FAZ 4 — Scraping & Fiyat Optimizasyonu
**Süre tahmini:** Sürekli (cron job)

#### 4A. Fiyat Botu İyileştirmeleri

Mevcut `scrape-pricing.ts` iyi çalışıyor. Yapılacak tek ekleme:
- EMES supplier fiyatlarını `meta.supplier_price_lists` alanına yaz
- Rakip fiyat ile supplier fiyatı karşılaştır, hangisi düşükse `sale_price`'ı güncelle

#### 4B. Görsel Bot Düzeltmesi

`upload-images.ts`'deki kritik sorun — `scripts/output/products.json` güncel tutulmalı:

```bash
# products.json'u Supabase'den yenile (bu scripti yaz):
npx tsx scripts/export-products.ts --status=active,draft
# Sonra görsel botu çalıştır:
npx tsx scripts/upload-images.ts
```

#### 4C. SEO Checkpoint Kontrolü

```bash
cat scripts/output/seo-checkpoint.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'İşlenen: {len(d)} ürün')
"
```

---

## Faz Bağımlılıkları (Önce-Sonra)

```
FAZ 1A (Şema) ──────────────┐
                             ▼
FAZ 1B (EMES eşleştir) ──► FAZ 1C (Yeni import) ──► FAZ 1D (Fiyat bot)
                                                              │
                             ┌────────────────────────────────┘
                             ▼
FAZ 2 (Bot zinciri: Fiyat → Görsel → SEO) ─────────────────────┐
                                                                 │
FAZ 3 (Tasarım — bağımsız, paralel başlayabilir) ──────────────┤
                                                                 ▼
                                              FAZ 4 (Cron job — sürekli)
```

FAZ 3 veri değişikliği içermez, FAZ 1-2 ile **paralel** yürütülebilir.

---

## Kritik Kararlar ve Gerekçeler

### Neden mevcut DB SKU'ları değiştirilmiyor?
`EA 01 VBP 150` formatı slug, URL ve arama indeksine işlemiş durumda.
SKU formatını değiştirmek tüm URL'leri kırar, SEO sıfırlanır.
Çözüm: Eski SKU tutulur, `meta.supplier_skus` alanına tedarikçi kodu eklenir.

### Neden EMES ürünleri `status: active` değil `draft` olarak import ediliyor?
Fuzzy eşleştirme her zaman %100 doğru değil. Yanlış eşleşmiş bir ürün
doğrudan `active` olarak yayına alınırsa müşteri yanlış ürün görür.
`draft` → manuel onay → `active` pipeline'ı güvenli.

### Neden ZET için bekliyoruz?
ZET'in 2.045 ürününde SKU yok. `products` tablosunda `sku NOT NULL UNIQUE`
constraint var. Ya constraint kaldırılır (şemayı bozar) ya tedarikçiden
SKU'lu liste istenir. İkinci seçenek doğru.

### Industrial/Utilitarian font seçimi neden Syne/DM Sans?
web-design-rules.md §2 tablosuna göre "Modern/Clean" kategorisi:
Display: `Syne, Outfit, General Sans`
Body: `DM Sans, Plus Jakarta Sans, Manrope`
Industrial sertliği için Syne'nin geometric agırlığı uygundur.
Bebas Neue gibi tam brutalist fontlar B2B katalog okunabilirliğini düşürür.

---

## Riskler ve Önlemler

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| Fuzzy match yanlış eşleştirme | Orta | Yüksek | `--dry-run` zorunlu, 0.65 eşik |
| Fiyat botu scraping engeli | Yüksek | Orta | 350ms delay var, Cloudflare bypass gerekebilir |
| 15K ürün import sonrası DB yavaşlaması | Düşük | Yüksek | Mevcut index'ler yeterli (gin, btree) |
| Font değişimi sonrası CLS | Düşük | Orta | `next/font` ile preload garantili |
| ZET tedarikçisi SKU vermez | Orta | Orta | 2.045 ürün beklemede, blokla |

---

## Başlangıç Onayı

Planı uygulamaya başlamak için **FAZ 1A** ile başlayacağız:

1. Supabase SQL Editor'da `idx_products_meta_gin` index'ini oluştur
2. `sync-emes-supplier-skus.ts` scriptini yaz (dry-run ile test)
3. ÇİFTEL2026'yı `draft` olarak import et (1.180 ürün, en temiz set)

**FAZ 3 (Tasarım) paralel başlatılabilir** — veri riskı yok, sadece kod değişikliği.

Onay verirsen hangi fazla başlayalım?
- **"Veri önce"** → FAZ 1A ile başla (EMES sync scripti)
- **"Tasarım önce"** → FAZ 3A ile başla (font + animasyon)
- **"İkisi paralel"** → FAZ 1A + FAZ 3A aynı anda

---

*Bu plan `system-check.md`, `pre-import-test-report` ve `fuzzy-matching-report` bulgularını birleştirmektedir. `web-design-rules.md` §10-12 kural seti ve `supabase_schema.sql` şeması esas alınmıştır.*

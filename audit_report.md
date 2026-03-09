# TekerMarket — Kapsamlı Backend, Frontend & Scraper Denetim Raporu

**Tarih:** 5 Mart 2026 | **Versiyon:** 1.0

---

## 1. Proje Genel Durumu

| Alan | Dosya Sayısı | Satır Sayısı | Durum |
|------|-------------|-------------|-------|
| Vitrin Frontend (storefront/) | 26 bileşen | ~2.200 satır | ✅ Tamamlandı |
| Admin Dashboard | 6 dosya | ~800 satır | ⚠️ Temel düzey |
| Backend (lib/ + API) | 10 dosya | ~350 satır | ⚠️ Eksikler var |
| Botlar (scripts/) | 4 ana dosya | ~870 satır | ✅ İyi, geliştirilebilir |
| Tipler (types/) | 2 dosya | ~760 satır | ✅ Detaylı |
| Toplam | ~61 src dosyası | ~5.000+ satır | — |

---

## 2. BACKEND ANALİZİ

### 2.1 Mevcut Altyapı ✅

| Bileşen | Dosya | Durum |
|---------|-------|-------|
| Supabase Server Client | `lib/supabase/server.ts` | ✅ SSR cookie-based auth |
| Supabase Browser Client | `lib/supabase/client.ts` | ✅ Client-side queries |
| Admin Client (service role) | `lib/supabase/admin.ts` | ✅ RLS bypass |
| Auth Middleware | `middleware.ts` + `lib/supabase/middleware.ts` | ✅ Session refresh |
| DB Types | `types/supabase.ts` (759 satır) | ✅ Kapsamlı, auto-generated |
| Sentry Error Tracking | `instrumentation.ts` + `instrumentation-client.ts` | ✅ v10 aktif |

### 2.2 Backend Eksikleri ❌

| # | Eksik | Etki | Öncelik |
|---|-------|------|---------|
| B1 | ~~**API Routes yok** — Tüm veri çekme işlemi doğrudan Server Component içinde yapılıyor. REST/JSON endpoint yok.~~ ✅ **TAMAMLANDI** — `/api/products`, `/api/categories`, `/api/search` route'ları oluşturuldu. Filtreleme, sayfalama ve kategori hiyerarşisi destekleniyor. | ~~Mobil uygulama, webhook, 3. parti entegrasyon yapılamaz.~~ | ~~YÜKSEK~~ |
| B2 | ~~**`rpc_search_products` RPC tanımsız** — `SearchAutocomplete` bileşeni bu RPC'yi çağırıyor ama Supabase'de fonksiyon oluşturulmamış olabilir.~~ ✅ **TAMAMLANDI** — Supabase'de optimize `rpc_search_products` fonksiyonu oluşturuldu. `SearchAutocomplete` artık doğrudan RPC yerine `/api/search` route'unu kullanıyor. | ~~Arama autocomplete çalışmaz.~~ | ~~KRİTİK~~ |
| B3 | ~~**Error handling zayıf** — Server Component'larda Supabase hataları `console.error` ile loglanıp görmezden geliniyor.~~ ✅ **TAMAMLANDI** — `src/lib/cron/helpers.ts` içinde `runCronStep()` sarmalayıcısı oluşturuldu. İş mantığı hataları Sentry'ye `warning`, beklenmedik exception'lar `error` seviyesinde raporlanıyor. Her adım `scope.setTag / setContext` ile etiketleniyor. | ~~Kullanıcı hata sayfası görmüyor, sessiz başarısızlık.~~ | ~~ORTA~~ |
| B4 | **Rate limiting yok** — API route'lar (şu an sadece `/api/sentry-test`) ve public sayfa sorguları rate limit korumasına sahip değil. | DDoS veya kötü niyetli aşırı istek riski. | YÜKSEK |
| B5 | **Validasyon katmanı yok** — Zod kurulu ama hiçbir yerde form/input validasyonu yapılmıyor. | Güvensiz veri girişi. | ORTA |
| B6 | **`global-error.tsx` eksik** — Sentry bu dosyayı istiyor (build warning). | React render hataları Sentry'ye gitmez. | DÜŞÜK |
| B7 | ~~**Webhook/Cron endpoint yok** — Fiyat güncelleme ve scraping işlemleri sadece CLI ile yapılıyor. Otomatik zamanlama yok.~~ ✅ **TAMAMLANDI** — `GET /api/cron/sync` endpoint'i oluşturuldu. `CRON_SECRET` Bearer token doğrulaması, fiyat normalizasyonu (price_history kaydı dahil) ve son 24 saatteki eksik ürün kontrolü adımlarını içeriyor. Vercel Cron veya harici scheduler ile tetiklenmeye hazır. | ~~Manuel müdahale gerekiyor.~~ | ~~YÜKSEK~~ |
| B8 | **`not-found.tsx` ve `error.tsx` sayfaları yok** — App Router hata sayfaları tanımlanmamış. | 404 ve 500 sayfaları Next.js varsayılanı. | ORTA |

### 2.3 Veritabanı Katmanı

| Bileşen | Durum |
|---------|-------|
| Products tablosu | ✅ Tam (sku, name, slug, prices, attributes JSONB, quantity, status) |
| Categories tablosu | ✅ ltree destekli hiyerarşik |
| RLS Policies | ✅ Aktif (select public, insert/update/delete auth) |
| Materialized Views | ✅ `mv_category_stock_summary`, `mv_incomplete_products` |
| pg_cron | ✅ View refresh otomatik |
| Storage Bucket | ✅ `product-media` (public) |

---

## 3. FRONTEND ANALİZİ

### 3.1 Vitrin (Storefront) — 26 Bileşen ✅

Tüm Sprint 4 (Hafta 1-3) bileşenleri tamamlanmış ve build verified:

| Hafta | Bileşen Sayısı | First Load JS | Durum |
|-------|---------------|---------------|-------|
| Hafta 1: Global + Ana Sayfa | 11 bileşen | 253 kB | ✅ |
| Hafta 2: Ürün Listesi | 7 bileşen | (aynı bundle) | ✅ |
| Hafta 3: Ürün Detay | 9 bileşen (+sayfa) | 253 kB | ✅ |

### 3.2 Admin Dashboard — Temel Seviye ⚠️

| Bileşen | Dosya | Durum |
|---------|-------|-------|
| Dashboard Ana Sayfa | `dashboard/page.tsx` | ✅ 4 KPI kart + grafikler |
| Dashboard Shell (Layout) | `dashboard-shell.tsx` | ✅ Sidebar navigasyon |
| Ürün Yönetim Tablosu | `product-data-grid.tsx` | ✅ Tanstack Table + inline edit |
| Toplu Güncelleme | `bulk-update-dialog.tsx` | ✅ Çoklu ürün fiyat/durum güncelleme |

### 3.3 Frontend Eksikleri ❌

| # | Eksik | Etki | Öncelik |
|---|-------|------|---------|
| F1 | **Layout tekrarı** — Header/Footer hem `page.tsx` hem `products/[slug]/page.tsx` içinde tekrar ediyor. Ortak layout kullanılmıyor. | Kod tekrarı, bakım zorluğu. | YÜKSEK |
| F2 | **Loading states yok** — `loading.tsx` dosyası hiçbir route'ta yok. Sayfa geçişlerinde beyaz ekran. | Kötü UX. | YÜKSEK |
| F3 | **SEO metadata eksik** — `layout.tsx` sadece "Yönetim Paneli" title'ı var. Vitrin sayfalarında `<head>` meta eksik. | Google indexleme sorunu. | YÜKSEK |
| F4 | **Font import yok** — `layout.tsx`'te font tanımlanmamış. Tarayıcı varsayılan fontu kullanılıyor. | Tasarım tutarsızlığı. | ORTA |
| F5 | **Responsive test eksik** — Mobil drawer var ama tablet ara boyutlar test edilmemiş. | Tablet kullanıcılarında UI kırılması. | ORTA |
| F6 | **Image domain config eksik** — `next.config.ts`'te `images.remotePatterns` tanımlı değilse external resimler kırılır. | Ürün resimleri yüklenmez. | KRİTİK |
| F7 | **Dashboard'da CRUD eksik** — Ürün ekleme/silme formu yok. Sadece inline edit ve toplu güncelleme var. | Admin tam CRUD yapamıyor. | ORTA |
| F8 | **Dark mode yok** — Sadece light theme tanımlı. | Kullanıcı tercihi karşılanamıyor. | DÜŞÜK |

---

## 4. SCRAPER (BOT) DENETİMİ

### 4.1 Scraper Envanteri

| Script | Satır | Görevi | Son Çalışma |
|--------|-------|--------|-------------|
| `scrape-emes.ts` | 442 | Emes Teker katalog + detay + resim | Faz 2'de çalıştırıldı |
| `scrape-pricing.ts` | 192 | Rakip fiyat karşılaştırma + DB güncelleme | Faz 2'de çalıştırıldı |
| `seed-supabase.ts` | 233 | JSON → Supabase DB + Storage yükleme | Faz 2'de çalıştırıldı |
| `assign-categories.ts` | ~100 | Kategori atama (yardımcı) | Faz 2 tamamlandı |

### 4.2 Güçlü Yönler ✅

| Özellik | Detay |
|---------|-------|
| **Retry mekanizması** | `fetchWithRetry()` — 3 deneme, exponential backoff (2^n saniye) |
| **Rate limiting** | `randomDelay()` 0.8-2s arası, `sleep(500)` pricing botunda |
| **Chunked processing** | Resim indirme 5'li, detay enrichment 3'lü, seeding 5'li chunk |
| **Timeout koruması** | Axios `timeout: 20000` (emes), `timeout: 15000` (pricing) |
| **Watermark** | Sharp ile otomatik watermark + WebP dönüşüm |
| **Dedup** | SKU bazlı `Set` ile tekrar engelleme |
| **Compensating tx** | Seed'de DB insert başarısızsa yüklenen resim silinir |
| **Fallback** | Katalog scrape başarısızsa ana sayfa denenir |

### 4.3 Scraper Zayıflıkları & Geliştirme Alanları ⚠️

| # | Sorun | Detay | Öncelik |
|---|-------|-------|---------|
| S1 | ~~**Pagination desteği yok**~~ ✅ **TAMAMLANDI** — `scrapeAllPages()` + `findNextPageUrl()` fonksiyonları eklendi. Bot artık her seri sayfasında tüm sayfaları sırasıyla geziyor; `rel="next"`, query-string (`?page=N`) ve path tabanlı (`/sayfa/N/`) pagination formatlarının hepsi destekleniyor. | ~~`scrape-emes.ts` sadece ilk sayfa ürünlerini çekiyor.~~ | ~~KRİTİK~~ |
| S2 | **Hardcoded CSS selectors** | `.product-list`, `.product-item` gibi selector'lar site değişirse kırılır. Selector registry / config dosyası yok. | YÜKSEK |
| S3 | **Proxy rotasyon yok** | Tek IP ile sequential istek yapılıyor. Büyük hacimde IP ban riski. | ORTA |
| S4 | **Log dosyası yok** | Tüm çıktılar `console.log` ile terminale. Kalıcı log kaydı yok. | ORTA |
| S5 | ~~**İlerleme kaydetme (checkpoint) yok**~~ ✅ **TAMAMLANDI** — `checkpoint.json` tabanlı resume sistemi eklendi. `Checkpoint` interface'i ile `loadCheckpoint / saveCheckpoint / clearCheckpoint` fonksiyonları yazıldı. Bot seri, detail ve image fazlarının her birinde ilerlemeyi kaydediyor; yeniden başlatıldığında kaldığı yerden devam ediyor. `--reset` flag'i ile sıfırdan başlamak mümkün. | ~~Bot yarıda kesilirse sıfırdan başlıyor.~~ | ~~YÜKSEK~~ |
| S6 | ~~**Fiyat geçmişi kaydedilmiyor**~~ ✅ **TAMAMLANDI** — `scrape-pricing.ts` güncellendi. Her ürün için mevcut `sale_price` önce okunuyor; fiyat değiştiyse `price_history` tablosuna `old_price / new_price / notes (strateji)` ile kayıt atılıyor. Fiyat değişmediğinde kayıt atlanıyor (gereksiz satır şişmesi önlemi). Değişim yönü (↑ ↓ =) log'a yazdırılıyor. | ~~`scrape-pricing.ts` sadece son fiyatı yazıyor.~~ | ~~YÜKSEK~~ |
| S7 | **Rakip sayısı sınırlı** | Sadece 1 rakip (e-tekerlek.com) + 1 mevcut site (tekermarket.com.tr) taranıyor. | ORTA |
| S8 | **SSL sertifika uyarısı** | `rejectUnauthorized: false` production'da güvenlik riski. | ORTA |
| S9 | **Test coverage sıfır** | Scraper'lar için birim/entegrasyon testi yok. Parser'ların doğruluğu kanıtlanamaz. | YÜKSEK |
| S10 | **npm script tanımsız** | `package.json`'da scraper komutları yok. Her seferinde `npx tsx scripts/...` yazmak gerekiyor. | DÜŞÜK |

### 4.4 Performans Metrikleri

| Bot | Tahmini Çalışma Süresi | Ürün/dk | Darboğaz |
|-----|----------------------|---------|----------|
| `scrape-emes.ts` | ~30 dk (647 ürün) | ~21 | Detay sayfası enrichment (1 HTTP isteği/ürün) |
| `scrape-pricing.ts` | ~10 dk (647 ürün) | ~65 | 2 HTTP isteği/ürün (rakip + mevcut site) |
| `seed-supabase.ts` | ~5 dk (647 ürün) | ~130 | Storage upload (1 dosya/ürün) |

---

## 5. ÖNCELİKLİ AKSİYON PLANI

### 🔴 KRİTİK (Hemen yapılması gereken)

1. **B2** — `rpc_search_products` Supabase fonksiyonunu oluştur
2. **F6** — `next.config.ts`'e Supabase Storage `remotePatterns` ekle
3. **S1** — Scraper'a pagination desteği ekle (tüm sayfa ürünlerini çek)
4. **F1** — Vitrin layout bileşeni oluştur (header/footer tekrarını kaldır)
5. **F2** — Her route'a `loading.tsx` skeleton ekle

### 🟡 YÜKSEK (Sprint içinde yapılması gereken)

6. **B1** — RESTful API routes katmanı (`/api/products`, `/api/categories`)
7. **B4** — Rate limiting middleware (IP/token bazlı)
8. **B7** — Cron endpoint veya Vercel Cron Job (otomatik fiyat güncelleme)
9. **S5** — Scraper checkpoint/resume sistemi
10. **S6** — Fiyat geçmiş tablosu + trend analizi
11. **F3** — Vitrin sayfaları için dinamik SEO metadata
12. **S2** — Selector config dosyası (scraper bakım kolaylığı)
13. **S9** — Parser unit testleri

### 🟢 ORTA / DÜŞÜK

14. **B5** — Zod validasyon katmanı
15. **B8** — Custom 404 ve error sayfaları
16. **F4** — Google Fonts (Inter/Outfit) entegrasyonu
17. **F7** — Dashboard CRUD formları
18. **S3** — Proxy rotasyon (opsiyonel)
19. **S4** — File-based logging
20. **S10** — npm script shortcuts

---

## 6. SONUÇ

| Alan | Puan (10 üzerinden) | Yorum |
|------|---------------------|-------|
| **Frontend — Vitrin** | **8/10** | Sprint 4 ile büyük sıçrama yapıldı. Layout tekrarı ve loading states eksik. |
| **Frontend — Dashboard** | **6/10** | Temel KPI + tablo var, CRUD ve detaylı raporlama eksik. |
| **Backend** | **5/10** | Auth + DB altyapısı sağlam, API katmanı ve validasyon eksik. |
| **Scraper/Botlar** | **7/10** | Retry, chunking, watermark mükemmel. Pagination, checkpoint, test eksik. |
| **DevOps & Observability** | **6/10** | Sentry aktif. CI/CD, staging, otomatik deployment yok. |
| **Genel** | **6.4/10** | Sağlam temel, production-ready için kritik eksikler var. | 
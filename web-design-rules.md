# Web Sitesi & Internal Tool Tasarım Kuralları

> Bu dosya iki kapsam için yazılmıştır:
> - **Public Storefront** — müşteriye yönelik ürün sayfaları
> - **TekerAdmin (Internal Dashboard)** — stok, ürün ve tedarikçi yönetimi
>
> Bu iki kapsam farklı tasarım dillerine sahiptir. Hangisi için çalışıyorsanız ilgili bölümü okuyun.

---

## BÖLÜM A — INTERNAL TOOL / DASHBOARD (TekerAdmin)

> TekerAdmin: Next.js + shadcn/ui + Tailwind. Veri yoğun, günlük kullanım, tek kullanıcı odaklı yönetim aracı.

---

### A.1 Temel Felsefe

Internal tool'un birinci amacı **bilişsel yükü sıfıra indirmektir**. Kullanıcı düşünmemeli, aramak zorunda kalmamalı, şaşırmamalı. Şu ilkeleri her kararın önüne koy:

| Dashboard | Storefront |
|---|---|
| Kullanıcıyı hiç düşündürme | Kullanıcıyı keşfettir |
| Veri yoğunluğu ve taranabilirlik | Atmosfer ve dönüşüm |
| Öngörülebilir, tutarlı grid | Asimetri, grid-breaking |
| Bilgi hiyerarşisi önce | Estetik önce |
| State her zaman görünür | Animasyon ön planda |
| Tablo, badge, skeleton standart | Hero, gradient, parallax standart |

---

### A.2 Shadcn/ui + Tailwind Entegrasyonu

#### CSS Variable → Tailwind köprüsü
`globals.css`'teki `:root` değerleri ile Tailwind config arasında tutarlılık şart:

```css
/* globals.css — shadcn token'ları */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;     /* #3b82f6 — blue-500 */
  --primary-foreground: 210 40% 98%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --border: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;

  /* Durum renkleri */
  --color-success: #10b981;   /* emerald-500 */
  --color-warning: #f59e0b;   /* amber-500  */
  --color-error:   #ef4444;   /* red-500    */
  --color-info:    #3b82f6;   /* blue-500   */
}
```

```typescript
// tailwind.config.ts — token'ları Tailwind'e bağla
theme: {
  extend: {
    colors: {
      border:     'hsl(var(--border))',
      primary: {
        DEFAULT:    'hsl(var(--primary))',
        foreground: 'hsl(var(--primary-foreground))',
      },
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      error:   'var(--color-error)',
    }
  }
}
```

#### `cn()` kullanım kuralı
shadcn bileşenlerini extend ederken `cn()` ile merge et, override yapma:
```typescript
import { cn } from "@/lib/utils"
// DOĞRU
<Card className={cn("shadow-sm", isUrgent && "border-red-200 bg-red-50/40")} />
// YANLIŞ
<Card style={{ borderColor: 'red' }} />
```

---

### A.3 Dashboard Layout Standardı

```
┌─────────────────────────────────────────────────┐
│  Sidebar (280px fixed)  │  Main Content Area     │
│  ─────────────────────  │  ──────────────────    │
│  Logo                   │  Page Header           │
│  ─────────────────────  │    Başlık + tarih      │
│  Nav linkleri           │    Action buttons      │
│  ─────────────────────  │  ──────────────────    │
│  (Alt kısım: kullanıcı) │  Alert Band (varsa)    │
│                         │  KPI Kartlar (2-4 adet)│
│                         │  Primary Content       │
│                         │  Secondary Content     │
└─────────────────────────────────────────────────┘
```

**Spacing kuralları (8px grid):**
- Sayfa padding: `p-6` (24px)
- Bileşenler arası: `space-y-6` (24px)
- Kart içi: `p-5` (20px)
- Tablo satır: `py-2.5 px-4`

---

### A.4 Tipografi (Dashboard)

Dashboard'da font **okunabilirlik** için seçilir, karakter için değil.

```css
/* TekerAdmin font stack */
--font-body:    'Inter', system-ui, sans-serif;   /* Tablo, label, body */
--font-display: 'Inter', system-ui, sans-serif;   /* KPI rakamları */
--font-mono:    'JetBrains Mono', monospace;       /* SKU kodları */
```

**Type scale (dashboard için sabit px, fluid değil):**
```
text-[10px] / font-bold / tracking-widest  → Tablo başlığı, label üst metin
text-xs (12px)                             → Meta bilgi, timestamp, badge
text-sm (14px)                             → Tablo satırı, form label
text-base (16px)                           → Normal metin
text-lg / text-xl                          → Kart başlığı
text-3xl / font-extrabold                  → KPI rakamı
```

**Kural:** Dashboard'da `clamp()` fluid typography KULLANMA. Sabit pixel boyutları veri tarama için daha güvenli.

---

### A.5 Renk ve Durum Sistemi

#### Durum renkleri — tutarlı kullan
```
Emerald (success):  stokta var, başarılı, aktif
Amber (warning):    kritik stok, beklemede, taslak
Red (danger):       stok bitti, hata, iptal
Blue (info):        nötr bilgi, default state
Slate (muted):      pasif, disabled, meta bilgi
```

#### Tailwind sınıf kalıpları
```typescript
// Badge / durum etiketi
const statusClass = {
  active:   'bg-emerald-100 text-emerald-700',
  draft:    'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  info:     'bg-blue-100 text-blue-700',
}

// Tablo satırı vurgusu
const rowClass = {
  zero:     'bg-red-50/40',
  critical: 'bg-amber-50/30',
  normal:   'hover:bg-slate-50',
}
```

---

### A.6 Bileşen Standartları (Data-Dense UI)

#### Tablo
```tsx
// Standart dashboard tablosu yapısı
<div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
  {/* Sticky header */}
  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200
                  text-[10px] font-bold uppercase tracking-wider text-slate-400 sticky top-0">
    <div className="col-span-2">Tedarikçi</div>
    <div className="col-span-5">SKU / Ürün</div>
    <div className="col-span-2 text-center">Stok</div>
    <div className="col-span-3 text-right">İşlem</div>
  </div>
  {/* Zebra stripe yok — hover highlight yeterli */}
  <div className="divide-y divide-slate-100">
    {rows.map(row => (
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50 transition-colors">
        ...
      </div>
    ))}
  </div>
</div>
```

#### Badge / Durum Etiketi
```tsx
// Kullanım
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold
                 bg-emerald-100 text-emerald-700">
  Aktif
</span>

// Boyutlar: text-[10px] + px-1.5 (mini) | text-xs + px-2 (normal)
// Şekil: rounded-full (pill) | rounded (kare)
```

#### Skeleton Loader
```tsx
// Veri yüklenirken — hiçbir zaman boş sayfa gösterme
<div className="animate-pulse space-y-3">
  <div className="h-4 bg-slate-200 rounded w-3/4" />
  <div className="h-4 bg-slate-200 rounded w-1/2" />
  <div className="h-4 bg-slate-200 rounded w-5/6" />
</div>
```

#### Empty State
```tsx
// Veri yoksa — hiçbir zaman blank alan bırakma
<div className="flex flex-col items-center gap-2 py-12 text-center">
  <Icon className="w-10 h-10 text-slate-200" />
  <p className="text-sm font-semibold text-slate-500">Kayıt bulunamadı</p>
  <p className="text-xs text-slate-400">Filtre kriterlerini değiştirmeyi deneyin</p>
</div>
```

#### Progress Bar
```tsx
// Görsel doluluk göstergesi gibi
<div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
  <div
    className="h-full bg-blue-500 rounded-full transition-all duration-500"
    style={{ width: `${pct}%` }}
  />
</div>
```

---

### A.7 Form Hata ve Durum Standartları

```tsx
// Input durumları
// Normal:   border-slate-200
// Focus:    border-primary ring-2 ring-primary/20
// Error:    border-red-400 ring-2 ring-red-400/20
// Success:  border-emerald-400
// Disabled: opacity-50 cursor-not-allowed pointer-events-none

// Hata mesajı yerleşimi — input'un hemen altına
<div>
  <Input className={cn(error && "border-red-400 focus-visible:ring-red-400/20")} />
  {error && (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
      <AlertCircle className="w-3 h-3" /> {error}
    </p>
  )}
</div>
```

---

### A.8 İkon Sistemi

**Kütüphane:** Lucide React (zaten kurulu, shadcn default)

**Boyut standardı:**
```
w-3 h-3 (12px) → Badge içi, tablo meta
w-4 h-4 (16px) → Buton içi, form label yanı
w-5 h-5 (20px) → KPI kart ikonu, section başlığı
w-6 h-6 (24px) → Empty state, büyük aksiyon butonu
w-8 h-8+ (32px+) → Onboarding, hata sayfası
```

**Renk kuralı:** İkon rengi her zaman parent text rengini ya da durum rengini takip eder.
```tsx
<AlertTriangle className="w-5 h-5 text-amber-500" />  // durum rengi
<Search className="w-4 h-4 text-slate-400" />          // muted
<Check className="w-4 h-4" />                          // parent'tan inherit
```

---

### A.9 Z-index Katman Sistemi

```css
/* globals.css — katman yönetimi */
:root {
  --z-base:     0;
  --z-dropdown: 10;
  --z-sticky:   20;   /* sticky table header */
  --z-overlay:  30;   /* backdrop */
  --z-modal:    40;
  --z-toast:    50;
  --z-tooltip:  60;
}
```

```
Tailwind z-class karşılıkları:
z-10  → dropdown
z-20  → sticky header
z-30  → overlay/backdrop
z-40  → modal/dialog
z-50  → toast/notification
```

---

### A.10 Animasyon Kuralları (Dashboard'a Özel)

Dashboard'da animasyon **sadece state geçişlerinde** kullanılır:

```
✅ Kullan:
- Modal / dialog aç-kapat (fade + scale)
- Toast göster-gizle (slide-in)
- Loading → data geçişi (skeleton → içerik)
- Tab değiştirme (fade)
- KPI kartları ilk yükleniyor (stagger, SADECE ilk render)

❌ Kullanma:
- Her scroll'da animate etme
- Tablo satırlarına stagger verme (50 satır animate = lag)
- Hover'da transform/translate (dikkat dağıtır)
- Sürekli dönen/pulse ikonlar (alert dışında)
```

```tsx
// Sadece ilk render için stagger — KPI kartlarında olduğu gibi
style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}

// Modal geçişi — shadcn Dialog default yeterli
// Toast — sonuture Sonner kullan (shadcn uyumlu)
```

---

### A.11 Dashboard Sayfa Yapısı Şablonu

Her dashboard sayfası bu sırayı takip eder:

```tsx
export default function SomeDashboardPage() {
  return (
    <div className="flex flex-col space-y-6">

      {/* 1. Sayfa başlığı */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Başlık</h1>
        <p className="text-slate-500 mt-0.5 text-sm font-medium">Alt başlık / tarih</p>
      </div>

      {/* 2. Alert band — sadece kritik durum varsa */}
      <AlertBand ... />

      {/* 3. KPI kartlar — 2-4 adet, tek satır */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard ... />
      </div>

      {/* 4. Primary content — tablo veya ana widget */}
      <PrimaryWidget />

      {/* 5. Secondary content — yan panel, grafikler */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2"><MainTable /></div>
        <div className="space-y-6">
          <SideWidget />
          <AnotherWidget />
        </div>
      </div>

    </div>
  )
}
```

---

### A.12 Dashboard Anti-Pattern Listesi

| YAPMA | YAP |
|---|---|
| Boş ekran bırak | Her state için empty state tasarla |
| Tablo satırlarını animate et | Sadece ilk render'da stagger |
| Hover'da `translateY` | Hover'da `bg-slate-50` background |
| Kart'a `:hover transform` ver | Sadece border/shadow değiştir |
| `grid-breaking` layout | Öngörülebilir 12-col grid |
| Fluid typography (`clamp`) | Sabit px type scale |
| Her sayfada farklı padding | `p-6` + `space-y-6` standart |
| Console'da `any` type | Strict TS, tip güvenli DB sorguları |
| Alert bandı sürekli göster | Sadece kritik durum varsa render et |
| Rengi inline style ile yaz | Tailwind durum sınıfları kullan |

---

## BÖLÜM B — PUBLIC STOREFRONT

> Müşteriye yönelik ürün listeleme ve detay sayfaları. Dönüşüm odaklı.

---

### B.1 Tasarım Felsefesi

- Her proje başlamadan önce net bir **estetik yön** belirle: Brutalist, Luxury, Editorial, Retro-Futuristic, Organic, Industrial vb.
- Seçtiğin yönü **her detayda** tutarlı uygula: font, renk, spacing, animasyon, ikonografi.
- **"Kasıtlı güzel"** prensibi — rastgele değil, her karar bilinçli.

---

### B.2 Tipografi (Storefront)

- **Inter, Roboto, Arial, system-ui ASLA kullanma.** Karakterli font seç.
- Display font + body font eşleştirmesi:

| Kullanım | Display | Body |
|---|---|---|
| Luxury | Playfair Display, Cormorant | Source Serif Pro, Lora |
| Modern | Syne, Outfit, Satoshi | DM Sans, Plus Jakarta Sans |
| Bold/Endüstriyel | Bebas Neue, Oswald | Space Mono, IBM Plex Mono |
| Editorial | Fraunces, Newsreader | Crimson Pro, Spectral |

- Heading'lerde `font-weight: 700-900`.
- Body minimum `16px`, ideal `18px`. Line-height body'de `1.5-1.7`.
- Fluid typography:
```css
h1 { font-size: clamp(2.5rem, 5vw + 1rem, 5rem); }
h2 { font-size: clamp(1.8rem, 3vw + 0.5rem, 3rem); }
p  { font-size: clamp(1rem, 1vw + 0.5rem, 1.125rem); }
```

---

### B.3 Renk & Tema (Storefront)

- **Mor gradient + beyaz arka plan ASLA.** AI klişesi.
- Dominant renk + keskin accent stratejisi.

```css
:root {
  --color-primary: #...;
  --color-secondary: #...;
  --color-accent: #...;
  --color-bg: #...;
  --color-surface: #...;
  --color-text-primary: #...;
  --color-text-secondary: #...;
  --color-border: #...;
  --color-success: #...;
  --color-warning: #...;
  --color-error: #...;

  /* Spacing 8px grid */
  --space-xs: 4px;   --space-sm: 8px;   --space-md: 16px;
  --space-lg: 24px;  --space-xl: 32px;  --space-2xl: 48px;
  --space-3xl: 64px; --space-4xl: 96px; --space-5xl: 128px;

  /* Border radius */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 16px;
  --radius-xl: 24px; --radius-full: 9999px;
}
```

---

### B.4 Layout (Storefront)

- Asimetri kullan. Grid-breaking elementler ekle.
- "Section-section-section" ritmi kır.
- Hero: `padding: 120-200px` üst-alt.
- Normal bölüm: `padding: 80-120px` üst-alt.

```css
.grid-asymmetric { grid-template-columns: 2fr 1fr; }
.grid-golden     { grid-template-columns: 1.618fr 1fr; }
```

---

### B.5 Animasyon (Storefront)

- Staggered reveal: her elemana `animation-delay` ver.
- Scroll-triggered: `IntersectionObserver` kullan.
- Hover'da kullanıcıyı şaşırt.

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-on-scroll {
  opacity: 0;
  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
```

---

### B.6 Sayfa Yapısı (Storefront)

1. Navbar — Logo + linkler + CTA
2. Hero — Büyük başlık + alt başlık + CTA + görsel
3. Social Proof / Logo Bar
4. Features / Benefits (3-6 özellik)
5. How It Works (3 adım)
6. Testimonials
7. Pricing (varsa)
8. FAQ (Accordion)
9. Final CTA
10. Footer

---

## BÖLÜM C — ORTAK KURALLAR (Her İki Kapsam)

---

### C.1 Renk Token Sistemi (Dark Mode)

```css
:root {
  --color-bg:           #ffffff;
  --color-surface:      #f8fafc;
  --color-text-primary: #0f172a;
  --color-border:       #e2e8f0;
}

[data-theme="dark"] {
  --color-bg:           #0f172a;
  --color-surface:      #1e293b;
  --color-text-primary: #f1f5f9;
  --color-border:       #334155;
}
```

**Şu an TekerAdmin dark mode kullanmıyor** — ama token yapısı hazır olmalı. Inline renk (hardcode) kullanırsan dark mode eklemek imkansız hale gelir.

---

### C.2 Z-index Sistemi

```
z-10  → dropdown, popover
z-20  → sticky header, table header
z-30  → overlay, backdrop
z-40  → modal, dialog, sheet
z-50  → toast, notification
z-60  → tooltip
```

---

### C.3 Form Standartları

```
Input state'leri:
- Normal:   border-slate-200
- Focus:    border-primary + ring-2 ring-primary/20
- Error:    border-red-400 + ring-2 ring-red-400/20 + hata mesajı altında
- Success:  border-emerald-400
- Disabled: opacity-50 cursor-not-allowed

Hata mesajı: input'un hemen altında, text-xs text-red-500, AlertCircle ikonu ile
```

---

### C.4 İkon Sistemi

**Kütüphane:** Lucide React
**Stroke width:** default (1.5) — değiştirme

| Boyut | Kullanım |
|---|---|
| `w-3 h-3` | Badge içi, tablo meta |
| `w-4 h-4` | Buton içi, label yanı |
| `w-5 h-5` | Section başlığı, KPI kart |
| `w-6 h-6` | Büyük aksiyon butonu |
| `w-8 h-8+` | Empty state, hata sayfası |

---

### C.5 Erişilebilirlik

- Kontrast minimum 4.5:1 (normal metin), 3:1 (büyük metin).
- Tüm görsellerde anlamlı `alt`.
- Semantik HTML: `<header>`, `<nav>`, `<main>`, `<section>`.
- Focus state görünür — `outline: none` yapıyorsan custom ekle.
- Icon-only butonlara `aria-label`.
- Keyboard nav: Tab, Enter, Escape.

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### C.6 Performans

- Görseller WebP/AVIF, fallback JPEG/PNG.
- `loading="lazy"` fold-altı görsellere.
- `font-display: swap`.
- Görsellere `width` + `height` (CLS önleme).
- Next.js'te `next/image` kullan, `<img>` kullanma.

---

### C.7 Son Kontrol Listesi

- [ ] Tüm linkler çalışıyor
- [ ] Mobil, tablet, desktop test edildi
- [ ] Lighthouse: Performance > 90, Accessibility > 90
- [ ] Tüm görsellerde alt text
- [ ] Console'da hata yok
- [ ] Animasyonlar `prefers-reduced-motion`'a saygı gösteriyor
- [ ] Form validation çalışıyor
- [ ] Input hata durumları tasarlandı
- [ ] Empty state'ler tasarlandı
- [ ] Skeleton loader'lar var (async içerik için)
- [ ] Z-index çakışması yok (modal + tooltip + toast)
- [ ] Dark mode token'ları hazır (inline hardcode yok)

---

*Bu dosya TekerAdmin (internal dashboard) ve public storefront için ayrı standartlar içerir. Dashboard kuralları Bölüm A, storefront kuralları Bölüm B, ortak kurallar Bölüm C'dedir.*

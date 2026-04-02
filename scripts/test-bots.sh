#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# TekerMarket Bot Test Suite v2.0
# 7 Scraper + 15 Importer = 22 Script
#
# Çalıştır:
#   bash scripts/test-bots.sh 2>&1 | tee scripts/output/bot-test-$(date +%Y%m%d-%H%M).txt
# ═══════════════════════════════════════════════════════════════

set -euo pipefail
REPORT_DIR="scripts/output"
mkdir -p "$REPORT_DIR"
PASS=0; FAIL=0; WARN=0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()      { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail()    { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
warn()    { echo -e "  ${YELLOW}⚠${NC} $1"; WARN=$((WARN+1)); }
info()    { echo -e "  ${BLUE}→${NC} $1"; }
section() { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }
sub()     { echo -e "  ${BOLD}$1${NC}"; }

# ═══════════════════════════════════════════════════════════════
section "BÖLÜM 1 — Dosya Varlığı (22 Script)"
# ═══════════════════════════════════════════════════════════════

sub "── Web Scrapers (7)"
SCRAPERS=(
  "scripts/scrape-emes.ts"
  "scripts/crawl-emes-catalog.ts"
  "scripts/scrape-emes-specs.ts"
  "scripts/scrape-istanbulkilit-images.ts"
  "scripts/scrape-ciftel-images.ts"
  "scripts/scrape-zet-images.ts"
  "scripts/scrape-pricing.ts"
)
for f in "${SCRAPERS[@]}"; do
  [ -f "$f" ] && ok "$f" || fail "BULUNAMADI: $f"
done

sub "── Excel Importers (15)"
IMPORTERS=(
  "scripts/import-emes.ts"
  "scripts/import-emes-images.ts"
  "scripts/import-zet.ts"
  "scripts/import-zet-images.ts"
  "scripts/import-ciftel.ts"
  "scripts/import-oskar.ts"
  "scripts/import-oskar-images.ts"
  "scripts/import-kaucuk.ts"
  "scripts/import-kaucuk-images.ts"
  "scripts/import-mertsan.ts"
  "scripts/import-mertsan-images.ts"
  "scripts/import-falo.ts"
  "scripts/import-falo-images.ts"
  "scripts/import-ticimax.ts"
  "scripts/import-all-missing.ts"
)
for f in "${IMPORTERS[@]}"; do
  [ -f "$f" ] && ok "$f" || fail "BULUNAMADI: $f"
done

sub "── Destek Dosyaları"
[ -f "scripts/watermark-logo.png" ] && ok "watermark-logo.png" \
  || warn "watermark-logo.png YOK — görsel botları watermark'sız çalışacak"
[ -f "scripts/output/checkpoint.json" ] \
  && warn "Eski checkpoint.json var — scrape-emes yarıda kalmış" \
  || ok "Temiz checkpoint (eski çalışma yok)"

EXCEL_FILE=$(find . -name "*.xlsx" -path "*/scripts/*" 2>/dev/null | head -1)
[ -n "$EXCEL_FILE" ] && ok "Excel kaynak dosyası: $EXCEL_FILE" \
  || warn "scripts/ altında .xlsx bulunamadı — importer'lar doğru path'i buluyor mu?"

# ═══════════════════════════════════════════════════════════════
section "BÖLÜM 2 — Bağımlılıklar"
# ═══════════════════════════════════════════════════════════════

DEPS=("axios" "cheerio" "sharp" "dotenv" "@supabase/supabase-js" "xlsx" "ts-node")
for dep in "${DEPS[@]}"; do
  [ -d "node_modules/$dep" ] || [ -d "node_modules/.pnpm/${dep}"* ] \
    && ok "$dep" || fail "EKSİK: npm install $dep"
done

[ -f "tsconfig.json" ] && ok "tsconfig.json" || warn "tsconfig.json yok"

# ═══════════════════════════════════════════════════════════════
section "BÖLÜM 3 — Environment Variables"
# ═══════════════════════════════════════════════════════════════

[ -f ".env.local" ] && ok ".env.local mevcut" || { fail ".env.local YOK"; exit 1; }

check_env() {
  grep -q "$1" .env.local && ok "$1 tanımlı" || fail "$1 EKSİK"
}
check_env "NEXT_PUBLIC_SUPABASE_URL"
check_env "SUPABASE_SERVICE_ROLE_KEY"
check_env "NEXT_PUBLIC_SUPABASE_ANON_KEY"

# ═══════════════════════════════════════════════════════════════
section "BÖLÜM 4 — Kod Kalitesi Analizi (Tüm Scriptler)"
# ═══════════════════════════════════════════════════════════════

sub "── dry-run flag desteği"
MISSING_DRYRUN=()
for f in "${SCRAPERS[@]}" "${IMPORTERS[@]}"; do
  [ -f "$f" ] || continue
  grep -q "dry.run\|DRY_RUN\|dry-run" "$f" \
    || MISSING_DRYRUN+=("$(basename $f)")
done
[ ${#MISSING_DRYRUN[@]} -eq 0 ] \
  && ok "Tüm scriptlerde --dry-run var" \
  || warn "--dry-run EKSİK: ${MISSING_DRYRUN[*]}"

sub "── --limit=N flag desteği"
MISSING_LIMIT=()
for f in "${SCRAPERS[@]}" "${IMPORTERS[@]}"; do
  [ -f "$f" ] || continue
  grep -q "limit\|LIMIT" "$f" \
    || MISSING_LIMIT+=("$(basename $f)")
done
[ ${#MISSING_LIMIT[@]} -eq 0 ] \
  && ok "Tüm scriptlerde --limit var" \
  || warn "--limit EKSİK: ${MISSING_LIMIT[*]}"

sub "── Checkpoint sistemi (scraper'lar)"
for f in "${SCRAPERS[@]}"; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  grep -q "checkpoint\|Checkpoint" "$f" \
    && ok "$name: checkpoint var" \
    || warn "$name: checkpoint YOK — kesintide sıfırdan başlar"
done

sub "── Retry mekanizması (scraper'lar)"
for f in "${SCRAPERS[@]}"; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  grep -q "retry\|Retry\|maxRetries" "$f" \
    && ok "$name: retry var" \
    || warn "$name: retry YOK"
done

sub "── SSL güvenlik (rejectUnauthorized)"
for f in "${SCRAPERS[@]}"; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  grep -q "rejectUnauthorized: false" "$f" \
    && warn "$name: rejectUnauthorized:false — production'da güvensiz" \
    || ok "$name: SSL güvenli"
done

sub "── Race condition riski (Promise.all + shared state)"
for f in "${SCRAPERS[@]}" "${IMPORTERS[@]}"; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  PA=$(grep -c "Promise.all" "$f" 2>/dev/null || true)
  ST=$(grep -c "stat\." "$f" 2>/dev/null || true)
  PA=${PA//[$'\n\r']/}; ST=${ST//[$'\n\r']/}
  if [ "${PA:-0}" -gt 0 ] && [ "${ST:-0}" -gt 4 ]; then
    warn "$name: Promise.all + shared stat (race condition riski)"
  fi
done

sub "── Supabase credentials guard (process.exit kontrolü)"
MISSING_GUARD=()
for f in "${SCRAPERS[@]}" "${IMPORTERS[@]}"; do
  [ -f "$f" ] || continue
  grep -q "process.exit\|credentials\|SERVICE_ROLE" "$f" \
    || MISSING_GUARD+=("$(basename $f)")
done
[ ${#MISSING_GUARD[@]} -eq 0 ] \
  && ok "Tüm scriptlerde credentials guard var" \
  || warn "Credentials guard EKSİK: ${MISSING_GUARD[*]}"

sub "── Fiyat stratejisi hardcoded mi? (pricing bot)"
[ -f "scripts/scrape-pricing.ts" ] && \
  grep -q "0\.98\|0\.95" scripts/scrape-pricing.ts \
    && warn "scrape-pricing: fiyat oranları hardcoded (0.98/0.95) — config'e taşı" \
    || ok "scrape-pricing: fiyat stratejisi parametrik"

# ═══════════════════════════════════════════════════════════════
section "BÖLÜM 5 — Site Bağlantı Testleri (10 Kaynak Site)"
# ═══════════════════════════════════════════════════════════════

SITE_OUT=$(node << 'NODE_EOF'
const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
const http  = axios.create({
  httpsAgent: agent, timeout: 12000,
  headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124' }
});

const sites = [
  { tag: 'SCRAPER', name: 'emesteker.com (EMES katalog)', url: 'https://emesteker.com/tr/tekerler.html' },
  { tag: 'SCRAPER', name: 'e-tekerlek.com (rakip fiyat)', url: 'https://www.e-tekerlek.com/arama?q=EA01' },
  { tag: 'SCRAPER', name: 'ciftel.com.tr (görsel)', url: 'https://ciftel.com.tr/shop/' },
  { tag: 'SCRAPER', name: 'zet-teker.com (görsel)', url: 'https://zet-teker.com/tr/urunler' },
  { tag: 'SCRAPER', name: 'istanbulkilit.com (OSKAR)', url: 'https://www.istanbulkilit.com' },
  { tag: 'IMPORT',  name: 'falometal.com (FALO görseli)', url: 'http://falometal.com/urunlerimiz/wheel-group' },
  { tag: 'IMPORT',  name: 'mertsanteker.com (MERTSAN görseli)', url: 'https://www.mertsanteker.com' },
  { tag: 'IMPORT',  name: 'cifteltakoz.com (KAUÇUK görseli)', url: 'https://www.cifteltakoz.com' },
  { tag: 'IMPORT',  name: 'tekermarket.com.tr (kendi site)', url: 'https://www.tekermarket.com.tr' },
  { tag: 'IMPORT',  name: 'oskar.biz.tr (OSKAR ürün)', url: 'https://www.oscar.biz.tr' },
];

const results = sites.map(s =>
  http.get(s.url, { validateStatus: () => true })
    .then(r => ({
      ...s,
      status: r.status,
      size: (r.data || '').length,
      ok: r.status === 200 && (r.data || '').length > 3000
    }))
    .catch(e => ({ ...s, status: 0, size: 0, ok: false, err: e.message.slice(0,60) }))
);

Promise.all(results).then(all => {
  all.forEach(r => {
    const tag  = r.ok ? 'OK' : (r.status > 0 ? 'WARN' : 'FAIL');
    const note = r.err ? r.err : `HTTP ${r.status} / ${(r.size/1000).toFixed(0)}KB`;
    console.log(`${tag}|${r.tag}|${r.name}|${note}`);
  });
});
NODE_EOF
)

echo "$SITE_OUT" | while IFS='|' read -r status category name note; do
  [ -z "$status" ] && continue
  case "$status" in
    OK)   echo -e "  ${GREEN}✓${NC} [$category] $name → $note" ;;
    WARN) echo -e "  ${YELLOW}⚠${NC} [$category] $name → $note" ;;
    FAIL) echo -e "  ${RED}✗${NC} [$category] $name → BAĞLANAMADI: $note" ;;
  esac
done

# ═══════════════════════════════════════════════════════════════
section "BÖLÜM 6 — DB Snapshot (Tedarikçi Bazlı)"
# ═══════════════════════════════════════════════════════════════

DB_OUT=$(node << 'NODE_EOF'
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUPPLIERS = [
  'emes_2026', 'yedek_emes_2026', 'emes_kulp_2026',
  'zet_2026', 'ciftel_2026', 'oskar_2026',
  'kaucuk_takoz_2026', 'falo_2026', 'mertsan_2026'
];

const queries = SUPPLIERS.map(source =>
  Promise.all([
    sb.from('products').select('id', { count: 'exact', head: true })
      .eq('status', 'active').is('deleted_at', null)
      .eq('meta->>source', source)
      .then(({ count }) => count || 0),
    sb.from('products').select('id', { count: 'exact', head: true })
      .eq('status', 'active').is('deleted_at', null)
      .eq('meta->>source', source).not('image_url', 'is', null)
      .then(({ count }) => count || 0),
    sb.from('products').select('id', { count: 'exact', head: true })
      .eq('status', 'active').is('deleted_at', null)
      .eq('meta->>source', source).not('sale_price', 'is', null)
      .then(({ count }) => count || 0),
  ]).then(([total, withImg, withPrice]) => {
    const imgPct   = total > 0 ? Math.round(withImg   / total * 100) : 0;
    const pricePct = total > 0 ? Math.round(withPrice / total * 100) : 0;
    console.log(`${source}|${total}|${withImg}|${imgPct}|${withPrice}|${pricePct}`);
  })
);

Promise.all(queries).catch(e => console.error('DB_ERR:', e.message));
NODE_EOF
)

echo ""
printf "  %-22s %6s %6s %5s %6s %5s\n" "TEDARİKÇİ" "TOPLAM" "GÖRSELLİ" "%" "FİYATLI" "%"
printf "  %-22s %6s %6s %5s %6s %5s\n" "──────────────────────" "──────" "────────" "──" "───────" "──"
echo "$DB_OUT" | while IFS='|' read -r source total withImg imgPct withPrice pricePct; do
  [ -z "$source" ] && continue
  label=$(echo "$source" | sed 's/_2026//' | tr '[:lower:]' '[:upper:]')
  printf "  %-22s %6s %6s %4s%% %6s %4s%%\n" \
    "$label" "$total" "$withImg" "$imgPct" "$withPrice" "$pricePct"
  [ "$total" -eq 0 ] 2>/dev/null && echo -e "  ${RED}✗${NC} $label: DB'de ürün YOK — import çalıştırılmamış" && FAIL=$((FAIL+1)) || true
  [ "$imgPct" -lt 30 ] 2>/dev/null && [ "$total" -gt 0 ] 2>/dev/null && \
    echo -e "  ${YELLOW}⚠${NC} $label: Görsel oranı düşük (%$imgPct)" && WARN=$((WARN+1)) || true
  [ "$pricePct" -lt 50 ] 2>/dev/null && [ "$total" -gt 0 ] 2>/dev/null && \
    echo -e "  ${YELLOW}⚠${NC} $label: Fiyat doluluk oranı düşük (%$pricePct)" && WARN=$((WARN+1)) || true
done

echo ""
EXTRA_OUT=$(node << 'NODE_EOF'
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
Promise.all([
  sb.from('stock_movements').select('id',{count:'exact',head:true})
    .then(({count}) => console.log('MOV|stock_movements kayıt sayısı|' + count)),
  sb.from('price_history').select('id',{count:'exact',head:true})
    .then(({count}) => console.log('PH|price_history kayıt sayısı|' + count)),
  sb.from('price_history').select('created_at').order('created_at',{ascending:false}).limit(1)
    .then(({data}) => console.log('LAST|Son fiyat güncellemesi|' + (data?.[0]?.created_at?.slice(0,10) || 'HİÇ'))),
  sb.from('products').select('id',{count:'exact',head:true})
    .not('competitor_price','is',null)
    .then(({count}) => console.log('COMP|Rakip fiyatı olan ürün|' + count)),
]).catch(e => console.log('ERR|DB hatası|' + e.message));
NODE_EOF
)
echo "$EXTRA_OUT" | while IFS='|' read -r key label val; do
  [ -z "$key" ] && continue
  echo -e "  ${BLUE}→${NC} $label: $val"
done

# ═══════════════════════════════════════════════════════════════
section "BÖLÜM 7 — Dry-Run Smoke Tests (Öncelikli 4 Script)"
# ═══════════════════════════════════════════════════════════════

sub "── 1/4  scrape-pricing.ts (--dry-run --limit=5)"
if [ -f "scripts/scrape-pricing.ts" ]; then
  OUT=$(npx tsx scripts/scrape-pricing.ts --dry-run --limit=5 2>&1 || true)
  echo "$OUT" > "$REPORT_DIR/pricing-dryrun.log"
  echo "$OUT" | grep -q "DRY\|dry"        && ok  "Bot başladı ve dry-run modunda çalıştı" || fail "Bot başlatılamadı"
  echo "$OUT" | grep -q "client=₺"        && ok  "Kendi site fiyatı alındı (tekermarket)" || warn "Kendi site fiyatı alınamadı"
  echo "$OUT" | grep -q "comp=₺"          && ok  "Rakip fiyat alındı (e-tekerlek)" || warn "Rakip fiyat 0 — e-tekerlek seçicisi değişmiş olabilir"
  echo "$OUT" | grep -q "tier1\|tier2"    && ok  "Tier matching çalışıyor"   || warn "Tier log görünmüyor"
  echo "$OUT" | grep -q "FATAL\|process.exit" && fail "Bot fatal hata verdi" || true
  T1=$(echo "$OUT" | grep -c "matchType.*tier1" 2>/dev/null || echo 0)
  T2=$(echo "$OUT" | grep -c "matchType.*tier2" 2>/dev/null || echo 0)
  info "5 üründen: Tier1=$T1 eşleşme, Tier2=$T2 eşleşme"
  info "Tam log: $REPORT_DIR/pricing-dryrun.log"
else
  warn "scrape-pricing.ts bulunamadı, atlandı"
fi

sub "── 2/4  scrape-ciftel-images.ts (--dry-run --limit=5)"
if [ -f "scripts/scrape-ciftel-images.ts" ]; then
  OUT=$(timeout 60 npx tsx scripts/scrape-ciftel-images.ts --dry-run --limit=5 2>&1 || true)
  echo "$OUT" > "$REPORT_DIR/ciftel-dryrun.log"
  echo "$OUT" | grep -q "CIFTEL\|ciftel\|Shop\|shop" && ok "Bot başladı, shop taranıyor" || fail "Bot başlatılamadı"
  PAGES=$(echo "$OUT" | grep -oP "Sayfa \K\d+" 2>/dev/null | tail -1)
  [ -n "$PAGES" ] && info "Son taranan sayfa: $PAGES" || warn "Sayfa tarama logu yok"
  MATCH=$(echo "$OUT" | grep -c "DRY.*→\|dry.*→" 2>/dev/null || echo 0)
  info "DB eşleşme (dry): $MATCH ürün"
  info "Tam log: $REPORT_DIR/ciftel-dryrun.log"
else
  warn "scrape-ciftel-images.ts bulunamadı, atlandı"
fi

sub "── 3/4  scrape-zet-images.ts (--dry-run --limit=5)"
if [ -f "scripts/scrape-zet-images.ts" ]; then
  OUT=$(timeout 90 npx tsx scripts/scrape-zet-images.ts --dry-run --limit=5 2>&1 || true)
  echo "$OUT" > "$REPORT_DIR/zet-dryrun.log"
  echo "$OUT" | grep -q "ZET\|zet\|teker\|urun"   && ok "Bot başladı" || fail "Bot başlatılamadı"
  echo "$OUT" | grep -qi "playwright\|puppeteer"    && warn "Playwright/Puppeteer kullanıyor — headless browser gerekli" || ok "Axios/Cheerio (headless gerekmez)"
  echo "$OUT" | grep -qi "javascript\|js render\|empty" && warn "JS render sorunu — sayfa içeriği boş gelebilir" || true
  MATCH=$(echo "$OUT" | grep -c "DRY\|dry.*→\|eşleş" 2>/dev/null || echo 0)
  info "DB eşleşme (dry): $MATCH ürün"
  info "Tam log: $REPORT_DIR/zet-dryrun.log"
else
  warn "scrape-zet-images.ts bulunamadı, atlandı"
fi

sub "── 4/4  import-all-missing.ts (--dry-run --limit=10)"
if [ -f "scripts/import-all-missing.ts" ]; then
  OUT=$(timeout 60 npx tsx scripts/import-all-missing.ts --dry-run --limit=10 2>&1 || true)
  echo "$OUT" > "$REPORT_DIR/import-all-dryrun.log"
  echo "$OUT" | grep -q "DRY\|dry\|import\|sheet" && ok "Master import başladı" || fail "Master import başlatılamadı"
  SHEETS=$(echo "$OUT" | grep -oiP "(EMES|ZET|CIFTEL|OSKAR|FALO|MERTSAN|KAUCUK)" 2>/dev/null | sort -u | tr '\n' ' ')
  [ -n "$SHEETS" ] && info "İşlenen tedarikçiler: $SHEETS" || warn "Tedarikçi logu görünmüyor"
  info "Tam log: $REPORT_DIR/import-all-dryrun.log"
else
  warn "import-all-missing.ts bulunamadı, atlandı"
fi

# ═══════════════════════════════════════════════════════════════
section "BÖLÜM 8 — Excel Kaynak Dosyası Kontrolü"
# ═══════════════════════════════════════════════════════════════

EXCEL_OUT=$(node << 'NODE_EOF'
const XLSX = require('xlsx');
const path = require('path');
const fs   = require('fs');

const candidates = [
  'scripts/2026_BUTUN_LISTELER.xlsx',
  'data/2026_BUTUN_LISTELER.xlsx',
  '2026_BUTUN_LISTELER.xlsx',
];

let wb = null;
let found = '';
for (const c of candidates) {
  if (fs.existsSync(c)) { wb = XLSX.readFile(c); found = c; break; }
}

if (!wb) {
  console.log('FAIL|Excel dosyası bulunamadı — importer\'lar çalışamaz');
  process.exit(0);
}

console.log('OK|Excel dosyası: ' + found);

const EXPECTED_SHEETS = ['EMES 2026', 'ZET', 'ÇİFTEL2026', 'OSKAR2026',
                         'KAUÇUK TAKOZ', 'FALO MAKARA 2026', 'MERTSAN 2026'];
const actual = wb.SheetNames;

EXPECTED_SHEETS.forEach(s => {
  const found = actual.find(a => a.trim().toLowerCase() === s.trim().toLowerCase());
  if (found) {
    const sheet = wb.Sheets[found];
    const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log('OK|Sheet "' + s + '": ' + rows.length + ' satır');
  } else {
    console.log('WARN|Sheet "' + s + '" bulunamadı. Mevcut: ' + actual.join(', '));
  }
});
NODE_EOF
)
echo "$EXCEL_OUT" | while IFS='|' read -r status msg; do
  [ -z "$status" ] && continue
  case "$status" in
    OK)   echo -e "  ${GREEN}✓${NC} $msg" ;;
    WARN) echo -e "  ${YELLOW}⚠${NC} $msg" ;;
    FAIL) echo -e "  ${RED}✗${NC} $msg" ;;
  esac
done

# ═══════════════════════════════════════════════════════════════
section "ÖZET RAPOR"
# ═══════════════════════════════════════════════════════════════

TOTAL=$((PASS + FAIL + WARN))
echo ""
printf "  ${GREEN}Geçti: %-4s${NC} | ${RED}Hata: %-4s${NC} | ${YELLOW}Uyarı: %-4s${NC} | Toplam: %s\n" \
  "$PASS" "$FAIL" "$WARN" "$TOTAL"
echo ""

SCORE=$(echo "scale=0; $PASS * 100 / $TOTAL" | bc 2>/dev/null || echo "?")
echo -e "  Sistem Sağlık Skoru: ${BOLD}%$SCORE${NC}"
echo ""

if   [ "$FAIL" -eq 0 ] && [ "$WARN" -le 3 ]; then
  echo -e "  ${GREEN}${BOLD}Production'a hazır.${NC}"
elif [ "$FAIL" -eq 0 ]; then
  echo -e "  ${YELLOW}${BOLD}Uyarılar var — incelenebilir durumda ama dikkat.${NC}"
elif [ "$FAIL" -le 5 ]; then
  echo -e "  ${YELLOW}${BOLD}Bazı kritik sorunlar var — önce bunları düzelt.${NC}"
else
  echo -e "  ${RED}${BOLD}Ciddi altyapı sorunları — botlar çalışmıyor olabilir.${NC}"
fi

echo ""
echo "  Detaylı loglar: $REPORT_DIR/"
ls "$REPORT_DIR"/*.log 2>/dev/null | xargs -I{} echo "  → {}"

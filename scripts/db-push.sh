#!/bin/bash
# Supabase migration push — Docker gerektirmez
# Kullanım: bash scripts/db-push.sh
# Yeni migration için: bash scripts/db-push.sh --new "açıklama"

set -e

# .env.local'dan SUPABASE_DB_URL oku
ENV_FILE="$(dirname "$0")/../.env.local"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep "SUPABASE_DB_URL" | xargs)
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ SUPABASE_DB_URL bulunamadı. .env.local dosyasını kontrol et."
  exit 1
fi

SUPABASE="$HOME/bin/supabase"
MIGRATIONS_DIR="supabase/migrations"

# Yeni migration oluştur
if [ "$1" = "--new" ] && [ -n "$2" ]; then
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  SLUG=$(echo "$2" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
  FILE="$MIGRATIONS_DIR/${TIMESTAMP}_${SLUG}.sql"
  touch "$FILE"
  echo "✅ Yeni migration oluşturuldu: $FILE"
  echo "SQL'i dosyaya yaz, sonra tekrar çalıştır: bash scripts/db-push.sh"
  exit 0
fi

echo "📋 Migration durumu kontrol ediliyor..."
$SUPABASE migration list --db-url "$SUPABASE_DB_URL"

echo ""
echo "🚀 Push ediliyor..."
$SUPABASE db push --db-url "$SUPABASE_DB_URL"

echo ""
echo "✅ Tamamlandı."

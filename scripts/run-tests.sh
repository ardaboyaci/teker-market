#!/bin/zsh
source ~/.zshrc

echo "=== ZET IMPORT ===" > scripts/output.log
npx tsx scripts/import-zet.ts --dry-run >> scripts/output.log 2>&1

echo -e "\n=== FALO IMPORT ===" >> scripts/output.log
npx tsx scripts/import-falo.ts --dry-run >> scripts/output.log 2>&1

echo -e "\n=== OSKAR IMAGES ===" >> scripts/output.log
npx tsx scripts/import-oskar-images.ts --dry-run --limit=10 >> scripts/output.log 2>&1

echo -e "\n=== FALO IMAGES ===" >> scripts/output.log
npx tsx scripts/import-falo-images.ts --dry-run --limit=10 >> scripts/output.log 2>&1

echo -e "\n=== PRICING BOT ===" >> scripts/output.log
npx tsx scripts/scrape-pricing.ts --dry-run --limit=20 >> scripts/output.log 2>&1

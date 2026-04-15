# ============================================================================
# TEKER MARKET — Dockerfile
# Next.js 15 | Node 20 Alpine | Multi-stage build
# ============================================================================

# ── Stage 1: Bağımlılık kurulumu ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Bağımlılık dosyalarını kopyala
COPY package.json package-lock.json ./

# Üretim bağımlılıklarını kur
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Bağımlılıkları önceki aşamadan al
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build sırasında gereksiz harici istekleri devre dışı bırak
ENV NEXT_TELEMETRY_DISABLED=1
ENV SENTRY_SKIP_AUTO_RELEASE=true
# Docker build'de Supabase yerine MySQL kullanılır
ENV NEXT_PUBLIC_SUPABASE_URL=http://placeholder
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder

RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Güvenlik: root olmayan kullanıcı
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Üretim için yalnızca gerekli dosyaları kopyala
COPY --from=builder /app/public        ./public
COPY --from=builder /app/.next         ./.next
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/package.json  ./package.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]

import { NextRequest } from "next/server";

type RateLimitOptions = {
    limit: number;
    windowMs: number;
    keyPrefix?: string;
};

export type RateLimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfter: number;
};

// ─── In-process store (best-effort, serverless'ta cold-start'ta sıfırlanır) ───
// Production'da Upstash Redis ile değiştirilmeli:
//   @upstash/redis + @upstash/ratelimit paketi, UPSTASH_REDIS_REST_URL env gerekir
// Şu an: tek instance / dev ortamı için yeterli.
declare global {
    // eslint-disable-next-line no-var
    var __tekerRateLimitStore: Map<string, { count: number; resetAt: number }> | undefined;
}

const store =
    globalThis.__tekerRateLimitStore ??
    new Map<string, { count: number; resetAt: number }>();

if (!globalThis.__tekerRateLimitStore) {
    globalThis.__tekerRateLimitStore = store;
}

function cleanup(now: number) {
    if (store.size < 5000) return;
    for (const [key, val] of store.entries()) {
        if (val.resetAt <= now) store.delete(key);
    }
}

export function getClientIp(request: NextRequest): string {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip")?.trim() ||
        request.headers.get("cf-connecting-ip")?.trim() ||
        "127.0.0.1"
    );
}

export function consumeRateLimit(
    request: NextRequest,
    options: RateLimitOptions
): RateLimitResult {
    const now = Date.now();
    cleanup(now);

    const ip  = getClientIp(request);
    const key = `${options.keyPrefix ?? "global"}:${ip}`;
    const cur = store.get(key);

    if (!cur || cur.resetAt <= now) {
        const resetAt = now + options.windowMs;
        store.set(key, { count: 1, resetAt });
        return {
            success: true,
            limit: options.limit,
            remaining: Math.max(options.limit - 1, 0),
            resetAt,
            retryAfter: Math.ceil(options.windowMs / 1000),
        };
    }

    cur.count += 1;
    const remaining = Math.max(options.limit - cur.count, 0);
    const retryAfter = Math.max(1, Math.ceil((cur.resetAt - now) / 1000));

    return {
        success: cur.count <= options.limit,
        limit: options.limit,
        remaining,
        resetAt: cur.resetAt,
        retryAfter,
    };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
        "X-RateLimit-Limit":     String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset":     String(Math.ceil(result.resetAt / 1000)),
        "Retry-After":           String(result.retryAfter),
    };
}

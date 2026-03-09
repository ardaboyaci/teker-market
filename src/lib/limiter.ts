import { NextRequest } from "next/server";

type RateLimitOptions = {
    limit: number;
    windowMs: number;
    keyPrefix?: string;
};

type RateLimitEntry = {
    count: number;
    resetAt: number;
};

export type RateLimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfter: number;
};

declare global {
    // eslint-disable-next-line no-var
    var __tekerRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const rateLimitStore =
    globalThis.__tekerRateLimitStore ?? new Map<string, RateLimitEntry>();

if (!globalThis.__tekerRateLimitStore) {
    globalThis.__tekerRateLimitStore = rateLimitStore;
}

function cleanupExpiredEntries(now: number) {
    if (rateLimitStore.size < 5000) return;

    for (const [key, value] of rateLimitStore.entries()) {
        if (value.resetAt <= now) {
            rateLimitStore.delete(key);
        }
    }
}

export function getClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || "127.0.0.1";
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
    if (vercelForwardedFor) return vercelForwardedFor.trim();

    const cloudflareIp = request.headers.get("cf-connecting-ip");
    if (cloudflareIp) return cloudflareIp.trim();

    return "127.0.0.1";
}

export function consumeRateLimit(
    request: NextRequest,
    options: RateLimitOptions
): RateLimitResult {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const ip = getClientIp(request);
    const key = `${options.keyPrefix ?? "global"}:${ip}`;
    const current = rateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
        const resetAt = now + options.windowMs;
        rateLimitStore.set(key, { count: 1, resetAt });

        return {
            success: true,
            limit: options.limit,
            remaining: Math.max(options.limit - 1, 0),
            resetAt,
            retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        };
    }

    current.count += 1;
    rateLimitStore.set(key, current);

    const remaining = Math.max(options.limit - current.count, 0);
    const success = current.count <= options.limit;
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

    return {
        success,
        limit: options.limit,
        remaining,
        resetAt: current.resetAt,
        retryAfter,
    };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        "Retry-After": String(result.retryAfter),
    };
}

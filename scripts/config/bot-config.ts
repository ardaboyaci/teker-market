/**
 * Bot Configuration — Merkezi Ayarlar
 * Tüm botlar bu dosyadan ortak ayarları okur.
 */

export const BOT_CONFIG = {
    http: {
        timeout:       30_000,
        maxRetries:    3,
        retryDelayMs:  800,
        chunkSize:     10,
        delayMs:       350,
        maxConcurrent: 3,
    },
    image: {
        quality:      85,
        maxWidthPx:   800,
        wmMaxWidthPx: 120,  // image-pipeline.ts ile tutarlı (max 120px, %15 genişlik)
    },
    pricing: {
        undercutRatio:  0.98,   // Rakipten ucuzsa -2%
        fallbackRatio:  0.95,   // Sadece rakipte varsa -5%
        minMatchScore:  0.25,   // Fuzzy eşleşme eşiği (0.25 — Playwright'a geçişle daha güvenilir)
        delayBetweenMs: 250,
    },
    ciftel: {
        pageDelayMs:   400,
        itemDelayMs:   150,
        errorDelayMs:  300,
    },
} as const;

/**
 * Shared fetchWithRetry — exponential backoff
 * Tüm botlar bu helper'ı kullanmalı.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    opts?: { retries?: number; delayMs?: number; label?: string }
): Promise<T> {
    const retries = opts?.retries ?? BOT_CONFIG.http.maxRetries;
    const delay   = opts?.delayMs  ?? BOT_CONFIG.http.retryDelayMs;
    const label   = opts?.label    ?? 'request';

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (attempt === retries) throw err;
            const wait = delay * attempt;
            console.warn(`\n  [Retry ${attempt}/${retries}] ${label}: ${msg} — ${wait}ms bekleniyor`);
            await new Promise(r => setTimeout(r, wait));
        }
    }
    throw new Error('unreachable');
}

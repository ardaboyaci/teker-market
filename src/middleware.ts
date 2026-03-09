import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, getRateLimitHeaders } from "@/lib/limiter";
import { updateSession } from "@/lib/supabase/middleware";

function toPositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

const API_RATE_LIMIT = {
    limit: toPositiveInt(process.env.API_RATE_LIMIT_MAX, 120),
    windowMs: toPositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60000),
} as const;

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    let rateLimitResult: ReturnType<typeof consumeRateLimit> | null = null;

    if (pathname.startsWith("/api/")) {
        rateLimitResult = consumeRateLimit(request, {
            keyPrefix: "api",
            ...API_RATE_LIMIT,
        });

        if (!rateLimitResult.success) {
            return NextResponse.json(
                {
                    error: "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.",
                },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult),
                }
            );
        }
    }

    // Supabase Auth oturum yönetimini güncelle
    const response = await updateSession(request);

    if (rateLimitResult) {
        const headers = getRateLimitHeaders(rateLimitResult);
        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined) {
                response.headers.set(key, value);
            }
        });
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};

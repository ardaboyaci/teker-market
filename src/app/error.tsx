"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Home, RefreshCcw, TriangleAlert } from "lucide-react";

type ErrorPageProps = {
    error: Error & { digest?: string };
    reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
    useEffect(() => {
        console.error("Global route error:", error);
    }, [error]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6 py-16">
            <div className="w-full max-w-xl rounded-3xl border border-slate-200/70 bg-white p-10 shadow-xl shadow-slate-200/40">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <TriangleAlert className="h-7 w-7" />
                </div>

                <p className="mb-2 text-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Beklenmeyen Hata
                </p>
                <h1 className="text-center text-3xl font-extrabold tracking-tight text-slate-900">
                    Bir seyler ters gitti
                </h1>
                <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">
                    Islem tamamlanirken bir hata olustu. Tekrar deneyebilir veya ana sayfaya donebilirsiniz.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Tekrar dene
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <Home className="h-4 w-4" />
                        Ana sayfaya don
                    </Link>
                </div>

                {error.digest && (
                    <p className="mt-6 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
                        Hata referansi: {error.digest}
                    </p>
                )}
            </div>
        </main>
    );
}

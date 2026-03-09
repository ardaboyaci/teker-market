export default function Loading() {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="min-h-screen bg-slate-50/60"
        >
            <div className="h-8 border-b border-slate-200/70 bg-slate-200/70 animate-pulse" />

            <header className="h-16 border-b border-slate-200/70 bg-white">
                <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between px-4 sm:px-6">
                    <div className="h-7 w-44 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-10 w-52 rounded-xl bg-slate-200 animate-pulse sm:w-80" />
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-[1600px] gap-8 px-4 py-8 sm:px-6">
                <aside className="hidden w-64 flex-shrink-0 space-y-4 lg:block">
                    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                        <div className="mb-4 h-5 w-28 rounded bg-slate-200 animate-pulse" />
                        <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, index) => (
                                <div
                                    key={`sidebar-item-${index}`}
                                    className="h-9 rounded-lg bg-slate-100 animate-pulse"
                                />
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                        <div className="mb-4 h-5 w-20 rounded bg-slate-200 animate-pulse" />
                        <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div
                                    key={`filter-item-${index}`}
                                    className="h-8 rounded-lg bg-slate-100 animate-pulse"
                                />
                            ))}
                        </div>
                    </div>
                </aside>

                <section className="min-w-0 flex-1">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="h-10 w-64 rounded-xl bg-slate-200 animate-pulse" />
                        <div className="h-10 w-32 rounded-xl bg-slate-200 animate-pulse" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div
                                key={`card-${index}`}
                                className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"
                            >
                                <div className="mb-4 aspect-[4/3] rounded-xl bg-slate-100 animate-pulse" />
                                <div className="mb-2 h-3 w-20 rounded bg-slate-200 animate-pulse" />
                                <div className="mb-2 h-4 w-full rounded bg-slate-200 animate-pulse" />
                                <div className="mb-4 h-4 w-2/3 rounded bg-slate-200 animate-pulse" />
                                <div className="h-6 w-28 rounded bg-slate-200 animate-pulse" />
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            <span className="sr-only">Sayfa yukleniyor...</span>
        </div>
    );
}

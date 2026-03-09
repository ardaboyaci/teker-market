'use client';

interface SortSelectProps {
    sortParam?: string;
    activeCategorySlug?: string;
    searchQuery?: string;
}

export default function SortSelect({ sortParam, activeCategorySlug, searchQuery }: SortSelectProps) {
    return (
        <form action="/" method="GET" className="min-w-0">
            {activeCategorySlug && <input type="hidden" name="category" value={activeCategorySlug} />}
            {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
            <select
                name="sort"
                defaultValue={sortParam || ''}
                onChange={(e) => (e.target.form as HTMLFormElement)?.submit()}
                className="text-sm border border-slate-200 rounded-lg bg-white px-3 py-2 font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 cursor-pointer outline-none"
            >
                <option value="">En Yeniler</option>
                <option value="price_asc">Fiyat: Düşükten Yükseğe</option>
                <option value="price_desc">Fiyat: Yüksekten Düşüğe</option>
                <option value="name_asc">İsim: A → Z</option>
                <option value="name_desc">İsim: Z → A</option>
            </select>
        </form>
    );
}

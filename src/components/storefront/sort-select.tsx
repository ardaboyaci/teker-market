"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function SortSelect() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sortParam = searchParams.get("sort") || "";

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        if (val) {
            params.set("sort", val);
        } else {
            params.delete("sort");
        }
        router.push(`/?${params.toString()}`);
    };

    return (
        <select
            name="sort"
            value={sortParam}
            onChange={handleChange}
            className="text-sm border border-slate-200 rounded-lg bg-white px-3 py-2 font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 cursor-pointer outline-none"
        >
            <option value="">En Yeniler</option>
            <option value="price_asc">Fiyat: Düşükten Yükseğe</option>
            <option value="price_desc">Fiyat: Yüksekten Düşüğe</option>
            <option value="name_asc">İsim: A → Z</option>
            <option value="name_desc">İsim: Z → A</option>
        </select>
    );
}

// Docker MySQL versiyonu — Tarayıcı tarafı Supabase client devre dışı.
// Auth, Docker versiyonunda kullanılmamaktadır.
export function createBrowserClient() {
    throw new Error(
        'Supabase browser client Docker versiyonunda kullanılamaz. MySQL bağlantısı için src/lib/db/pool.ts kullanın.'
    )
}

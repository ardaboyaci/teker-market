// Docker MySQL versiyonu — Supabase server client yerine MySQL2 pool kullanılır.
// Bu dosya docker-mysql branch'inde Supabase bağlantısını devre dışı bırakır.
import pool from '@/lib/db/pool'

export async function createServerClient() {
    return pool
}

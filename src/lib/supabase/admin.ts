// Docker MySQL versiyonu — Supabase admin client yerine MySQL2 pool kullanılır.
// Bu dosya docker-mysql branch'inde Supabase bağlantısını devre dışı bırakır.
import pool from '@/lib/db/pool'

export function createAdminClient() {
    return pool
}

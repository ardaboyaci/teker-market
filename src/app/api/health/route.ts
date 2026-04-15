import { NextResponse } from 'next/server'
import pool from '@/lib/db/pool'

export async function GET() {
    try {
        // MySQL bağlantısını test et
        await pool.query('SELECT 1')
        return NextResponse.json({ ok: true, db: 'mysql', status: 'healthy' })
    } catch {
        return NextResponse.json(
            { ok: false, db: 'mysql', status: 'unhealthy' },
            { status: 503 }
        )
    }
}

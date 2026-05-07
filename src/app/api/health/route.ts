import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
    try {
        const supabase = createAdminClient()
        const { error } = await supabase.from('products').select('id').limit(1)
        if (error) throw error
        return NextResponse.json({ ok: true, db: 'supabase', status: 'healthy' })
    } catch {
        return NextResponse.json({ ok: false, db: 'supabase', status: 'unhealthy' }, { status: 503 })
    }
}
// Docker MySQL versiyonu — Supabase auth oturum yönetimi devre dışı.
// Docker ortamında dashboard koruması yoktur (iç ağ koruması yeterlidir).
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    // Docker versiyonunda / → /dashboard/products yönlendirmesi korunur
    if (request.nextUrl.pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/products'
        return NextResponse.redirect(url)
    }

    // Auth kontrolü yok — Docker ortamı iç ağda çalışır
    return NextResponse.next({ request })
}

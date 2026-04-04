"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Table2, Settings, LogOut, Menu, X } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import * as React from "react"

const navigation = [
    { name: 'Ana Özet', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Ürün Kataloğu', href: '/dashboard/products', icon: Table2 },
    { name: 'Ayarlar', href: '/dashboard/settings', icon: Settings },
]

interface DashboardShellProps {
    children: React.ReactNode
    user: { email: string; id: string }
}

export function DashboardShell({ children, user }: DashboardShellProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createBrowserClient()
    const [mobileOpen, setMobileOpen] = React.useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const userInitial = user.email.charAt(0).toUpperCase()

    const sidebarContent = (
        <>
            <div className="h-16 flex items-center px-6 border-b border-slate-100">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Image src="/logo.png" alt="Teker Market" width={32} height={32} className="rounded" />
                    <h2 className="text-lg font-bold tracking-tight text-slate-900 border-l border-slate-200 pl-3 ml-1">
                        Teker<span className="font-medium text-slate-500">Admin</span>
                    </h2>
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-6 px-3">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Ana Menü</p>
                    <nav className="space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || (pathname?.startsWith(`${item.href}/`) && item.href !== '/dashboard')
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group ${isActive
                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} transition-colors`} />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </div>

            <div className="p-4 border-t border-slate-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors group"
                >
                    <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                    Oturumu Kapat
                </button>

                <div className="mt-4 flex items-center gap-3 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex flex-shrink-0 items-center justify-center text-primary font-bold text-xs ring-2 ring-white shadow-sm">
                        {userInitial}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold text-slate-900 truncate">{user.email}</span>
                        <span className="text-[11px] text-slate-500 font-medium truncate">Yönetici</span>
                    </div>
                </div>
            </div>
        </>
    )

    return (
        <div className="flex min-h-screen bg-slate-50/50 font-sans" style={{ colorScheme: 'light' }}>
            {/* Desktop Sidebar */}
            <aside className="w-[280px] flex-shrink-0 border-r border-slate-200/60 bg-white shadow-sm flex-col hidden lg:flex">
                {sidebarContent}
            </aside>

            {/* Mobile Sidebar Overlay (Madde #9) */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <aside className="absolute left-0 top-0 h-full w-[280px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                        <div className="absolute right-3 top-3 z-10">
                            <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        {sidebarContent}
                    </aside>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Mobile Top Bar */}
                <div className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur border-b border-slate-200/50 sticky top-0 z-10 lg:hidden">
                    <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <Menu className="w-5 h-5 text-slate-700" />
                    </button>
                    <span className="font-bold text-slate-800">TekerAdmin</span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {userInitial}
                    </div>
                </div>

                <div className="p-6 pb-16 opacity-100 animate-in fade-in duration-500 w-full">
                    {children}
                </div>
            </main>
        </div>
    )
}

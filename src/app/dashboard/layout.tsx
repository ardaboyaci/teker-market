"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, ShoppingCart, Settings, LogOut, FileBox, Users } from "lucide-react"

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Ürün Yönetimi', href: '/dashboard/products', icon: Package },
    { name: 'Kategoriler', href: '/dashboard/categories', icon: FileBox },
    { name: 'Siparişler', href: '/dashboard/orders', icon: ShoppingCart },
    { name: 'Müşteriler', href: '/dashboard/customers', icon: Users },
    { name: 'Ayarlar', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    return (
        <div className="flex min-h-screen bg-slate-50/50 font-sans">
            {/* Premium Sidebar */}
            <aside className="w-[280px] flex-shrink-0 border-r border-slate-200/60 bg-white shadow-sm flex flex-col hidden lg:flex">
                <div className="h-16 flex items-center px-6 border-b border-slate-100">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <span className="text-primary text-2xl leading-none font-extrabold flex items-center">
                            ⚙
                        </span>
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
                                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`) && item.href !== '/dashboard'
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
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
                    <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors group">
                        <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                        Oturumu Kapat
                    </button>

                    <div className="mt-4 flex items-center gap-3 px-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex flex-shrink-0 items-center justify-center text-slate-600 font-bold text-xs ring-2 ring-white shadow-sm">
                            A
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-semibold text-slate-900 truncate">Admin Profil</span>
                            <span className="text-[11px] text-slate-500 font-medium truncate">yonetim@tekermarket.com</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Top Navbar Component could go here */}
                <div className="h-16 flex items-center justify-between px-8 bg-white/50 backdrop-blur border-b border-slate-200/50 sticky top-0 z-10 lg:hidden">
                    <span className="font-bold text-slate-800">TekerAdmin Mobil</span>
                </div>

                <div className="p-8 pb-16 opacity-100 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    )
}

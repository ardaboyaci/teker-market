import Link from "next/link"
import { Lock } from "lucide-react"

interface PriceBlockProps {
    salePrice: string | null
    basePrice: string | null
    isAuthenticated: boolean
    wholesalePrice?: string | null
}

export function PriceBlock({ salePrice, basePrice, isAuthenticated, wholesalePrice }: PriceBlockProps) {
    const sale = Number(salePrice) || 0
    const base = Number(basePrice) || 0
    const wholesale = Number(wholesalePrice) || 0
    const hasDiscount = base > 0 && sale > 0 && sale < base

    return (
        <div className="space-y-3">
            {/* Public Toptan Fiyat */}
            <div>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Toptan Fiyat</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                    {sale > 0 ? (
                        <>
                            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                ₺{sale.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </span>
                            {hasDiscount && (
                                <span className="text-sm text-slate-400 line-through">
                                    ₺{base.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-2xl font-bold text-slate-500">Fiyat Sorunuz</span>
                    )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">KDV Dahil</p>
            </div>

            {/* Bayi Fiyatı (Auth Gated) — Madde #28 */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                {isAuthenticated ? (
                    wholesale > 0 ? (
                        <div>
                            <span className="text-[11px] font-medium text-primary uppercase tracking-wider">Bayi Fiyatı</span>
                            <p className="text-2xl font-extrabold text-primary mt-0.5">
                                ₺{wholesale.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">Bu ürün için bayi fiyatı henüz belirlenmemiştir.</p>
                    )
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Lock className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-700">Bayi fiyatını görmek için</p>
                            <Link href="/login" className="text-sm font-bold text-primary hover:underline">
                                Giriş Yap →
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

import { Truck, ShieldCheck, Headphones } from "lucide-react"

const trustItems = [
    {
        icon: Truck,
        title: "Hızlı & Güvenli Kargo",
        description: "Siparişleriniz aynı gün kargoya verilir",
    },
    {
        icon: ShieldCheck,
        title: "Orijinal Ürün Garantisi",
        description: "Tüm ürünlerimiz %100 orijinaldir",
    },
    {
        icon: Headphones,
        title: "7/24 Teknik Destek",
        description: "Uzman ekibimiz her zaman yanınızda",
    },
]

export function TrustBand() {
    return (
        <section className="py-12 border-y border-slate-100 bg-white">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {trustItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-4 p-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                                <item.icon className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">{item.title}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

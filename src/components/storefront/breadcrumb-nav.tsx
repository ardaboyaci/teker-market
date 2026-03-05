import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"

interface BreadcrumbItem {
    label: string
    href?: string
}

export function BreadcrumbNav({ items }: { items: BreadcrumbItem[] }) {
    if (items.length === 0) return null

    return (
        <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center gap-1 text-xs text-slate-400">
                <li>
                    <Link href="/" className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Home className="w-3 h-3" />
                        <span>Ana Sayfa</span>
                    </Link>
                </li>
                {items.map((item, i) => (
                    <li key={i} className="flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        {item.href ? (
                            <Link href={item.href} className="hover:text-primary transition-colors font-medium">
                                {item.label}
                            </Link>
                        ) : (
                            <span className="text-slate-700 font-medium">{item.label}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    )
}

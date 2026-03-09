export function CategoryHeader({
    title,
    count,
    description,
}: {
    title: string
    count: number
    description?: string
}) {
    return (
        <div className="mb-0 sm:mb-6 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-1 break-words">
                {title}
            </h2>
            <p className="text-sm text-slate-500">
                {count} ürün listeleniyor
                {description && <span className="hidden md:inline"> · {description}</span>}
            </p>
        </div>
    )
}

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
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
                {title}
            </h2>
            <p className="text-sm text-slate-500">
                {count} ürün listeleniyor
                {description && <span className="hidden md:inline"> · {description}</span>}
            </p>
        </div>
    )
}

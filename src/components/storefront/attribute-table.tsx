interface AttributeTableProps {
    attributes: Record<string, string> | null
}

export function AttributeTable({ attributes }: AttributeTableProps) {
    if (!attributes || Object.keys(attributes).length === 0) return null

    return (
        <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
                Teknik Özellikler
            </h3>
            <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
                <table className="w-full text-sm">
                    <tbody>
                        {Object.entries(attributes).map(([key, value], i) => (
                            <tr
                                key={key}
                                className={i % 2 === 0 ? "bg-slate-50/50" : "bg-white"}
                            >
                                <td className="px-4 py-2.5 text-slate-500 font-medium w-1/3 border-r border-slate-100">
                                    {key}
                                </td>
                                <td className="px-4 py-2.5 text-slate-800 font-semibold">
                                    {value}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

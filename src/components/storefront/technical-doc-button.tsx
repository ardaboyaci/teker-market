import { FileText, Download } from "lucide-react"

export function TechnicalDocButton({ pdfUrl }: { pdfUrl?: string | null }) {
    if (!pdfUrl) return null

    return (
        <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2.5 rounded-xl transition-colors text-sm border border-slate-200"
        >
            <FileText className="w-4 h-4" />
            Teknik Döküman
            <Download className="w-3.5 h-3.5 text-slate-400" />
        </a>
    )
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen">
            <aside className="w-64 border-r bg-gray-50/50 p-4">
                <h2 className="mb-4 text-lg font-semibold">Teker Market</h2>
                <nav className="space-y-2">
                    {/* Navigation items will go here */}
                </nav>
            </aside>
            <main className="flex-1 p-8">
                {children}
            </main>
        </div>
    )
}

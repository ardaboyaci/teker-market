import { DashboardShell } from "./dashboard-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell user={{ email: 'admin@tekermarket.com', id: 'docker-admin' }}>
            {children}
        </DashboardShell>
    )
}

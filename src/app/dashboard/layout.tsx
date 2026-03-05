import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "./dashboard-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <DashboardShell user={{ email: user.email || 'admin', id: user.id }}>
            {children}
        </DashboardShell>
    )
}

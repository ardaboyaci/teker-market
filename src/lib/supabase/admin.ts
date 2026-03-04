import { createClient } from '@supabase/supabase-js'

// This client bypasses RLS and should ONLY be used in secure Server Components or API Routes
// where public data is fetched or admin actions are performed.
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

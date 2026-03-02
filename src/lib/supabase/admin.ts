import { createClient } from '@supabase/supabase-js'

// Note: This client uses the SERVICE ROLE KEY. 
// It bypasses Row Level Security (RLS). 
// NEVER import this in Client Components.
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

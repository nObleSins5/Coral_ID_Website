import { createClient } from "@supabase/supabase-js";

// Public, session-less Supabase client for the read-only wiki pages. Works at
// build time (static generation) and runtime; RLS anon policies govern access.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

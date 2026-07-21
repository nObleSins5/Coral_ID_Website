import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Exchanges the token_hash Supabase puts on a recovery/confirmation email
// link for a real session (Supabase's standard verifyOtp handshake) — this
// route is the redirectTo target for both signup confirmation emails (if
// ever enabled) and requestPasswordReset's recovery email
// (app/reset-password/actions.ts). `next` carries where to land afterward;
// the reset flow points it at /update-password.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/reset-password?error=" + encodeURIComponent("That link is invalid or has expired."));
}

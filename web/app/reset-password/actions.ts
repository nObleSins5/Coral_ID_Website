"use server";

import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

// Sends a Supabase recovery email. Always returns the same success message
// regardless of whether the address is registered — a "no account with that
// email" response would let anyone enumerate registered addresses through
// this form.
export async function requestPasswordReset(
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/update-password`,
  });

  // A malformed address is worth surfacing; anything else (including "no
  // such user," which Supabase doesn't distinguish here by design) reads as
  // success to the caller.
  if (error && error.status === 400 && /email/i.test(error.message)) {
    return { error: "Enter a valid email address." };
  }

  return { sent: true };
}

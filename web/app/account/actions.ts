"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Profile fields that live on public.users (not auth.users) — username,
// display name, preferred units. RLS already lets a user update their own
// row in full (users_update_self, sql/supabase/02_rls_policies.sql), so no
// migration is needed here, just the first UI that writes to it — every
// prior signup field has been write-once until now.
export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const preferredTempUnit = String(formData.get("preferred_temp_unit") ?? "F");

  if (!username) return { error: "Username can't be empty." };
  if (preferredTempUnit !== "C" && preferredTempUnit !== "F") {
    return { error: "Invalid temperature unit." };
  }

  const { error } = await supabase
    .from("users")
    .update({
      username,
      display_name: displayName || null,
      preferred_temp_unit: preferredTempUnit,
    })
    .eq("id", user.id);

  if (error) {
    // users.username is UNIQUE — surface that specific case in plain
    // language instead of a raw Postgres constraint-violation message.
    if (error.code === "23505") return { error: "That username is already taken." };
    return { error: error.message };
  }

  revalidatePath("/account");
  return {};
}

// Changing a password from within the account page — the user already has
// an active session, so this is a direct auth.updateUser call (no current-
// password re-check; Supabase's session itself is the proof of identity
// here, same trust boundary the "forgot password" recovery link uses).
export async function updatePassword(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return {};
}

// Same underlying call as updatePassword, used from /update-password after
// a recovery-link session — redirects into the app instead of returning an
// inline result, since that page has nowhere else for the user to go next.
export async function updatePasswordAndContinue(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

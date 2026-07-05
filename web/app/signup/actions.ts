"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Signup (spec workflow 5.0). Profile fields ride along as auth metadata; the
// database trigger `handle_new_user` provisions the public.users profile row.
export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const data = {
    username: String(formData.get("username") ?? "").trim(),
    account_type: String(formData.get("account_type") ?? "hobbyist"),
    region: String(formData.get("region") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    zip: String(formData.get("zip") ?? "").trim(),
  };

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // If email confirmation is disabled (recommended for dev), a session is
  // active immediately and the dashboard loads; otherwise the user confirms
  // via email, then logs in.
  redirect("/dashboard");
}

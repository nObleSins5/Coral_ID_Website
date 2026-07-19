"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COUNTRY_CODES } from "@/lib/countries";

// Signup (spec workflow 5.0). Profile fields ride along as auth metadata; the
// database trigger `handle_new_user` provisions the public.users profile row.
export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // Country is the one location fact we can't derive later, so it's required
  // and validated against the ISO list here (the DB CHECK only enforces
  // format). Postal code + state stay optional and format-agnostic;
  // latitude/longitude are system-derived from these later, never entered.
  const countryCode = String(formData.get("country_code") ?? "").trim().toUpperCase();
  if (!COUNTRY_CODES.has(countryCode)) {
    redirect(`/signup?error=${encodeURIComponent("Please choose your country.")}`);
  }

  const data = {
    username: String(formData.get("username") ?? "").trim(),
    account_type: String(formData.get("account_type") ?? "hobbyist"),
    country_code: countryCode,
    state: String(formData.get("state") ?? "").trim(),
    postal_code: String(formData.get("postal_code") ?? "").trim(),
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

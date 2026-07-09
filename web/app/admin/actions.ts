"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireModerator(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." } as const;

  const { data: profile } = await supabase
    .from("users")
    .select("is_moderator")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_moderator) return { error: "Moderators only." } as const;

  return { user } as const;
}

// Approving an alias makes it publicly visible on the morph page
// (coral_aliases_public_read only shows moderation_status_code = 'approved')
// and records who reviewed it.
export async function approveAlias(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const check = await requireModerator(supabase);
  if ("error" in check) return check;

  const aliasId = String(formData.get("alias_id") ?? "");
  if (!aliasId) return { error: "Missing alias reference." };

  const { error } = await supabase
    .from("coral_aliases")
    .update({ moderation_status_code: "approved", approved_by_user_id: check.user.id })
    .eq("id", aliasId);
  if (error) return { error: error.message };

  revalidatePath("/admin/aliases");
  return {};
}

export async function rejectAlias(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const check = await requireModerator(supabase);
  if ("error" in check) return check;

  const aliasId = String(formData.get("alias_id") ?? "");
  if (!aliasId) return { error: "Missing alias reference." };

  const { error } = await supabase
    .from("coral_aliases")
    .update({ moderation_status_code: "rejected" })
    .eq("id", aliasId);
  if (error) return { error: error.message };

  revalidatePath("/admin/aliases");
  return {};
}

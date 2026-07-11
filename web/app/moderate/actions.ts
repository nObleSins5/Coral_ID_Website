"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const DECISIONS = new Set(["approved", "rejected"]);

// Shared moderator gate — RLS enforces this too (coral_aliases_moderator_update
// / husbandry_products_moderator_update, sql/supabase/14_alias_moderation.sql),
// but checking here gives a readable error instead of a raw RLS-violation
// message, matching the business-tier gate in app/affiliate/actions.ts.
async function requireModerator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." } as const;

  const { data: profile } = await supabase
    .from("users")
    .select("is_moderator")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_moderator) {
    return { error: "Only moderators can review the queue." } as const;
  }
  return { supabase, userId: user.id } as const;
}

export async function moderateAlias(
  formData: FormData,
): Promise<{ error?: string }> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };

  const aliasId = String(formData.get("alias_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!aliasId || !DECISIONS.has(decision)) {
    return { error: "Invalid moderation request." };
  }

  const { error } = await gate.supabase
    .from("coral_aliases")
    .update({ moderation_status_code: decision, approved_by_user_id: gate.userId })
    .eq("id", aliasId)
    .eq("moderation_status_code", "proposed");
  if (error) return { error: error.message };

  revalidatePath("/moderate");
  return {};
}

export async function moderateProduct(
  formData: FormData,
): Promise<{ error?: string }> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };

  const productId = String(formData.get("product_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!productId || !DECISIONS.has(decision)) {
    return { error: "Invalid moderation request." };
  }

  const { error } = await gate.supabase
    .from("husbandry_products")
    .update({ moderation_status_code: decision, approved_by_user_id: gate.userId })
    .eq("id", productId)
    .eq("moderation_status_code", "proposed");
  if (error) return { error: error.message };

  revalidatePath("/moderate");
  return {};
}

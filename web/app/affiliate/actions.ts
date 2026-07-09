"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const LINK_TYPES = new Set(["wysiwyg", "representative"]);

function revalidateMorph(formData: FormData) {
  const genusSlug = String(formData.get("genus_slug") ?? "");
  const morphSlug = String(formData.get("morph_slug") ?? "");
  if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
}

// Attaches a vendor link to one of the CALLER'S OWN photos — "a vendor
// showcases their own photo of a coral to compete with other vendors selling
// the same morph" (docs/schema-decisions.md §10). Business-tier only
// (account_type_code = 'business') as of 2026-07 — see
// sql/supabase/12_business_listings.sql; RLS enforces this too, but checking
// here gives a readable error instead of a raw RLS-violation message.
export async function addAffiliateLink(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { data: profile } = await supabase
    .from("users")
    .select("account_type_code")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.account_type_code !== "business") {
    return { error: "Only business accounts can add affiliate links." };
  }

  const photoId = String(formData.get("coral_photo_id") ?? "");
  const vendorName = String(formData.get("vendor_name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const linkType = String(formData.get("link_type") ?? "representative");
  const forSaleOrTrade = formData.get("for_sale_or_trade") === "on";
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? Number(priceRaw) : null;
  if (!photoId || !vendorName || !url) {
    return { error: "Fill in a vendor name and a URL." };
  }
  if (!/^https?:\/\//i.test(url)) {
    return { error: "URL must start with http:// or https://." };
  }
  if (!LINK_TYPES.has(linkType)) return { error: "Invalid link type." };
  if (priceRaw && (Number.isNaN(price) || (price as number) < 0)) {
    return { error: "Price must be a positive number." };
  }

  const { data: photo } = await supabase
    .from("coral_photos")
    .select("uploader_user_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo || photo.uploader_user_id !== user.id) {
    return { error: "You can only attach links to your own photos." };
  }

  const { error } = await supabase.from("affiliate_links").insert({
    coral_photo_id: photoId,
    vendor_name: vendorName,
    url,
    link_type: linkType,
    for_sale_or_trade: forSaleOrTrade,
    price,
  });
  if (error) return { error: error.message };

  revalidateMorph(formData);
  return {};
}

// Inline edits from the /business dashboard: price, the for-sale/trade flag,
// and hiding a listing from public view without deactivating it (a listing
// can be temporarily hidden and un-hidden; deactivation, below, is one-way).
export async function updateAffiliateListing(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const linkId = String(formData.get("affiliate_link_id") ?? "");
  if (!linkId) return { error: "Missing link reference." };

  const forSaleOrTrade = formData.get("for_sale_or_trade") === "on";
  const hidden = formData.get("hidden_by_owner") === "on";
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? Number(priceRaw) : null;
  if (priceRaw && (Number.isNaN(price) || (price as number) < 0)) {
    return { error: "Price must be a positive number." };
  }

  const { data, error } = await supabase
    .from("affiliate_links")
    .update({ for_sale_or_trade: forSaleOrTrade, hidden_by_owner: hidden, price })
    .eq("id", linkId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Link not found." };

  revalidatePath("/business");
  return {};
}

// Deactivates one of the caller's own links (soft — keeps the row, its click
// history, and any reports; just stops showing/redirecting it).
export async function deactivateAffiliateLink(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const linkId = String(formData.get("affiliate_link_id") ?? "");
  if (!linkId) return { error: "Missing link reference." };

  const { data, error } = await supabase
    .from("affiliate_links")
    .update({ is_active: false })
    .eq("id", linkId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Link not found." };

  revalidateMorph(formData);
  revalidatePath("/business");
  return {};
}

// Community "report dead link" flagging (docs/future-considerations.md idea
// 3) — handle_affiliate_link_report() auto-deactivates once enough distinct
// users have reported the same link.
export async function reportDeadLink(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to report a link." };

  const linkId = String(formData.get("affiliate_link_id") ?? "");
  if (!linkId) return { error: "Missing link reference." };

  const { error } = await supabase.from("affiliate_link_reports").insert({
    affiliate_link_id: linkId,
    user_id: user.id,
  });
  // A unique-violation just means they already reported this one — not an error.
  if (error && error.code !== "23505") return { error: error.message };

  revalidateMorph(formData);
  return {};
}

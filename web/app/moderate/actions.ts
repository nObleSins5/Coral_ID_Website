"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTopPhotosForTaxa } from "@/lib/wiki";

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

// Reported comments (is_hidden = true, auto-hidden by report threshold or
// already moderator-hidden) — restore un-hides it, delete soft-deletes it.
// sql/supabase/19_coral_comments.sql.
export async function restoreComment(formData: FormData): Promise<{ error?: string }> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };

  const commentId = String(formData.get("comment_id") ?? "");
  if (!commentId) return { error: "Missing comment reference." };

  const { error } = await gate.supabase
    .from("coral_comments")
    .update({ is_hidden: false, hidden_by_user_id: null })
    .eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath("/moderate");
  return {};
}

export async function deleteReportedComment(
  formData: FormData,
): Promise<{ error?: string }> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };

  const commentId = String(formData.get("comment_id") ?? "");
  if (!commentId) return { error: "Missing comment reference." };

  const { error } = await gate.supabase
    .from("coral_comments")
    .update({
      deleted_at: new Date().toISOString(),
      hidden_by_user_id: gate.userId,
      is_hidden: true,
    })
    .eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath("/moderate");
  return {};
}

// Manual fast-path for a still-pending brand-new-morph proposal — same
// outcome as the auto-confirm vote trigger (handle_id_vote_change,
// sql/supabase/09_unidentified_id_flow.sql), just skipping the remaining
// vote/time thresholds. The actual moderator check and taxon creation happen
// inside moderator_confirm_suggestion (sql/supabase/33_moderator_confirm_suggestion.sql)
// — requireModerator here just gives a readable error instead of a raw RPC
// failure, matching every other action in this file.
export async function confirmMorphProposal(
  formData: FormData,
): Promise<{ error?: string }> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };

  const suggestionId = String(formData.get("suggestion_id") ?? "");
  const genusSlug = String(formData.get("genus_slug") ?? "");
  if (!suggestionId) return { error: "Missing proposal reference." };

  const { error } = await gate.supabase.rpc("moderator_confirm_suggestion", {
    p_suggestion_id: suggestionId,
  });
  if (error) return { error: error.message };

  revalidatePath("/moderate");
  if (genusSlug) revalidatePath(`/coral/${genusSlug}`);
  return {};
}

// -----------------------------------------------------------------------
// Color entry (sql/supabase/27_color_moderation.sql, docs/color-percent-
// feature-brief.md) — the first UI-based path for canonical color_ranges/
// color_stops data; every prior correction (e.g. Rasta Zoanthid,
// 25_correct_rasta_zoa_colors.sql) went through a hand-written migration.
// One taxon at a time, matching the product's "reference database" register
// — not a bulk-import tool.
// -----------------------------------------------------------------------

const COLOR_PATTERN_CODES = new Set([
  "solid",
  "range",
  "rainbow",
  "banded",
  "spotted",
  "mottled",
  "tipped",
  "ringed",
]);
const LIGHTING_CODES = new Set(["daylight", "actinic", "mixed", "unsure"]);
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export type ColorRangeForModeration = {
  id: string;
  position_label: string | null;
  color_pattern_code: string;
  label: string | null;
  notes: string | null;
  approx_percent: number | null;
  lighting_condition: string | null;
  color_stops: { hex: string; ordinal: number; approx_percent: number | null }[];
};

// Fetches a taxon's current color_ranges for the moderator editor — a read,
// not a mutation, but kept here (not lib/wiki.ts) since it's gated on
// is_moderator, not public like everything in that file.
export async function getColorRangesForModeration(taxonId: string): Promise<{
  ranges?: ColorRangeForModeration[];
  anatomyTemplateCode?: string | null;
  photos?: string[];
  error?: string;
}> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };

  const [{ data, error }, { data: taxon }, topPhotos] = await Promise.all([
    gate.supabase
      .from("color_ranges")
      .select(
        "id, position_label, color_pattern_code, label, notes, approx_percent, lighting_condition, color_stops ( hex, ordinal, approx_percent )",
      )
      .eq("taxon_node_id", taxonId)
      .order("sort_order"),
    gate.supabase.from("taxon_nodes").select("parent_id").eq("id", taxonId).maybeSingle(),
    // Real community photos for the moderator's image card + hex loupe
    // (see components/photo-color-sampler.tsx) — same most-voted-first
    // ranking already used for the identify funnel's result carousels.
    getTopPhotosForTaxa([taxonId], 10),
  ]);
  if (error) return { error: error.message };

  let anatomyTemplateCode: string | null = null;
  if (taxon?.parent_id) {
    const { data: genus } = await gate.supabase
      .from("taxon_nodes")
      .select("anatomy_template_code")
      .eq("id", taxon.parent_id)
      .maybeSingle();
    anatomyTemplateCode = genus?.anatomy_template_code ?? null;
  }

  const ranges = (data ?? []).map((r) => ({
    ...r,
    color_stops: [...r.color_stops].sort((a, b) => a.ordinal - b.ordinal),
  })) as ColorRangeForModeration[];
  return { ranges, anatomyTemplateCode, photos: topPhotos.get(taxonId) ?? [] };
}

export type ColorEntryModerationRow = {
  id: string;
  name: string;
  genusName: string;
  categoryName: string | null;
  colorCount: number;
  lastActivity: string | null; // ISO timestamp, null = never touched
};

// "Which corals have I set up, and when did I last touch them" — the
// moderator's own activity list, so entry work can be picked up/resumed
// without re-searching from scratch each time. Sorted most-recent-first by
// default; the "never entered" case (lastActivity null) is a real, common
// state worth surfacing distinctly, not an error (~101 seeded corals, most
// with zero moderator-entered color data yet — see docs/PROGRESS.md).
export async function getColorEntryModerationList(): Promise<{
  rows?: ColorEntryModerationRow[];
  error?: string;
}> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };
  const supabase = gate.supabase;

  const [{ data: morphs }, { data: genera }, { data: categories }, { data: ranges }] = await Promise.all([
    supabase.from("taxon_nodes").select("id, name, parent_id, updated_at").eq("rank_code", "morph"),
    supabase.from("taxon_nodes").select("id, name, parent_id").eq("rank_code", "genus"),
    supabase.from("taxon_nodes").select("id, name").eq("rank_code", "category"),
    supabase.from("color_ranges").select("taxon_node_id, updated_at"),
  ]);

  const genusById = new Map((genera ?? []).map((g) => [g.id, g]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const activityByTaxon = new Map<string, { count: number; lastActivity: string | null }>();
  for (const r of ranges ?? []) {
    const entry = activityByTaxon.get(r.taxon_node_id) ?? { count: 0, lastActivity: null };
    entry.count += 1;
    if (!entry.lastActivity || r.updated_at > entry.lastActivity) entry.lastActivity = r.updated_at;
    activityByTaxon.set(r.taxon_node_id, entry);
  }

  const rows: ColorEntryModerationRow[] = (morphs ?? []).map((m) => {
    const genus = m.parent_id ? genusById.get(m.parent_id) : undefined;
    const category = genus?.parent_id ? categoryById.get(genus.parent_id) : undefined;
    const activity = activityByTaxon.get(m.id);
    return {
      id: m.id,
      name: m.name,
      genusName: genus?.name ?? "—",
      categoryName: category?.name ?? null,
      colorCount: activity?.count ?? 0,
      lastActivity: activity?.lastActivity ?? null,
    };
  });

  rows.sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return a.name.localeCompare(b.name);
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return b.lastActivity.localeCompare(a.lastActivity);
  });

  return { rows };
}

// Creates a new color_range (no id in formData) or replaces an existing
// one's fields + stops (id present) — stops are always replaced wholesale
// (delete + reinsert) rather than diffed, since a moderator edit is
// infrequent and the row count per range is small (1-5 stops).
export async function upsertColorRange(formData: FormData): Promise<{ error?: string }> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };

  const id = String(formData.get("id") ?? "").trim() || null;
  const taxonId = String(formData.get("taxon_node_id") ?? "").trim();
  const positionLabel = String(formData.get("position_label") ?? "").trim() || null;
  const patternCode = String(formData.get("color_pattern_code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const lighting = String(formData.get("lighting_condition") ?? "").trim() || null;
  const percentRaw = String(formData.get("approx_percent") ?? "").trim();
  const hexesRaw = String(formData.get("hexes") ?? "");
  const stopPercentsRaw = String(formData.get("stop_percents") ?? "");

  if (!taxonId) return { error: "Missing taxon." };
  if (!COLOR_PATTERN_CODES.has(patternCode)) return { error: "Choose a pattern." };
  if (lighting && !LIGHTING_CODES.has(lighting)) return { error: "Invalid lighting value." };

  let percent: number | null = null;
  if (percentRaw !== "") {
    percent = Number(percentRaw);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      return { error: "% of coral must be between 0 and 100." };
    }
  }

  const hexes = hexesRaw
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hexes.length === 0) {
    return { error: "Enter at least one hex color (e.g. #2E8B57)." };
  }
  for (const h of hexes) {
    if (!HEX_RE.test(h)) {
      return { error: `"${h}" isn't a valid hex color — use the form #RRGGBB (e.g. #2E8B57).` };
    }
  }

  // How much of THIS range's own blend each stop is (e.g. an 80/20
  // blue-to-purple growth-tip gradient) — the sibling fact to the
  // range-level % above, at the stop grain. Sent client-side as one entry
  // per hex, same order, blank = not recorded. If the count doesn't line
  // up with hexes (e.g. an older client), silently drop it rather than
  // block the save — this is optional detail, never a hard requirement.
  const stopPercentParts = stopPercentsRaw.split(",");
  const stopPercents: (number | null)[] = new Array(hexes.length).fill(null);
  if (stopPercentParts.length === hexes.length) {
    for (let i = 0; i < stopPercentParts.length; i++) {
      const raw = stopPercentParts[i].trim();
      if (raw === "") continue;
      const value = Number(raw);
      if (Number.isNaN(value) || value < 0 || value > 100) {
        return { error: `The percent for "${hexes[i]}" must be between 0 and 100.` };
      }
      stopPercents[i] = value;
    }
  }

  const supabase = gate.supabase;
  const fields = {
    position_label: positionLabel,
    color_pattern_code: patternCode,
    label,
    notes,
    approx_percent: percent,
    lighting_condition: lighting,
  };

  let rangeId = id;
  if (rangeId) {
    const { error } = await supabase.from("color_ranges").update(fields).eq("id", rangeId);
    if (error) return { error: error.message };
    const { error: deleteError } = await supabase
      .from("color_stops")
      .delete()
      .eq("color_range_id", rangeId);
    if (deleteError) return { error: deleteError.message };
  } else {
    const { data, error } = await supabase
      .from("color_ranges")
      .insert({ ...fields, taxon_node_id: taxonId })
      .select("id")
      .single();
    if (error) return { error: error.message };
    rangeId = data.id;
  }

  const stopRows = hexes.map((hex, i) => ({
    color_range_id: rangeId,
    ordinal: i,
    hex: hex.toUpperCase(),
    approx_percent: stopPercents[i],
  }));
  const { error: stopsError } = await supabase.from("color_stops").insert(stopRows);
  if (stopsError) return { error: stopsError.message };

  revalidatePath("/moderate");
  return {};
}

// color_stops cascade-deletes with their parent range (ON DELETE CASCADE,
// coral_trait_schema.sql) — no separate stops cleanup needed here.
export async function deleteColorRange(formData: FormData): Promise<{ error?: string }> {
  const gate = await requireModerator();
  if ("error" in gate) return { error: gate.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing color reference." };

  const { error } = await gate.supabase.from("color_ranges").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/moderate");
  return {};
}

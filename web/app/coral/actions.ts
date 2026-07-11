"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeParameterSnapshot, uploadPhotoFile } from "@/lib/photo-upload";
import { minDeltaE } from "@/lib/color";
import { getElementReferenceHexes } from "@/lib/color-samples";

// Uploads a standalone photo attached to a taxon (Door 1). The
// "unidentified — help me ID this" path lives separately in
// app/identify/actions.ts (uploadUnidentifiedPhoto) — this always attaches to
// an already-identified coral. Choosing a tank stamps the parameter snapshot
// AND auto-adds this coral to that tank's collection (a new specimen, this
// photo as its representative) — logging a photo of your own tank's coral
// means you have it, no separate "add to my collection" click required.
// (addSpecimen below still exists for adding an ALREADY-existing community
// photo to your collection without uploading a new one of your own.)
export async function uploadCoralPhoto(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to add a photo." };

  const taxonNodeId = String(formData.get("taxon_node_id") ?? "");
  const genusSlug = String(formData.get("genus_slug") ?? "");
  const morphSlug = String(formData.get("morph_slug") ?? "");
  const tankId = String(formData.get("tank_id") ?? "") || null;
  const takenAtRaw = String(formData.get("taken_at") ?? "");

  if (!taxonNodeId) return { error: "Missing coral reference." };

  const uploaded = await uploadPhotoFile(supabase, user.id, formData.get("photo"));
  if ("error" in uploaded) return uploaded;

  const snapshot = await computeParameterSnapshot(supabase, tankId, takenAtRaw);

  const { data: photo, error: insertError } = await supabase
    .from("coral_photos")
    .insert({
      uploader_user_id: user.id,
      taxon_node_id: taxonNodeId,
      tank_id: tankId,
      is_public: true,
      taken_at: takenAtRaw
        ? new Date(takenAtRaw).toISOString()
        : new Date().toISOString(),
      storage_provider: "supabase",
      storage_key: uploaded.path,
      url: uploaded.publicUrl,
      mime: uploaded.mime,
      bytes: uploaded.bytes,
      ...snapshot,
    })
    .select("id")
    .single();

  if (insertError || !photo) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned object.
    await supabase.storage.from("coral-photos").remove([uploaded.path]);
    return { error: `Could not save photo: ${insertError?.message ?? "unknown error"}` };
  }

  if (tankId) {
    await supabase.from("specimens").insert({
      user_id: user.id,
      tank_id: tankId,
      taxon_node_id: taxonNodeId,
      representative_photo_id: photo.id,
    });
    revalidatePath(`/tank/${tankId}`);
    revalidatePath("/dashboard");
  }

  if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
  return {};
}

// Toggles a single, unambiguously-labeled "this is an accurate match" vote
// (see docs/schema-decisions.md / docs/future-considerations.md for why this
// is deliberately one signal, not a separate "I like this photo" — the UI
// button copy is what keeps the vote meaning clear, not a second table).
// vote_type is schema-ready for a future 'like' dimension without a migration.
export async function toggleAccurateVote(
  formData: FormData,
): Promise<{ error?: string; voted?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to vote." };

  const photoId = String(formData.get("photo_id") ?? "");
  const genusSlug = String(formData.get("genus_slug") ?? "");
  const morphSlug = String(formData.get("morph_slug") ?? "");
  if (!photoId) return { error: "Missing photo reference." };

  const { data: existing } = await supabase
    .from("coral_photo_votes")
    .select("id")
    .eq("coral_photo_id", photoId)
    .eq("user_id", user.id)
    .eq("vote_type", "accurate")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("coral_photo_votes")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: error.message };
    if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
    return { voted: false };
  }

  const { error } = await supabase.from("coral_photo_votes").insert({
    coral_photo_id: photoId,
    user_id: user.id,
    vote_type: "accurate",
  });
  if (error) return { error: error.message };
  if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
  return { voted: true };
}

// Adds a specimen ("+ Add to my collection") for an already-identified coral.
// An optional representative_photo_id may point to ANY public photo of this
// coral, not just the user's own — that's a display pick, not a provenance
// claim. When the chosen photo IS the user's own upload, we additionally set
// that photo's specimen_id (true provenance), since they have permission to;
// another user's photo is left untouched.
export async function addSpecimen(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to add to your collection." };

  const taxonNodeId = String(formData.get("taxon_node_id") ?? "");
  const genusSlug = String(formData.get("genus_slug") ?? "");
  const morphSlug = String(formData.get("morph_slug") ?? "");
  const tankId = String(formData.get("tank_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim() || null;
  const acquiredOnRaw = String(formData.get("acquired_on") ?? "");
  const representativePhotoId =
    String(formData.get("representative_photo_id") ?? "") || null;

  if (!taxonNodeId) return { error: "Missing coral reference." };
  if (!tankId) return { error: "Choose which tank this is in." };

  // Defensive re-check: only ever link a photo that is actually public,
  // regardless of what the submitted form claims.
  let photoUploaderId: string | null = null;
  if (representativePhotoId) {
    const { data: photo } = await supabase
      .from("coral_photos")
      .select("uploader_user_id, is_public")
      .eq("id", representativePhotoId)
      .maybeSingle();
    if (!photo?.is_public) {
      return { error: "That photo is no longer available." };
    }
    photoUploaderId = photo.uploader_user_id;
  }

  const { data: specimen, error: insertError } = await supabase
    .from("specimens")
    .insert({
      user_id: user.id,
      tank_id: tankId,
      taxon_node_id: taxonNodeId,
      name,
      acquired_on: acquiredOnRaw || null,
      representative_photo_id: representativePhotoId,
    })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  // Own photo -> also record true provenance (this photo documents THIS
  // specimen) on the photo itself, since the uploader has permission to.
  if (representativePhotoId && photoUploaderId === user.id) {
    await supabase
      .from("coral_photos")
      .update({ specimen_id: specimen.id })
      .eq("id", representativePhotoId);
  }

  if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
  return {};
}

// Toggles a coral on/off the user's want_list (a private bookmark — RLS on
// want_list already restricts it to the owner; there is no public "who wants
// this" view yet, see docs/future-considerations.md for the fuller
// vendor-matching idea this could grow into).
export async function toggleWishlist(
  formData: FormData,
): Promise<{ error?: string; wishlisted?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to use your wishlist." };

  const taxonNodeId = String(formData.get("taxon_node_id") ?? "");
  const genusSlug = String(formData.get("genus_slug") ?? "");
  const morphSlug = String(formData.get("morph_slug") ?? "");
  if (!taxonNodeId) return { error: "Missing coral reference." };

  const { data: existing } = await supabase
    .from("want_list")
    .select("id")
    .eq("user_id", user.id)
    .eq("taxon_node_id", taxonNodeId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("want_list").delete().eq("id", existing.id);
    if (error) return { error: error.message };
    if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
    revalidatePath("/dashboard");
    return { wishlisted: false };
  }

  const { error } = await supabase.from("want_list").insert({
    user_id: user.id,
    taxon_node_id: taxonNodeId,
  });
  if (error) return { error: error.message };
  if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
  revalidatePath("/dashboard");
  return { wishlisted: true };
}

// -----------------------------------------------------------------------
// Per-coral comment board (docs/future-considerations.md "Idea 3") — flat,
// post-publish (goes live immediately, not queue-gated like coral_aliases),
// strongly moderated via report-threshold auto-hide
// (handle_coral_comment_report(), sql/supabase/19_coral_comments.sql) plus
// direct moderator hide/restore/delete from /moderate.
// -----------------------------------------------------------------------

export async function postComment(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to comment." };

  const taxonNodeId = String(formData.get("taxon_node_id") ?? "");
  const genusSlug = String(formData.get("genus_slug") ?? "");
  const morphSlug = String(formData.get("morph_slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!taxonNodeId) return { error: "Missing coral reference." };
  if (!body) return { error: "Write something first." };
  if (body.length > 2000) return { error: "Comments are capped at 2000 characters." };

  const { error } = await supabase.from("coral_comments").insert({
    taxon_node_id: taxonNodeId,
    user_id: user.id,
    body,
  });
  if (error) return { error: error.message };

  if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
  return {};
}

// Soft-delete of the caller's OWN comment. RLS (coral_comments_owner_delete)
// would technically allow updating any column, but this action only ever
// writes deleted_at.
export async function deleteComment(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const commentId = String(formData.get("comment_id") ?? "");
  const genusSlug = String(formData.get("genus_slug") ?? "");
  const morphSlug = String(formData.get("morph_slug") ?? "");
  if (!commentId) return { error: "Missing comment reference." };

  const { error } = await supabase
    .from("coral_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
  return {};
}

// Enough distinct reports auto-hides the comment (DB trigger); this action
// just records the caller's own report.
export async function reportComment(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to report a comment." };

  const commentId = String(formData.get("comment_id") ?? "");
  if (!commentId) return { error: "Missing comment reference." };

  const { error } = await supabase.from("coral_comment_reports").insert({
    comment_id: commentId,
    user_id: user.id,
  });
  // A unique-violation just means they already reported this one.
  if (error && error.code !== "23505") return { error: error.message };

  return {};
}

// -----------------------------------------------------------------------
// Community color samples (color-picker tool). Saved as a raw log
// (element_color_samples), separate from the published color_stops the wiki
// displays. Each sample is scored by CIELAB ΔE against the element's existing
// documented colors: within threshold on a settled taxon -> auto-confirmed
// (agrees with consensus); too far out -> held as a likely-miss
// (out_of_range) for moderator review; no documented color yet -> proposed,
// awaiting a moderator to bootstrap the element. See docs/future-considerations.md.
// -----------------------------------------------------------------------

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

type IncomingColorSample = {
  element_type_code: string;
  raw_hex: string;
  corrected_hex: string | null;
  used_hex: string;
  sample_x: number | null;
  sample_y: number | null;
};

export async function submitColorSamples(payload: {
  taxon_node_id: string;
  coral_photo_id: string | null;
  genus_slug: string;
  morph_slug: string;
  wb: { material: string; gain: [number, number, number] } | null;
  samples: IncomingColorSample[];
}): Promise<{ error?: string; confirmed?: number; pending?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to contribute colors." };

  const { taxon_node_id, coral_photo_id, genus_slug, morph_slug, wb, samples } = payload;
  if (!taxon_node_id) return { error: "Missing coral reference." };
  if (!samples || samples.length === 0) return { error: "Add at least one color sample first." };
  if (samples.length > 20) return { error: "Too many samples in one submission." };

  // Only a real, settled morph can auto-confirm — never the hidden
  // "Genus unknown" bucket, whose identity isn't settled.
  const { data: taxon } = await supabase
    .from("taxon_nodes")
    .select("rank_code, parent_id")
    .eq("id", taxon_node_id)
    .maybeSingle();
  if (!taxon) return { error: "Coral not found." };
  const { data: parent } = taxon.parent_id
    ? await supabase.from("taxon_nodes").select("slug").eq("id", taxon.parent_id).maybeSingle()
    : { data: null };
  const settled = taxon.rank_code === "morph" && parent?.slug !== "genus-unknown";

  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "color_sample_delta_e_threshold")
    .maybeSingle();
  const threshold = Number((setting?.value as unknown) ?? 30) || 30;

  let confirmed = 0;
  let pending = 0;

  for (const s of samples) {
    if (!HEX_RE.test(s.raw_hex) || !HEX_RE.test(s.used_hex)) {
      return { error: "A sample had an invalid color value." };
    }
    if (s.corrected_hex && !HEX_RE.test(s.corrected_hex)) {
      return { error: "A sample had an invalid corrected color value." };
    }

    const refHexes = await getElementReferenceHexes(supabase, taxon_node_id, s.element_type_code);
    const d = minDeltaE(s.used_hex, refHexes);

    let status: "proposed" | "confirmed" = "proposed";
    let outOfRange = false;
    if (d !== null) {
      if (d <= threshold && settled) status = "confirmed";
      else if (d > threshold) outOfRange = true;
    }
    if (status === "confirmed") confirmed++;
    else pending++;

    const { error } = await supabase.from("element_color_samples").insert({
      taxon_node_id,
      element_type_code: s.element_type_code,
      coral_photo_id: coral_photo_id || null,
      raw_hex: s.raw_hex,
      corrected_hex: s.corrected_hex,
      used_hex: s.used_hex,
      wb_reference_material: wb ? wb.material : null,
      wb_gain_r: wb ? wb.gain[0] : null,
      wb_gain_g: wb ? wb.gain[1] : null,
      wb_gain_b: wb ? wb.gain[2] : null,
      sample_x: s.sample_x,
      sample_y: s.sample_y,
      delta_e: d,
      out_of_range: outOfRange,
      status,
      submitted_by_user_id: user.id,
      ...(status === "confirmed" ? { reviewed_at: new Date().toISOString() } : {}),
    });
    if (error) return { error: error.message };
  }

  if (genus_slug && morph_slug) revalidatePath(`/coral/${genus_slug}/${morph_slug}`);
  return { confirmed, pending };
}

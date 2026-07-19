"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeParameterSnapshot, uploadPhotoFile } from "@/lib/photo-upload";

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

// Fast on-ramp for "I know this genus, my morph just isn't seeded yet" — the
// callout at the top of a genus's wiki page. Skips the full /identify flow
// (upload -> get confirmed to the genus -> come back and propose a name):
// this does the upload AND the new-morph proposal in one submit, landing the
// photo directly at the genus level with a pending id_suggestion already
// attached. Same underlying mechanism as the "newName + newGenusId" path in
// app/identify/actions.ts (proposeIdentification) — a suggestion only
// becomes a real taxon_node once it clears the community vote threshold
// (handle_id_vote_change, sql/supabase/09_unidentified_id_flow.sql), so this
// never bypasses moderation, it just removes the extra round trip.
export async function quickAddMorph(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to add a morph." };

  const genusId = String(formData.get("genus_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const genusSlug = String(formData.get("genus_slug") ?? "");
  if (!genusId) return { error: "Missing genus reference." };
  if (!name) return { error: "Give the morph a name." };

  const uploaded = await uploadPhotoFile(supabase, user.id, formData.get("photo"));
  if ("error" in uploaded) return uploaded;

  const { data: photo, error: photoError } = await supabase
    .from("coral_photos")
    .insert({
      uploader_user_id: user.id,
      taxon_node_id: genusId,
      is_public: true,
      taken_at: new Date().toISOString(),
      storage_provider: "supabase",
      storage_key: uploaded.path,
      url: uploaded.publicUrl,
      mime: uploaded.mime,
      bytes: uploaded.bytes,
    })
    .select("id")
    .single();

  if (photoError || !photo) {
    await supabase.storage.from("coral-photos").remove([uploaded.path]);
    return { error: `Could not save photo: ${photoError?.message ?? "unknown error"}` };
  }

  const { error: suggestionError } = await supabase.from("id_suggestions").insert({
    coral_photo_id: photo.id,
    proposed_taxon_id: null,
    proposed_name: name,
    proposed_genus_id: genusId,
    suggested_by_user_id: user.id,
  });
  if (suggestionError) {
    await supabase.storage.from("coral-photos").remove([uploaded.path]);
    await supabase.from("coral_photos").delete().eq("id", photo.id);
    return { error: suggestionError.message };
  }

  if (genusSlug) revalidatePath(`/coral/${genusSlug}`);
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


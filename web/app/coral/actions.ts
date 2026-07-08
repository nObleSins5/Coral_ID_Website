"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeParameterSnapshot, uploadPhotoFile } from "@/lib/photo-upload";

// Uploads a standalone photo attached to a taxon (Door 1). The
// "unidentified — help me ID this" path lives separately in
// app/identify/actions.ts (uploadUnidentifiedPhoto) — this always attaches to
// an already-identified coral. (Specimen linkage is handled separately by
// addSpecimen below, via representative_photo_id.)
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

  const { error: insertError } = await supabase.from("coral_photos").insert({
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
  });

  if (insertError) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned object.
    await supabase.storage.from("coral-photos").remove([uploaded.path]);
    return { error: `Could not save photo: ${insertError.message}` };
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

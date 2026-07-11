"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeParameterSnapshot, resolveGenusId, uploadPhotoFile } from "@/lib/photo-upload";

// Uploads a photo with NO taxon attached — Door 1's primary entry point
// ("what is this coral?"). It appears in the /identify queue for the
// community to propose and vote on an identification.
export async function uploadUnidentifiedPhoto(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to add a photo." };

  const tankId = String(formData.get("tank_id") ?? "") || null;
  const takenAtRaw = String(formData.get("taken_at") ?? "");

  const uploaded = await uploadPhotoFile(supabase, user.id, formData.get("photo"));
  if ("error" in uploaded) return uploaded;

  const snapshot = await computeParameterSnapshot(supabase, tankId, takenAtRaw);

  const { error: insertError } = await supabase.from("coral_photos").insert({
    uploader_user_id: user.id,
    taxon_node_id: null,
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
    await supabase.storage.from("coral-photos").remove([uploaded.path]);
    return { error: `Could not save photo: ${insertError.message}` };
  }

  revalidatePath("/identify");
  return {};
}

// Proposes an identification for an unidentified photo. Three paths,
// distinguished by which fields are present (see docs/future-considerations.md
// for why alias approval is deliberately decoupled from this vote):
//   1. existingTaxonId only            -> simple match, no alias claim.
//   2. existingTaxonId + aliasName     -> match, PLUS a separate (unapproved
//                                          until reviewed) alias proposal.
//   3. newName + newGenusId            -> a genuinely new, undocumented morph;
//                                          confirming this later CREATES the
//                                          taxon_node (see the DB trigger).
export async function proposeIdentification(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to propose an identification." };

  const photoId = String(formData.get("photo_id") ?? "");
  const existingTaxonId = String(formData.get("existing_taxon_id") ?? "") || null;
  const aliasName = String(formData.get("alias_name") ?? "").trim() || null;
  const newName = String(formData.get("new_name") ?? "").trim() || null;
  let newGenusId = String(formData.get("new_genus_id") ?? "") || null;

  if (!photoId) return { error: "Missing photo reference." };

  if (!existingTaxonId && !newName) {
    return { error: "Pick an existing coral or name a new one." };
  }
  if (!existingTaxonId && newName && !newGenusId) {
    return { error: "Choose which genus this new coral belongs to." };
  }

  const resolvedGenus = await resolveGenusId(supabase, newGenusId);
  if (resolvedGenus.error) return { error: resolvedGenus.error };
  newGenusId = resolvedGenus.id;

  // A photo escalated here from a private, local-only specimen (see
  // app/tank/actions.ts quickAddLocal) needs to become public — the
  // community can't vote on something it can't see. No-op for photos that
  // were already public (the normal /identify path).
  await supabase
    .from("coral_photos")
    .update({ is_public: true })
    .eq("id", photoId)
    .eq("uploader_user_id", user.id);

  const { error: insertError } = await supabase.from("id_suggestions").insert({
    coral_photo_id: photoId,
    proposed_taxon_id: existingTaxonId,
    proposed_name: existingTaxonId ? aliasName : newName,
    proposed_genus_id: existingTaxonId ? null : newGenusId,
    suggested_by_user_id: user.id,
  });
  if (insertError) return { error: insertError.message };

  // The alias claim is recorded but NOT auto-approved by this vote — see
  // docs/future-considerations.md: identifying the photo and approving an
  // alternate name are different judgments, so this sits pending review.
  if (existingTaxonId && aliasName) {
    const normalized = aliasName.toLowerCase().trim();
    await supabase.from("coral_aliases").insert({
      taxon_node_id: existingTaxonId,
      alias_name: aliasName,
      alias_name_normalized: normalized,
      proposed_by_user_id: user.id,
    });
    // Ignore a duplicate-alias conflict silently — the suggestion itself
    // still succeeded, which is the primary action here.
  }

  revalidatePath("/identify");
  return {};
}

// Casts, switches, or retracts a single up/down vote on a suggestion.
export async function voteOnSuggestion(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to vote." };

  const suggestionId = String(formData.get("suggestion_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!suggestionId || (direction !== "up" && direction !== "down")) {
    return { error: "Invalid vote." };
  }
  const value = direction === "up" ? 1 : -1;

  const { data: existing } = await supabase
    .from("id_votes")
    .select("id, value")
    .eq("id_suggestion_id", suggestionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.value === value) {
    // Same direction again -> retract.
    const { error } = await supabase.from("id_votes").delete().eq("id", existing.id);
    if (error) return { error: error.message };
  } else if (existing) {
    // Opposite direction -> switch.
    const { error } = await supabase
      .from("id_votes")
      .update({ value })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("id_votes").insert({
      id_suggestion_id: suggestionId,
      user_id: user.id,
      value,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/identify");
  return {};
}

// Soft-deletes one of the CURRENT user's own photos (owner-only, enforced by
// RLS regardless of this check) — lets them retract a photo from the
// identification queue.
export async function removePhoto(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const photoId = String(formData.get("photo_id") ?? "");
  if (!photoId) return { error: "Missing photo reference." };

  const { error } = await supabase
    .from("coral_photos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", photoId)
    .eq("uploader_user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/identify");
  return {};
}

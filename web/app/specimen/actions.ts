"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Updates a specimen's own fields: nickname, acquired date, and its
// representative photo (a display pick — may be anyone's public photo, see
// specimens.representative_photo_id). Specimen editing didn't exist before
// this: previously the photo could only be set once, at creation.
export async function updateSpecimen(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const specimenId = String(formData.get("specimen_id") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const acquiredOnRaw = String(formData.get("acquired_on") ?? "");
  const representativePhotoId =
    String(formData.get("representative_photo_id") ?? "") || null;
  if (!specimenId) return { error: "Missing specimen reference." };

  let photoUploaderId: string | null = null;
  if (representativePhotoId) {
    const { data: photo } = await supabase
      .from("coral_photos")
      .select("uploader_user_id, is_public")
      .eq("id", representativePhotoId)
      .maybeSingle();
    if (!photo?.is_public) return { error: "That photo is no longer available." };
    photoUploaderId = photo.uploader_user_id;
  }

  const { error } = await supabase
    .from("specimens")
    .update({
      name,
      acquired_on: acquiredOnRaw || null,
      representative_photo_id: representativePhotoId,
    })
    .eq("id", specimenId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  // Own photo -> also record true provenance, same as addSpecimen.
  if (representativePhotoId && photoUploaderId === user.id) {
    await supabase
      .from("coral_photos")
      .update({ specimen_id: specimenId })
      .eq("id", representativePhotoId);
  }

  revalidatePath(`/specimen/${specimenId}`);
  return {};
}

// Places or moves a specimen into a grid slot. A move is a single UPDATE of
// grid_slot_id, so the specimen's previous slot (if any) is vacated
// automatically — no separate "unplace" step needed. The DB's partial unique
// index (uq_specimens_grid_slot) rejects a slot that's already occupied.
export async function placeSpecimen(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const specimenId = String(formData.get("specimen_id") ?? "");
  const gridSlotId = String(formData.get("grid_slot_id") ?? "");
  if (!specimenId || !gridSlotId) return { error: "Choose a slot." };

  const { data: specimen } = await supabase
    .from("specimens")
    .select("id, tank_id")
    .eq("id", specimenId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!specimen) return { error: "Specimen not found." };

  const { data: slot } = await supabase
    .from("grid_slots")
    .select("id, tank_id")
    .eq("id", gridSlotId)
    .maybeSingle();
  if (!slot || slot.tank_id !== specimen.tank_id) {
    return { error: "That slot isn't in this specimen's tank." };
  }

  const { error } = await supabase
    .from("specimens")
    .update({ grid_slot_id: gridSlotId })
    .eq("id", specimenId);
  if (error) return { error: "That slot is already occupied." };

  revalidatePath(`/tank/${specimen.tank_id}`);
  revalidatePath(`/specimen/${specimenId}`);
  return {};
}

// "Remove from tank" — clears the slot but keeps the specimen record intact.
export async function removeFromSlot(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const specimenId = String(formData.get("specimen_id") ?? "");
  if (!specimenId) return { error: "Missing specimen reference." };

  const { data: specimen, error } = await supabase
    .from("specimens")
    .update({ grid_slot_id: null })
    .eq("id", specimenId)
    .eq("user_id", user.id)
    .select("tank_id")
    .single();
  if (error) return { error: error.message };

  if (specimen?.tank_id) revalidatePath(`/tank/${specimen.tank_id}`);
  revalidatePath(`/specimen/${specimenId}`);
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildGridSlots, MAX_GRID_SLOTS } from "@/lib/grid";
import { computeParameterSnapshot, resolveGenusId, uploadPhotoFile } from "@/lib/photo-upload";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOwnedTank(supabase: any, tankId: string, userId: string) {
  const { data } = await supabase
    .from("tanks")
    .select("id")
    .eq("id", tankId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

// Generates a tank's grid once (columns x rows x tiers). Only for tanks that
// don't have one yet — reconfiguring in place would orphan any specimens
// already placed, so this is intentionally one-shot (see schema-decisions.md
// §4: no historical/resizable slot layout in v1).
export async function configureGrid(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const columns = Number(formData.get("grid_columns") ?? 0);
  const rows = Number(formData.get("grid_rows") ?? 0);
  const tiers = Number(formData.get("tier_count") ?? 1) || 1;
  if (!tankId || columns < 1 || rows < 1) {
    return { error: "Enter at least 1 column and 1 row." };
  }
  if (columns * rows * tiers > MAX_GRID_SLOTS) {
    return { error: `That's ${columns * rows * tiers} slots — max is ${MAX_GRID_SLOTS}.` };
  }

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { count } = await supabase
    .from("grid_slots")
    .select("id", { count: "exact", head: true })
    .eq("tank_id", tankId);
  if (count && count > 0) return { error: "This tank already has a grid." };

  const slots = buildGridSlots(tankId, columns, rows, tiers);
  const { error: insertError } = await supabase.from("grid_slots").insert(slots);
  if (insertError) return { error: insertError.message };

  await supabase
    .from("tanks")
    .update({ grid_columns: columns, grid_rows: rows, tier_count: tiers })
    .eq("id", tankId);

  revalidatePath(`/tank/${tankId}`);
  return {};
}

// Unwinds a configured grid entirely: clears every specimen's grid_slot_id
// (back to the "Not yet in the grid" list) and deletes the slot layout, so
// the tank goes back through ConfigureGridForm. The one-shot-at-creation
// design (see configureGrid above) still holds — this is a deliberate reset,
// not a resize, and the client-side confirm warns the user before calling it.
export async function resetGrid(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { error: unplaceError } = await supabase
    .from("specimens")
    .update({ grid_slot_id: null })
    .eq("tank_id", tankId);
  if (unplaceError) return { error: unplaceError.message };

  const { error: deleteError } = await supabase
    .from("grid_slots")
    .delete()
    .eq("tank_id", tankId);
  if (deleteError) return { error: deleteError.message };

  const { error: clearError } = await supabase
    .from("tanks")
    .update({ grid_columns: null, grid_rows: null })
    .eq("id", tankId);
  if (clearError) return { error: clearError.message };

  revalidatePath(`/tank/${tankId}`);
  return {};
}

// Publishes/unpublishes a read-only showcase of this tank's grid at
// /showcase/[id] (sql/supabase/28_public_tank_showcase.sql) — business-tier
// only, matching the existing account_type_code gate on affiliate_links
// (12_business_listings.sql). Enforced here in the app layer rather than in
// RLS: tanks' owner-ALL policy already lets an owner update any column on
// their own row, and Postgres RLS has no column-level granularity to narrow
// just this one flag further.
export async function setTankPublic(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const makePublic = formData.get("is_public") === "true";

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  if (makePublic) {
    const { data: profile } = await supabase
      .from("users")
      .select("account_type_code")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.account_type_code !== "business") {
      return { error: "Publishing a tank showcase is a business-account feature." };
    }
  }

  const { error } = await supabase
    .from("tanks")
    .update({ is_public: makePublic })
    .eq("id", tankId);
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tankId}`);
  revalidatePath(`/showcase/${tankId}`);
  return {};
}

// Toggles the pastable forum-signature badge (app/badge/[id]/route.tsx) —
// unlike setTankPublic above, deliberately NO account-type gate: this only
// exposes current parameters + a species list (see 32_tank_badge.sql), not
// the full grid, so any owner (hobbyist or business) may enable it for
// their own tank.
export async function setTankBadgeEnabled(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const enabled = formData.get("badge_enabled") === "true";

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { error } = await supabase
    .from("tanks")
    .update({ badge_enabled: enabled })
    .eq("id", tankId);
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tankId}`);
  revalidatePath(`/showcase/${tankId}`);
  return {};
}

const SLOT_TYPE_CODES = new Set(["sand", "rock", "open_water", "frag_rack"]);

// Slot settings — substrate type + "not usable for coral" (sql/supabase/34_grid_slot_types.sql).
// Setting a slot to open_water cascades UPWARD to every tier above it at the
// same (x, y) — coral grows up into open water, not the reverse, so 99% of
// the time a lower-tier open-water call should apply to everything above it
// too. cascade_open_water lets the caller opt out (the client shows a confirm
// step first when there ARE higher tiers to affect).
export async function updateGridSlot(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const gridSlotId = String(formData.get("grid_slot_id") ?? "");
  const slotTypeCodeRaw = String(formData.get("slot_type_code") ?? "");
  const slotTypeCode = SLOT_TYPE_CODES.has(slotTypeCodeRaw) ? slotTypeCodeRaw : null;
  const disabled = formData.get("disabled") === "true";
  const cascadeOpenWater = formData.get("cascade_open_water") !== "false";
  if (!gridSlotId) return { error: "Missing slot reference." };

  const { data: slot } = await supabase
    .from("grid_slots")
    .select("id, tank_id, x, y, z, tanks!inner ( user_id )")
    .eq("id", gridSlotId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner = (slot as any)?.tanks?.user_id;
  if (!slot || owner !== user.id) return { error: "Slot not found." };

  const { error } = await supabase
    .from("grid_slots")
    .update({ slot_type_code: slotTypeCode, disabled })
    .eq("id", gridSlotId);
  if (error) return { error: error.message };

  if (slotTypeCode === "open_water" && cascadeOpenWater) {
    await supabase
      .from("grid_slots")
      .update({ slot_type_code: "open_water" })
      .eq("tank_id", slot.tank_id)
      .eq("x", slot.x)
      .eq("y", slot.y)
      .gt("z", slot.z);
  }

  revalidatePath(`/tank/${slot.tank_id}`);
  return {};
}

// --- Quick-add (tank grid page: search the wiki, add, place — no navigating
// away). Three branches sharing the same shape (create a specimen, optionally
// a photo, optionally straight into a grid slot) but differing in what the
// specimen/photo mean:
//   quickAddExisting     -> a real wiki coral, found via search.
//   quickAddLocal        -> "just label this slot" — private, no community.
//   quickAddUnidentified -> "propose as new" — public, kicks off /identify.
// -----------------------------------------------------------------------

// A coral that's already in the wiki. Optionally attaches a fresh photo of
// your own (public, votable, appears on that morph's page — same as
// uploading from the morph page itself) and/or places straight into a slot.
export async function quickAddExisting(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const taxonNodeId = String(formData.get("taxon_node_id") ?? "");
  const gridSlotId = String(formData.get("grid_slot_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim() || null;
  const takenAtRaw = String(formData.get("taken_at") ?? "");
  // An existing public photo picked via PhotoPicker ("use a community
  // photo") instead of a fresh upload — mutually exclusive with `photo`
  // below, mirrors addSpecimen's representative_photo_id validation
  // (app/coral/actions.ts).
  const pickedPhotoId = String(formData.get("representative_photo_id") ?? "") || null;
  if (!taxonNodeId) return { error: "Choose a coral." };

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  let pickedPhotoUploaderId: string | null = null;
  if (pickedPhotoId) {
    const { data: photo } = await supabase
      .from("coral_photos")
      .select("uploader_user_id, is_public")
      .eq("id", pickedPhotoId)
      .maybeSingle();
    if (!photo?.is_public) return { error: "That photo is no longer available." };
    pickedPhotoUploaderId = photo.uploader_user_id;
  }

  const { data: specimen, error: specimenError } = await supabase
    .from("specimens")
    .insert({
      user_id: user.id,
      tank_id: tankId,
      grid_slot_id: gridSlotId,
      taxon_node_id: taxonNodeId,
      name,
      representative_photo_id: pickedPhotoId,
    })
    .select("id")
    .single();
  if (specimenError || !specimen) {
    return { error: specimenError?.message ?? "Could not create specimen." };
  }

  if (pickedPhotoId && pickedPhotoUploaderId === user.id) {
    await supabase.from("coral_photos").update({ specimen_id: specimen.id }).eq("id", pickedPhotoId);
  }

  const photoFile = formData.get("photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    const uploaded = await uploadPhotoFile(supabase, user.id, photoFile);
    if ("error" in uploaded) return uploaded;
    const snapshot = await computeParameterSnapshot(supabase, tankId, takenAtRaw);
    const { data: photo, error: photoError } = await supabase
      .from("coral_photos")
      .insert({
        uploader_user_id: user.id,
        taxon_node_id: taxonNodeId,
        specimen_id: specimen.id,
        tank_id: tankId,
        is_public: true,
        taken_at: takenAtRaw ? new Date(takenAtRaw).toISOString() : new Date().toISOString(),
        storage_provider: "supabase",
        storage_key: uploaded.path,
        url: uploaded.publicUrl,
        mime: uploaded.mime,
        bytes: uploaded.bytes,
        ...snapshot,
      })
      .select("id")
      .single();
    if (photoError || !photo) {
      await supabase.storage.from("coral-photos").remove([uploaded.path]);
      return { error: `Could not save photo: ${photoError?.message ?? "unknown error"}` };
    }
    await supabase
      .from("specimens")
      .update({ representative_photo_id: photo.id })
      .eq("id", specimen.id);
  }

  revalidatePath(`/tank/${tankId}`);
  return {};
}

// "Just label this slot" — a private, local-only specimen: no taxon match,
// no community involvement. A photo here is visible only to its owner (RLS
// coral_photos_owner_write covers this regardless of is_public) and never
// shown on any wiki page. See ProposeIdentificationForm on /specimen/[id] for
// the separate, higher-friction escalation into the community pipeline,
// which reuses this same photo rather than requiring a re-upload.
export async function quickAddLocal(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const gridSlotId = String(formData.get("grid_slot_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const takenAtRaw = String(formData.get("taken_at") ?? "");
  if (!name) return { error: "Give it a label." };

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { data: specimen, error: specimenError } = await supabase
    .from("specimens")
    .insert({
      user_id: user.id,
      tank_id: tankId,
      grid_slot_id: gridSlotId,
      taxon_node_id: null,
      name,
    })
    .select("id")
    .single();
  if (specimenError || !specimen) {
    return { error: specimenError?.message ?? "Could not create specimen." };
  }

  const photoFile = formData.get("photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    const uploaded = await uploadPhotoFile(supabase, user.id, photoFile);
    if ("error" in uploaded) return uploaded;
    const snapshot = await computeParameterSnapshot(supabase, tankId, takenAtRaw);
    const { data: photo, error: photoError } = await supabase
      .from("coral_photos")
      .insert({
        uploader_user_id: user.id,
        taxon_node_id: null,
        specimen_id: specimen.id,
        tank_id: tankId,
        is_public: false,
        taken_at: takenAtRaw ? new Date(takenAtRaw).toISOString() : new Date().toISOString(),
        storage_provider: "supabase",
        storage_key: uploaded.path,
        url: uploaded.publicUrl,
        mime: uploaded.mime,
        bytes: uploaded.bytes,
        ...snapshot,
      })
      .select("id")
      .single();
    if (photoError || !photo) {
      await supabase.storage.from("coral-photos").remove([uploaded.path]);
      return { error: `Could not save photo: ${photoError?.message ?? "unknown error"}` };
    }
    await supabase
      .from("specimens")
      .update({ representative_photo_id: photo.id })
      .eq("id", specimen.id);
  }

  revalidatePath(`/tank/${tankId}`);
  return {};
}

// "Propose as a new coral for the wiki" — kicks off the community
// identification pipeline immediately (same shape as
// app/identify/actions.ts's uploadUnidentifiedPhoto + proposeIdentification,
// combined here since this starts fresh from the grid page). Requires a
// photo and a genus — the community pipeline is inherently photo-driven,
// there's nothing to vote on otherwise.
export async function quickAddUnidentified(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const gridSlotId = String(formData.get("grid_slot_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const genusIdRaw = String(formData.get("genus_id") ?? "") || null;
  const takenAtRaw = String(formData.get("taken_at") ?? "");
  if (!name) return { error: "Name this coral." };
  if (!genusIdRaw) return { error: "Choose which genus this belongs to." };

  const resolvedGenus = await resolveGenusId(supabase, genusIdRaw);
  if (resolvedGenus.error) return { error: resolvedGenus.error };
  const genusId = resolvedGenus.id;

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const uploaded = await uploadPhotoFile(supabase, user.id, formData.get("photo"));
  if ("error" in uploaded) return uploaded;

  const { data: specimen, error: specimenError } = await supabase
    .from("specimens")
    .insert({
      user_id: user.id,
      tank_id: tankId,
      grid_slot_id: gridSlotId,
      taxon_node_id: null,
      name,
    })
    .select("id")
    .single();
  if (specimenError || !specimen) {
    await supabase.storage.from("coral-photos").remove([uploaded.path]);
    return { error: specimenError?.message ?? "Could not create specimen." };
  }

  const snapshot = await computeParameterSnapshot(supabase, tankId, takenAtRaw);
  const { data: photo, error: photoError } = await supabase
    .from("coral_photos")
    .insert({
      uploader_user_id: user.id,
      taxon_node_id: null,
      specimen_id: specimen.id,
      tank_id: tankId,
      is_public: true,
      taken_at: takenAtRaw ? new Date(takenAtRaw).toISOString() : new Date().toISOString(),
      storage_provider: "supabase",
      storage_key: uploaded.path,
      url: uploaded.publicUrl,
      mime: uploaded.mime,
      bytes: uploaded.bytes,
      ...snapshot,
    })
    .select("id")
    .single();
  if (photoError || !photo) {
    await supabase.storage.from("coral-photos").remove([uploaded.path]);
    return { error: `Could not save photo: ${photoError?.message ?? "unknown error"}` };
  }

  await supabase
    .from("specimens")
    .update({ representative_photo_id: photo.id })
    .eq("id", specimen.id);

  const { error: suggestionError } = await supabase.from("id_suggestions").insert({
    coral_photo_id: photo.id,
    proposed_taxon_id: null,
    proposed_name: name,
    proposed_genus_id: genusId,
    suggested_by_user_id: user.id,
  });
  if (suggestionError) return { error: suggestionError.message };

  revalidatePath(`/tank/${tankId}`);
  revalidatePath("/identify");
  return {};
}

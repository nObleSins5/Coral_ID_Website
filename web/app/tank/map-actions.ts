"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadPhotoFile } from "@/lib/photo-upload";
import { MAX_MAP_PINS, MAX_MAP_TILES } from "@/lib/tank-map";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOwnedTile(supabase: any, tileId: string, userId: string) {
  const { data } = await supabase
    .from("tank_map_tiles")
    .select("id, tank_id, storage_path, tanks!inner(user_id)")
    .eq("id", tileId)
    .eq("tanks.user_id", userId)
    .maybeSingle();
  return data as { id: string; tank_id: string; storage_path: string } | null;
}

export async function setMapEnabled(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const enabled = formData.get("map_enabled") === "true";

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { error } = await supabase.from("tanks").update({ map_enabled: enabled }).eq("id", tankId);
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tankId}`);
  return {};
}

// Uploads a new photo as a tile, placed at a caller-supplied default
// position/size (the client drops it at a sensible default, e.g. centered,
// then the user drags/resizes it — see MapTile). Reuses the same storage
// bucket/upload helper as every other photo in the app (lib/photo-upload.ts).
export async function uploadMapTile(
  formData: FormData,
): Promise<{ error?: string; tileId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tankId = String(formData.get("tank_id") ?? "");
  const width = Number(formData.get("width") ?? 0);
  const height = Number(formData.get("height") ?? 0);
  if (!tankId || width <= 0 || height <= 0) return { error: "Missing tile placement." };

  const tank = await getOwnedTank(supabase, tankId, user.id);
  if (!tank) return { error: "Tank not found." };

  const { count } = await supabase
    .from("tank_map_tiles")
    .select("id", { count: "exact", head: true })
    .eq("tank_id", tankId);
  if (count != null && count >= MAX_MAP_TILES) {
    return { error: `This tank already has ${MAX_MAP_TILES} tiles, the current max.` };
  }

  const uploaded = await uploadPhotoFile(supabase, user.id, formData.get("photo"));
  if ("error" in uploaded) return uploaded;

  const posX = Number(formData.get("pos_x") ?? 0);
  const posY = Number(formData.get("pos_y") ?? 0);

  const { data: tile, error } = await supabase
    .from("tank_map_tiles")
    .insert({
      tank_id: tankId,
      storage_path: uploaded.path,
      pos_x: posX,
      pos_y: posY,
      width,
      height,
      z_index: count ?? 0,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !tile) {
    await supabase.storage.from("coral-photos").remove([uploaded.path]);
    return { error: error?.message ?? "Could not save tile." };
  }

  revalidatePath(`/tank/${tankId}`);
  return { tileId: tile.id };
}

// Persists a tile's transform (drag/resize/rotate/reorder) and/or its crop
// rectangle. Every field is optional so the client can send just what
// changed — e.g. a drag only sends pos_x/pos_y, a crop-tool save only sends
// the crop_* fields — without clobbering the rest.
export async function updateMapTile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tileId = String(formData.get("tile_id") ?? "");
  const tile = await getOwnedTile(supabase, tileId, user.id);
  if (!tile) return { error: "Tile not found." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  const numericFields = [
    "pos_x",
    "pos_y",
    "width",
    "height",
    "rotation",
    "z_index",
    "crop_x",
    "crop_y",
    "crop_width",
    "crop_height",
  ] as const;
  for (const field of numericFields) {
    const raw = formData.get(field);
    if (raw === null || raw === "") continue;
    update[field] = Number(raw);
  }
  if (Object.keys(update).length === 0) return { error: "Nothing to update." };

  const { error } = await supabase.from("tank_map_tiles").update(update).eq("id", tileId);
  if (error) return { error: error.message };

  revalidatePath(`/tank/${tile.tank_id}`);
  return {};
}

// Deletes a tile (cascades its pins via ON DELETE CASCADE — the corals
// themselves are untouched, only their map placement goes away) and cleans
// up the underlying storage object.
export async function deleteMapTile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const tileId = String(formData.get("tile_id") ?? "");
  const tile = await getOwnedTile(supabase, tileId, user.id);
  if (!tile) return { error: "Tile not found." };

  const { error } = await supabase.from("tank_map_tiles").delete().eq("id", tileId);
  if (error) return { error: error.message };

  await supabase.storage.from("coral-photos").remove([tile.storage_path]);

  revalidatePath(`/tank/${tile.tank_id}`);
  return {};
}

// Tags a coral to a point on a tile (relative to the tile's crop, per
// coral_map_pins.pos_x/pos_y — see 36_tank_map.sql). One pin per coral for
// MVP (uq_coral_map_pins_coral): re-tagging is done by dragging/upserting
// this same row, not by accumulating pins, matching the work order's
// "re-tagging is the intended way to handle coral movement" (non-goal #5).
// Called as a second step after quickAddExisting/quickAddLocal/
// quickAddUnidentified (app/tank/actions.ts, which now return specimenId)
// or after picking an unplaced specimen — mirrors how grid-slot-panel.tsx
// chains placeSpecimen then updateSpecimen for the grid's own add-coral flow.
export async function placeMapPin(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const coralId = String(formData.get("coral_id") ?? "");
  const tileId = String(formData.get("tile_id") ?? "");
  const posX = Number(formData.get("pos_x") ?? NaN);
  const posY = Number(formData.get("pos_y") ?? NaN);
  if (!coralId || !tileId || Number.isNaN(posX) || Number.isNaN(posY)) {
    return { error: "Choose a spot on the tile." };
  }

  const { data: specimen } = await supabase
    .from("specimens")
    .select("id, tank_id")
    .eq("id", coralId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!specimen) return { error: "Coral not found." };

  const tile = await getOwnedTile(supabase, tileId, user.id);
  if (!tile || tile.tank_id !== specimen.tank_id) {
    return { error: "That tile isn't in this coral's tank." };
  }

  const { count: existingPinCount } = await supabase
    .from("coral_map_pins")
    .select("id", { count: "exact", head: true })
    .eq("coral_id", coralId);
  if (!existingPinCount) {
    const { count } = await supabase
      .from("coral_map_pins")
      .select("id, tank_map_tiles!inner(tank_id)", { count: "exact", head: true })
      .eq("tank_map_tiles.tank_id", specimen.tank_id);
    if (count != null && count >= MAX_MAP_PINS) {
      return { error: `This tank already has ${MAX_MAP_PINS} pins, the current max.` };
    }
  }

  const { error } = await supabase
    .from("coral_map_pins")
    .upsert({ coral_id: coralId, tile_id: tileId, pos_x: posX, pos_y: posY }, { onConflict: "coral_id" });
  if (error) return { error: error.message };

  revalidatePath(`/tank/${specimen.tank_id}`);
  revalidatePath(`/specimen/${coralId}`);
  return {};
}

// Un-tags a coral from the map — deletes the pin, leaves the specimen and
// its grid_slot_id (if any) untouched.
export async function removeMapPin(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const coralId = String(formData.get("coral_id") ?? "");
  if (!coralId) return { error: "Missing coral reference." };

  const { data: specimen } = await supabase
    .from("specimens")
    .select("id, tank_id")
    .eq("id", coralId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!specimen) return { error: "Coral not found." };

  const { error } = await supabase.from("coral_map_pins").delete().eq("coral_id", coralId);
  if (error) return { error: error.message };

  if (specimen.tank_id) revalidatePath(`/tank/${specimen.tank_id}`);
  revalidatePath(`/specimen/${coralId}`);
  return {};
}

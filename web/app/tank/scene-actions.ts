"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clampToScene } from "@/lib/scene";

// Places or moves a specimen within a calibrated tank_scene. A move is a
// single upsert on (scene_id, specimen_id), same "no separate unplace step"
// shape as specimen/actions.ts's placeSpecimen for grid_slots. Position is
// clamped server-side too (not just in the canvas) so a stale client can't
// write a position outside the scene's known physical bounds.
export async function placeSpecimenInScene(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const sceneId = String(formData.get("scene_id") ?? "");
  const specimenId = String(formData.get("specimen_id") ?? "");
  const xMm = Number(formData.get("x_mm"));
  const yMm = Number(formData.get("y_mm"));
  const zMm = Number(formData.get("z_mm"));
  if (!sceneId || !specimenId || [xMm, yMm, zMm].some((n) => !Number.isFinite(n))) {
    return { error: "Tap the photo to set a position first." };
  }

  // RLS already scopes this to scenes the caller owns (tank_scenes_owner_all,
  // sql/supabase/36_tank_scale_model.sql) — a foreign scene_id resolves to no
  // row, not someone else's dimensions.
  const { data: scene } = await supabase
    .from("tank_scenes")
    .select("id, tank_id, width_mm, height_mm, depth_mm")
    .eq("id", sceneId)
    .maybeSingle();
  if (!scene) return { error: "Scene not found." };

  const { data: specimen } = await supabase
    .from("specimens")
    .select("id, tank_id")
    .eq("id", specimenId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!specimen || specimen.tank_id !== scene.tank_id) {
    return { error: "That coral isn't in this tank." };
  }

  const clamped = clampToScene(
    { x_mm: xMm, y_mm: yMm, z_mm: zMm },
    {
      width_mm: scene.width_mm ?? 0,
      height_mm: scene.height_mm ?? 0,
      depth_mm: scene.depth_mm ?? 0,
    },
  );

  const { error } = await supabase.from("specimen_placements").upsert(
    {
      scene_id: sceneId,
      specimen_id: specimenId,
      x_mm: clamped.x_mm,
      y_mm: clamped.y_mm,
      z_mm: clamped.z_mm,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "scene_id,specimen_id" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/tank/${scene.tank_id}`);
  return {};
}

// Clears a specimen's placement in a scene, keeping the specimen record and
// its grid_slot_id (if any, for grid-mode) intact — mirrors removeFromSlot.
export async function removeSpecimenPlacement(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const sceneId = String(formData.get("scene_id") ?? "");
  const specimenId = String(formData.get("specimen_id") ?? "");
  if (!sceneId || !specimenId) return { error: "Missing placement reference." };

  const { data: specimen } = await supabase
    .from("specimens")
    .select("id, tank_id")
    .eq("id", specimenId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!specimen) return { error: "Specimen not found." };

  const { error } = await supabase
    .from("specimen_placements")
    .delete()
    .eq("scene_id", sceneId)
    .eq("specimen_id", specimenId);
  if (error) return { error: error.message };

  revalidatePath(`/tank/${specimen.tank_id}`);
  return {};
}

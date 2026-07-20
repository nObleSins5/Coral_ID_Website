"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clampToScene, isValidCalibration, type SceneViewCalibration } from "@/lib/scene";

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

// Saves the pixel<->mm mapping for one scene_views photo (see
// components/scene-calibration-tool.tsx). scene_views_owner_all RLS already
// scopes the lookups below to scenes the caller owns — a foreign
// scene_view_id resolves to no row rather than someone else's photo.
export async function saveSceneCalibration(
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const sceneViewId = String(formData.get("scene_view_id") ?? "");
  const calibrationRaw = String(formData.get("calibration") ?? "");
  if (!sceneViewId || !calibrationRaw) return { error: "Mark all four reference points first." };

  let calibration: SceneViewCalibration;
  try {
    calibration = JSON.parse(calibrationRaw);
  } catch {
    return { error: "Invalid calibration data." };
  }
  if (!isValidCalibration(calibration)) {
    return { error: "Two reference points landed on the same spot — mark them further apart." };
  }

  const { data: sceneView } = await supabase
    .from("scene_views")
    .select("id, scene_id")
    .eq("id", sceneViewId)
    .maybeSingle();
  if (!sceneView) return { error: "Photo not found." };

  const { data: scene } = await supabase
    .from("tank_scenes")
    .select("id, tank_id")
    .eq("id", sceneView.scene_id)
    .maybeSingle();
  if (!scene) return { error: "Scene not found." };

  const { error } = await supabase
    .from("scene_views")
    .update({ calibration, updated_at: new Date().toISOString() })
    .eq("id", sceneViewId);
  if (error) return { error: error.message };

  revalidatePath(`/tank/${scene.tank_id}`);
  return {};
}

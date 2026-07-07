"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

// Uploads a standalone photo attached to a taxon (Door 1). Specimen linkage
// and the "unidentified — help me ID this" path are deferred (see
// docs/PROGRESS.md) — this always attaches to an already-identified coral.
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
  const file = formData.get("photo");

  if (!taxonNodeId) return { error: "Missing coral reference." };
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose an image to upload." };
  if (!ALLOWED_MIME.has(file.type))
    return { error: "Only JPG, PNG, or WEBP images are supported." };
  if (file.size > MAX_BYTES) return { error: "Image must be under 8MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("coral-photos")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const {
    data: { publicUrl },
  } = supabase.storage.from("coral-photos").getPublicUrl(path);

  // Optional: stamp the tank's most recent parameter reading (the immutable
  // snapshot — FK + denormalized copy, per docs/schema-decisions.md §7).
  let snapshot = {
    parameter_reading_id: null as string | null,
    snapshot_measured_at: null as string | null,
    snapshot_alkalinity_dkh: null as number | null,
    snapshot_calcium_ppm: null as number | null,
    snapshot_magnesium_ppm: null as number | null,
    snapshot_nitrate_ppm: null as number | null,
    snapshot_phosphate_ppm: null as number | null,
  };

  if (tankId) {
    const { data: reading } = await supabase
      .from("parameter_readings")
      .select(
        "id, measured_at, alkalinity_dkh, calcium_ppm, magnesium_ppm, nitrate_ppm, phosphate_ppm",
      )
      .eq("tank_id", tankId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reading) {
      snapshot = {
        parameter_reading_id: reading.id,
        snapshot_measured_at: reading.measured_at,
        snapshot_alkalinity_dkh: reading.alkalinity_dkh,
        snapshot_calcium_ppm: reading.calcium_ppm,
        snapshot_magnesium_ppm: reading.magnesium_ppm,
        snapshot_nitrate_ppm: reading.nitrate_ppm,
        snapshot_phosphate_ppm: reading.phosphate_ppm,
      };
    }
  }

  const { error: insertError } = await supabase.from("coral_photos").insert({
    uploader_user_id: user.id,
    taxon_node_id: taxonNodeId,
    tank_id: tankId,
    is_public: true,
    taken_at: takenAtRaw
      ? new Date(takenAtRaw).toISOString()
      : new Date().toISOString(),
    storage_provider: "supabase",
    storage_key: path,
    url: publicUrl,
    mime: file.type,
    bytes: file.size,
    ...snapshot,
  });

  if (insertError) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned object.
    await supabase.storage.from("coral-photos").remove([path]);
    return { error: `Could not save photo: ${insertError.message}` };
  }

  if (genusSlug && morphSlug) revalidatePath(`/coral/${genusSlug}/${morphSlug}`);
  return {};
}

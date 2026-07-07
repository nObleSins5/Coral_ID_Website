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
    // Find the reading that was actually current AS OF the photo's taken_at
    // date — not just "the latest" — so an old photo doesn't get today's
    // parameters stamped on it. taken_at is date-only, so the cutoff is the
    // END of that calendar day (a reading logged later the same day still
    // counts). No qualifying reading (photo predates all logging) => no
    // snapshot, which is the honest answer rather than a guess.
    const cutoff = new Date(
      `${takenAtRaw || new Date().toISOString().slice(0, 10)}T23:59:59.999Z`,
    ).toISOString();
    const { data: reading } = await supabase
      .from("parameter_readings")
      .select(
        "id, measured_at, alkalinity_dkh, calcium_ppm, magnesium_ppm, nitrate_ppm, phosphate_ppm",
      )
      .eq("tank_id", tankId)
      .lte("measured_at", cutoff)
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

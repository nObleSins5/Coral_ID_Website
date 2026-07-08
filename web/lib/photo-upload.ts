import type { SupabaseClient } from "@supabase/supabase-js";

// Shared upload/snapshot logic used by both app/coral/actions.ts
// (upload-to-a-known-coral) and app/identify/actions.ts (upload-unidentified).

export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_BYTES = 8 * 1024 * 1024;

export type ParameterSnapshot = {
  parameter_reading_id: string | null;
  snapshot_measured_at: string | null;
  snapshot_alkalinity_dkh: number | null;
  snapshot_calcium_ppm: number | null;
  snapshot_magnesium_ppm: number | null;
  snapshot_nitrate_ppm: number | null;
  snapshot_phosphate_ppm: number | null;
};

const EMPTY_SNAPSHOT: ParameterSnapshot = {
  parameter_reading_id: null,
  snapshot_measured_at: null,
  snapshot_alkalinity_dkh: null,
  snapshot_calcium_ppm: null,
  snapshot_magnesium_ppm: null,
  snapshot_nitrate_ppm: null,
  snapshot_phosphate_ppm: null,
};

// Finds the reading that was actually current AS OF the photo's taken_at date
// — not just "the latest" — so an old photo doesn't get today's parameters
// stamped on it. taken_at is date-only, so the cutoff is the END of that
// calendar day (a reading logged later the same day still counts). No
// qualifying reading (photo predates all logging) => no snapshot, the honest
// answer rather than a guess.
export async function computeParameterSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  tankId: string | null,
  takenAtRaw: string,
): Promise<ParameterSnapshot> {
  if (!tankId) return EMPTY_SNAPSHOT;

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

  if (!reading) return EMPTY_SNAPSHOT;
  return {
    parameter_reading_id: reading.id,
    snapshot_measured_at: reading.measured_at,
    snapshot_alkalinity_dkh: reading.alkalinity_dkh,
    snapshot_calcium_ppm: reading.calcium_ppm,
    snapshot_magnesium_ppm: reading.magnesium_ppm,
    snapshot_nitrate_ppm: reading.nitrate_ppm,
    snapshot_phosphate_ppm: reading.phosphate_ppm,
  };
}

export async function uploadPhotoFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  file: FormDataEntryValue | null,
): Promise<{ path: string; publicUrl: string; mime: string; bytes: number } | { error: string }> {
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose an image to upload." };
  if (!ALLOWED_MIME.has(file.type))
    return { error: "Only JPG, PNG, or WEBP images are supported." };
  if (file.size > MAX_BYTES) return { error: "Image must be under 8MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("coral-photos")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const {
    data: { publicUrl },
  } = supabase.storage.from("coral-photos").getPublicUrl(path);

  return { path, publicUrl, mime: file.type, bytes: file.size };
}

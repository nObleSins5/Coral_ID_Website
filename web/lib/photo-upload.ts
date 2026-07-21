import type { SupabaseClient } from "@supabase/supabase-js";

// Shared upload/snapshot logic used by both app/coral/actions.ts
// (upload-to-a-known-coral) and app/identify/actions.ts (upload-unidentified).

export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
// 20MB, not the original 8MB — the tank scene model (scene-actions.ts's
// uploadSceneView) needs meaningfully higher-resolution photos than a coral
// macro shot: the feature's payoff is digitally zooming into a rock outcrop
// later, so resolution is load-bearing here, not just nice-to-have. Applies
// to every photo-upload flow that shares this helper, not just scenes.
export const MAX_BYTES = 20 * 1024 * 1024;

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

// A reading session doesn't have to log every parameter — a hobbyist might
// only test alkalinity that day and leave the rest blank. Per-parameter
// lookback across the tank's history means a photo still gets the last
// known value for each parameter individually, rather than nulling out a
// field just because the closest single session didn't happen to include
// it. Bounded lookback window, not unbounded history.
const LOOKBACK_READINGS = 50;

// Finds the parameter values that were actually current AS OF the photo's
// taken_at date — not just "the latest" — so an old photo doesn't get
// today's parameters stamped on it. taken_at is date-only, so the cutoff is
// the END of that calendar day (a reading logged later the same day still
// counts). No qualifying reading at all (photo predates all logging) =>
// no snapshot, the honest answer rather than a guess.
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
  const { data: readings } = await supabase
    .from("parameter_readings")
    .select(
      "id, measured_at, alkalinity_dkh, calcium_ppm, magnesium_ppm, nitrate_ppm, phosphate_ppm",
    )
    .eq("tank_id", tankId)
    .lte("measured_at", cutoff)
    .order("measured_at", { ascending: false })
    .limit(LOOKBACK_READINGS);

  if (!readings || readings.length === 0) return EMPTY_SNAPSHOT;

  const closest = readings[0];
  const firstNonNull = (key: keyof (typeof readings)[number]) => {
    for (const r of readings) {
      if (r[key] != null) return r[key];
    }
    return null;
  };

  return {
    parameter_reading_id: closest.id,
    snapshot_measured_at: closest.measured_at,
    snapshot_alkalinity_dkh: firstNonNull("alkalinity_dkh"),
    snapshot_calcium_ppm: firstNonNull("calcium_ppm"),
    snapshot_magnesium_ppm: firstNonNull("magnesium_ppm"),
    snapshot_nitrate_ppm: firstNonNull("nitrate_ppm"),
    snapshot_phosphate_ppm: firstNonNull("phosphate_ppm"),
  };
}

// Reusable "not sure which genus" bucket a brand-new-morph proposal can point
// to instead of a real genus — id_suggestions_new_morph_needs_genus (schema)
// requires SOME genus even when the proposer doesn't know it. Sent from the
// client as the sentinel value "unsure" (not a real uuid); resolved here to
// the actual placeholder taxon_node id (sql/supabase/15_unknown_genus_placeholder.sql)
// so callers never need to know it. Shared by app/identify/actions.ts
// (propose an ID) and app/tank/actions.ts (quick-add "propose as new").
const UNKNOWN_GENUS_SLUG = "genus-unknown";

export async function resolveGenusId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  genusId: string | null,
): Promise<{ id: string | null; error?: string }> {
  if (genusId !== "unsure") return { id: genusId };

  const { data: unknownGenus } = await supabase
    .from("taxon_nodes")
    .select("id")
    .eq("slug", UNKNOWN_GENUS_SLUG)
    .maybeSingle();
  if (!unknownGenus) {
    return { id: null, error: "Couldn't resolve the 'genus unknown' bucket — try again later." };
  }
  return { id: unknownGenus.id };
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

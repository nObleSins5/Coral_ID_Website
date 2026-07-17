import type { SupabaseClient } from "@supabase/supabase-js";
import { withGenusCareDefaults, type CareFields } from "@/lib/wiki";

// Pure aggregation: what a tank's corals NEED vs. what the tank actually HAS
// logged, surfaced as a short list of calm, specific callouts on /tank/[id].
// See docs/tank-callout-engine-brief.md for the shaped design decisions this
// implements (conflict handling, equipment-sufficiency rule, tone).
//
// Deliberately narrow for v1: presence-only equipment check (no wattage/PAR
// inference — see the brief's "false precision" note), no stale-reading
// chip, temperature_c is compared only if actually logged (the dashboard's
// logging form doesn't currently collect it, so this is usually a no-op
// until that's added — not something this module should paper over).

export const PARAM_KEYS = [
  "alkalinity_dkh",
  "calcium_ppm",
  "magnesium_ppm",
  "nitrate_ppm",
  "phosphate_ppm",
  "temperature_c",
] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

export const PARAM_META: Record<ParamKey, { label: string; unit: string }> = {
  alkalinity_dkh: { label: "Alkalinity", unit: "dKH" },
  calcium_ppm: { label: "Calcium", unit: "ppm" },
  magnesium_ppm: { label: "Magnesium", unit: "ppm" },
  nitrate_ppm: { label: "Nitrate", unit: "ppm" },
  phosphate_ppm: { label: "Phosphate", unit: "ppm" },
  temperature_c: { label: "Temperature", unit: "°C" },
};

type RecRange = { min: number | null; max: number | null };

export type ContributingMorph = CareFields & {
  id: string;
  name: string;
  ranges: Record<ParamKey, RecRange>;
};

export type LatestReading = {
  measured_at: string;
  alkalinity_dkh: number | null;
  calcium_ppm: number | null;
  magnesium_ppm: number | null;
  nitrate_ppm: number | null;
  phosphate_ppm: number | null;
  temperature_c: number | null;
};

export type EquipmentPresence = { light: boolean; flow: boolean };

export type ParamOutlierCallout = {
  type: "param_outlier";
  param: ParamKey;
  actual: number;
  // The band the reading falls outside of. When every contributing coral's
  // range overlaps, this is that shared intersection. When ranges don't
  // overlap at all, `offender` names the specific coral(s) this band belongs
  // to instead of pretending there's one universal target (see brief §9).
  band: { min: number | null; max: number | null };
  offenders: string[] | null; // null = shared band, all corals agree
};

export type EquipmentGapCallout = {
  type: "equipment_gap";
  category: "light" | "flow";
  demandTier: "medium" | "high";
  coralCount: number;
};

export type TankCallout = ParamOutlierCallout | EquipmentGapCallout;

export type TankStatus = {
  latestReading: LatestReading | null;
  callouts: TankCallout[];
  contributingCoralCount: number;
};

const TIER_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

// One parameter's intersection band across contributing morphs, or a
// conflict signal when no single value satisfies every morph's range.
function intersectRanges(
  ranges: { morph: ContributingMorph; range: RecRange }[],
): { min: number | null; max: number | null } | "conflict" {
  const withData = ranges.filter(
    (r) => r.range.min != null || r.range.max != null,
  );
  if (withData.length === 0) return { min: null, max: null };

  let min = -Infinity;
  let max = Infinity;
  for (const { range } of withData) {
    if (range.min != null) min = Math.max(min, range.min);
    if (range.max != null) max = Math.min(max, range.max);
  }
  if (min > max) return "conflict";
  return { min: min === -Infinity ? null : min, max: max === Infinity ? null : max };
}

function calloutsForParam(
  param: ParamKey,
  actual: number | null,
  contributing: ContributingMorph[],
): ParamOutlierCallout | null {
  if (actual == null) return null;

  const ranges = contributing
    .map((morph) => ({ morph, range: morph.ranges[param] }))
    .filter((r) => r.range.min != null || r.range.max != null);
  if (ranges.length === 0) return null;

  const intersection = intersectRanges(ranges);

  if (intersection !== "conflict") {
    const { min, max } = intersection;
    if (min == null && max == null) return null;
    const outOfRange = (min != null && actual < min) || (max != null && actual > max);
    if (!outOfRange) return null;
    return { type: "param_outlier", param, actual, band: { min, max }, offenders: null };
  }

  // No shared band exists — report against whichever individual morph's
  // range the current reading actually violates, naming it specifically
  // rather than inventing a target nothing agreed to (brief §9, step 4).
  const violated = ranges.filter(({ range }) => {
    const { min, max } = range;
    return (min != null && actual < min) || (max != null && actual > max);
  });
  if (violated.length === 0) return null;

  // All violated ranges are reported as one callout per distinct band, but
  // v1 keeps this simple: one callout naming every offending coral against
  // the tightest violated band (most specific, most actionable line).
  const tightest = violated.reduce((a, b) => {
    const aWidth = (a.range.max ?? Infinity) - (a.range.min ?? -Infinity);
    const bWidth = (b.range.max ?? Infinity) - (b.range.min ?? -Infinity);
    return bWidth < aWidth ? b : a;
  });
  const offenders = violated
    .filter((v) => v.range.min === tightest.range.min && v.range.max === tightest.range.max)
    .map((v) => v.morph.name);

  return {
    type: "param_outlier",
    param,
    actual,
    band: { min: tightest.range.min, max: tightest.range.max },
    offenders,
  };
}

function equipmentGapCallouts(
  contributing: ContributingMorph[],
  equipment: EquipmentPresence,
): EquipmentGapCallout[] {
  const callouts: EquipmentGapCallout[] = [];

  for (const [category, key] of [
    ["light", "light_level_code"],
    ["flow", "flow_level_code"],
  ] as const) {
    let topTier = -1;
    let count = 0;
    for (const morph of contributing) {
      const tier = TIER_RANK[morph[key] ?? ""] ?? -1;
      if (tier > topTier) topTier = tier;
      if (tier >= TIER_RANK.medium) count += 1;
    }
    // Low-demand-only tanks don't get a gap callout — not logging a light for
    // an all-mushroom tank isn't a real gap worth a chip (brief §9, equipment
    // sufficiency rule, step 3).
    if (topTier < TIER_RANK.medium) continue;
    if (equipment[category]) continue;

    callouts.push({
      type: "equipment_gap",
      category,
      demandTier: topTier === TIER_RANK.high ? "high" : "medium",
      coralCount: count,
    });
  }

  return callouts;
}

// Pure core: given already-resolved inputs, compute the callout list. Kept
// free of Supabase so it's directly unit-testable.
export function buildTankStatus(
  contributing: ContributingMorph[],
  latestReading: LatestReading | null,
  equipment: EquipmentPresence,
): TankStatus {
  const paramCallouts = latestReading
    ? PARAM_KEYS.map((param) => calloutsForParam(param, latestReading[param], contributing)).filter(
        (c): c is ParamOutlierCallout => c != null,
      )
    : [];

  // Equipment-gap chips surface ahead of parameter-drift chips — a missing
  // fixture is usually further upstream than a drifted reading (brief §11).
  const callouts: TankCallout[] = [
    ...equipmentGapCallouts(contributing, equipment),
    ...paramCallouts,
  ];

  return { latestReading, callouts, contributingCoralCount: contributing.length };
}

// --- Data loading -----------------------------------------------------------

type SpecimenTaxonRow = {
  taxon_node_id: string | null;
};

export async function getTankStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  tankId: string,
): Promise<TankStatus> {
  const { data: specimens } = await supabase
    .from("specimens")
    .select("taxon_node_id")
    .eq("tank_id", tankId)
    .is("deleted_at", null);

  // Only taxon-linked specimens contribute demand — an unidentified or
  // genus-unknown specimen has no rec_* data to roll up (brief, Key States).
  const taxonIds = [
    ...new Set(
      ((specimens ?? []) as SpecimenTaxonRow[])
        .map((s) => s.taxon_node_id)
        .filter((id): id is string => !!id),
    ),
  ];

  let contributing: ContributingMorph[] = [];
  if (taxonIds.length > 0) {
    const { data: morphs } = await supabase
      .from("taxon_nodes")
      .select(
        `id, name, parent_id, care_difficulty_code, light_level_code, flow_level_code,
         rec_alkalinity_dkh_min, rec_alkalinity_dkh_max,
         rec_calcium_ppm_min, rec_calcium_ppm_max,
         rec_magnesium_ppm_min, rec_magnesium_ppm_max,
         rec_nitrate_ppm_min, rec_nitrate_ppm_max,
         rec_phosphate_ppm_min, rec_phosphate_ppm_max,
         rec_temperature_c_min, rec_temperature_c_max`,
      )
      .in("id", taxonIds)
      // The "Genus unknown" placeholder itself is never a real specimen's
      // taxon, but excluding rows with no parent_id defends against it or
      // any other rootless row cheaply, matching the brief's exclusion rule.
      .not("parent_id", "is", null);

    const genusIds = [...new Set((morphs ?? []).map((m) => m.parent_id as string))];
    const { data: genera } =
      genusIds.length > 0
        ? await supabase
            .from("taxon_nodes")
            .select("id, care_difficulty_code, light_level_code, flow_level_code")
            .in("id", genusIds)
        : { data: [] as (CareFields & { id: string })[] };
    const genusById = new Map((genera ?? []).map((g) => [g.id, g as CareFields]));

    contributing = (morphs ?? []).map((m) => {
      const withDefaults = withGenusCareDefaults(m, genusById.get(m.parent_id as string));
      return {
        id: m.id,
        name: m.name,
        care_difficulty_code: withDefaults.care_difficulty_code,
        light_level_code: withDefaults.light_level_code,
        flow_level_code: withDefaults.flow_level_code,
        ranges: {
          alkalinity_dkh: { min: m.rec_alkalinity_dkh_min, max: m.rec_alkalinity_dkh_max },
          calcium_ppm: { min: m.rec_calcium_ppm_min, max: m.rec_calcium_ppm_max },
          magnesium_ppm: { min: m.rec_magnesium_ppm_min, max: m.rec_magnesium_ppm_max },
          nitrate_ppm: { min: m.rec_nitrate_ppm_min, max: m.rec_nitrate_ppm_max },
          phosphate_ppm: { min: m.rec_phosphate_ppm_min, max: m.rec_phosphate_ppm_max },
          temperature_c: { min: m.rec_temperature_c_min, max: m.rec_temperature_c_max },
        },
      };
    });
  }

  const { data: readingRows } = await supabase
    .from("parameter_readings")
    .select("measured_at, alkalinity_dkh, calcium_ppm, magnesium_ppm, nitrate_ppm, phosphate_ppm, temperature_c")
    .eq("tank_id", tankId)
    .order("measured_at", { ascending: false })
    .limit(1);
  const latestReading = (readingRows?.[0] as LatestReading | undefined) ?? null;

  const { data: equipmentRows } = await supabase
    .from("equipment")
    .select("equipment_type_code")
    .eq("tank_id", tankId)
    .is("removed_on", null);
  const equipment: EquipmentPresence = {
    light: (equipmentRows ?? []).some((e) => e.equipment_type_code === "light"),
    flow: (equipmentRows ?? []).some((e) => e.equipment_type_code === "flow"),
  };

  return buildTankStatus(contributing, latestReading, equipment);
}

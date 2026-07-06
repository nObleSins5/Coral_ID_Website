import { createPublicClient } from "@/lib/supabase/public";
import type { ElementProfile } from "@/components/coral-ui";

// Read-only data access for the public coral wiki (genus -> morph browse tree).
// Species is intentionally not a browse level — see sql/supabase/04_normalize_taxonomy.sql.

export type Genus = {
  id: string;
  name: string;
  slug: string;
  scientific_name: string | null;
};

export type MorphSummary = {
  id: string;
  name: string;
  slug: string;
  care_difficulty_code: string | null;
  light_level_code: string | null;
  flow_level_code: string | null;
  growth_form_code: string | null;
  element_profiles: ElementProfile[];
};

export type MorphDetail = MorphSummary & {
  parent_id: string | null;
  scientific_name: string | null;
  placement: string | null;
  description: string | null;
  rec_alkalinity_dkh_min: number | null;
  rec_alkalinity_dkh_max: number | null;
  rec_calcium_ppm_min: number | null;
  rec_calcium_ppm_max: number | null;
  rec_magnesium_ppm_min: number | null;
  rec_magnesium_ppm_max: number | null;
  rec_nitrate_ppm_min: number | null;
  rec_nitrate_ppm_max: number | null;
  rec_phosphate_ppm_min: number | null;
  rec_phosphate_ppm_max: number | null;
  rec_temperature_c_min: number | null;
  rec_temperature_c_max: number | null;
};

const ELEMENT_SELECT =
  "element_type_code, description, color_ranges ( color_pattern_code, label, color_stops ( hex, ordinal ) )";

export async function getGenera(): Promise<
  (Genus & { morph_count: number })[]
> {
  const supabase = createPublicClient();

  const { data: genera, error } = await supabase
    .from("taxon_nodes")
    .select("id, name, slug, scientific_name")
    .eq("rank_code", "genus")
    .eq("is_visible", true)
    .order("name");

  if (error || !genera) return [];

  const { data: morphs } = await supabase
    .from("taxon_nodes")
    .select("parent_id")
    .eq("rank_code", "morph");

  const counts = new Map<string, number>();
  for (const m of morphs ?? []) {
    if (!m.parent_id) continue;
    counts.set(m.parent_id, (counts.get(m.parent_id) ?? 0) + 1);
  }

  return genera.map((g) => ({ ...g, morph_count: counts.get(g.id) ?? 0 }));
}

export async function getGenusBySlug(slug: string): Promise<Genus | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("taxon_nodes")
    .select("id, name, slug, scientific_name")
    .eq("rank_code", "genus")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getMorphsForGenus(
  genusId: string,
): Promise<MorphSummary[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("taxon_nodes")
    .select(
      `id, name, slug, care_difficulty_code, light_level_code, flow_level_code, growth_form_code,
       element_profiles ( ${ELEMENT_SELECT} )`,
    )
    .eq("rank_code", "morph")
    .eq("parent_id", genusId)
    .order("name");
  return (data as unknown as MorphSummary[]) ?? [];
}

export async function getMorphBySlug(
  slug: string,
): Promise<MorphDetail | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("taxon_nodes")
    .select(
      `id, name, slug, parent_id, scientific_name, placement, description,
       care_difficulty_code, light_level_code, flow_level_code, growth_form_code,
       rec_alkalinity_dkh_min, rec_alkalinity_dkh_max,
       rec_calcium_ppm_min, rec_calcium_ppm_max,
       rec_magnesium_ppm_min, rec_magnesium_ppm_max,
       rec_nitrate_ppm_min, rec_nitrate_ppm_max,
       rec_phosphate_ppm_min, rec_phosphate_ppm_max,
       rec_temperature_c_min, rec_temperature_c_max,
       element_profiles ( ${ELEMENT_SELECT} )`,
    )
    .eq("rank_code", "morph")
    .eq("slug", slug)
    .maybeSingle();
  return data as unknown as MorphDetail | null;
}

// Fetches a morph and its parent genus together, verifying the genus slug in
// the URL actually matches the morph's real parent (so /coral/wrong-genus/x 404s).
export async function getMorphWithGenus(
  genusSlug: string,
  morphSlug: string,
): Promise<{ morph: MorphDetail; genus: Genus } | null> {
  const morph = await getMorphBySlug(morphSlug);
  if (!morph || !morph.parent_id) return null;

  const supabase = createPublicClient();
  const { data: genus } = await supabase
    .from("taxon_nodes")
    .select("id, name, slug, scientific_name")
    .eq("id", morph.parent_id)
    .maybeSingle();

  if (!genus || genus.slug !== genusSlug) return null;
  return { morph, genus };
}

export async function getAllGenusSlugs(): Promise<string[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("taxon_nodes")
    .select("slug")
    .eq("rank_code", "genus")
    .eq("is_visible", true);
  return (data ?? []).map((r) => r.slug);
}

export async function getAllGenusMorphSlugPairs(): Promise<
  { genus: string; morph: string }[]
> {
  const supabase = createPublicClient();
  const { data: genera } = await supabase
    .from("taxon_nodes")
    .select("id, slug")
    .eq("rank_code", "genus");
  const { data: morphs } = await supabase
    .from("taxon_nodes")
    .select("slug, parent_id")
    .eq("rank_code", "morph");

  const genusById = new Map((genera ?? []).map((g) => [g.id, g.slug]));
  return (morphs ?? [])
    .filter((m) => m.parent_id && genusById.has(m.parent_id))
    .map((m) => ({ genus: genusById.get(m.parent_id!)!, morph: m.slug }));
}

import { createPublicClient } from "@/lib/supabase/public";
import type { ColorRange } from "@/components/coral-ui";
import { familiesForColorRanges, hexToFamily, type ColorFamily } from "@/lib/color-match";

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
  color_ranges: ColorRange[];
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
  "color_ranges ( position_label, color_pattern_code, label, approx_percent, color_stops ( hex, ordinal ) )";

export type CareFields = {
  care_difficulty_code: string | null;
  light_level_code: string | null;
  flow_level_code: string | null;
};

// Genus-level fallback: care difficulty, light, and flow are substantially a
// genus property, not a morph one (every Acropora wants high light/flow
// regardless of morph; every Euphyllia wants moderate difficulty and lower
// light/flow) — resolved at READ time rather than copied onto each morph at
// creation, so correcting a genus default instantly applies to every morph
// under it instead of needing a bulk update across already-created rows.
// Only fills in a field the morph itself left null; a morph that's a genuine
// exception to its genus keeps its own value. See
// docs/future-considerations.md ("Genus-level care defaults...").
export function withGenusCareDefaults<T extends CareFields>(
  morph: T,
  genusDefaults: CareFields | null | undefined,
): T {
  if (!genusDefaults) return morph;
  return {
    ...morph,
    care_difficulty_code: morph.care_difficulty_code ?? genusDefaults.care_difficulty_code,
    light_level_code: morph.light_level_code ?? genusDefaults.light_level_code,
    flow_level_code: morph.flow_level_code ?? genusDefaults.flow_level_code,
  };
}

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

export type GenusCategory = {
  id: string;
  name: string;
  slug: string;
};

// Display order for the wiki index's fold-out sections — not alphabetical
// (SPS/LPS/Soft Coral would scatter), and not stored on the row itself since
// taxon_nodes has no ordering column. See sql/supabase/24_coral_categories.sql
// for why these six exist instead of one generic "soft coral" bucket.
const CATEGORY_ORDER = ["sps", "lps", "mushroom", "leather", "zoanthid", "soft-coral"];

// Genus -> category grouping for the wiki index (one fold-out per category,
// genera as its contents) — the "coral" category root used to be one single
// hidden bucket; 24_coral_categories.sql re-parented every genus to the real
// one it belongs to.
export async function getGenusCategories(): Promise<
  (GenusCategory & { genera: (Genus & { morph_count: number })[] })[]
> {
  const supabase = createPublicClient();

  const [{ data: categories }, { data: genera }, { data: morphs }] = await Promise.all([
    supabase
      .from("taxon_nodes")
      .select("id, name, slug")
      .eq("rank_code", "category")
      .eq("is_visible", true),
    supabase
      .from("taxon_nodes")
      .select("id, parent_id, name, slug, scientific_name")
      .eq("rank_code", "genus")
      .eq("is_visible", true)
      .order("name"),
    supabase.from("taxon_nodes").select("parent_id").eq("rank_code", "morph"),
  ]);

  const morphCounts = new Map<string, number>();
  for (const m of morphs ?? []) {
    if (!m.parent_id) continue;
    morphCounts.set(m.parent_id, (morphCounts.get(m.parent_id) ?? 0) + 1);
  }

  const generaByCategory = new Map<string, (Genus & { morph_count: number })[]>();
  for (const g of (genera ?? []) as (Genus & { parent_id: string | null })[]) {
    if (!g.parent_id) continue;
    const list = generaByCategory.get(g.parent_id) ?? [];
    list.push({ ...g, morph_count: morphCounts.get(g.id) ?? 0 });
    generaByCategory.set(g.parent_id, list);
  }

  return (categories ?? [])
    .map((c) => ({ ...c, genera: generaByCategory.get(c.id) ?? [] }))
    .filter((c) => c.genera.length > 0)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug));
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
  const [{ data }, { data: genusDefaults }] = await Promise.all([
    supabase
      .from("taxon_nodes")
      .select(
        `id, name, slug, care_difficulty_code, light_level_code, flow_level_code, growth_form_code,
         ${ELEMENT_SELECT}`,
      )
      .eq("rank_code", "morph")
      .eq("parent_id", genusId)
      .order("name"),
    supabase
      .from("taxon_nodes")
      .select("care_difficulty_code, light_level_code, flow_level_code")
      .eq("id", genusId)
      .maybeSingle(),
  ]);
  const morphs = (data as unknown as MorphSummary[]) ?? [];
  return morphs.map((m) => withGenusCareDefaults(m, genusDefaults));
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
       ${ELEMENT_SELECT}`,
    )
    .eq("rank_code", "morph")
    .eq("slug", slug)
    .maybeSingle();
  return data as unknown as MorphDetail | null;
}

// Ordered element_type_codes for a genus's anatomy_template_code (which
// elements THIS kind of coral actually has) — sql/supabase/20_anatomy_templates.sql.
// Empty for a genus with no template assigned yet (e.g. the "Genus unknown"
// placeholder), which ElementColorKey treats as "fall back to whatever the
// morph itself has."
export async function getAnatomyTemplateElements(
  templateCode: string | null,
): Promise<string[]> {
  if (!templateCode) return [];
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("anatomy_template_elements")
    .select("element_type_code")
    .eq("template_code", templateCode)
    .order("sort_order");
  return (data ?? []).map((r) => r.element_type_code);
}

// Fetches a morph and its parent genus together, verifying the genus slug in
// the URL actually matches the morph's real parent (so /coral/wrong-genus/x 404s).
export async function getMorphWithGenus(
  genusSlug: string,
  morphSlug: string,
): Promise<{ morph: MorphDetail; genus: Genus; templateElementCodes: string[] } | null> {
  const morph = await getMorphBySlug(morphSlug);
  if (!morph || !morph.parent_id) return null;

  const supabase = createPublicClient();
  const { data: genus } = await supabase
    .from("taxon_nodes")
    .select(
      "id, name, slug, scientific_name, care_difficulty_code, light_level_code, flow_level_code, anatomy_template_code",
    )
    .eq("id", morph.parent_id)
    .maybeSingle();

  if (!genus || genus.slug !== genusSlug) return null;
  const templateElementCodes = await getAnatomyTemplateElements(genus.anatomy_template_code);
  return { morph: withGenusCareDefaults(morph, genus), genus, templateElementCodes };
}

export type WikiPhoto = {
  id: string;
  url: string;
  uploader_user_id: string;
  taken_at: string | null;
  created_at: string;
  snapshot_measured_at: string | null;
  snapshot_alkalinity_dkh: number | null;
  snapshot_calcium_ppm: number | null;
  snapshot_magnesium_ppm: number | null;
  snapshot_nitrate_ppm: number | null;
  snapshot_phosphate_ppm: number | null;
};

// Public gallery for a taxon. RLS (coral_photos_public_read) already scopes
// this to is_public rows, so no auth is required to read it.
export async function getPhotosForTaxon(taxonId: string): Promise<WikiPhoto[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("coral_photos")
    .select(
      "id, url, uploader_user_id, taken_at, created_at, snapshot_measured_at, snapshot_alkalinity_dkh, snapshot_calcium_ppm, snapshot_magnesium_ppm, snapshot_nitrate_ppm, snapshot_phosphate_ppm",
    )
    .eq("taxon_node_id", taxonId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  return (data as WikiPhoto[]) ?? [];
}

// Batched, narrow username lookup via the get_public_usernames() SECURITY
// DEFINER function (see sql/supabase/06_public_usernames.sql) — exposes only
// id+username, nothing else about a user.
export async function getUsernamesFor(
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_public_usernames", {
    user_ids: unique,
  });
  const map = new Map<string, string>();
  for (const row of (data as { id: string; username: string }[]) ?? [])
    map.set(row.id, row.username);
  return map;
}

// Tally of 'accurate' votes per photo, for hero-image selection and display.
// Computed live (no cached counter, no batch job) — trivial at this scale and
// keeps the hero image consistent the instant a vote tips the balance.
export async function getAccurateVoteCounts(
  photoIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (photoIds.length === 0) return counts;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("coral_photo_votes")
    .select("coral_photo_id")
    .in("coral_photo_id", photoIds)
    .eq("vote_type", "accurate");
  for (const row of data ?? []) {
    counts.set(row.coral_photo_id, (counts.get(row.coral_photo_id) ?? 0) + 1);
  }
  return counts;
}

// Hero photo (most-voted, ties to newest) per taxon, batched across every
// morph on a genus page in two queries total instead of two-per-morph. Same
// selection rule as the morph detail page's own hero logic.
export async function getHeroPhotoUrlsForTaxa(
  taxonIds: string[],
): Promise<Map<string, string>> {
  const heroUrlByTaxon = new Map<string, string>();
  if (taxonIds.length === 0) return heroUrlByTaxon;

  const supabase = createPublicClient();
  const { data: photos } = await supabase
    .from("coral_photos")
    .select("id, url, taxon_node_id, created_at")
    .in("taxon_node_id", taxonIds)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const photoList = (photos ?? []).filter((p) => p.url && p.taxon_node_id);
  if (photoList.length === 0) return heroUrlByTaxon;

  const voteCounts = await getAccurateVoteCounts(photoList.map((p) => p.id));

  const heroVotesByTaxon = new Map<string, number>();
  for (const p of photoList) {
    const taxonId = p.taxon_node_id as string;
    const v = voteCounts.get(p.id) ?? 0;
    const currentBest = heroVotesByTaxon.get(taxonId) ?? -1;
    if (v > currentBest) {
      heroVotesByTaxon.set(taxonId, v);
      heroUrlByTaxon.set(taxonId, p.url as string);
    }
  }
  return heroUrlByTaxon;
}

// Up to `limit` photos per taxon, most-voted first (ties to newest) — same
// hero-photo rule as getHeroPhotoUrlsForTaxa above, but keeping the whole
// ranked list instead of collapsing to one. Used by the identify funnel's
// per-result photo carousel so a result always leads with its real hero
// photo, then whatever else the community has posted.
export async function getTopPhotosForTaxa(
  taxonIds: string[],
  limit = 10,
): Promise<Map<string, string[]>> {
  const byTaxon = new Map<string, string[]>();
  if (taxonIds.length === 0) return byTaxon;

  const supabase = createPublicClient();
  const { data: photos } = await supabase
    .from("coral_photos")
    .select("id, url, taxon_node_id, created_at")
    .in("taxon_node_id", taxonIds)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const photoList = (photos ?? []).filter((p) => p.url && p.taxon_node_id);
  if (photoList.length === 0) return byTaxon;

  const voteCounts = await getAccurateVoteCounts(photoList.map((p) => p.id));

  const byTaxonRanked = new Map<string, { url: string; votes: number }[]>();
  for (const p of photoList) {
    const taxonId = p.taxon_node_id as string;
    const list = byTaxonRanked.get(taxonId) ?? [];
    list.push({ url: p.url as string, votes: voteCounts.get(p.id) ?? 0 });
    byTaxonRanked.set(taxonId, list);
  }
  for (const [taxonId, list] of byTaxonRanked) {
    // created_at desc already gives newest-first as the stable tiebreak;
    // a stable sort on votes desc preserves that ordering within each vote tier.
    list.sort((a, b) => b.votes - a.votes);
    byTaxon.set(taxonId, list.slice(0, limit).map((p) => p.url));
  }
  return byTaxon;
}

export type AffiliateLink = {
  id: string;
  vendor_name: string;
  url: string;
  link_type: string;
  coral_photo_id: string;
  for_sale_or_trade: boolean;
  price: number | null;
};

// Public vendor links across every public photo of a taxon (RLS already
// scopes affiliate_links to is_active, non-hidden rows —
// affiliate_links_public_read).
export async function getAffiliateLinksForTaxon(
  taxonId: string,
): Promise<AffiliateLink[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("affiliate_links")
    .select(
      "id, vendor_name, url, link_type, coral_photo_id, for_sale_or_trade, price, coral_photos!inner(taxon_node_id, is_public, deleted_at)",
    )
    .eq("coral_photos.taxon_node_id", taxonId)
    .eq("coral_photos.is_public", true)
    .is("coral_photos.deleted_at", null)
    .order("created_at", { ascending: false });
  return (data as unknown as AffiliateLink[]) ?? [];
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

export type FeaturedMorph = {
  id: string;
  name: string;
  slug: string;
  genusName: string;
  genusSlug: string;
  care_difficulty_code: string | null;
  heroUrl: string;
};

// A small real-photo showcase for the landing page — any morph with at
// least one public photo, newest-photographed first, using the same
// most-voted hero-photo rule as the genus/morph pages (getHeroPhotoUrlsForTaxa)
// rather than re-deriving it.
export async function getFeaturedMorphs(limit = 4): Promise<FeaturedMorph[]> {
  const supabase = createPublicClient();
  const { data: photoRows } = await supabase
    .from("coral_photos")
    .select("taxon_node_id, created_at")
    .eq("is_public", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const seen = new Set<string>();
  const taxonIds: string[] = [];
  for (const row of photoRows ?? []) {
    const id = row.taxon_node_id as string | null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    taxonIds.push(id);
    if (taxonIds.length >= limit) break;
  }
  if (taxonIds.length === 0) return [];

  const { data: morphs } = await supabase
    .from("taxon_nodes")
    .select("id, name, slug, care_difficulty_code, parent_id")
    .in("id", taxonIds);

  const genusIds = [
    ...new Set((morphs ?? []).map((m) => m.parent_id).filter(Boolean)),
  ] as string[];
  const { data: genera } = await supabase
    .from("taxon_nodes")
    .select("id, name, slug, care_difficulty_code")
    .in("id", genusIds);
  const genusById = new Map((genera ?? []).map((g) => [g.id, g]));

  const heroUrls = await getHeroPhotoUrlsForTaxa(taxonIds);

  const featured: FeaturedMorph[] = [];
  for (const m of morphs ?? []) {
    const genus = m.parent_id ? genusById.get(m.parent_id) : undefined;
    const heroUrl = heroUrls.get(m.id);
    if (!genus || !heroUrl) continue;
    featured.push({
      id: m.id,
      name: m.name,
      slug: m.slug,
      genusName: genus.name,
      genusSlug: genus.slug,
      care_difficulty_code: m.care_difficulty_code ?? genus.care_difficulty_code,
      heroUrl,
    });
  }
  // Preserve newest-photographed order from taxonIds rather than the
  // unordered `in()` result.
  const order = new Map(taxonIds.map((id, i) => [id, i]));
  return featured.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// ---------------------------------------------------------------------------
// Guided "identify by the colors you see" funnel (/identify)
// ---------------------------------------------------------------------------

// A morph flattened for the color-match funnel: its category (for the
// shape-first filter), documented color families (binned server-side from the
// hexes so the client never needs the binning logic), a hero photo when one
// exists, and the raw hexes for the shortlist card's color chips.
export type ColorMatchCoral = {
  id: string;
  name: string;
  slug: string;
  genusName: string;
  genusSlug: string;
  categorySlug: string | null;
  categoryName: string | null;
  care_difficulty_code: string | null;
  families: ColorFamily[];
  hexes: string[];
  heroUrl: string | null;
  // Extended for the anatomy-stepper/pattern-step funnel redesign — see
  // docs/color-percent-feature-brief.md §7 (ranking bonus) and lib/color-match.ts.
  patterns: string[]; // distinct color_pattern_code values documented on this coral
  dominantFamily: ColorFamily | null; // family of the color_range with the highest approx_percent, when any is recorded
  colorRanges: ColorRange[]; // full position-labeled color data, for the result card's "where each color is" breakdown
  photos: string[]; // up to 10 photo URLs, most-voted first (hero always first) — for the result card's carousel
};

// The color_range with the highest recorded approx_percent (ranges with no
// percent are ignored — most of the registry today has none, and "unknown"
// must not be treated as "dominant"), mapped to its primary stop's family.
function dominantFamilyForRanges(ranges: ColorRange[]): ColorFamily | null {
  let best: { family: ColorFamily; percent: number } | null = null;
  for (const r of ranges) {
    if (r.approx_percent == null) continue;
    const primaryHex = [...r.color_stops].sort((a, b) => a.ordinal - b.ordinal)[0]?.hex;
    if (!primaryHex) continue;
    const family = hexToFamily(primaryHex);
    if (!family) continue;
    if (!best || r.approx_percent > best.percent) best = { family, percent: r.approx_percent };
  }
  return best?.family ?? null;
}

// Every morph with enough shape/color/photo context to drive the funnel.
// Corals with no documented colors are still returned (families: []) so the
// count is honest and a shape-only filter can still surface them — the
// scorer just won't rank them for a color query.
export async function getCoralsForColorMatch(): Promise<ColorMatchCoral[]> {
  const supabase = createPublicClient();

  const [{ data: morphs }, { data: genera }, { data: categories }] = await Promise.all([
    supabase
      .from("taxon_nodes")
      .select(`id, name, slug, parent_id, care_difficulty_code, ${ELEMENT_SELECT}`)
      .eq("rank_code", "morph")
      .order("name"),
    supabase
      .from("taxon_nodes")
      .select("id, name, slug, parent_id, care_difficulty_code")
      .eq("rank_code", "genus"),
    supabase
      .from("taxon_nodes")
      .select("id, name, slug")
      .eq("rank_code", "category")
      .eq("is_visible", true),
  ]);

  const genusById = new Map((genera ?? []).map((g) => [g.id, g]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  type MorphRow = {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    care_difficulty_code: string | null;
    color_ranges: ColorRange[];
  };
  const morphRows = (morphs as unknown as MorphRow[]) ?? [];
  // getTopPhotosForTaxa already returns most-voted-first (hero-equivalent
  // rule), so photos[0] doubles as the existing single heroUrl without a
  // second query.
  const topPhotos = await getTopPhotosForTaxa(morphRows.map((m) => m.id));

  const result: ColorMatchCoral[] = [];
  for (const m of morphRows) {
    const genus = m.parent_id ? genusById.get(m.parent_id) : undefined;
    if (!genus) continue; // orphaned/placeholder morph — skip
    const category = genus.parent_id ? categoryById.get(genus.parent_id) : undefined;
    const ranges = m.color_ranges ?? [];
    const hexes = ranges.flatMap((r) => r.color_stops.map((s) => s.hex));
    const photos = topPhotos.get(m.id) ?? [];
    result.push({
      id: m.id,
      name: m.name,
      slug: m.slug,
      genusName: genus.name,
      genusSlug: genus.slug,
      categorySlug: category?.slug ?? null,
      categoryName: category?.name ?? null,
      care_difficulty_code: m.care_difficulty_code ?? genus.care_difficulty_code,
      families: familiesForColorRanges(ranges),
      hexes,
      heroUrl: photos[0] ?? null,
      patterns: [...new Set(ranges.map((r) => r.color_pattern_code))],
      dominantFamily: dominantFamilyForRanges(ranges),
      colorRanges: ranges,
      photos,
    });
  }
  return result;
}

// The six visible categories for the funnel's shape-first step, in the same
// display order the wiki index uses.
export type FunnelGenus = { slug: string; name: string; anatomyTemplateCode: string | null };
export type FunnelCategory = { slug: string; name: string; genera: FunnelGenus[] };

// Categories with their genera nested (each genus carrying its real
// anatomy_template_code) — drives both the funnel's optional "type" step and
// its optional "genus" breakout step, plus which anatomy step-through
// (lib/anatomy-steps.ts) applies once a genus is picked.
export async function getFunnelCategories(): Promise<FunnelCategory[]> {
  const cats = await getGenusCategories();
  const genusIds = cats.flatMap((c) => c.genera.map((g) => g.id));
  if (genusIds.length === 0) return cats.map((c) => ({ slug: c.slug, name: c.name, genera: [] }));

  const supabase = createPublicClient();
  const { data: templates } = await supabase
    .from("taxon_nodes")
    .select("id, anatomy_template_code")
    .in("id", genusIds);
  const templateById = new Map((templates ?? []).map((t) => [t.id, t.anatomy_template_code as string | null]));

  return cats.map((c) => ({
    slug: c.slug,
    name: c.name,
    genera: c.genera.map((g) => ({
      slug: g.slug,
      name: g.name,
      anatomyTemplateCode: templateById.get(g.id) ?? null,
    })),
  }));
}

// Up to `limit` real hero photos (most-voted per morph, same rule as
// getHeroPhotoUrlsForTaxa elsewhere) across every morph in a category — the
// identify funnel's "type" popup photo carousel. Order follows the morph
// query's own order, not a true cross-taxon vote ranking (the live dataset
// is too small today for that distinction to matter); PhotoCarousel pads any
// remaining slots with illustrative art, never fake photography.
export async function getCategoryShowcasePhotos(
  categorySlug: string,
  limit = 5,
): Promise<{ url: string; alt: string }[]> {
  const supabase = createPublicClient();
  const { data: category } = await supabase
    .from("taxon_nodes")
    .select("id")
    .eq("rank_code", "category")
    .eq("slug", categorySlug)
    .maybeSingle();
  if (!category) return [];

  const { data: genera } = await supabase
    .from("taxon_nodes")
    .select("id")
    .eq("rank_code", "genus")
    .eq("parent_id", category.id);
  const genusIds = (genera ?? []).map((g) => g.id);
  if (genusIds.length === 0) return [];

  const { data: morphs } = await supabase
    .from("taxon_nodes")
    .select("id, name")
    .eq("rank_code", "morph")
    .in("parent_id", genusIds);
  const morphRows = morphs ?? [];
  if (morphRows.length === 0) return [];

  const heroUrls = await getHeroPhotoUrlsForTaxa(morphRows.map((m) => m.id));
  const photos: { url: string; alt: string }[] = [];
  for (const m of morphRows) {
    const url = heroUrls.get(m.id);
    if (url) photos.push({ url, alt: `${m.name} — reference photo` });
    if (photos.length >= limit) break;
  }
  return photos;
}

// Same idea as getCategoryShowcasePhotos, scoped to one genus — the funnel's
// "genus" popup. Real photos are rare today (only Acropora/Zoanthus/Briareum
// have any live); the caller falls back to the category's showcase when this
// returns fewer than needed.
export async function getGenusShowcasePhotos(
  genusSlug: string,
  limit = 5,
): Promise<{ url: string; alt: string }[]> {
  const genus = await getGenusBySlug(genusSlug);
  if (!genus) return [];
  const morphs = await getMorphsForGenus(genus.id);
  const heroUrls = await getHeroPhotoUrlsForTaxa(morphs.map((m) => m.id));
  const photos: { url: string; alt: string }[] = [];
  for (const m of morphs) {
    const url = heroUrls.get(m.id);
    if (url) photos.push({ url, alt: `${m.name} — reference photo` });
    if (photos.length >= limit) break;
  }
  return photos;
}

// A real coral in the registry that documents the given pattern, for the
// funnel's pattern-recognition popup — links straight to its wiki page
// instead of only showing a generic swatch example.
export async function getPatternExampleCoral(
  patternCode: string,
): Promise<{ name: string; genusSlug: string; slug: string; hexes: string[] } | null> {
  const supabase = createPublicClient();
  const { data: ranges } = await supabase
    .from("color_ranges")
    .select("taxon_node_id, color_stops(hex, ordinal)")
    .eq("color_pattern_code", patternCode)
    .limit(1);
  const row = ranges?.[0];
  if (!row?.taxon_node_id) return null;

  const { data: morph } = await supabase
    .from("taxon_nodes")
    .select("id, name, slug, parent_id")
    .eq("id", row.taxon_node_id)
    .maybeSingle();
  if (!morph?.parent_id) return null;
  const { data: genus } = await supabase
    .from("taxon_nodes")
    .select("slug")
    .eq("id", morph.parent_id)
    .maybeSingle();
  if (!genus) return null;

  const hexes = (row.color_stops as { hex: string; ordinal: number }[])
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => s.hex);
  return { name: morph.name, genusSlug: genus.slug, slug: morph.slug, hexes };
}

const PATTERN_CODES = ["spotted", "mottled", "banded", "tipped", "ringed", "rainbow"];

export type IdentifyShowcaseData = {
  categoryPhotos: Record<string, { url: string; alt: string }[]>;
  genusPhotos: Record<string, { url: string; alt: string }[]>;
  patternExamples: Record<string, { name: string; genusSlug: string; slug: string; hexes: string[] } | null>;
};

// All the funnel's popup photo/example data, fetched once server-side and
// passed down as props — same "all data arrives as props, scoring runs
// client-side" posture the funnel already uses for corals/categories, kept
// here rather than adding client-side server actions/loading states to every
// popup for a still-small dataset.
export async function getIdentifyShowcaseData(categories: FunnelCategory[]): Promise<IdentifyShowcaseData> {
  const genusSlugs = categories.flatMap((c) => c.genera.map((g) => g.slug));

  const [categoryEntries, genusEntries, patternEntries] = await Promise.all([
    Promise.all(categories.map(async (c) => [c.slug, await getCategoryShowcasePhotos(c.slug)] as const)),
    Promise.all(genusSlugs.map(async (slug) => [slug, await getGenusShowcasePhotos(slug)] as const)),
    Promise.all(PATTERN_CODES.map(async (code) => [code, await getPatternExampleCoral(code)] as const)),
  ]);

  return {
    categoryPhotos: Object.fromEntries(categoryEntries),
    genusPhotos: Object.fromEntries(genusEntries),
    patternExamples: Object.fromEntries(patternEntries),
  };
}

// ---------------------------------------------------------------------------
// Unidentified-ID flow (community fallback — /identify)
// ---------------------------------------------------------------------------

export type SearchableMorph = {
  id: string;
  name: string;
  slug: string;
  genusName: string;
  genusSlug: string;
};

// The whole 37-coral list, fetched once and filtered client-side (type-to-
// filter) — no need for server-side search infrastructure at this scale.
export async function getAllMorphsForSearch(): Promise<SearchableMorph[]> {
  const supabase = createPublicClient();
  const { data: morphs } = await supabase
    .from("taxon_nodes")
    .select("id, name, slug, parent_id")
    .eq("rank_code", "morph")
    .order("name");
  const { data: genera } = await supabase
    .from("taxon_nodes")
    .select("id, name, slug")
    .eq("rank_code", "genus");
  const generaById = new Map((genera ?? []).map((g) => [g.id, g]));
  return (morphs ?? []).map((m) => {
    const genus = m.parent_id ? generaById.get(m.parent_id) : undefined;
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      genusName: genus?.name ?? "",
      genusSlug: genus?.slug ?? "",
    };
  });
}

// Maps an exact, ordered hex-stop signature (e.g. "#77BB41,#E23B3B") to
// whatever label has most often been used for that same signature
// elsewhere in the registry — the moderator color-entry form's "consistent
// naming" aid (a moderator who called #77BB41 "Neon green" once shouldn't
// later call the same hex "Bright green" for a different taxon). Computed
// from every existing color_range/color_stops row, not scoped to one
// moderator — consistency across the whole registry is the point. Ties
// resolve to whichever label was seen most often (mode); genuinely new
// hex combinations simply have no entry, and the moderator UI leaves the
// field free-text either way.
export async function getColorLabelSuggestions(): Promise<Record<string, string>> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("color_ranges")
    .select("label, color_stops ( hex, ordinal )");

  const tally = new Map<string, Map<string, number>>();
  for (const r of (data ?? []) as { label: string | null; color_stops: { hex: string; ordinal: number }[] }[]) {
    if (!r.label) continue;
    const signature = [...r.color_stops]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((s) => s.hex.toUpperCase())
      .join(",");
    if (!signature) continue;
    const labelCounts = tally.get(signature) ?? new Map<string, number>();
    labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1);
    tally.set(signature, labelCounts);
  }

  const result: Record<string, string> = {};
  for (const [signature, labelCounts] of tally) {
    let bestLabel: string | null = null;
    let bestCount = 0;
    for (const [label, count] of labelCounts) {
      if (count > bestCount) {
        bestLabel = label;
        bestCount = count;
      }
    }
    if (bestLabel) result[signature] = bestLabel;
  }
  return result;
}

export type UnidentifiedPhoto = {
  id: string;
  url: string;
  uploader_user_id: string;
  taken_at: string | null;
  created_at: string;
};

export type PendingSuggestion = {
  id: string;
  coral_photo_id: string;
  proposed_taxon_id: string | null;
  proposed_taxon_name: string | null; // resolved "Name (Genus)" label, if targeting an existing taxon
  proposed_taxon_is_genus: boolean; // true when proposed_taxon_id targets a genus directly (not a morph)
  proposed_name: string | null; // an alias claim (alongside proposed_taxon_id) or a brand-new morph name
  proposed_genus_name: string | null; // resolved genus name for a brand-new-morph proposal (e.g. "Genus unknown")
  suggested_by_user_id: string;
  suggested_by_username: string;
  net_votes: number;
  created_at: string;
};

export type UnidentifiedQueueItem = {
  photo: UnidentifiedPhoto;
  suggestions: PendingSuggestion[];
};

// Shared by getUnidentifiedQueue (taxon_node_id IS NULL) and
// getGenusOnlyQueue (taxon_node_id = a specific genus) — both render the same
// photo + pending-suggestions card, just scoped to a different starting set
// of photos. Resolved (confirmed/rejected/superseded) suggestions are never
// included; proposed_taxon_id may point at a MORPH (the common case) or,
// since a suggestion can target a genus directly ("I only know the genus" —
// see ProposeIdentificationForm), at a GENUS itself, which needs its own
// label rule instead of the "Name (Genus)" morph format.
async function buildQueueItems(
  supabase: ReturnType<typeof createPublicClient>,
  photoList: UnidentifiedPhoto[],
): Promise<UnidentifiedQueueItem[]> {
  if (photoList.length === 0) return [];

  const photoIds = photoList.map((p) => p.id);
  const { data: suggestions } = await supabase
    .from("id_suggestions")
    .select(
      "id, coral_photo_id, proposed_taxon_id, proposed_name, proposed_genus_id, suggested_by_user_id, net_votes, created_at",
    )
    .in("coral_photo_id", photoIds)
    .eq("status_code", "pending")
    .order("net_votes", { ascending: false });

  const suggestionList = suggestions ?? [];

  // Resolve proposed_taxon_id -> a display label, batched. A morph gets
  // "Name (Genus)"; a genus targeted directly gets "Name (genus only)" since
  // it has no morph-shaped parent to look up.
  const taxonIds = [
    ...new Set(
      suggestionList
        .map((s) => s.proposed_taxon_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const taxonLabels = new Map<string, string>();
  const taxonIsGenus = new Map<string, boolean>();
  if (taxonIds.length > 0) {
    const { data: taxa } = await supabase
      .from("taxon_nodes")
      .select("id, name, parent_id, rank_code")
      .in("id", taxonIds);
    const genusIds = [
      ...new Set(
        (taxa ?? [])
          .filter((t) => t.rank_code !== "genus")
          .map((t) => t.parent_id)
          .filter((x): x is string => !!x),
      ),
    ];
    const { data: genera } =
      genusIds.length > 0
        ? await supabase.from("taxon_nodes").select("id, name").in("id", genusIds)
        : { data: [] as { id: string; name: string }[] };
    const genusNameById = new Map((genera ?? []).map((g) => [g.id, g.name]));
    for (const t of taxa ?? []) {
      const isGenus = t.rank_code === "genus";
      taxonIsGenus.set(t.id, isGenus);
      if (isGenus) {
        taxonLabels.set(t.id, `${t.name} (genus only)`);
      } else {
        const genusName = t.parent_id ? genusNameById.get(t.parent_id) : undefined;
        taxonLabels.set(t.id, genusName ? `${t.name} (${genusName})` : t.name);
      }
    }
  }

  // Resolve proposed_genus_id -> plain genus name for brand-new-morph
  // proposals (no existing taxon match, so nothing above resolved a genus
  // for them) — e.g. "Rainbow Fire Acro (Genus unknown)" when the proposer
  // picked the "not sure" bucket. See sql/supabase/15_unknown_genus_placeholder.sql.
  const directGenusIds = [
    ...new Set(
      suggestionList
        .filter((s) => !s.proposed_taxon_id && s.proposed_genus_id)
        .map((s) => s.proposed_genus_id as string),
    ),
  ];
  const directGenusNameById = new Map<string, string>();
  if (directGenusIds.length > 0) {
    const { data: directGenera } = await supabase
      .from("taxon_nodes")
      .select("id, name")
      .in("id", directGenusIds);
    for (const g of directGenera ?? []) directGenusNameById.set(g.id, g.name);
  }

  const usernames = await getUsernamesFor(
    suggestionList.map((s) => s.suggested_by_user_id),
  );

  const byPhoto = new Map<string, PendingSuggestion[]>();
  for (const s of suggestionList) {
    const entry: PendingSuggestion = {
      id: s.id,
      coral_photo_id: s.coral_photo_id,
      proposed_taxon_id: s.proposed_taxon_id,
      proposed_taxon_name: s.proposed_taxon_id
        ? (taxonLabels.get(s.proposed_taxon_id) ?? null)
        : null,
      proposed_taxon_is_genus: s.proposed_taxon_id
        ? (taxonIsGenus.get(s.proposed_taxon_id) ?? false)
        : false,
      proposed_name: s.proposed_name,
      proposed_genus_name:
        !s.proposed_taxon_id && s.proposed_genus_id
          ? (directGenusNameById.get(s.proposed_genus_id) ?? null)
          : null,
      suggested_by_user_id: s.suggested_by_user_id,
      suggested_by_username:
        usernames.get(s.suggested_by_user_id) ?? "A hobbyist",
      net_votes: s.net_votes,
      created_at: s.created_at,
    };
    const list = byPhoto.get(s.coral_photo_id) ?? [];
    list.push(entry);
    byPhoto.set(s.coral_photo_id, list);
  }

  return photoList.map((photo) => ({
    photo,
    suggestions: byPhoto.get(photo.id) ?? [],
  }));
}

// Photos with no taxon yet, each with its still-open (pending) suggestions —
// one card per photo, matching the agreed queue design.
export async function getUnidentifiedQueue(): Promise<UnidentifiedQueueItem[]> {
  const supabase = createPublicClient();
  const { data: photos } = await supabase
    .from("coral_photos")
    .select("id, url, uploader_user_id, taken_at, created_at")
    .is("taxon_node_id", null)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  return buildQueueItems(supabase, (photos as UnidentifiedPhoto[]) ?? []);
}

// Photos already confirmed to THIS genus but not yet pinned to an exact
// morph — "I only know the genus" proposals land here (see
// ProposeIdentificationForm's genus-only mode). Kept open for further
// proposals/votes exactly like the unidentified queue, rather than treating
// genus-level confirmation as a dead end: a morph-targeting suggestion that
// later gets confirmed moves the photo's taxon_node_id off this genus and
// onto the real morph (handle_id_vote_change — no extra wiring needed here).
export async function getGenusOnlyQueue(genusId: string): Promise<UnidentifiedQueueItem[]> {
  const supabase = createPublicClient();
  const { data: photos } = await supabase
    .from("coral_photos")
    .select("id, url, uploader_user_id, taken_at, created_at")
    .eq("taxon_node_id", genusId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  return buildQueueItems(supabase, (photos as UnidentifiedPhoto[]) ?? []);
}

export type GenusOption = { id: string; name: string; slug: string; isUnknownBucket: boolean };

// Genus choices for "I only know the genus" / "no idea at all" proposals —
// every visible genus, PLUS the hidden "Genus unknown" placeholder
// (sql/supabase/15_unknown_genus_placeholder.sql), which getGenera()
// deliberately excludes from the public wiki grid but which this specific
// context needs to offer as "not sure at all."
export async function getGenusOptionsForIdentify(): Promise<GenusOption[]> {
  const supabase = createPublicClient();
  const [visible, unknown] = await Promise.all([
    supabase
      .from("taxon_nodes")
      .select("id, name, slug")
      .eq("rank_code", "genus")
      .eq("is_visible", true)
      .order("name"),
    supabase
      .from("taxon_nodes")
      .select("id, name, slug")
      .eq("rank_code", "genus")
      .eq("slug", "genus-unknown")
      .maybeSingle(),
  ]);
  const options: GenusOption[] = (visible.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    isUnknownBucket: false,
  }));
  if (unknown.data) {
    options.push({
      id: unknown.data.id,
      name: "Not sure at all — genus unknown",
      slug: unknown.data.slug,
      isUnknownBucket: true,
    });
  }
  return options;
}

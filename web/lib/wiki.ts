import { createPublicClient } from "@/lib/supabase/public";
import type { ColorRange } from "@/components/coral-ui";
import { familiesForColorRanges, type ColorFamily } from "@/lib/color-match";

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

type CareFields = {
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
function withGenusCareDefaults<T extends CareFields>(
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
};

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
  const heroUrls = await getHeroPhotoUrlsForTaxa(morphRows.map((m) => m.id));

  const result: ColorMatchCoral[] = [];
  for (const m of morphRows) {
    const genus = m.parent_id ? genusById.get(m.parent_id) : undefined;
    if (!genus) continue; // orphaned/placeholder morph — skip
    const category = genus.parent_id ? categoryById.get(genus.parent_id) : undefined;
    const ranges = m.color_ranges ?? [];
    const hexes = ranges.flatMap((r) => r.color_stops.map((s) => s.hex));
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
      heroUrl: heroUrls.get(m.id) ?? null,
    });
  }
  return result;
}

// The six visible categories for the funnel's shape-first step, in the same
// display order the wiki index uses.
export type FunnelCategory = { slug: string; name: string };

export async function getFunnelCategories(): Promise<FunnelCategory[]> {
  const cats = await getGenusCategories();
  return cats.map((c) => ({ slug: c.slug, name: c.name }));
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

// Photos with no taxon yet, each with its still-open (pending) suggestions —
// one card per photo, matching the agreed queue design. Resolved
// (confirmed/rejected/superseded) suggestions are never shown here.
export async function getUnidentifiedQueue(): Promise<UnidentifiedQueueItem[]> {
  const supabase = createPublicClient();

  const { data: photos } = await supabase
    .from("coral_photos")
    .select("id, url, uploader_user_id, taken_at, created_at")
    .is("taxon_node_id", null)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const photoList = (photos as UnidentifiedPhoto[]) ?? [];
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

  // Resolve proposed_taxon_id -> "Name (Genus)" display labels, batched.
  const taxonIds = [
    ...new Set(
      suggestionList
        .map((s) => s.proposed_taxon_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const taxonLabels = new Map<string, string>();
  if (taxonIds.length > 0) {
    const { data: taxa } = await supabase
      .from("taxon_nodes")
      .select("id, name, parent_id")
      .in("id", taxonIds);
    const genusIds = [
      ...new Set(
        (taxa ?? []).map((t) => t.parent_id).filter((x): x is string => !!x),
      ),
    ];
    const { data: genera } =
      genusIds.length > 0
        ? await supabase.from("taxon_nodes").select("id, name").in("id", genusIds)
        : { data: [] as { id: string; name: string }[] };
    const genusNameById = new Map((genera ?? []).map((g) => [g.id, g.name]));
    for (const t of taxa ?? []) {
      const genusName = t.parent_id ? genusNameById.get(t.parent_id) : undefined;
      taxonLabels.set(t.id, genusName ? `${t.name} (${genusName})` : t.name);
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

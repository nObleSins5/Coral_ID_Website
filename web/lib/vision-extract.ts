// Validates and clamps a vision model's raw structured output into a shape
// the identify funnel can trust — identify-MVP Phase 2 ("pre-fill the funnel
// from a photo, user confirms/edits, then matches"). Kept separate from the
// actual API call (see app/identify/vision-actions.ts) so this can be unit
// tested without a network round trip or an API key: the model is untrusted
// input exactly like a form submission, and every field here is either
// coerced into a known enum or dropped.
import { COLOR_FAMILIES, type ColorFamily } from "@/lib/color-match";

export type LightingGuess = "daylight" | "actinic" | "mixed" | "unsure";

const LIGHTING_VALUES: readonly LightingGuess[] = ["daylight", "actinic", "mixed", "unsure"];
const FAMILY_CODES = new Set<string>(COLOR_FAMILIES.map((f) => f.code));

export type VisionExtraction = {
  categorySlug: string | null;
  families: ColorFamily[];
  // Rough visual proportion per family (0-100), only for families also
  // present in `families` — the same shape as color_ranges.approx_percent,
  // kept separate here since this is an ephemeral AI guess, not canonical
  // taxon data (canonical colors stay research/moderator-entry-only).
  approxPercents: Partial<Record<ColorFamily, number>>;
  lighting: LightingGuess;
};

// `knownCategorySlugs` is passed in (rather than hardcoded) so this stays
// correct if categories change — it's just the funnel's own category list.
export function parseVisionExtraction(
  raw: unknown,
  knownCategorySlugs: readonly string[],
): VisionExtraction {
  const obj = isRecord(raw) ? raw : {};

  const categorySlug =
    typeof obj.category === "string" && knownCategorySlugs.includes(obj.category)
      ? obj.category
      : null;

  const familiesRaw = Array.isArray(obj.colors) ? obj.colors : [];
  const families: ColorFamily[] = [];
  for (const c of familiesRaw) {
    if (typeof c === "string" && FAMILY_CODES.has(c) && !families.includes(c as ColorFamily)) {
      families.push(c as ColorFamily);
    }
  }
  // Stable spectrum order, same convention as familiesForColorRanges.
  families.sort(
    (a, b) => COLOR_FAMILIES.findIndex((f) => f.code === a) - COLOR_FAMILIES.findIndex((f) => f.code === b),
  );

  const approxPercents: Partial<Record<ColorFamily, number>> = {};
  if (isRecord(obj.approx_percents)) {
    for (const family of families) {
      const v = obj.approx_percents[family];
      if (typeof v === "number" && Number.isFinite(v)) {
        approxPercents[family] = Math.max(0, Math.min(100, Math.round(v)));
      }
    }
  }

  const lighting: LightingGuess =
    typeof obj.lighting === "string" && (LIGHTING_VALUES as readonly string[]).includes(obj.lighting)
      ? (obj.lighting as LightingGuess)
      : "unsure";

  return { categorySlug, families, approxPercents, lighting };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

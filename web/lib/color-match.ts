// Color-family binning + coral matching — the core of the guided "identify by
// the colors you see" funnel (see docs/identify-mvp.md). Pure and dependency-
// free so it runs identically in tests (node), on the server (binning the
// seed hexes), and in the client (scoring a shortlist).
//
// The premise: a novice can truthfully say "I see red, green, and blue" on day
// one, but cannot say "the coenosarc is #2E8B57". So we bin every documented
// hex into one of a small set of named color families a beginner recognizes,
// and match the coral against the families they picked. Anatomy/hex precision
// stays as an expert *confirmation* step, not the entry gate.

export type ColorFamily =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "cream";

// The picker's swatches, in a rough spectrum order. `swatch` is only a
// representative chip color for the UI, never used for matching (matching is
// hue-bin based, below). "Cream" deliberately absorbs white/off-white — a
// novice filter gains nothing from a separate near-white bin.
export const COLOR_FAMILIES: { code: ColorFamily; label: string; swatch: string }[] = [
  { code: "red", label: "Red", swatch: "#E23B3B" },
  { code: "orange", label: "Orange", swatch: "#FF8C00" },
  { code: "yellow", label: "Yellow", swatch: "#FFD700" },
  { code: "green", label: "Green", swatch: "#2E8B57" },
  { code: "teal", label: "Teal", swatch: "#008080" },
  { code: "blue", label: "Blue", swatch: "#1E90FF" },
  { code: "purple", label: "Purple", swatch: "#800080" },
  { code: "pink", label: "Pink", swatch: "#FF69B4" },
  { code: "brown", label: "Brown", swatch: "#8B4513" },
  { code: "cream", label: "Cream / white", swatch: "#FFF3D6" },
];

const FAMILY_LABEL: Record<ColorFamily, string> = Object.fromEntries(
  COLOR_FAMILIES.map((f) => [f.code, f.label]),
) as Record<ColorFamily, string>;

export function familyLabel(f: ColorFamily): string {
  return FAMILY_LABEL[f];
}

// --- hex -> HSL -------------------------------------------------------------

// Returns { h: 0..360, s: 0..100, l: 0..100 }, or null for a malformed hex.
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

// --- hex -> color family ----------------------------------------------------

// Maps a single hex to the family a beginner would name it. Order matters:
// the neutral/tint/shade special cases (cream, brown) are checked before the
// plain hue bins, because HSL hue alone can't tell dark-orange (brown) from
// orange or a pale warm tint (cream) from a saturated one.
export function hexToFamily(hex: string): ColorFamily | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const { h, s, l } = hsl;

  // Near-white / very light warm tints read as "cream" to a beginner.
  if (l >= 94 && s <= 15) return "cream";
  if (l >= 85 && isWarmHue(h)) return "cream";
  // Tan / khaki / pale warm low-saturation mids are cream-ish, not orange.
  if (l >= 55 && s <= 55 && h >= 20 && h < 65) return "cream";

  // Dark warm colors are brown, not "dark orange/yellow".
  if (h >= 8 && h < 50 && l < 42) return "brown";

  // Plain hue bins. Boundaries tuned against the real seed hexes (see
  // color-match.test.ts) — e.g. teal/blue split at 190 so light blue
  // (#ADD8E6, h~194) lands in blue, and purple/pink split at 315 so
  // magenta-purple (#800080, h=300) stays purple.
  if (h < 15 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 190) return "teal";
  if (h < 255) return "blue";
  if (h < 315) return "purple";
  return "pink";
}

function isWarmHue(h: number): boolean {
  return h >= 20 && h < 70;
}

// --- coral color families ---------------------------------------------------

// A minimal shape compatible with lib/wiki's ColorRange / the color_stops
// join — just the hexes are needed here.
type RangeLike = { color_stops: { hex: string }[] };

// The distinct set of families across every documented hex for a coral, in
// COLOR_FAMILIES (spectrum) order for stable display.
export function familiesForColorRanges(ranges: RangeLike[]): ColorFamily[] {
  const set = new Set<ColorFamily>();
  for (const r of ranges) {
    for (const stop of r.color_stops) {
      const f = hexToFamily(stop.hex);
      if (f) set.add(f);
    }
  }
  return COLOR_FAMILIES.map((f) => f.code).filter((c) => set.has(c));
}

// --- matching ---------------------------------------------------------------

export type CoralMatch = {
  score: number; // 0..1
  matched: ColorFamily[]; // user colors this coral has
  missed: ColorFamily[]; // user colors this coral lacks
};

// Scores how well a coral's documented color families satisfy the colors the
// user reported seeing. Coverage (did the coral contain everything the user
// sees?) dominates; precision (does the coral have lots of *extra* colors the
// user didn't mention?) is a gentle tiebreaker so a focused 2-color match
// ranks above a 6-color coral that merely happens to include those two.
//
// A coral with zero of the user's colors scores 0 (caller filters these out).
export function scoreCoralMatch(
  userFamilies: ColorFamily[],
  coralFamilies: ColorFamily[],
): CoralMatch {
  const coralSet = new Set(coralFamilies);
  const matched: ColorFamily[] = [];
  const missed: ColorFamily[] = [];
  for (const f of userFamilies) {
    if (coralSet.has(f)) matched.push(f);
    else missed.push(f);
  }

  if (userFamilies.length === 0 || matched.length === 0) {
    return { score: 0, matched, missed };
  }

  const coverage = matched.length / userFamilies.length;
  const precision = coralFamilies.length > 0 ? matched.length / coralFamilies.length : 0;
  // Coverage weighted 85% — finding all the user's colors is the point;
  // precision only breaks ties between equally-covering candidates.
  const score = coverage * 0.85 + precision * 0.15;
  return { score, matched, missed };
}

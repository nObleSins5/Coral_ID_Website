// Shared, server-rendered UI for the coral wiki: the element color key (the
// self-ID feature) plus small presentational helpers.
import type { ComponentType } from "react";
import { AffiliateLinkManager } from "@/components/affiliate-link-manager";

export type ColorStop = { hex: string; ordinal: number };
export type ColorRange = {
  position_label: string | null;
  color_pattern_code: string;
  label: string | null;
  approx_percent: number | null;
  color_stops: ColorStop[];
};

export const ELEMENT_LABEL: Record<string, string> = {
  corallite: "Corallite",
  axial_corallite: "Axial corallite",
  radial_corallite: "Radial corallite",
  tentacle: "Tentacle / tips",
  mouth_oral_disc: "Mouth / oral disc",
  coenosarc_skin: "Coenosarc / skin",
  base_body: "Base / body",
  growth_tip: "Growth tip",
  surface_texture: "Surface texture",
  oral_disc_center: "Oral disc / face (center)",
  skirt_1: "Skirt color 1",
  skirt_2: "Skirt color 2",
  skirt_3: "Skirt color 3",
  stalk: "Stalk / capitulum base",
};

export const CARE_DIFFICULTY: Record<string, string> = {
  easy: "Easy",
  moderate: "Moderate",
  difficult: "Difficult",
  expert: "Expert",
};

export const CARE_LEVEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const GROWTH_FORM: Record<string, string> = {
  branching: "Branching",
  encrusting: "Encrusting",
  plating_laminar: "Plating / laminar",
  massive: "Massive",
  columnar: "Columnar",
  tabling: "Tabling",
  foliose: "Foliose",
  digitate: "Digitate",
  submassive: "Submassive",
};

function sortedHexes(range: ColorRange): string[] {
  return [...range.color_stops]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => s.hex);
}

// Deterministic seed from a range's own content (label + hexes) — stable
// across renders/requests, so the scattered dots/blotches below don't
// reshuffle every time the page renders (no Math.random()).
function seedFor(range: ColorRange): number {
  const str = (range.label ?? "") + sortedHexes(range).join("");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Literal, repeating stripes — a fixed px band width so it tiles as real
// stripes regardless of the swatch's rendered size, rather than one hard
// segment per color across the whole width (that's `rainbow`, below).
function bandedCss(hexes: string[]): string {
  const bandWidth = 14;
  const stops: string[] = [];
  hexes.forEach((h, i) => {
    stops.push(`${h} ${i * bandWidth}px`, `${h} ${(i + 1) * bandWidth}px`);
  });
  return `repeating-linear-gradient(90deg, ${stops.join(", ")})`;
}

// Concentric rings, outer-to-inner — the pattern that most directly echoes
// a reference zoanthid color-guide chart's flower-ring look.
function ringedShapes(hexes: string[], compact?: boolean) {
  const [cx, cy] = compact ? [8, 8] : [45, 13];
  const maxR = compact ? 7.5 : 12.5;
  const n = hexes.length;
  return hexes.map((h, i) => (
    <circle key={i} cx={cx} cy={cy} r={maxR * ((n - i) / n)} fill={h} />
  ));
}

// A base fill + small dots scattered in the other hex(es) at fixed
// (seeded) positions — a real speckled texture instead of a gradient bar.
function spottedShapes(hexes: string[], compact: boolean | undefined, seed: number) {
  const rand = mulberry32(seed);
  const [w, h] = compact ? [16, 16] : [90, 26];
  const dotHexes = hexes.length > 1 ? hexes.slice(1) : hexes;
  const count = compact ? 5 : 10;
  const shapes = [<rect key="base" x={0} y={0} width={w} height={h} fill={hexes[0]} />];
  for (let i = 0; i < count; i++) {
    const r = (compact ? 1.1 : 1.8) + rand() * (compact ? 1 : 1.6);
    shapes.push(
      <circle
        key={i}
        cx={rand() * w}
        cy={rand() * h}
        r={r}
        fill={dotHexes[i % dotHexes.length]}
      />,
    );
  }
  return shapes;
}

// A base fill + a few overlapping soft-edged blotches — reads as irregular
// and blotchy rather than spotted's discrete dots.
function mottledShapes(hexes: string[], compact: boolean | undefined, seed: number) {
  const rand = mulberry32(seed);
  const [w, h] = compact ? [16, 16] : [90, 26];
  const blotchHexes = hexes.length > 1 ? hexes.slice(1) : hexes;
  const count = compact ? 3 : 5;
  const shapes = [<rect key="base" x={0} y={0} width={w} height={h} fill={hexes[0]} />];
  for (let i = 0; i < count; i++) {
    const rx = (compact ? 2.5 : 8) + rand() * (compact ? 3 : 7);
    shapes.push(
      <ellipse
        key={i}
        cx={rand() * w}
        cy={rand() * h}
        rx={rx}
        ry={rx * (0.6 + rand() * 0.4)}
        fill={blotchHexes[i % blotchHexes.length]}
        fillOpacity={0.75}
      />,
    );
  }
  return shapes;
}

// One coloration's swatch, rendered per pattern instead of always flattening
// to a single CSS background — spotted/mottled/ringed get a literal small
// SVG texture; the rest stay CSS for perf/simplicity. `compact` renders at
// CompactColorKey's small fixed icon size instead of the full color-bar.
export function ColorSwatch({
  range,
  compact,
  title,
}: {
  range: ColorRange;
  compact?: boolean;
  title?: string;
}) {
  const hexes = sortedHexes(range);
  const className = compact ? "swatch-chip" : "color-bar";
  if (hexes.length === 0) return null;

  if (hexes.length === 1) {
    return <span className={className} style={{ background: hexes[0] }} title={title} />;
  }

  const pattern = range.color_pattern_code;
  if (pattern === "range" || pattern === "tipped") {
    return (
      <span
        className={className}
        style={{ background: `linear-gradient(90deg, ${hexes.join(", ")})` }}
        title={title}
      />
    );
  }
  if (pattern === "banded") {
    return <span className={className} style={{ background: bandedCss(hexes) }} title={title} />;
  }
  if (pattern === "spotted" || pattern === "mottled" || pattern === "ringed") {
    const viewBox = compact ? "0 0 16 16" : "0 0 90 26";
    const seed = seedFor(range);
    return (
      <span className={className} style={{ overflow: "hidden", display: "inline-block" }} title={title}>
        <svg viewBox={viewBox} width="100%" height="100%" preserveAspectRatio="none">
          {pattern === "ringed"
            ? ringedShapes(hexes, compact)
            : pattern === "spotted"
              ? spottedShapes(hexes, compact, seed)
              : mottledShapes(hexes, compact, seed)}
        </svg>
      </span>
    );
  }
  // rainbow (and any future multi-stop pattern): hard-edged adjacent
  // segments across the whole swatch — several distinct colors side by side.
  const n = hexes.length;
  const segs = hexes
    .map((h, i) => `${h} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
    .join(", ");
  return (
    <span className={className} style={{ background: `linear-gradient(90deg, ${segs})` }} title={title} />
  );
}

// All hexes across a taxon's colors — used for the placeholder tile.
export function keyColors(colorRanges: ColorRange[]): string[] {
  const out: string[] = [];
  for (const r of colorRanges) out.push(...sortedHexes(r));
  return out;
}

// Compact palette strip (one chip per distinct color) for list rows.
export function CompactColorKey({ colorRanges }: { colorRanges: ColorRange[] }) {
  return (
    <div className="swatch-strip">
      {colorRanges.map((r, i) => (
        <ColorSwatch
          key={i}
          range={r}
          compact
          title={r.label ?? (r.position_label ? (ELEMENT_LABEL[r.position_label] ?? r.position_label) : undefined)}
        />
      ))}
    </div>
  );
}

function ColorRangeRow({ range }: { range: ColorRange }) {
  return (
    <div className="color-range">
      <ColorSwatch range={range} />
      <span className="color-meta">
        {range.label ? <strong>{range.label}</strong> : null}{" "}
        <span className="muted">{sortedHexes(range).join(" → ")}</span>
      </span>
    </div>
  );
}

// Full color key for the detail page. A taxon just has however many
// distinct colors it has — position_label is an optional, suggested hint
// (from the genus's anatomy_template_code, see
// sql/supabase/22_decouple_color_from_elements.sql), not a required
// checklist; there's no more "Not yet documented" placeholder enforcement.
// suggestedPositions orders labeled colors to match the template's expected
// order; anything unlabeled (or in a position outside the template) is
// grouped under "Other".
export function ElementColorKey({
  colorRanges,
  suggestedPositions,
}: {
  colorRanges: ColorRange[];
  suggestedPositions?: string[];
}) {
  if (colorRanges.length === 0) return <p className="muted">No colors documented yet.</p>;

  const byPosition = new Map<string, ColorRange[]>();
  const unlabeled: ColorRange[] = [];
  for (const r of colorRanges) {
    if (r.position_label) {
      const list = byPosition.get(r.position_label) ?? [];
      list.push(r);
      byPosition.set(r.position_label, list);
    } else {
      unlabeled.push(r);
    }
  }

  const orderedPositions = suggestedPositions
    ? [
        ...suggestedPositions.filter((p) => byPosition.has(p)),
        ...[...byPosition.keys()].filter((p) => !suggestedPositions.includes(p)),
      ]
    : [...byPosition.keys()];

  return (
    <div className="element-key">
      {orderedPositions.map((position) => (
        <div className="element-row" key={position}>
          <div className="element-name">{ELEMENT_LABEL[position] ?? position}</div>
          <div className="element-colors">
            {byPosition.get(position)!.map((r, i) => (
              <ColorRangeRow range={r} key={i} />
            ))}
          </div>
        </div>
      ))}
      {unlabeled.length > 0 ? (
        <div className="element-row">
          <div className="element-name muted">Other</div>
          <div className="element-colors">
            {unlabeled.map((r, i) => (
              <ColorRangeRow range={r} key={i} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// A "photo" placeholder built from the coral's own key colors — intentional,
// and it reinforces the color-ID theme until real photos exist.
export function ColorTile({
  colors,
  label,
  large,
}: {
  colors: string[];
  label?: string;
  large?: boolean;
}) {
  const bg =
    colors.length === 0
      ? "var(--panel)"
      : colors.length === 1
        ? colors[0]
        : `linear-gradient(135deg, ${colors.slice(0, 4).join(", ")})`;
  return (
    <div className={`color-tile${large ? " large" : ""}`} style={{ background: bg }}>
      {label ? <span className="color-tile-label">{label}</span> : null}
    </div>
  );
}

export function CarePill({ kind, code }: { kind: "light" | "flow"; code: string | null }) {
  if (!code) return null;
  const icon = kind === "light" ? "☀" : "≈";
  return (
    <span className="pill">
      {icon} {kind === "light" ? "Light" : "Flow"}: {CARE_LEVEL[code] ?? code}
    </span>
  );
}

// Easy -> expert escalation across the supporting palette (calm lime through
// to hot pink) — the one badge in the UI meant to stand out in color, since
// it's the single most useful at-a-glance signal on a browse list.
export function CareDifficultyPill({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <span className={`pill pill-difficulty pill-difficulty-${code}`}>
      {CARE_DIFFICULTY[code] ?? code}
    </span>
  );
}

// The spec's parameter-freshness trust signal: elapsed time between a photo
// and the parameter reading stamped on it. Smaller gap = higher confidence.
export function formatFreshness(
  takenAt: string | null,
  snapshotMeasuredAt: string | null,
): string | null {
  if (!snapshotMeasuredAt) return null;
  const taken = takenAt ? new Date(takenAt).getTime() : Date.now();
  const measured = new Date(snapshotMeasuredAt).getTime();
  const diffMin = Math.round(Math.abs(taken - measured) / 60000);
  if (diffMin < 60) return `Params ~${diffMin || 1}m old`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `Params ~${diffHr}h old`;
  return `Params ~${Math.round(diffHr / 24)}d old`;
}

export type PhotoWithSnapshot = {
  id: string;
  url: string;
  uploader_user_id: string;
  taken_at: string | null;
  snapshot_measured_at: string | null;
  snapshot_alkalinity_dkh: number | null;
  snapshot_calcium_ppm: number | null;
  snapshot_magnesium_ppm: number | null;
  snapshot_nitrate_ppm: number | null;
  snapshot_phosphate_ppm: number | null;
};

function paramCell(value: number | null, unit: string) {
  return value == null ? "—" : `${value} ${unit}`;
}

// Image + uploader byline + an expandable parameter drawer (native <details>,
// no client JS needed for the disclosure itself) + the vote control (a client
// component, since it needs the viewer's auth state).
export function PhotoCard({
  photo,
  username,
  voteCount,
  genusSlug,
  morphName,
  morphSlug,
  VoteButton,
}: {
  photo: PhotoWithSnapshot;
  username: string;
  voteCount: number;
  genusSlug: string;
  morphName: string;
  morphSlug: string;
  VoteButton: ComponentType<{
    photoId: string;
    initialCount: number;
    morphName: string;
    genusSlug: string;
    morphSlug: string;
  }>;
}) {
  const freshness = formatFreshness(photo.taken_at, photo.snapshot_measured_at);
  const hasSnapshot = photo.snapshot_measured_at != null;

  return (
    <div className="photo-card">
      <div className="photo-tile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={`${morphName} — community photo by ${username}`} loading="lazy" />
      </div>
      <div className="photo-card-meta">
        <span className="photo-username">{username}</span>
        <VoteButton
          photoId={photo.id}
          initialCount={voteCount}
          morphName={morphName}
          genusSlug={genusSlug}
          morphSlug={morphSlug}
        />
      </div>
      {hasSnapshot ? (
        <details className="photo-params-drawer">
          <summary>Parameters{freshness ? ` · ${freshness}` : ""}</summary>
          <table className="param-table">
            <tbody>
              <tr>
                <td>Alkalinity</td>
                <td>{paramCell(photo.snapshot_alkalinity_dkh, "dKH")}</td>
              </tr>
              <tr>
                <td>Calcium</td>
                <td>{paramCell(photo.snapshot_calcium_ppm, "ppm")}</td>
              </tr>
              <tr>
                <td>Magnesium</td>
                <td>{paramCell(photo.snapshot_magnesium_ppm, "ppm")}</td>
              </tr>
              <tr>
                <td>Nitrate</td>
                <td>{paramCell(photo.snapshot_nitrate_ppm, "ppm")}</td>
              </tr>
              <tr>
                <td>Phosphate</td>
                <td>{paramCell(photo.snapshot_phosphate_ppm, "ppm")}</td>
              </tr>
            </tbody>
          </table>
        </details>
      ) : (
        <p className="muted photo-no-params">No parameters logged for this photo.</p>
      )}
      <AffiliateLinkManager
        photoId={photo.id}
        uploaderUserId={photo.uploader_user_id}
        genusSlug={genusSlug}
        morphSlug={morphSlug}
      />
    </div>
  );
}

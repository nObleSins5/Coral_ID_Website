// Shared, server-rendered UI for the coral wiki: the element color key (the
// self-ID feature) plus small presentational helpers. No interactivity yet.

export type ColorStop = { hex: string; ordinal: number };
export type ColorRange = {
  color_pattern_code: string;
  label: string | null;
  color_stops: ColorStop[];
};
export type ElementProfile = {
  element_type_code: string;
  description: string | null;
  color_ranges: ColorRange[];
};

export const ELEMENT_LABEL: Record<string, string> = {
  corallite: "Corallite",
  axial_corallite: "Axial corallite",
  radial_corallite: "Radial corallite",
  polyp: "Polyp",
  tentacle: "Tentacle / tips",
  mouth_oral_disc: "Mouth / oral disc",
  coenosarc_skin: "Coenosarc / skin",
  base_body: "Base / body",
  growth_tip: "Growth tip",
  surface_texture: "Surface texture",
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

// Turn a coloration into a CSS background: solid = flat fill, range/tipped =
// smooth gradient, everything else = hard-edged segments.
export function rangeToCss(range: ColorRange): string {
  const hexes = sortedHexes(range);
  if (hexes.length === 0) return "transparent";
  if (hexes.length === 1) return hexes[0];
  if (range.color_pattern_code === "range" || range.color_pattern_code === "tipped") {
    return `linear-gradient(90deg, ${hexes.join(", ")})`;
  }
  const n = hexes.length;
  const segs = hexes
    .map((h, i) => `${h} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
    .join(", ");
  return `linear-gradient(90deg, ${segs})`;
}

// All hexes across a coral's elements — used for the placeholder tile.
export function keyColors(elements: ElementProfile[]): string[] {
  const out: string[] = [];
  for (const el of elements)
    for (const r of el.color_ranges) out.push(...sortedHexes(r));
  return out;
}

// Compact palette strip (one bar per element's first coloration) for list rows.
export function CompactColorKey({ elements }: { elements: ElementProfile[] }) {
  return (
    <div className="swatch-strip">
      {elements.map((el) =>
        el.color_ranges.slice(0, 1).map((r, i) => (
          <span
            key={el.element_type_code + i}
            className="swatch-chip"
            title={ELEMENT_LABEL[el.element_type_code] ?? el.element_type_code}
            style={{ background: rangeToCss(r) }}
          />
        )),
      )}
    </div>
  );
}

// Full, labeled element color key for the detail page.
export function ElementColorKey({ elements }: { elements: ElementProfile[] }) {
  if (elements.length === 0)
    return <p className="muted">No element profiles recorded yet.</p>;
  return (
    <div className="element-key">
      {elements.map((el) => (
        <div className="element-row" key={el.element_type_code}>
          <div className="element-name">
            {ELEMENT_LABEL[el.element_type_code] ?? el.element_type_code}
          </div>
          <div className="element-colors">
            {el.color_ranges.map((r, i) => (
              <div className="color-range" key={i}>
                <span className="color-bar" style={{ background: rangeToCss(r) }} />
                <span className="color-meta">
                  {r.label ? <strong>{r.label}</strong> : null}{" "}
                  <span className="muted">
                    {sortedHexes(r).join(" → ")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
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

export function PhotoTile({
  url,
  freshness,
}: {
  url: string;
  freshness: string | null;
}) {
  return (
    <div className="photo-tile">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" loading="lazy" />
      {freshness ? <span className="freshness-badge">{freshness}</span> : null}
    </div>
  );
}

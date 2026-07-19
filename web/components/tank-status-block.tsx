import { PARAM_META, type TankCallout, type TankStatus } from "@/lib/tank-callouts";

// Quiet status line + advisory chips for /tank/[id] — see
// docs/tank-callout-engine-brief.md. Deliberately server-rendered, no card,
// no color-coded gauge: a status LINE, not a widget, matching the existing
// subtitle line it sits under. Silence (no chips) IS the all-clear signal.

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatBand(min: number | null, max: number | null, unit: string): string {
  if (min != null && max != null) return `${min}–${max} ${unit}`;
  if (min != null) return `≥${min} ${unit}`;
  if (max != null) return `≤${max} ${unit}`;
  return "";
}

function readingSummary(status: TankStatus): string {
  const r = status.latestReading;
  if (!r) return "";
  const parts: string[] = [];
  if (r.alkalinity_dkh != null) parts.push(`Alk ${r.alkalinity_dkh} dKH`);
  if (r.calcium_ppm != null) parts.push(`Ca ${r.calcium_ppm} ppm`);
  if (r.magnesium_ppm != null) parts.push(`Mg ${r.magnesium_ppm} ppm`);
  if (r.nitrate_ppm != null) parts.push(`NO₃ ${r.nitrate_ppm} ppm`);
  if (r.phosphate_ppm != null) parts.push(`PO₄ ${r.phosphate_ppm} ppm`);
  if (r.temperature_c != null) parts.push(`${r.temperature_c}°C`);
  return parts.join(", ");
}

// The chip list itself — shared by TankStatusBlock (below, /tank/[id]) and
// CalloutSummaryToggle (dashboard card, web/components/callout-summary-toggle.tsx)
// so both surfaces render the exact same wording/links for the same data.
export function CalloutList({
  callouts,
  husbandryHref,
}: {
  callouts: TankCallout[];
  husbandryHref: string;
}) {
  if (callouts.length === 0) return null;
  return (
    <ul className="tank-callout-list">
      {callouts.map((c, i) => (
        <li key={i} className="tank-callout">
          {c.type === "equipment_gap" ? (
            <a href={husbandryHref}>
              {c.coralCount} {c.demandTier}-{c.category === "light" ? "light" : "flow"} coral
              {c.coralCount === 1 ? "" : "s"} · no {c.category} logged →
            </a>
          ) : (
            <span>
              {PARAM_META[c.param].label} {c.actual} {PARAM_META[c.param].unit} — outside{" "}
              {c.offenders ? `${c.offenders.join(", ")}'s` : "the recommended"}{" "}
              {formatBand(c.band.min, c.band.max, PARAM_META[c.param].unit)} range
              {c.offenders ? " (your other corals are fine with this)" : ""}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TankStatusBlock({
  status,
  husbandryHref,
}: {
  status: TankStatus;
  husbandryHref: string;
}) {
  const { latestReading, callouts, contributingCoralCount } = status;

  if (contributingCoralCount === 0 && !latestReading) {
    return (
      <p className="muted tank-status-line">
        Add a coral and log a reading to see status here.
      </p>
    );
  }

  return (
    <div className="tank-status-block">
      <p className="muted tank-status-line">
        {latestReading
          ? `Last logged: ${readingSummary(status)} · ${timeAgo(latestReading.measured_at)}`
          : "No parameters logged yet."}
      </p>
      <CalloutList callouts={callouts} husbandryHref={husbandryHref} />
    </div>
  );
}

"use client";

import { useState } from "react";

// A quiet, instrument-style tank cross-section — orients the user (tier 1 is
// the bottom/substrate, the highest tier number is closest to the surface/
// light) without dressing itself up as chrome. Registry design system rules
// apply here same as anywhere else: flat fills only (no gradients/glass),
// exactly one accent color used for exactly one thing — marking the
// currently-selected tier — and the rockwork stays a quiet, secondary
// silhouette so it never competes with real coral photography elsewhere on
// the page. A future pass may replace the rockwork with a real per-tank
// layout (see PROGRESS.md); this is the flat-diagram version of that idea.
// Exported for reuse by tank-grid-interactive.tsx (the owner-facing
// clickable grid on /tank/[id]) — same cross-section chrome, this file stays
// the read-only version used by the public /showcase/[id] page.
export function TankMockup({ tierCount, selected }: { tierCount: number; selected: number }) {
  const tankTop = 14;
  const tankBottom = 148;
  const tankHeight = tankBottom - tankTop;
  const bandHeight = tankHeight / tierCount;
  const bandTop = tankBottom - selected * bandHeight;

  const dividers = [];
  for (let n = 1; n < tierCount; n++) {
    dividers.push(tankBottom - n * bandHeight);
  }

  return (
    <svg viewBox="0 0 90 170" width="70" aria-hidden="true">
      {/* Waterline — a quiet cue that tankTop is the surface, not just the
          top of the glass. */}
      <line x1={6} y1={tankTop} x2={84} y2={tankTop} stroke="var(--accent-text)" strokeWidth={1} opacity={0.5} />
      <path
        d="M6,10 q4,-3 8,0 t8,0 t8,0 t8,0 t8,0 t8,0 t8,0 t8,0"
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth={1}
        opacity={0.35}
      />

      <rect
        x={6}
        y={tankTop}
        width={78}
        height={tankHeight}
        rx={2}
        fill="none"
        stroke="var(--text)"
        strokeWidth={1.5}
      />

      {/* Rockwork silhouette, layered from a single flat tone at two
          opacities for depth without a gradient. Anchored to the substrate,
          it reads as reference geometry, not decoration. */}
      <polygon
        points="6,148 16,128 24,138 30,118 38,134 6,148"
        fill="var(--muted)"
        opacity={0.35}
      />
      <polygon
        points="30,148 42,116 52,132 62,108 72,130 84,120 84,148"
        fill="var(--muted)"
        opacity={0.55}
      />

      {dividers.map((y) => (
        <line
          key={y}
          x1={6}
          y1={y}
          x2={84}
          y2={y}
          stroke="var(--border)"
          strokeDasharray="2 3"
        />
      ))}

      {/* Selected tier: an accent BORDER around the band, matching the same
          "Shallow Reef Blue border marks the occupied/selected thing" rule
          the tank-grid cells themselves use — not a color wash, so this
          stays legible over the rockwork behind it. */}
      <rect
        x={6}
        y={bandTop}
        width={78}
        height={bandHeight}
        fill="var(--accent)"
        opacity={0.12}
        stroke="var(--accent-text)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

// Shows one tier's grid at a time — the tier rail (mockup + buttons) makes it
// clear a tier is a horizontal slice of the tank, not the whole thing.
// `tierGrids` is pre-rendered server-side, one entry per tier (index 0 = tier 1).
export function TankGridView({ tierGrids }: { tierGrids: React.ReactNode[] }) {
  const tierCount = tierGrids.length;
  const [selected, setSelected] = useState(tierCount);

  if (tierCount <= 1) return <>{tierGrids[0]}</>;

  return (
    <div className="tank-grid-view">
      <div className="tier-rail">
        <TankMockup tierCount={tierCount} selected={selected} />
        <div className="tier-rail-buttons">
          {Array.from({ length: tierCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={n === selected ? "selected" : ""}
              onClick={() => setSelected(n)}
            >
              Tier {n}
            </button>
          ))}
        </div>
      </div>
      {tierGrids[selected - 1]}
    </div>
  );
}

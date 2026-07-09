"use client";

import { useState } from "react";

// Simple B&W tank cross-section with a rockwork silhouette, used purely to
// orient the user: tier 1 is the bottom of the tank, the highest tier number
// is closest to the surface/light. A future design pass will replace this
// placeholder with real art (see PROGRESS.md).
function TankMockup({ tierCount, selected }: { tierCount: number; selected: number }) {
  const tankTop = 8;
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
      <rect
        x={8}
        y={tankTop}
        width={74}
        height={tankHeight}
        fill="none"
        stroke="var(--text)"
        strokeWidth={2}
      />
      {/* Rockwork silhouette, anchored to the substrate. */}
      <polygon
        points="8,148 20,120 30,135 42,110 55,132 66,118 82,148"
        fill="var(--muted)"
        opacity={0.6}
      />
      {dividers.map((y) => (
        <line
          key={y}
          x1={8}
          y1={y}
          x2={82}
          y2={y}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
      ))}
      <rect
        x={8}
        y={bandTop}
        width={74}
        height={bandHeight}
        fill="var(--accent)"
        opacity={0.35}
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

"use client";

import { COLOR_FAMILIES, familyLabel, type ColorFamily } from "@/lib/color-match";

export type StepColorPick = { family: ColorFamily; percent: number };

const SWATCH: Record<ColorFamily, string> = Object.fromEntries(
  COLOR_FAMILIES.map((f) => [f.code, f.swatch]),
) as Record<ColorFamily, string>;

// Deliberately invisible for the common case (a single color picked for a
// step = implicit 100%, no UI at all). Only appears once a step has 2+
// colors — the "not overbearing" requirement from the funnel redesign.
// 2 colors get one slider (mostly-this <-> mostly-that, 10%-snapped); 3+
// get small steppers with a live "adds up to X%" hint, non-blocking.
export function ColorPercentSplit({
  picks,
  onChange,
}: {
  picks: StepColorPick[];
  onChange: (picks: StepColorPick[]) => void;
}) {
  if (picks.length < 2) return null;

  if (picks.length === 2) {
    const [a, b] = picks;
    return (
      <div className="percent-split">
        <p className="percent-split-hint muted">Roughly how much of each?</p>
        <div className="percent-split-two">
          <span className="percent-split-label">
            <span className="funnel-color-dot" style={{ background: SWATCH[a.family] }} />
            {familyLabel(a.family)} {a.percent}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={a.percent}
            onChange={(e) => {
              const pct = Number(e.target.value);
              onChange([{ ...a, percent: pct }, { ...b, percent: 100 - pct }]);
            }}
            aria-label={`Proportion of ${familyLabel(a.family)} vs ${familyLabel(b.family)}`}
          />
          <span className="percent-split-label">
            {familyLabel(b.family)} {b.percent}%
            <span className="funnel-color-dot" style={{ background: SWATCH[b.family] }} />
          </span>
        </div>
      </div>
    );
  }

  const total = picks.reduce((sum, p) => sum + p.percent, 0);
  return (
    <div className="percent-split">
      <p className="percent-split-hint muted">
        Roughly how much of each? (adds up to {total}%)
      </p>
      <div className="percent-split-many">
        {picks.map((p, i) => (
          <label className="percent-split-stepper" key={p.family}>
            <span className="funnel-color-dot" style={{ background: SWATCH[p.family] }} />
            {familyLabel(p.family)}
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={p.percent}
              onChange={(e) => {
                const next = [...picks];
                next[i] = { ...p, percent: Math.max(0, Math.min(100, Number(e.target.value))) };
                onChange(next);
              }}
              aria-label={`Percent ${familyLabel(p.family)}`}
            />
            %
          </label>
        ))}
      </div>
    </div>
  );
}

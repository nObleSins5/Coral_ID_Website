"use client";

import { useEffect, useId, useRef, useState } from "react";

export type GraphPoint = { measured_at: string; value: number };

// Hand-rolled SVG line chart — no charting dependency needed for up to 10
// points. X positions are evenly spaced by index (readings aren't logged on
// a regular cadence, so a true time scale would just be index spacing with
// extra steps); exact dates are read from the table below, not the axis.
function ParamLineChart({ points, unit }: { points: GraphPoint[]; unit: string }) {
  const width = 320;
  const height = 140;
  const padX = 28;
  const padY = 18;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  // Flat/single-point series: center the line instead of dividing by zero.
  const yFor = (v: number) =>
    range === 0
      ? height / 2
      : height - padY - ((v - min) / range) * (height - padY * 2);
  const xFor = (i: number) =>
    points.length === 1
      ? width / 2
      : padX + (i / (points.length - 1)) * (width - padX * 2);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.value)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`Line chart of ${points.length} logged ${unit} values, oldest to newest`}
    >
      <line
        x1={padX}
        y1={height - padY}
        x2={width - padX}
        y2={height - padY}
        stroke="var(--border)"
      />
      <text x={2} y={padY + 4} fontSize="9" fill="var(--muted)">
        {max}
      </text>
      <text x={2} y={height - padY + 4} fontSize="9" fill="var(--muted)">
        {min}
      </text>
      <path d={linePath} fill="none" stroke="var(--accent-text)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(p.value)} r="3.5" fill="var(--accent-text)" />
      ))}
    </svg>
  );
}

export function ParameterGraphButton({
  label,
  unit,
  tankName,
  points,
}: {
  label: string;
  unit: string;
  tankName: string;
  points: GraphPoint[];
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Newest first for the table (matches the log's convention), oldest first
  // for the chart (a trend line should read left-to-right through time).
  const chronological = [...points].reverse();

  return (
    <>
      <button type="button" ref={triggerRef} className="graph-trigger" onClick={() => setOpen(true)}>
        View graph
      </button>
      {open ? (
        <div className="modal-overlay" onClick={close}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id={titleId} style={{ margin: 0 }}>
                {label} <span className="muted">— {tankName}</span>
              </h3>
              <button type="button" ref={closeRef} className="modal-close" onClick={close} aria-label="Close">
                ×
              </button>
            </div>

            {points.length === 0 ? (
              <p className="muted">No {label.toLowerCase()} readings logged yet.</p>
            ) : (
              <>
                <ParamLineChart points={chronological} unit={unit} />
                <table className="param-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>
                        {label} ({unit})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p, i) => (
                      <tr key={i}>
                        <td>{new Date(p.measured_at).toLocaleDateString()}</td>
                        <td>{p.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

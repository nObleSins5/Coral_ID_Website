"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rgbToHex, wbGain, applyGain, WB_TARGETS, type RGB } from "@/lib/color";

type Reference = { rgb: RGB; material: string; nx: number; ny: number };

const CW = 480;
const CH = 360;
const MIN_RADIUS = 3;
const MAX_RADIUS = 30;
const DEFAULT_RADIUS = 10;
const REF_MATERIAL_LABEL: Record<string, string> = {
  white: "Bright white (frag plug / white card)",
  bone: "Bone / off-white",
  gray: "Neutral light grey",
};

// A personal, ephemeral color-comparison tool for /identify — click a photo
// to see a sampled hex next to a candidate coral's documented reference
// colors. Nothing here is submitted or stored (the wiki's crowdsourced
// color-contribution pipeline was removed 2026-07-12; canonical colors now
// come from research/moderator entry only).
export function PhotoColorSampler({ photoUrl }: { photoUrl: string }) {
  const photoRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Uint8ClampedArray | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);

  const [tainted, setTainted] = useState(false);
  const [mode, setMode] = useState<"sample" | "reference">("sample");
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);
  const [current, setCurrent] = useState<{ rgb: RGB; nx: number; ny: number } | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [refMaterial, setRefMaterial] = useState<string>("white");
  const [loupeHex, setLoupeHex] = useState<string>("—");

  const gain = useMemo<RGB | null>(
    () => (reference ? wbGain(reference.rgb, reference.material) : null),
    [reference],
  );
  const used = (rgb: RGB) => (gain ? applyGain(rgb, gain) : rgb);

  useEffect(() => {
    const canvas = photoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.fillStyle = "#061620";
      ctx.fillRect(0, 0, CW, CH);
      const scale = Math.min(CW / img.width, CH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (CW - dw) / 2, (CH - dh) / 2, dw, dh);
      try {
        pixelsRef.current = ctx.getImageData(0, 0, CW, CH).data;
        setTainted(false);
      } catch {
        pixelsRef.current = null;
        setTainted(true);
      }
    };
    img.onerror = () => setTainted(true);
    img.src = photoUrl;
  }, [photoUrl]);

  function sampleAt(cx: number, cy: number): RGB {
    const px = pixelsRef.current;
    if (!px) return [0, 0, 0];
    let rs = 0, gs = 0, bs = 0, n = 0;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
        const i = (y * CW + x) * 4;
        rs += px[i]; gs += px[i + 1]; bs += px[i + 2]; n++;
      }
    }
    return n ? [rs / n, gs / n, bs / n] : [0, 0, 0];
  }

  function evtToCanvas(e: React.MouseEvent) {
    const canvas = photoRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * (CW / rect.width)),
      y: Math.round((e.clientY - rect.top) * (CH / rect.height)),
    };
  }

  function drawLoupe(cx: number, cy: number) {
    const canvas = loupeRef.current, photo = photoRef.current;
    if (!canvas || !photo) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const src = Math.min(CW, Math.max(radius * 2.6, 16));
    const dest = 96;
    ctx.clearRect(0, 0, dest, dest);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(photo, cx - src / 2, cy - src / 2, src, src, 0, 0, dest, dest);
    const scale = dest / src;
    ctx.beginPath();
    ctx.arc(dest / 2, dest / 2, radius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawOverlay() {
    const o = overlayRef.current?.getContext("2d");
    if (!o) return;
    o.clearRect(0, 0, CW, CH);
    if (hoverRef.current) {
      o.beginPath();
      o.arc(hoverRef.current.x, hoverRef.current.y, radius, 0, Math.PI * 2);
      o.strokeStyle = "rgba(255,255,255,0.55)";
      o.lineWidth = 1.5;
      o.setLineDash([4, 3]);
      o.stroke();
      o.setLineDash([]);
    }
    if (reference) {
      o.beginPath();
      o.arc(reference.nx * CW, reference.ny * CH, 9, 0, Math.PI * 2);
      o.lineWidth = 3;
      o.strokeStyle = "#ffffff";
      o.stroke();
    }
    if (current) {
      const x = current.nx * CW, y = current.ny * CH;
      o.beginPath();
      o.arc(x, y, radius, 0, Math.PI * 2);
      o.strokeStyle = "rgba(255,255,255,0.95)";
      o.lineWidth = 2;
      o.stroke();
    }
  }
  useEffect(drawOverlay, [current, reference, radius]);

  function onMove(e: React.MouseEvent) {
    const p = evtToCanvas(e);
    if (p.x < 0 || p.y < 0 || p.x >= CW || p.y >= CH) {
      hoverRef.current = null;
      return;
    }
    hoverRef.current = p;
    drawOverlay();
    drawLoupe(p.x, p.y);
    if (!pixelsRef.current) return;
    setLoupeHex(rgbToHex(used(sampleAt(p.x, p.y))));
  }
  function onClick(e: React.MouseEvent) {
    if (!pixelsRef.current) return;
    const p = evtToCanvas(e);
    const rgb = sampleAt(p.x, p.y);
    const nx = p.x / CW, ny = p.y / CH;
    if (mode === "reference") setReference({ rgb, material: refMaterial, nx, ny });
    else setCurrent({ rgb, nx, ny });
  }

  const currentUsedHex = current ? rgbToHex(used(current.rgb)) : null;

  return (
    <div className="card color-picker">
      {tainted ? (
        <p className="error" style={{ fontSize: "0.85rem" }}>
          Can&apos;t read this photo&apos;s pixels (cross-origin).
        </p>
      ) : (
        <>
          <div className="color-picker-layout">
            <div className="cp-stage-card">
              <div className={`cp-stage${mode === "reference" ? " ref-mode" : ""}`}>
                <canvas
                  ref={photoRef}
                  width={CW}
                  height={CH}
                  className="cp-photo"
                  onMouseMove={onMove}
                  onClick={onClick}
                />
                <canvas ref={overlayRef} width={CW} height={CH} className="cp-overlay" aria-hidden="true" />
              </div>
              <p className="cp-hint">
                <b>Hover</b> to inspect &middot; <b>click</b> to{" "}
                {mode === "reference" ? "set the white reference" : "sample a color"}
              </p>
            </div>

            <div className="cp-inspector">
              <div className="cp-modes">
                <button
                  type="button"
                  className={`cp-mode${mode === "sample" ? " selected" : ""}`}
                  onClick={() => setMode("sample")}
                >
                  Sample color
                </button>
                <button
                  type="button"
                  className={`cp-mode${mode === "reference" ? " selected" : ""}`}
                  onClick={() => setMode("reference")}
                >
                  White reference
                </button>
              </div>

              <div className="cp-radius-row">
                <label htmlFor="cps-radius" className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                  Sample size
                </label>
                <div className="cp-radius-control">
                  <input
                    id="cps-radius"
                    type="range"
                    min={MIN_RADIUS}
                    max={MAX_RADIUS}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  />
                  <span className="muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {radius * 2}px
                  </span>
                </div>
              </div>

              <div className="cp-loupe-row">
                <canvas ref={loupeRef} width={96} height={96} className="cp-loupe" />
                <div>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>Under cursor</div>
                  <div className="hex">{loupeHex}</div>
                </div>
              </div>

              {current ? (
                <div className="cp-current">
                  <div className="cp-swatch-lg" style={{ background: currentUsedHex ?? undefined }} />
                  <div>
                    <div className="hex">{currentUsedHex}</div>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {gain ? `raw ${rgbToHex(current.rgb)} · white-balanced` : "uncorrected"}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Click the photo to lift a color and compare it against the reference swatches.
                </p>
              )}

              <div className="cp-wb">
                {reference ? (
                  <>
                    <span className="pill">White balance: on</span>
                    <select
                      value={refMaterial}
                      onChange={(e) => {
                        setRefMaterial(e.target.value);
                        setReference((r) => (r ? { ...r, material: e.target.value } : r));
                      }}
                    >
                      {Object.keys(WB_TARGETS).map((m) => (
                        <option key={m} value={m}>{REF_MATERIAL_LABEL[m]}</option>
                      ))}
                    </select>
                    <button type="button" className="link-button" onClick={() => setReference(null)}>
                      Clear
                    </button>
                  </>
                ) : (
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    Optional: switch to <b>White reference</b> and click a known-neutral spot to
                    correct for a color cast.
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.5rem" }}>
            Just for comparison — nothing sampled here is saved or submitted.
          </p>
        </>
      )}
    </div>
  );
}

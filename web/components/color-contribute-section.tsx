"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitColorSamples } from "@/app/coral/actions";
import { rgbToHex, wbGain, applyGain, WB_TARGETS, type RGB } from "@/lib/color";

type TemplateElement = { code: string; label: string };
type PickPhoto = { id: string; url: string };
type Sample = { element: string; rawRgb: RGB; nx: number; ny: number };
type Reference = { rgb: RGB; material: string; nx: number; ny: number };

const CW = 720;
const CH = 540;
const REF_MATERIAL_LABEL: Record<string, string> = {
  white: "Bright white (frag plug / white card)",
  bone: "Bone / off-white",
  gray: "Neutral light grey",
};

export function ColorContributeSection({
  taxonNodeId,
  genusSlug,
  morphSlug,
  templateElements,
  photos,
}: {
  taxonNodeId: string;
  genusSlug: string;
  morphSlug: string;
  templateElements: TemplateElement[];
  photos: PickPhoto[];
}) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setLoggedIn(!!user));
  }, []);

  if (loggedIn === null) return null;
  if (!loggedIn) {
    return (
      <p className="muted">
        <a href="/login">Log in</a> to contribute element colors from a photo.
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        + Contribute colors from a photo
      </button>
    );
  }
  return (
    <ColorPicker
      taxonNodeId={taxonNodeId}
      genusSlug={genusSlug}
      morphSlug={morphSlug}
      templateElements={templateElements}
      photos={photos}
      onClose={() => setOpen(false)}
    />
  );
}

function ColorPicker({
  taxonNodeId,
  genusSlug,
  morphSlug,
  templateElements,
  photos,
  onClose,
}: {
  taxonNodeId: string;
  genusSlug: string;
  morphSlug: string;
  templateElements: TemplateElement[];
  photos: PickPhoto[];
  onClose: () => void;
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Uint8ClampedArray | null>(null);

  const [sourceIdx, setSourceIdx] = useState<number>(photos.length ? 0 : -1); // -1 = uploaded
  const [activePhotoId, setActivePhotoId] = useState<string | null>(photos.length ? photos[0].id : null);
  const [tainted, setTainted] = useState(false);
  const [mode, setMode] = useState<"sample" | "reference">("sample");
  const [current, setCurrent] = useState<{ rgb: RGB; nx: number; ny: number } | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [refMaterial, setRefMaterial] = useState<string>("white");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [elementCode, setElementCode] = useState<string>(templateElements[0]?.code ?? "");
  const [loupeHex, setLoupeHex] = useState<string>("—");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ confirmed: number; pending: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const gain = useMemo<RGB | null>(
    () => (reference ? wbGain(reference.rgb, reference.material) : null),
    [reference],
  );
  const used = (rgb: RGB) => (gain ? applyGain(rgb, gain) : rgb);

  function cachePixels(ctx: CanvasRenderingContext2D) {
    try {
      pixelsRef.current = ctx.getImageData(0, 0, CW, CH).data;
      setTainted(false);
    } catch {
      pixelsRef.current = null;
      setTainted(true);
    }
  }

  // Load the active image (community photo or uploaded data URL).
  function loadImage(src: string, isUpload: boolean) {
    const canvas = photoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const img = new Image();
    if (!isUpload) img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.fillStyle = "#061620";
      ctx.fillRect(0, 0, CW, CH);
      const scale = Math.min(CW / img.width, CH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (CW - dw) / 2, (CH - dh) / 2, dw, dh);
      cachePixels(ctx);
      clearOverlay();
      setCurrent(null);
    };
    img.onerror = () => setTainted(true);
    img.src = src;
  }

  // Load whenever the source changes.
  useEffect(() => {
    if (sourceIdx >= 0 && photos[sourceIdx]) {
      setActivePhotoId(photos[sourceIdx].id);
      loadImage(photos[sourceIdx].url, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceIdx]);

  function sampleAt(cx: number, cy: number): RGB {
    const px = pixelsRef.current;
    if (!px) return [0, 0, 0];
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
        const i = (y * CW + x) * 4;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
    }
    return n ? [r / n, g / n, b / n] : [0, 0, 0];
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
    const src = 15, dest = 116;
    ctx.clearRect(0, 0, dest, dest);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(photo, cx - src / 2, cy - src / 2, src, src, 0, 0, dest, dest);
    const p = dest / src;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(dest / 2 - p / 2, dest / 2 - p / 2, p, p);
  }

  function clearOverlay() {
    const o = overlayRef.current?.getContext("2d");
    if (o) o.clearRect(0, 0, CW, CH);
  }
  function drawOverlay() {
    const o = overlayRef.current?.getContext("2d");
    if (!o) return;
    o.clearRect(0, 0, CW, CH);
    samples.forEach((s) => {
      o.beginPath();
      o.arc(s.nx * CW, s.ny * CH, 7, 0, Math.PI * 2);
      o.fillStyle = rgbToHex(s.rawRgb);
      o.fill();
      o.lineWidth = 2;
      o.strokeStyle = "rgba(255,255,255,0.9)";
      o.stroke();
    });
    if (reference) {
      o.beginPath();
      o.arc(reference.nx * CW, reference.ny * CH, 9, 0, Math.PI * 2);
      o.lineWidth = 3;
      o.strokeStyle = "#ffffff";
      o.stroke();
    }
    if (current) {
      const x = current.nx * CW, y = current.ny * CH;
      o.strokeStyle = "rgba(255,255,255,0.95)";
      o.lineWidth = 1.5;
      o.beginPath();
      o.moveTo(x - 11, y); o.lineTo(x - 4, y);
      o.moveTo(x + 4, y); o.lineTo(x + 11, y);
      o.moveTo(x, y - 11); o.lineTo(x, y - 4);
      o.moveTo(x, y + 4); o.lineTo(x, y + 11);
      o.stroke();
    }
  }
  useEffect(drawOverlay, [samples, reference, current]);

  function onMove(e: React.MouseEvent) {
    const p = evtToCanvas(e);
    if (p.x < 0 || p.y < 0 || p.x >= CW || p.y >= CH) return;
    drawLoupe(p.x, p.y);
    if (!pixelsRef.current) return;
    const rgb = sampleAt(p.x, p.y);
    setLoupeHex(rgbToHex(used(rgb)));
  }
  function onClick(e: React.MouseEvent) {
    if (!pixelsRef.current) return;
    const p = evtToCanvas(e);
    const rgb = sampleAt(p.x, p.y);
    const nx = p.x / CW, ny = p.y / CH;
    if (mode === "reference") {
      setReference({ rgb, material: refMaterial, nx, ny });
    } else {
      setCurrent({ rgb, nx, ny });
      setError(null);
    }
  }

  function addSample() {
    if (!current) return;
    setSamples((s) => [...s, { element: elementCode, rawRgb: current.rgb, nx: current.nx, ny: current.ny }]);
    setCurrent(null);
  }
  function removeSample(idx: number) {
    setSamples((s) => s.filter((_, i) => i !== idx));
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      setSourceIdx(-1);
      setActivePhotoId(null);
      loadImage(String(rd.result), true);
    };
    rd.readAsDataURL(f);
  }

  function submit() {
    if (samples.length === 0) {
      setError("Add at least one color sample first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitColorSamples({
        taxon_node_id: taxonNodeId,
        coral_photo_id: activePhotoId,
        genus_slug: genusSlug,
        morph_slug: morphSlug,
        wb: reference && gain ? { material: reference.material, gain } : null,
        samples: samples.map((s) => ({
          element_type_code: s.element,
          raw_hex: rgbToHex(s.rawRgb),
          corrected_hex: gain ? rgbToHex(used(s.rawRgb)) : null,
          used_hex: rgbToHex(used(s.rawRgb)),
          sample_x: s.nx,
          sample_y: s.ny,
        })),
      });
      if (res?.error) setError(res.error);
      else {
        setResult({ confirmed: res.confirmed ?? 0, pending: res.pending ?? 0 });
        setSamples([]);
        setCurrent(null);
        router.refresh();
      }
    });
  }

  const currentUsedHex = current ? rgbToHex(used(current.rgb)) : null;

  return (
    <div className="card color-picker">
      <div className="color-picker-toolbar">
        <div className="tb-group">
          <span className="cp-label">Photo</span>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`cp-thumb${sourceIdx === i ? " selected" : ""}`}
              onClick={() => setSourceIdx(i)}
              aria-label={`Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
            </button>
          ))}
          <label className="btn-secondary cp-upload">
            Upload…
            <input type="file" accept="image/*" hidden onChange={onUpload} />
          </label>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>

      {photos.length === 0 && !activePhotoId && !pixelsRef.current ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          No community photos yet — upload one to sample its colors.
        </p>
      ) : null}

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
            {tainted ? (
              <span className="error">
                Can&apos;t read this photo&apos;s pixels (cross-origin). Upload a copy to sample it.
              </span>
            ) : (
              <>
                <b>Hover</b> to inspect &middot; <b>click</b> to{" "}
                {mode === "reference" ? "set the white reference" : "sample an element"}
              </>
            )}
          </p>
        </div>

        <div className="cp-inspector">
          <div className="cp-modes">
            <button
              type="button"
              className={`cp-mode${mode === "sample" ? " selected" : ""}`}
              onClick={() => setMode("sample")}
            >
              Sample element
            </button>
            <button
              type="button"
              className={`cp-mode${mode === "reference" ? " selected" : ""}`}
              onClick={() => setMode("reference")}
            >
              White reference
            </button>
          </div>

          <div className="cp-loupe-row">
            <canvas ref={loupeRef} width={116} height={116} className="cp-loupe" />
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
                <div className="cp-tag-row">
                  <select value={elementCode} onChange={(e) => setElementCode(e.target.value)}>
                    {templateElements.map((el) => (
                      <option key={el.code} value={el.code}>{el.label}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-primary" onClick={addSample}>Add</button>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Click the photo to lift a color, then tag which element it is.
            </p>
          )}

          <div className="cp-wb">
            {reference ? (
              <>
                <span className="pill">White balance: on</span>
                <select value={refMaterial} onChange={(e) => {
                  setRefMaterial(e.target.value);
                  setReference((r) => (r ? { ...r, material: e.target.value } : r));
                }}>
                  {Object.keys(WB_TARGETS).map((m) => (
                    <option key={m} value={m}>{REF_MATERIAL_LABEL[m]}</option>
                  ))}
                </select>
                <button type="button" className="link-button" onClick={() => setReference(null)}>Clear</button>
              </>
            ) : (
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Optional: switch to <b>White reference</b> and click a known-neutral spot (a white
                frag plug) to correct the photo&apos;s color cast.
              </span>
            )}
          </div>
        </div>
      </div>

      {samples.length > 0 ? (
        <div className="cp-samples">
          {samples.map((s, i) => {
            const label = templateElements.find((e) => e.code === s.element)?.label ?? s.element;
            return (
              <div className="cp-sample-chip" key={i}>
                <span className="cp-sample-swatch" style={{ background: rgbToHex(used(s.rawRgb)) }} />
                <span>{label} <span className="hex">{rgbToHex(used(s.rawRgb))}</span></span>
                <button type="button" className="link-button" onClick={() => removeSample(i)}>remove</button>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="form-actions">
        <button type="button" className="btn-primary" onClick={submit} disabled={pending || samples.length === 0}>
          {pending ? "Submitting…" : `Submit ${samples.length || ""} sample${samples.length === 1 ? "" : "s"}`}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Thanks! {result.confirmed} confirmed (matched the documented range),{" "}
          {result.pending} sent for review.
        </p>
      ) : null}
      <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.5rem" }}>
        Samples are checked against this coral&apos;s documented colors. A close match is confirmed
        automatically; anything far off is held for a moderator, so a color sampled on the wrong
        coral can&apos;t skew the range.
      </p>
    </div>
  );
}

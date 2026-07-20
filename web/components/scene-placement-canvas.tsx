"use client";

import { useRef, useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  clampToScene,
  depthMmToSliderFraction,
  formatSceneLength,
  pxToScenePartial,
  sceneToPx,
  sliderFractionToDepthMm,
  type ScenePositionMm,
  type SceneDimensionsMm,
  type SceneViewCalibration,
} from "@/lib/scene";
import { placeSpecimenInScene, removeSpecimenPlacement } from "@/app/tank/scene-actions";

export type PlacementSpecimen = {
  id: string;
  name: string;
  photoUrl: string | null;
  placement: ScenePositionMm | null;
};

// The v1 placement UI from docs/tank-scale-model-brief.md §5: pick a coral,
// tap its spot on the calibrated face-on photo (sets X/Y), fine-tune depth on
// a slider (the PRIMARY Z input — a side-profile tap is not offered here,
// since rockwork occludes most of the tank from the side and a required side
// tap would block placing anything hidden behind rock). Explicit Save/Remove,
// same "no auto-save" shape as place-specimen-control.tsx.
//
// Calibrating the face-on photo itself (marking the glass edges) is a
// separate, not-yet-built step — this component is a read/write consumer of
// an already-calibrated scene, and renders a quiet non-interactive state when
// `calibration` is null.
export function ScenePlacementCanvas({
  sceneId,
  dims,
  imageUrl,
  calibration,
  specimens,
}: {
  sceneId: string;
  dims: SceneDimensionsMm;
  imageUrl: string | null;
  calibration: SceneViewCalibration | null;
  specimens: PlacementSpecimen[];
}) {
  const router = useRouter();
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Uncommitted position for the active specimen — null means "not yet
  // tapped" (a never-placed coral before its first tap). Seeded from the
  // specimen's saved placement on select, so re-selecting an already-placed
  // coral immediately allows depth fine-tuning or a move.
  const [pending, setPending] = useState<ScenePositionMm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const activeSpecimen = specimens.find((s) => s.id === activeId) ?? null;

  function selectSpecimen(id: string) {
    setError(null);
    if (id === activeId) {
      setActiveId(null);
      setPending(null);
      return;
    }
    setActiveId(id);
    setPending(specimens.find((s) => s.id === id)?.placement ?? null);
  }

  function handleImageClick(e: MouseEvent<HTMLImageElement>) {
    if (!activeId || !calibration || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * imgRef.current.naturalWidth;
    const yPx = ((e.clientY - rect.top) / rect.height) * imgRef.current.naturalHeight;
    const partial = pxToScenePartial("front", calibration, dims, xPx, yPx);
    const zMm = pending?.z_mm ?? dims.depth_mm / 2; // mid-tank default (brief §5)
    setError(null);
    setPending(
      clampToScene({ x_mm: partial.x_mm ?? 0, y_mm: partial.y_mm ?? 0, z_mm: zMm }, dims),
    );
  }

  function handleDepthChange(fraction: number) {
    if (!pending) return;
    setPending(clampToScene({ ...pending, z_mm: sliderFractionToDepthMm(fraction, dims.depth_mm) }, dims));
  }

  function handleSave() {
    if (!activeId || !pending) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("scene_id", sceneId);
      fd.set("specimen_id", activeId);
      fd.set("x_mm", String(pending.x_mm));
      fd.set("y_mm", String(pending.y_mm));
      fd.set("z_mm", String(pending.z_mm));
      const result = await placeSpecimenInScene(fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleRemove() {
    if (!activeId) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("scene_id", sceneId);
      fd.set("specimen_id", activeId);
      const result = await removeSpecimenPlacement(fd);
      if (result?.error) setError(result.error);
      else {
        setPending(null);
        router.refresh();
      }
    });
  }

  if (!imageUrl) {
    return <p className="muted">No face-on photo yet for this tank.</p>;
  }

  if (!calibration) {
    return (
      <div className="scene-canvas-frame">
        <div className="scene-canvas-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Face-on photo of the tank" className="scene-canvas-image" />
        </div>
        <p className="muted">Calibrate this photo (mark the tank&apos;s edges) before placing corals.</p>
      </div>
    );
  }

  return (
    <div className="scene-placement">
      <div className="scene-canvas-frame">
        <p className="muted scene-canvas-hint">
          {activeSpecimen ? `Tap the photo to place ${activeSpecimen.name}.` : "Select a coral below, then tap its spot on the photo."}
        </p>
        <div className="scene-canvas-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Face-on photo of the tank"
            className={`scene-canvas-image${activeId ? " placing" : ""}`}
            onLoad={(e) =>
              setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
            onClick={handleImageClick}
          />
          {naturalSize
            ? specimens.map((s) => {
                const position = s.id === activeId ? pending : s.placement;
                if (!position) return null;
                const px = sceneToPx("front", calibration, dims, position);
                if (!px) return null;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`scene-pin${s.id === activeId ? " active" : ""}`}
                    style={{
                      left: `${(px.xPx / naturalSize.w) * 100}%`,
                      top: `${(px.yPx / naturalSize.h) * 100}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectSpecimen(s.id);
                    }}
                    title={s.name}
                  >
                    <span className="scene-pin-dot" />
                  </button>
                );
              })
            : null}
        </div>
      </div>

      <div className="scene-specimen-list">
        {specimens.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`scene-specimen-row${s.id === activeId ? " active" : ""}`}
            onClick={() => selectSpecimen(s.id)}
          >
            {s.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photoUrl} alt="" className="scene-specimen-thumb" />
            ) : null}
            <span className="scene-specimen-name">{s.name}</span>
            <span className="scene-specimen-status muted">{s.placement ? "Placed" : "Not placed"}</span>
          </button>
        ))}
      </div>

      {activeSpecimen ? (
        <div className="scene-depth-control">
          <div className="scene-depth-header">
            <span>Depth — {activeSpecimen.name}</span>
            {pending ? (
              <span className="muted">{formatSceneLength(pending.z_mm)} from front glass</span>
            ) : null}
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            disabled={!pending}
            value={pending ? depthMmToSliderFraction(pending.z_mm, dims.depth_mm) : 0}
            onChange={(e) => handleDepthChange(Number(e.target.value))}
          />
          <div className="scene-depth-scale">
            <span>0 in — front glass</span>
            <span>{formatSceneLength(dims.depth_mm)} — back glass</span>
          </div>
          {!pending ? (
            <p className="muted scene-depth-hint">Tap the photo to set left-right and up-down position first.</p>
          ) : null}
          <div className="scene-depth-actions">
            <button type="button" onClick={handleSave} disabled={!pending || isSaving}>
              {isSaving ? "…" : "Save placement"}
            </button>
            {activeSpecimen.placement ? (
              <button type="button" className="btn-secondary" onClick={handleRemove} disabled={isSaving}>
                Remove
              </button>
            ) : null}
          </div>
          {error ? <p className="error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

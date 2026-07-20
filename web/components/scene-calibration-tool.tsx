"use client";

import { useRef, useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  isValidCalibration,
  mmPerPx,
  formatSceneLength,
  type Facing,
  type SceneViewCalibration,
} from "@/lib/scene";
import { saveSceneCalibration } from "@/app/tank/scene-actions";

type PointKey = "horizontalZero" | "horizontalMax" | "verticalZero" | "verticalMax";
type MarkedPoint = { xPx: number; yPx: number };

const POINT_ORDER: PointKey[] = ["horizontalZero", "horizontalMax", "verticalZero", "verticalMax"];

// What each of the four points means depends on which scene axes this facing
// determines (lib/scene.ts's FACING_AXES) — a 'front' photo's horizontal axis
// is left/right glass, a 'side' photo's horizontal axis is front/back glass.
const POINT_LABELS: Record<Facing, Record<PointKey, string>> = {
  front: {
    horizontalZero: "Left glass edge",
    horizontalMax: "Right glass edge",
    verticalZero: "Substrate (bottom)",
    verticalMax: "Waterline (top)",
  },
  side: {
    horizontalZero: "Front glass edge",
    horizontalMax: "Back glass edge",
    verticalZero: "Substrate (bottom)",
    verticalMax: "Waterline (top)",
  },
  top: {
    horizontalZero: "Left glass edge",
    horizontalMax: "Right glass edge",
    verticalZero: "Front glass edge",
    verticalMax: "Back glass edge",
  },
};

function buildCalibration(points: Record<PointKey, MarkedPoint>): SceneViewCalibration {
  return {
    horizontal: { zeroPx: points.horizontalZero.xPx, maxPx: points.horizontalMax.xPx },
    vertical: { zeroPx: points.verticalZero.yPx, maxPx: points.verticalMax.yPx },
  };
}

// Marks the four reference points (two per axis) that pin an already-uploaded
// scene photo to real-world millimetres — see docs/tank-scale-model-brief.md
// §3's "deliberately linear" calibration and lib/scene.ts's EdgeCalibration.
// Each point only ever contributes ONE coordinate to the saved calibration
// (a horizontal point's x, or a vertical point's y) — the other coordinate of
// the click is kept only so a marker can be drawn where the user actually
// tapped, for visual feedback.
export function SceneCalibrationTool({
  sceneViewId,
  facing,
  imageUrl,
  axisLengthsMm,
  initialCalibration,
}: {
  sceneViewId: string;
  facing: Facing;
  imageUrl: string;
  axisLengthsMm: { horizontal: number; vertical: number };
  initialCalibration: SceneViewCalibration | null;
}) {
  const router = useRouter();
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [points, setPoints] = useState<Partial<Record<PointKey, MarkedPoint>>>({});
  const [activePoint, setActivePoint] = useState<PointKey>("horizontalZero");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const labels = POINT_LABELS[facing];
  const allMarked = POINT_ORDER.every((k) => points[k]);
  const calibration = allMarked ? buildCalibration(points as Record<PointKey, MarkedPoint>) : null;
  const valid = calibration ? isValidCalibration(calibration) : false;

  function handleImageClick(e: MouseEvent<HTMLImageElement>) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * imgRef.current.naturalWidth;
    const yPx = ((e.clientY - rect.top) / rect.height) * imgRef.current.naturalHeight;
    setError(null);
    setPoints((prev) => ({ ...prev, [activePoint]: { xPx, yPx } }));
    const idx = POINT_ORDER.indexOf(activePoint);
    setActivePoint(POINT_ORDER[(idx + 1) % POINT_ORDER.length]);
  }

  function handleSave() {
    if (!calibration || !valid) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("scene_view_id", sceneViewId);
      fd.set("calibration", JSON.stringify(calibration));
      const result = await saveSceneCalibration(fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="scene-calibration">
      {initialCalibration ? (
        <p className="muted scene-calibration-existing">
          Already calibrated — roughly {formatSceneLength(mmPerPx(initialCalibration.horizontal, axisLengthsMm.horizontal) * 100)} per 100px
          horizontal, {formatSceneLength(mmPerPx(initialCalibration.vertical, axisLengthsMm.vertical) * 100)} per 100px vertical. Marking new
          points below replaces it.
        </p>
      ) : null}

      <p className="scene-canvas-hint">
        Tap the photo to mark: <strong>{labels[activePoint]}</strong>
      </p>

      <div className="scene-canvas-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Tank photo to calibrate"
          className="scene-canvas-image placing"
          onLoad={(e) => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          onClick={handleImageClick}
        />
        {naturalSize
          ? POINT_ORDER.map((key) => {
              const point = points[key];
              if (!point) return null;
              return (
                <button
                  key={key}
                  type="button"
                  className={`scene-calibration-marker${key === activePoint ? " active" : ""}`}
                  style={{
                    left: `${(point.xPx / naturalSize.w) * 100}%`,
                    top: `${(point.yPx / naturalSize.h) * 100}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePoint(key);
                  }}
                  title={labels[key]}
                >
                  <span className="scene-calibration-marker-dot" />
                </button>
              );
            })
          : null}
      </div>

      <div className="scene-calibration-points">
        {POINT_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`scene-specimen-row${key === activePoint ? " active" : ""}`}
            onClick={() => setActivePoint(key)}
          >
            <span className="scene-specimen-name">{labels[key]}</span>
            <span className="scene-specimen-status muted">{points[key] ? "Marked" : "Not marked"}</span>
          </button>
        ))}
      </div>

      {calibration ? (
        <p className="muted">
          Derived scale: {formatSceneLength(mmPerPx(calibration.horizontal, axisLengthsMm.horizontal) * 100)} per 100px horizontal,{" "}
          {formatSceneLength(mmPerPx(calibration.vertical, axisLengthsMm.vertical) * 100)} per 100px vertical.
        </p>
      ) : null}

      {calibration && !valid ? (
        <p className="error">Two reference points landed on the same spot — re-mark them further apart.</p>
      ) : null}

      <div className="scene-depth-actions">
        <button type="button" onClick={handleSave} disabled={!calibration || !valid || isSaving}>
          {isSaving ? "…" : "Save calibration"}
        </button>
        {error ? <span className="error">{error}</span> : null}
      </div>
    </div>
  );
}

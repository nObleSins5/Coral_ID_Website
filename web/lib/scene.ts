// Tank scale model — calibrated photo <-> real-world coordinate helpers (see
// docs/tank-scale-model-brief.md, sql/supabase/36_tank_scale_model.sql). Pure
// and dependency-free, same shape as lib/grid.ts: a scene's layout is derived
// from calibration + known dimensions, not stored as anything richer.
//
// Canonical unit is MILLIMETRES throughout (matches specimen_placements'
// x_mm/y_mm/z_mm) — inches are a display conversion only, computed on demand,
// never a second stored value the mm figures could drift from.
//
// Calibration is deliberately linear (brief §3): each scene_views row is
// assumed to be a flat, glass-parallel capture, so a facing's pixel axis maps
// to a scene axis via two reference points — the "0" edge and the "max" edge
// (e.g. left glass edge and right glass edge) — rather than a full projective
// homography.

export type SceneAxis = "x" | "y" | "z";
export type Facing = "front" | "side" | "top";

// Which two scene axes a given facing's photo can determine. 'front' calibrates
// width (x) + height (y); 'side' calibrates depth (z) + height (y, cross-check);
// 'top' (deferred, optional) calibrates width (x) + depth (z, cross-check).
export const FACING_AXES: Record<Facing, { horizontal: SceneAxis; vertical: SceneAxis }> = {
  front: { horizontal: "x", vertical: "y" },
  side: { horizontal: "z", vertical: "y" },
  top: { horizontal: "x", vertical: "z" },
};

export type SceneDimensionsMm = {
  width_mm: number; // x extent, left-right
  height_mm: number; // y extent, up-down (substrate to waterline)
  depth_mm: number; // z extent, front-back (front glass to back glass)
};

export function axisLengthMm(axis: SceneAxis, dims: SceneDimensionsMm): number {
  switch (axis) {
    case "x":
      return dims.width_mm;
    case "y":
      return dims.height_mm;
    case "z":
      return dims.depth_mm;
  }
}

// One image axis's calibration: the pixel positions of the scene's "0" edge
// and its known-length "max" edge (e.g. left glass edge -> 0, right glass edge
// -> width_mm). direction-agnostic — maxPx may be less than zeroPx (an image
// axis that runs opposite the scene axis, e.g. pixel-y increasing downward
// while scene y increases upward from the substrate).
export type EdgeCalibration = { zeroPx: number; maxPx: number };

export type SceneViewCalibration = {
  horizontal: EdgeCalibration; // this facing's FACING_AXES.horizontal
  vertical: EdgeCalibration; // this facing's FACING_AXES.vertical
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// A calibration whose two reference points landed on the same pixel can't
// derive a scale (divide-by-zero) — reject it before it's saved.
export function isValidCalibration(calibration: SceneViewCalibration): boolean {
  return (
    calibration.horizontal.zeroPx !== calibration.horizontal.maxPx &&
    calibration.vertical.zeroPx !== calibration.vertical.maxPx
  );
}

// Pixel position -> real-world mm along one axis, clamped to the scene's known
// extent (a tap slightly outside the marked edges still resolves to the
// nearest in-bounds mm rather than an out-of-range value).
export function pxToMm(calibration: EdgeCalibration, lengthMm: number, px: number): number {
  const span = calibration.maxPx - calibration.zeroPx;
  if (span === 0) return 0;
  const mm = ((px - calibration.zeroPx) / span) * lengthMm;
  return clamp(mm, 0, lengthMm);
}

// Inverse of pxToMm — where a real-world mm position falls in pixel space, for
// drawing a placed pin back onto this facing's photo.
export function mmToPx(calibration: EdgeCalibration, lengthMm: number, mm: number): number {
  if (lengthMm === 0) return calibration.zeroPx;
  const fraction = clamp(mm, 0, lengthMm) / lengthMm;
  return calibration.zeroPx + fraction * (calibration.maxPx - calibration.zeroPx);
}

export type ScenePositionMm = { x_mm: number; y_mm: number; z_mm: number };

const AXIS_KEY: Record<SceneAxis, keyof ScenePositionMm> = {
  x: "x_mm",
  y: "y_mm",
  z: "z_mm",
};

// A tap on a facing's photo determines only the two axes that facing exposes
// (see FACING_AXES) — the third axis is NOT returned here. In particular a tap
// on 'front' never yields depth: depth is slider-primary, because rockwork
// occludes most of the tank from the side view, so a coral behind rock simply
// isn't visible/tappable there (brief §5). Callers merge in the third axis
// (from the depth slider, or an existing placement's current value).
export function pxToScenePartial(
  facing: Facing,
  calibration: SceneViewCalibration,
  dims: SceneDimensionsMm,
  xPx: number,
  yPx: number,
): Partial<ScenePositionMm> {
  const axes = FACING_AXES[facing];
  const horizontalMm = pxToMm(calibration.horizontal, axisLengthMm(axes.horizontal, dims), xPx);
  const verticalMm = pxToMm(calibration.vertical, axisLengthMm(axes.vertical, dims), yPx);
  return {
    [AXIS_KEY[axes.horizontal]]: horizontalMm,
    [AXIS_KEY[axes.vertical]]: verticalMm,
  };
}

function axisValueMm(axis: SceneAxis, position: ScenePositionMm): number {
  return position[AXIS_KEY[axis]];
}

// Inverse of pxToScenePartial — where to draw a placement's pin in this
// facing's pixel space. Returns null if this facing has no calibration yet
// (e.g. the optional side/top photo was never shot or calibrated).
export function sceneToPx(
  facing: Facing,
  calibration: SceneViewCalibration | null,
  dims: SceneDimensionsMm,
  position: ScenePositionMm,
): { xPx: number; yPx: number } | null {
  if (!calibration) return null;
  const axes = FACING_AXES[facing];
  return {
    xPx: mmToPx(calibration.horizontal, axisLengthMm(axes.horizontal, dims), axisValueMm(axes.horizontal, position)),
    yPx: mmToPx(calibration.vertical, axisLengthMm(axes.vertical, dims), axisValueMm(axes.vertical, position)),
  };
}

// Keeps a placement inside the scene's known physical bounds — e.g. after
// merging a tapped (x,y) with a slider-set z that hasn't been clamped yet.
export function clampToScene(position: ScenePositionMm, dims: SceneDimensionsMm): ScenePositionMm {
  return {
    x_mm: clamp(position.x_mm, 0, dims.width_mm),
    y_mm: clamp(position.y_mm, 0, dims.height_mm),
    z_mm: clamp(position.z_mm, 0, dims.depth_mm),
  };
}

// --- Depth slider (primary Z input — see brief §5) --------------------------
// The slider ranges 0 (front glass) .. depth_mm (back glass) as a 0..1
// fraction of the tank's known depth; always available regardless of whether
// the side photo can actually see a given coral.

export function sliderFractionToDepthMm(fraction: number, depthMm: number): number {
  return clamp(fraction, 0, 1) * depthMm;
}

export function depthMmToSliderFraction(depthValueMm: number, depthMm: number): number {
  if (depthMm === 0) return 0;
  return clamp(depthValueMm, 0, depthMm) / depthMm;
}

// --- Display units (mm is canonical; inches are derived, never stored) ------

const MM_PER_INCH = 25.4;

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

// "4.5 in" / "114 mm" — for slider labels and pin tooltips (brief §5's "0 in —
// front glass … 18 in — back glass" scale).
export function formatSceneLength(mm: number, unit: "in" | "mm" = "in"): string {
  if (unit === "mm") return `${Math.round(mm)} mm`;
  return `${Math.round(mmToInches(mm) * 10) / 10} in`;
}

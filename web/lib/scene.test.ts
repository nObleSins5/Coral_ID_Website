import { describe, it, expect } from "vitest";
import {
  pxToMm,
  mmToPx,
  isValidCalibration,
  pxToScenePartial,
  sceneToPx,
  clampToScene,
  sliderFractionToDepthMm,
  depthMmToSliderFraction,
  mmToInches,
  inchesToMm,
  formatSceneLength,
  type SceneDimensionsMm,
  type SceneViewCalibration,
} from "./scene";

const DIMS: SceneDimensionsMm = { width_mm: 1220, height_mm: 500, depth_mm: 500 }; // ~48x20x20in

describe("pxToMm / mmToPx", () => {
  it("maps the zero edge to 0mm and the max edge to the full length", () => {
    const calib = { zeroPx: 100, maxPx: 900 };
    expect(pxToMm(calib, 1220, 100)).toBe(0);
    expect(pxToMm(calib, 1220, 900)).toBe(1220);
    expect(pxToMm(calib, 1220, 500)).toBeCloseTo(610, 0);
  });

  it("handles a flipped axis (maxPx < zeroPx, e.g. pixel-y running opposite scene-y)", () => {
    const calib = { zeroPx: 900, maxPx: 100 }; // substrate at bottom of image (high px), waterline at top
    expect(pxToMm(calib, 500, 900)).toBe(0);
    expect(pxToMm(calib, 500, 100)).toBe(500);
  });

  it("clamps taps outside the marked edges to the scene's bounds", () => {
    const calib = { zeroPx: 100, maxPx: 900 };
    expect(pxToMm(calib, 1220, 0)).toBe(0);
    expect(pxToMm(calib, 1220, 2000)).toBe(1220);
  });

  it("round-trips mm -> px -> mm", () => {
    const calib = { zeroPx: 50, maxPx: 750 };
    const originalMm = 300;
    const px = mmToPx(calib, 500, originalMm);
    expect(pxToMm(calib, 500, px)).toBeCloseTo(originalMm, 6);
  });

  it("a degenerate zero-length scene axis doesn't divide by zero", () => {
    const calib = { zeroPx: 100, maxPx: 900 };
    expect(mmToPx(calib, 0, 50)).toBe(100);
  });
});

describe("isValidCalibration", () => {
  it("rejects an axis whose two reference points landed on the same pixel", () => {
    const calibration: SceneViewCalibration = {
      horizontal: { zeroPx: 100, maxPx: 900 },
      vertical: { zeroPx: 50, maxPx: 50 },
    };
    expect(isValidCalibration(calibration)).toBe(false);
  });

  it("accepts distinct reference points on both axes", () => {
    const calibration: SceneViewCalibration = {
      horizontal: { zeroPx: 100, maxPx: 900 },
      vertical: { zeroPx: 50, maxPx: 450 },
    };
    expect(isValidCalibration(calibration)).toBe(true);
  });
});

describe("pxToScenePartial — facing determines which axes a tap can set", () => {
  const calibration: SceneViewCalibration = {
    horizontal: { zeroPx: 0, maxPx: 1000 },
    vertical: { zeroPx: 1000, maxPx: 0 },
  };

  it("front sets x + y, never z", () => {
    const partial = pxToScenePartial("front", calibration, DIMS, 500, 500);
    expect(Object.keys(partial).sort()).toEqual(["x_mm", "y_mm"]);
    expect(partial.x_mm).toBeCloseTo(610, 0);
  });

  it("side sets z + y, never x — depth from a side photo, not the face-on canvas", () => {
    const partial = pxToScenePartial("side", calibration, DIMS, 500, 500);
    expect(Object.keys(partial).sort()).toEqual(["y_mm", "z_mm"]);
  });

  it("top sets x + z, never y", () => {
    const partial = pxToScenePartial("top", calibration, DIMS, 500, 500);
    expect(Object.keys(partial).sort()).toEqual(["x_mm", "z_mm"]);
  });
});

describe("sceneToPx", () => {
  const calibration: SceneViewCalibration = {
    horizontal: { zeroPx: 0, maxPx: 1000 },
    vertical: { zeroPx: 1000, maxPx: 0 },
  };
  const position = { x_mm: 610, y_mm: 250, z_mm: 250 };

  it("returns null when the facing has no calibration (uncaptured/optional side or top photo)", () => {
    expect(sceneToPx("side", null, DIMS, position)).toBeNull();
  });

  it("maps a scene position back into this facing's pixel space", () => {
    const px = sceneToPx("front", calibration, DIMS, position);
    expect(px).not.toBeNull();
    expect(px!.xPx).toBeCloseTo(500, 0);
  });
});

describe("clampToScene", () => {
  it("clamps an out-of-bounds position (e.g. tap + unclamped slider merge) into the tank", () => {
    const clamped = clampToScene({ x_mm: -50, y_mm: 9999, z_mm: 250 }, DIMS);
    expect(clamped).toEqual({ x_mm: 0, y_mm: DIMS.height_mm, z_mm: 250 });
  });
});

describe("depth slider (primary Z input)", () => {
  it("0 fraction is front glass, 1 fraction is back glass", () => {
    expect(sliderFractionToDepthMm(0, 500)).toBe(0);
    expect(sliderFractionToDepthMm(1, 500)).toBe(500);
    expect(sliderFractionToDepthMm(0.5, 500)).toBe(250);
  });

  it("round-trips depth mm -> fraction -> depth mm", () => {
    const fraction = depthMmToSliderFraction(125, 500);
    expect(sliderFractionToDepthMm(fraction, 500)).toBeCloseTo(125, 6);
  });

  it("clamps out-of-range fractions and depths", () => {
    expect(sliderFractionToDepthMm(1.5, 500)).toBe(500);
    expect(depthMmToSliderFraction(-10, 500)).toBe(0);
  });
});

describe("mm/inch conversion (mm canonical, inches derived only)", () => {
  it("converts a 48in tank width to mm and back", () => {
    const mm = inchesToMm(48);
    expect(mm).toBeCloseTo(1219.2, 1);
    expect(mmToInches(mm)).toBeCloseTo(48, 6);
  });
});

describe("formatSceneLength", () => {
  it("formats inches to one decimal place by default", () => {
    expect(formatSceneLength(1219.2)).toBe("48 in");
    expect(formatSceneLength(127)).toBe("5 in");
  });

  it("formats millimetres as whole numbers when requested", () => {
    expect(formatSceneLength(1219.2, "mm")).toBe("1219 mm");
  });
});

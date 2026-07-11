// Shared color math for the element color-picker feature. Pure functions, no
// I/O — safe to import from both client (the picker) and server (the
// range-check in submitColorSamples).
//
// Two distinct color operations live here, and they deliberately use
// different methods (product decision 2026-07-11):
//   - White-balance CORRECTION uses simple per-channel sRGB scaling. Proper
//     CIELAB chromatic adaptation (a Bradford transform in linear light) is
//     substantially more work for a v1; per-channel sRGB is the honest
//     approximation we ship first.
//   - The RANGE-CHECK ("is this sample too far from the documented color?")
//     uses CIELAB ΔE76 — the standard, cheap way to measure perceptual color
//     distance, and the right tool for deciding "likely a miss vs. agrees
//     with consensus."

export type RGB = [number, number, number];

export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(rgb: RGB): string {
  return (
    "#" +
    rgb
      .map((v) => {
        const s = Math.round(clamp255(v)).toString(16).toUpperCase();
        return s.length === 1 ? "0" + s : s;
      })
      .join("")
  );
}

// Known target values for an in-frame white-balance reference material. Not a
// perceptual match the user eyeballs (their screen is uncalibrated too) — a
// categorical pick of which physical thing they tagged.
export const WB_TARGETS: Record<string, RGB> = {
  white: [255, 255, 255], // bright white frag plug / white card
  bone: [238, 232, 222], // bone / off-white
  gray: [200, 200, 200], // neutral light grey
};

// Per-channel gain from an observed reference color to its known target,
// clamped so a near-black or blown reference can't produce an absurd factor.
export function wbGain(observed: RGB, material: string): RGB {
  const t = WB_TARGETS[material] ?? WB_TARGETS.white;
  return observed.map((o, i) => {
    const g = o < 4 ? 1 : t[i] / o;
    return Math.max(0.2, Math.min(5, g));
  }) as RGB;
}

export function applyGain(rgb: RGB, gain: RGB): RGB {
  return [rgb[0] * gain[0], rgb[1] * gain[1], rgb[2] * gain[2]].map(clamp255) as RGB;
}

// --- CIELAB ΔE76, for the range-check only ---

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToLab(rgb: RGB): [number, number, number] {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);
  // linear sRGB -> XYZ (D65)
  const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  // XYZ -> Lab (D65 reference white)
  const xn = 0.95047, yn = 1.0, zn = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / xn), fy = f(y / yn), fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(hexA: string, hexB: string): number {
  const a = rgbToLab(hexToRgb(hexA));
  const b = rgbToLab(hexToRgb(hexB));
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

// Minimum ΔE from a candidate hex to any color in the documented reference
// set. The reference for an element is the union of its seed color stops and
// any already-confirmed community samples — so consensus self-reinforces as
// real data accrues. Returns null when there's nothing to compare against yet
// (a brand-new element with no documented color), which the caller treats as
// "can't range-check — needs review" rather than auto-confirm.
export function minDeltaE(candidateHex: string, referenceHexes: string[]): number | null {
  if (referenceHexes.length === 0) return null;
  let best = Infinity;
  for (const ref of referenceHexes) {
    const d = deltaE76(candidateHex, ref);
    if (d < best) best = d;
  }
  return best;
}

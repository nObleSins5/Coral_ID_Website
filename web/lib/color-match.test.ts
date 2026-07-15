import { describe, it, expect } from "vitest";
import {
  hexToHsl,
  hexToFamily,
  familiesForColorRanges,
  scoreCoralMatch,
  type ColorFamily,
} from "./color-match";

describe("hexToHsl", () => {
  it("parses with or without leading # and is case-insensitive", () => {
    expect(hexToHsl("#FFFFFF")).toEqual({ h: 0, s: 0, l: 100 });
    expect(hexToHsl("000000")).toEqual({ h: 0, s: 0, l: 0 });
    expect(hexToHsl("#ff0000")?.h).toBe(0);
  });
  it("returns null for malformed input", () => {
    expect(hexToHsl("#FFF")).toBeNull();
    expect(hexToHsl("not-a-color")).toBeNull();
    expect(hexToHsl("#GGGGGG")).toBeNull();
  });
});

describe("hexToFamily — canonical anchors", () => {
  const cases: [string, ColorFamily][] = [
    ["#E23B3B", "red"],
    ["#FF8C00", "orange"],
    ["#FFD700", "yellow"],
    ["#2E8B57", "green"],
    ["#008080", "teal"],
    ["#1E90FF", "blue"],
    ["#800080", "purple"],
    ["#FF69B4", "pink"],
    ["#8B4513", "brown"],
    ["#FFF3D6", "cream"],
  ];
  it.each(cases)("%s -> %s", (hex, family) => {
    expect(hexToFamily(hex)).toBe(family);
  });
});

describe("hexToFamily — tuned boundary cases", () => {
  // These are the classifications HSL hue alone would get wrong; the module's
  // ordering (cream/brown before hue bins) and shifted bin edges fix them.
  it("magenta-purple stays purple, not pink (purple/pink split at 315)", () => {
    expect(hexToFamily("#800080")).toBe("purple"); // h=300
    expect(hexToFamily("#FF69B4")).toBe("pink"); // h=330
  });
  it("light blue lands in blue, not teal (teal/blue split at 190)", () => {
    expect(hexToFamily("#ADD8E6")).toBe("blue"); // h~195
    expect(hexToFamily("#008080")).toBe("teal"); // h=180
  });
  it("dark warm colors are brown, not dark orange/yellow", () => {
    expect(hexToFamily("#3B2A1A")).toBe("brown"); // very dark
    expect(hexToFamily("#B8860B")).toBe("brown"); // dark goldenrod
    expect(hexToFamily("#FF8C00")).toBe("orange"); // bright orange stays orange
  });
  it("pale/low-saturation warm tints are cream, not orange/yellow", () => {
    expect(hexToFamily("#E8E0C8")).toBe("cream"); // off-white
    expect(hexToFamily("#C8A96B")).toBe("cream"); // tan/khaki
    expect(hexToFamily("#F2C200")).toBe("yellow"); // saturated gold stays yellow
  });
  it("dark red stays red (brown rule excludes the red hue edge)", () => {
    expect(hexToFamily("#B02222")).toBe("red"); // h=0, l=41
  });
  it("blue-grey reads as blue by hue, not dropped as neutral", () => {
    expect(hexToFamily("#546E7A")).toBe("blue");
  });
});

describe("hexToFamily — invalid", () => {
  it("returns null for malformed hex", () => {
    expect(hexToFamily("#FFF")).toBeNull();
    expect(hexToFamily("")).toBeNull();
  });
});

describe("familiesForColorRanges", () => {
  const r = (...hexes: string[]) => ({ color_stops: hexes.map((hex) => ({ hex })) });

  it("collects the distinct families across all stops", () => {
    const fams = familiesForColorRanges([r("#2E8B57"), r("#E23B3B", "#FF8C00")]);
    expect(fams.sort()).toEqual(["green", "orange", "red"].sort());
  });
  it("dedupes families that appear in multiple ranges", () => {
    expect(familiesForColorRanges([r("#2E8B57"), r("#4CAF50")])).toEqual(["green"]);
  });
  it("returns families in spectrum (COLOR_FAMILIES) order, not input order", () => {
    // pink, green, red as input -> should come back red, green, pink
    expect(familiesForColorRanges([r("#FF69B4"), r("#2E8B57"), r("#E23B3B")])).toEqual([
      "red",
      "green",
      "pink",
    ]);
  });
  it("skips malformed hexes without throwing", () => {
    expect(familiesForColorRanges([r("bad", "#1E90FF")])).toEqual(["blue"]);
  });
  it("returns empty for a coral with no color stops", () => {
    expect(familiesForColorRanges([{ color_stops: [] }])).toEqual([]);
  });
});

describe("scoreCoralMatch", () => {
  it("full coverage with no extras scores 1", () => {
    const m = scoreCoralMatch(["red", "green"], ["red", "green"]);
    expect(m.score).toBeCloseTo(1);
    expect(m.matched).toEqual(["red", "green"]);
    expect(m.missed).toEqual([]);
  });
  it("scores 0 and is filterable when nothing overlaps", () => {
    const m = scoreCoralMatch(["blue"], ["red", "green"]);
    expect(m.score).toBe(0);
    expect(m.missed).toEqual(["blue"]);
  });
  it("reports which requested colors are missing", () => {
    const m = scoreCoralMatch(["red", "blue"], ["red", "green"]);
    expect(m.matched).toEqual(["red"]);
    expect(m.missed).toEqual(["blue"]);
    expect(m.score).toBeGreaterThan(0);
    expect(m.score).toBeLessThan(1);
  });
  it("ranks a focused exact match above a busy coral that merely includes the colors", () => {
    const user: ColorFamily[] = ["red", "green"];
    const focused = scoreCoralMatch(user, ["red", "green"]);
    const busy = scoreCoralMatch(user, ["red", "green", "blue", "purple", "yellow"]);
    expect(focused.score).toBeGreaterThan(busy.score);
    // ...but the busy coral still scores well since it covers both colors.
    expect(busy.score).toBeGreaterThan(0.8);
  });
  it("full coverage always outranks partial coverage", () => {
    const user: ColorFamily[] = ["red", "green", "blue"];
    const full = scoreCoralMatch(user, ["red", "green", "blue"]);
    const partial = scoreCoralMatch(user, ["red", "green"]); // missing blue, no extras
    expect(full.score).toBeGreaterThan(partial.score);
  });
  it("treats an empty user selection as a non-match", () => {
    expect(scoreCoralMatch([], ["red"]).score).toBe(0);
  });
});

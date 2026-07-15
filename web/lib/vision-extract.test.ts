import { describe, it, expect } from "vitest";
import { parseVisionExtraction } from "./vision-extract";

const CATEGORIES = ["sps", "lps", "mushroom", "leather", "zoanthid", "soft-coral"];

describe("parseVisionExtraction", () => {
  it("passes through a well-formed response", () => {
    const r = parseVisionExtraction(
      {
        category: "zoanthid",
        colors: ["red", "green"],
        approx_percents: { red: 40, green: 60 },
        lighting: "actinic",
      },
      CATEGORIES,
    );
    expect(r).toEqual({
      categorySlug: "zoanthid",
      families: ["red", "green"],
      approxPercents: { red: 40, green: 60 },
      lighting: "actinic",
    });
  });

  it("drops an unknown category slug (model hallucination)", () => {
    const r = parseVisionExtraction({ category: "hard-coral", colors: [] }, CATEGORIES);
    expect(r.categorySlug).toBeNull();
  });

  it("drops unrecognized color codes but keeps valid ones", () => {
    const r = parseVisionExtraction({ colors: ["red", "chartreuse", "blue"] }, CATEGORIES);
    expect(r.families).toEqual(["red", "blue"]);
  });

  it("dedupes repeated colors", () => {
    const r = parseVisionExtraction({ colors: ["red", "red", "green"] }, CATEGORIES);
    expect(r.families).toEqual(["red", "green"]);
  });

  it("returns families in spectrum order regardless of input order", () => {
    const r = parseVisionExtraction({ colors: ["pink", "red", "green"] }, CATEGORIES);
    expect(r.families).toEqual(["red", "green", "pink"]);
  });

  it("clamps and rounds approx_percents into 0-100", () => {
    const r = parseVisionExtraction(
      { colors: ["red", "green"], approx_percents: { red: 150, green: -10.6 } },
      CATEGORIES,
    );
    expect(r.approxPercents).toEqual({ red: 100, green: 0 });
  });

  it("only keeps approx_percents for families that were actually reported", () => {
    const r = parseVisionExtraction(
      { colors: ["red"], approx_percents: { red: 80, blue: 20 } },
      CATEGORIES,
    );
    expect(r.approxPercents).toEqual({ red: 80 });
  });

  it("ignores non-numeric approx_percent values", () => {
    const r = parseVisionExtraction(
      { colors: ["red"], approx_percents: { red: "mostly" } },
      CATEGORIES,
    );
    expect(r.approxPercents).toEqual({});
  });

  it("defaults lighting to unsure for a missing or invalid value", () => {
    expect(parseVisionExtraction({ colors: [] }, CATEGORIES).lighting).toBe("unsure");
    expect(parseVisionExtraction({ colors: [], lighting: "sunny" }, CATEGORIES).lighting).toBe(
      "unsure",
    );
  });

  it("handles malformed top-level input without throwing", () => {
    expect(parseVisionExtraction(null, CATEGORIES)).toEqual({
      categorySlug: null,
      families: [],
      approxPercents: {},
      lighting: "unsure",
    });
    expect(parseVisionExtraction("not an object", CATEGORIES).families).toEqual([]);
    expect(parseVisionExtraction([1, 2, 3], CATEGORIES).families).toEqual([]);
  });

  it("handles a non-array colors field without throwing", () => {
    const r = parseVisionExtraction({ colors: "red" }, CATEGORIES);
    expect(r.families).toEqual([]);
  });
});

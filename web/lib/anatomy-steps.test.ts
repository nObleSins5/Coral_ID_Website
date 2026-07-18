import { describe, expect, it } from "vitest";
import { resolveTemplateCode, stepsForTemplate } from "@/lib/anatomy-steps";

describe("resolveTemplateCode", () => {
  it("prefers the genus's own anatomy template over the category default", () => {
    expect(resolveTemplateCode("sps", "leather_soft_coral")).toBe("leather_soft_coral");
  });
  it("falls back to the category default when no genus is picked", () => {
    expect(resolveTemplateCode("zoanthid", null)).toBe("zoanthid_paly");
  });
  it("returns null when neither category nor genus is known", () => {
    expect(resolveTemplateCode(null, null)).toBeNull();
  });
});

describe("stepsForTemplate", () => {
  it("gives a zoanthid exactly Mouth, Skirt, Tentacles", () => {
    const steps = stepsForTemplate("zoanthid_paly");
    expect(steps.map((s) => s.label)).toEqual(["Mouth", "Skirt", "Tentacles"]);
  });
  it("combines an SPS's skin/corallite positions into one 'Skin and Structure' step, and includes Tentacles", () => {
    const steps = stepsForTemplate("branching_sps");
    expect(steps.map((s) => s.label)).toEqual(["Growth tip", "Skin and Structure", "Tentacles"]);
    const skin = steps.find((s) => s.key === "skin_structure")!;
    expect(skin.positions).toEqual(["coenosarc_skin", "axial_corallite", "radial_corallite"]);
  });
  it("marks a leather's Stalk step optional (not every leather has one)", () => {
    const steps = stepsForTemplate("leather_soft_coral");
    const stalk = steps.find((s) => s.key === "stalk")!;
    expect(stalk.optional).toBe(true);
  });
  it("marks a mushroom's Bubbles step optional (not every mushroom has one)", () => {
    const steps = stepsForTemplate("mushroom_coral");
    const bubbles = steps.find((s) => s.key === "bubbles")!;
    expect(bubbles.optional).toBe(true);
  });
  it("returns an empty list for an unknown template", () => {
    expect(stepsForTemplate(null)).toEqual([]);
    expect(stepsForTemplate("not_a_real_template")).toEqual([]);
  });
});

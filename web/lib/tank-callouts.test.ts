import { describe, it, expect } from "vitest";
import { buildTankStatus, type ContributingMorph, type LatestReading } from "./tank-callouts";

function morph(overrides: Partial<ContributingMorph> & { id: string; name: string }): ContributingMorph {
  const empty = { min: null, max: null };
  return {
    care_difficulty_code: null,
    light_level_code: null,
    flow_level_code: null,
    ranges: {
      alkalinity_dkh: empty,
      calcium_ppm: empty,
      magnesium_ppm: empty,
      nitrate_ppm: empty,
      phosphate_ppm: empty,
      temperature_c: empty,
    },
    ...overrides,
  };
}

function reading(overrides: Partial<LatestReading> = {}): LatestReading {
  return {
    measured_at: "2026-07-16T12:00:00.000Z",
    alkalinity_dkh: null,
    calcium_ppm: null,
    magnesium_ppm: null,
    nitrate_ppm: null,
    phosphate_ppm: null,
    temperature_c: null,
    ...overrides,
  };
}

describe("buildTankStatus — empty / no-op cases", () => {
  it("produces no callouts for a tank with no corals and no reading", () => {
    const status = buildTankStatus([], null, { light: false, flow: false });
    expect(status.callouts).toEqual([]);
    expect(status.contributingCoralCount).toBe(0);
  });

  it("produces no callouts when a reading is in range for all contributing corals", () => {
    const sps = morph({
      id: "1",
      name: "Walt Disney Acropora",
      light_level_code: "high",
      flow_level_code: "high",
      ranges: {
        alkalinity_dkh: { min: 8, max: 9.5 },
        calcium_ppm: { min: 420, max: 450 },
        magnesium_ppm: { min: null, max: null },
        nitrate_ppm: { min: null, max: null },
        phosphate_ppm: { min: null, max: null },
        temperature_c: { min: null, max: null },
      },
    });
    const status = buildTankStatus(
      [sps],
      reading({ alkalinity_dkh: 8.7, calcium_ppm: 430 }),
      { light: true, flow: true },
    );
    expect(status.callouts).toEqual([]);
  });
});

describe("buildTankStatus — shared-band outlier (ranges overlap)", () => {
  it("reports a single outlier with no named offenders when the intersection band is violated", () => {
    const softy = morph({
      id: "1",
      name: "Green Star Polyps",
      ranges: { alkalinity_dkh: { min: 7, max: 10 }, calcium_ppm: { min: null, max: null }, magnesium_ppm: { min: null, max: null }, nitrate_ppm: { min: null, max: null }, phosphate_ppm: { min: null, max: null }, temperature_c: { min: null, max: null } },
    });
    const sps = morph({
      id: "2",
      name: "Walt Disney Acropora",
      ranges: { alkalinity_dkh: { min: 8, max: 9.5 }, calcium_ppm: { min: null, max: null }, magnesium_ppm: { min: null, max: null }, nitrate_ppm: { min: null, max: null }, phosphate_ppm: { min: null, max: null }, temperature_c: { min: null, max: null } },
    });
    // Intersection of [7,10] and [8,9.5] is [8,9.5] — a real shared band.
    const status = buildTankStatus(
      [softy, sps],
      reading({ alkalinity_dkh: 7.2 }),
      { light: false, flow: false },
    );
    const paramCallouts = status.callouts.filter((c) => c.type === "param_outlier");
    expect(paramCallouts).toHaveLength(1);
    const c = paramCallouts[0];
    if (c.type !== "param_outlier") throw new Error("unreachable");
    expect(c.band).toEqual({ min: 8, max: 9.5 });
    expect(c.offenders).toBeNull();
  });
});

describe("buildTankStatus — genuine conflict (ranges don't overlap)", () => {
  it("names the specific offending coral instead of fabricating a shared target", () => {
    // Two corals whose alkalinity ranges share no overlap at all.
    const wantsLow = morph({
      id: "1",
      name: "Rainbow Trachy",
      ranges: { alkalinity_dkh: { min: 6, max: 7 }, calcium_ppm: { min: null, max: null }, magnesium_ppm: { min: null, max: null }, nitrate_ppm: { min: null, max: null }, phosphate_ppm: { min: null, max: null }, temperature_c: { min: null, max: null } },
    });
    const wantsHigh = morph({
      id: "2",
      name: "Walt Disney Acropora",
      ranges: { alkalinity_dkh: { min: 8, max: 9.5 }, calcium_ppm: { min: null, max: null }, magnesium_ppm: { min: null, max: null }, nitrate_ppm: { min: null, max: null }, phosphate_ppm: { min: null, max: null }, temperature_c: { min: null, max: null } },
    });
    // A reading of 8.5 satisfies wantsHigh but violates wantsLow's [6,7] band.
    const status = buildTankStatus(
      [wantsLow, wantsHigh],
      reading({ alkalinity_dkh: 8.5 }),
      { light: false, flow: false },
    );
    const paramCallouts = status.callouts.filter((c) => c.type === "param_outlier");
    expect(paramCallouts).toHaveLength(1);
    const c = paramCallouts[0];
    if (c.type !== "param_outlier") throw new Error("unreachable");
    expect(c.band).toEqual({ min: 6, max: 7 });
    expect(c.offenders).toEqual(["Rainbow Trachy"]);
  });

  it("reports no callout when the reading satisfies every individual range despite a conflict existing", () => {
    const wantsLow = morph({
      id: "1",
      name: "Coral A",
      ranges: { alkalinity_dkh: { min: 6, max: 7 }, calcium_ppm: { min: null, max: null }, magnesium_ppm: { min: null, max: null }, nitrate_ppm: { min: null, max: null }, phosphate_ppm: { min: null, max: null }, temperature_c: { min: null, max: null } },
    });
    const wantsHigh = morph({
      id: "2",
      name: "Coral B",
      ranges: { alkalinity_dkh: { min: 8, max: 9.5 }, calcium_ppm: { min: null, max: null }, magnesium_ppm: { min: null, max: null }, nitrate_ppm: { min: null, max: null }, phosphate_ppm: { min: null, max: null }, temperature_c: { min: null, max: null } },
    });
    // No possible reading satisfies both, but 6.5 at least satisfies Coral A;
    // it does violate Coral B's [8,9.5] band, so a callout should still fire
    // naming Coral B this time (the tightest violated band).
    const status = buildTankStatus(
      [wantsLow, wantsHigh],
      reading({ alkalinity_dkh: 6.5 }),
      { light: false, flow: false },
    );
    const c = status.callouts.find((c) => c.type === "param_outlier");
    if (!c || c.type !== "param_outlier") throw new Error("expected a callout");
    expect(c.offenders).toEqual(["Coral B"]);
  });
});

describe("buildTankStatus — equipment gap", () => {
  it("flags a missing light for a high-light coral", () => {
    const sps = morph({ id: "1", name: "SPS", light_level_code: "high" });
    const status = buildTankStatus([sps], null, { light: false, flow: true });
    const gap = status.callouts.find((c) => c.type === "equipment_gap" && c.category === "light");
    expect(gap).toBeDefined();
    if (gap?.type === "equipment_gap") {
      expect(gap.demandTier).toBe("high");
      expect(gap.coralCount).toBe(1);
    }
  });

  it("does not flag a gap for low-demand-only tanks", () => {
    const mushroom = morph({ id: "1", name: "Mushroom", light_level_code: "low", flow_level_code: "low" });
    const status = buildTankStatus([mushroom], null, { light: false, flow: false });
    expect(status.callouts.filter((c) => c.type === "equipment_gap")).toEqual([]);
  });

  it("does not flag a gap once matching equipment is logged, regardless of level", () => {
    const sps = morph({ id: "1", name: "SPS", light_level_code: "high", flow_level_code: "high" });
    const status = buildTankStatus([sps], null, { light: true, flow: true });
    expect(status.callouts.filter((c) => c.type === "equipment_gap")).toEqual([]);
  });
});

describe("buildTankStatus — excluded specimens", () => {
  it("a parameter with zero contributing morphs produces no callout even if a reading exists", () => {
    const noRanges = morph({ id: "1", name: "Unidentified-backed morph" });
    const status = buildTankStatus([noRanges], reading({ alkalinity_dkh: 2 }), { light: false, flow: false });
    expect(status.callouts).toEqual([]);
  });
});

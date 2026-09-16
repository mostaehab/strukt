import { describe, expect, it } from "vitest";
import {
  areaToDisplay,
  areaToStore,
  areaUnit,
  axialForceLabel,
  forceToDisplay,
  forceToStore,
  forceUnit,
  formatForce,
  formatLength,
  formatMoment,
  formatScaled,
  inertiaToDisplay,
  inertiaToStore,
  inertiaUnit,
  lengthToDisplay,
  lengthUnit,
  loadUnitLabel,
  momentToDisplay,
  momentUnit,
} from "./units";

/**
 * The display boundary (AD-4). The store is always SI, so what these pin is
 * that conversions are exact inverses and that nothing displayed can be
 * written back in the wrong system.
 */

describe("unit labels", () => {
  it("never labels a concentrated Load and a UDL the same way", () => {
    expect(loadUnitLabel("concentrated", "SI")).toBe("kN");
    expect(loadUnitLabel("udl", "SI")).toBe("kN/m");
    expect(loadUnitLabel("concentrated", "IMPERIAL")).toBe("kip");
    expect(loadUnitLabel("udl", "IMPERIAL")).toBe("kip/ft");
  });

  it("uses structural convention for Imperial", () => {
    expect(forceUnit("IMPERIAL")).toBe("kip");
    expect(momentUnit("IMPERIAL")).toBe("kip·ft");
    expect(lengthUnit("IMPERIAL")).toBe("ft");
    // Feet for spans, inches for sections -- how AISC tabulates them.
    expect(areaUnit("IMPERIAL")).toBe("in²");
    expect(inertiaUnit("IMPERIAL")).toBe("in⁴");
  });

  it("leaves SI labels alone", () => {
    expect(forceUnit("SI")).toBe("kN");
    expect(momentUnit("SI")).toBe("kN·m");
    expect(lengthUnit("SI")).toBe("m");
    expect(areaUnit("SI")).toBe("m²");
    expect(inertiaUnit("SI")).toBe("m⁴");
  });
});

describe("conversion factors", () => {
  it("converts force against the published kip", () => {
    expect(forceToDisplay(4448.2216, "IMPERIAL")).toBeCloseTo(1, 9);
    expect(forceToDisplay(1000, "SI")).toBe(1);
  });

  it("converts moment through both force and length", () => {
    // kip·ft is a kip times a foot, so this is not the force factor alone.
    expect(momentToDisplay(4448.2216 * 0.3048, "IMPERIAL")).toBeCloseTo(1, 9);
    expect(momentToDisplay(1000, "SI")).toBe(1);
  });

  it("converts length, area and inertia by their own factors", () => {
    expect(lengthToDisplay(0.3048, "IMPERIAL")).toBeCloseTo(1, 9);
    expect(areaToDisplay(0.0254 ** 2, "IMPERIAL")).toBeCloseTo(1, 9);
    expect(inertiaToDisplay(0.0254 ** 4, "IMPERIAL")).toBeCloseTo(1, 9);
  });

  it("leaves SI values untouched, not merely unchanged in magnitude", () => {
    // SI is the stored form, so these must be identity rather than a round trip.
    expect(lengthToDisplay(3.7, "SI")).toBe(3.7);
    expect(areaToDisplay(0.01, "SI")).toBe(0.01);
    expect(inertiaToDisplay(8e-5, "SI")).toBe(8e-5);
  });
});

describe("round trips leave the stored value alone", () => {
  it("returns a force to itself through both systems", () => {
    for (const system of ["SI", "IMPERIAL"] as const) {
      const stored = 12_345.678;
      expect(forceToStore(forceToDisplay(stored, system), system)).toBeCloseTo(
        stored,
        6,
      );
    }
  });

  it("returns an area and an inertia to themselves", () => {
    for (const system of ["SI", "IMPERIAL"] as const) {
      expect(areaToStore(areaToDisplay(0.0123, system), system)).toBeCloseTo(0.0123, 12);
      expect(inertiaToStore(inertiaToDisplay(7.7e-5, system), system)).toBeCloseTo(7.7e-5, 15);
    }
  });

  it("survives repeated switching without drifting", () => {
    // FR-20's actual promise: toggling back and forth never changes what was
    // entered. Guaranteed by storage, not by conversion precision -- but the
    // factors still have to be exact inverses.
    let value = 0.0254 ** 2 * 9.3;
    for (let i = 0; i < 20; i += 1) {
      value = areaToStore(areaToDisplay(value, "IMPERIAL"), "IMPERIAL");
    }
    expect(value).toBeCloseTo(0.0254 ** 2 * 9.3, 15);
  });
});

describe("formatting", () => {
  it("formats a force in the selected system", () => {
    expect(formatForce(5000, "SI", 2)).toBe("5.00");
    expect(formatForce(4448.2216, "IMPERIAL", 2)).toBe("1.00");
  });

  it("formats a moment in the selected system", () => {
    expect(formatMoment(9000, "SI", 1)).toBe("9.0");
    expect(formatMoment(4448.2216 * 0.3048, "IMPERIAL", 1)).toBe("1.0");
  });

  it("formats a length in the selected system", () => {
    expect(formatLength(3, "SI")).toBe("3.00");
    expect(formatLength(0.3048 * 3, "IMPERIAL")).toBe("3.00");
  });

  it("never renders a real stored value as zero", () => {
    // A stored Load is positive and never zero, so a value too small to
    // survive rounding falls back to the compact form rather than reading 0.00.
    expect(formatScaled(0.0004, 2)).not.toBe("0.00");
    expect(formatScaled(0, 2)).toBe("0.00");
  });

  it("keeps very large values readable rather than sixteen digits wide", () => {
    expect(formatScaled(5e7, 2)).toContain("e+");
  });

  it("drops trailing zeros when no precision is asked for", () => {
    expect(formatScaled(5)).toBe("5");
  });
});

describe("axialForceLabel", () => {
  it("names the sense in words, in either system", () => {
    expect(axialForceLabel(12_000, "SI")).toBe("+12.0 kN (tension)");
    expect(axialForceLabel(-8_000, "SI")).toBe("−8.0 kN (compression)");
    expect(axialForceLabel(4448.2216, "IMPERIAL")).toBe("+1.0 kip (tension)");
  });

  it("says zero plainly, with no sense at all", () => {
    expect(axialForceLabel(0, "SI")).toBe("0 kN");
    expect(axialForceLabel(0, "IMPERIAL")).toBe("0 kip");
  });

  it("changes only the number and unit between systems, never the word", () => {
    expect(axialForceLabel(-4448.2216, "IMPERIAL")).toContain("compression");
    expect(axialForceLabel(-4448.2216, "SI")).toContain("compression");
  });
});

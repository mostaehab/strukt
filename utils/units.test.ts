import { describe, expect, it } from "vitest";
import {
  NEWTONS_PER_KILONEWTON,
  formatKilonewtons,
  kilonewtonsToNewtons,
  loadUnitLabel,
  newtonsToKilonewtons,
} from "./units";

describe("newton / kilonewton conversion", () => {
  it("reads newtons out as kN", () => {
    expect(newtonsToKilonewtons(5000)).toBe(5);
    expect(newtonsToKilonewtons(0)).toBe(0);
  });

  it("writes kN back as newtons", () => {
    expect(kilonewtonsToNewtons(5)).toBe(5000);
    expect(kilonewtonsToNewtons(0.5)).toBe(500);
  });

  it("round-trips a typed value unchanged", () => {
    for (const kilonewtons of [5, 0.5, 12.25, 1e-3]) {
      expect(
        newtonsToKilonewtons(kilonewtonsToNewtons(kilonewtons)),
      ).toBeCloseTo(kilonewtons, 12);
    }
  });

  it("keeps the factor in one place", () => {
    expect(NEWTONS_PER_KILONEWTON).toBe(1000);
  });
});

describe("formatKilonewtons", () => {
  // The panel tag: `L: 5.00 kN, -y`.
  it("fixes to the requested decimals for the panel tag", () => {
    expect(formatKilonewtons(5000, 2)).toBe("5.00");
    expect(formatKilonewtons(2500, 2)).toBe("2.50");
  });

  // The canvas caption: `5 kN`, which has no room to spare.
  it("trims trailing zeros when no precision is asked for", () => {
    expect(formatKilonewtons(5000)).toBe("5");
    expect(formatKilonewtons(2500)).toBe("2.5");
  });

  it("trims binary-float noise rather than printing it", () => {
    // 0.1 + 0.2 kN worth of newtons.
    expect(formatKilonewtons(300.00000000000006)).toBe("0.3");
  });

  // A stored Load is always positive and never zero, so no rendering of one
  // may read as zero -- that is a value the store would have refused to hold.
  it("never renders a stored Load as 0.00", () => {
    for (const newtons of [4, 1, 0.5, 1e-6]) {
      const tag = formatKilonewtons(newtons, 2);
      expect(Number.parseFloat(tag)).not.toBe(0);
    }
  });

  it("falls back to a readable form for a value too small to round", () => {
    // 4 N is 0.004 kN: two decimals would flatten it to zero.
    expect(formatKilonewtons(4, 2)).toBe("0.004");
    // Smaller still, and plain digits stop being readable.
    expect(formatKilonewtons(0.5, 2)).toBe("5.00e-4");
  });

  it("keeps a genuine zero as zero", () => {
    expect(formatKilonewtons(0, 2)).toBe("0.00");
    expect(formatKilonewtons(0)).toBe("0");
  });

  // A fixed-width tag cannot carry sixteen digits, and JS's own default
  // stringification produces `1e+18`.
  it("uses a consistent exponential form for very large values", () => {
    expect(formatKilonewtons(1e18, 2)).toBe("1.00e+15");
    expect(formatKilonewtons(1e18)).toBe("1.00e+15");
  });

  it("stays in plain digits across the range an engineering value lives in", () => {
    expect(formatKilonewtons(1000)).toBe("1");
    expect(formatKilonewtons(1e8)).toBe("100000");
    expect(formatKilonewtons(1)).toBe("0.001");
  });
});

describe("loadUnitLabel", () => {
  it("gives a concentrated Load a force unit", () => {
    expect(loadUnitLabel("concentrated")).toBe("kN");
  });

  it("gives a UDL a force-per-length unit", () => {
    expect(loadUnitLabel("udl")).toBe("kN/m");
  });
});

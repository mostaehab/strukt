import { describe, expect, it } from "vitest";
import {
  CATALOG_VERSION,
  CROSS_SECTIONS,
  findCrossSection,
  sectionsFor,
} from "./crossSections";

// Derived here from the definition of the inch (exactly 0.0254 m) rather than
// copied from the catalog's own constants -- otherwise this suite would only
// prove the catalog is self-consistent, and a rounded conversion factor (the
// truncated 4.162314e-7 this catalog originally shipped) would slip through.
const METRES_PER_INCH = 0.0254;
const IN2_TO_M2 = METRES_PER_INCH ** 2;
const IN4_TO_M4 = METRES_PER_INCH ** 4;

/** AISC source values the SI literals were authored from: [id, A in^2, Ix in^4]. */
const AISC_SOURCE: [string, number, number][] = [
  ["W12X26", 7.65, 204],
  ["W14X30", 8.85, 291],
  ["W16X40", 11.8, 518],
  ["W18X50", 14.7, 800],
  ["W21X62", 18.3, 1330],
  ["W24X76", 22.4, 2100],
];

/** Concrete rectangular sources: [id, b (m), h (m)]. */
const RECT_SOURCE: [string, number, number][] = [
  ["RECT-300X300", 0.3, 0.3],
  ["RECT-300X500", 0.3, 0.5],
  ["RECT-400X600", 0.4, 0.6],
];

/** Concrete circular sources: [id, d (m)]. */
const CIRC_SOURCE: [string, number][] = [
  ["CIRC-D300", 0.3],
  ["CIRC-D500", 0.5],
];

function relativeError(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe("cross-section catalog", () => {
  it("declares a catalog version", () => {
    expect(CATALOG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("gives every entry a unique id", () => {
    const ids = CROSS_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every entry a label and strictly positive SI properties", () => {
    for (const section of CROSS_SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0);
      expect(section.area).toBeGreaterThan(0);
      expect(section.inertia).toBeGreaterThan(0);
    }
  });

  it("stores AISC W-shapes pre-converted to SI, not in in^2/in^4", () => {
    for (const [id, areaIn2, inertiaIn4] of AISC_SOURCE) {
      const section = findCrossSection(id);
      expect(section, `${id} missing from the catalog`).toBeDefined();
      // Relative tolerance: the SI literals were authored from the Imperial
      // table above, so this asserts provenance rather than bit equality.
      expect(relativeError(section!.area, areaIn2 * IN2_TO_M2)).toBeLessThan(
        1e-9,
      );
      expect(
        relativeError(section!.inertia, inertiaIn4 * IN4_TO_M4),
      ).toBeLessThan(1e-9);
      // A guard against an Imperial value ever being pasted in raw.
      expect(section!.area).toBeLessThan(1);
    }
  });

  it("derives concrete rectangular sections exactly from A = b*h, I = b*h^3/12", () => {
    for (const [id, b, h] of RECT_SOURCE) {
      const section = findCrossSection(id);
      expect(section, `${id} missing from the catalog`).toBeDefined();
      expect(relativeError(section!.area, b * h)).toBeLessThan(1e-12);
      expect(relativeError(section!.inertia, (b * h ** 3) / 12)).toBeLessThan(
        1e-12,
      );
    }
  });

  it("derives concrete circular sections exactly from A = pi*d^2/4, I = pi*d^4/64", () => {
    for (const [id, d] of CIRC_SOURCE) {
      const section = findCrossSection(id);
      expect(section, `${id} missing from the catalog`).toBeDefined();
      expect(
        relativeError(section!.area, (Math.PI * d ** 2) / 4),
      ).toBeLessThan(1e-12);
      expect(
        relativeError(section!.inertia, (Math.PI * d ** 4) / 64),
      ).toBeLessThan(1e-12);
    }
  });

  it("offers only Steel sections for Steel", () => {
    const steel = sectionsFor("STEEL");
    expect(steel.length).toBeGreaterThan(0);
    expect(steel.every((section) => section.material === "STEEL")).toBe(true);
    expect(steel.map((section) => section.id)).toEqual(
      AISC_SOURCE.map(([id]) => id),
    );
  });

  it("offers only Concrete sections for Concrete, never an AISC W-shape", () => {
    const concrete = sectionsFor("CONCRETE");
    expect(concrete.length).toBeGreaterThan(0);
    expect(concrete.every((section) => section.material === "CONCRETE")).toBe(
      true,
    );
    expect(concrete.some((section) => section.id.startsWith("W"))).toBe(false);
  });

  it("partitions the catalog between the two Materials with nothing left over", () => {
    expect(sectionsFor("STEEL").length + sectionsFor("CONCRETE").length).toBe(
      CROSS_SECTIONS.length,
    );
  });

  it("returns undefined for an unknown id instead of throwing", () => {
    expect(findCrossSection("NOT-A-SECTION")).toBeUndefined();
  });
});

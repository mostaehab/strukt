import type { Material } from "../types";

/**
 * Static Cross-Section catalog (AD-8).
 *
 * Values are **pre-converted to SI at authoring time** -- never converted at
 * runtime, never a database table. Each entry carries its Imperial or metric
 * source in a comment so `crossSections.test.ts` can re-derive it and the
 * numbers can't silently rot.
 *
 * Conversion factors used for the AISC W-shapes, both exact (1 in is exactly
 * 0.0254 m by definition, so neither factor is rounded):
 * - 1 in^2 = 0.0254^2     = 6.4516e-4 m^2
 * - 1 in^4 = 0.0254^4     = 4.162314256e-7 m^4
 *
 * Pure data + pure lookups; framework-free (AD-1) and never throws.
 */

/**
 * Identifies the revision these SI values came from. Bump whenever an entry's
 * id, area, or inertia changes. Nothing currently records the version an
 * Element resolved its `crossSectionId` against, so this does not by itself
 * enable a per-Element migration -- it only lets a reader (or a future
 * migration) tell which catalog revision is in the bundle.
 */
export const CATALOG_VERSION = "1.0.0";

export interface CrossSection {
  /** Stable pointer stored on `StructuralElement.crossSectionId`. */
  id: string;
  /** User-facing name shown in the Cross-Section picker. */
  label: string;
  material: Material;
  /** Cross-sectional area in m^2. */
  area: number;
  /** Moment of inertia about the strong axis in m^4. */
  inertia: number;
}

/**
 * A deliberate starter subset -- six common AISC W-shapes for Steel and basic
 * rectangular/circular gross sections for Concrete. Catalog sourcing depth is
 * deferred (`_bmad-output/planning-artifacts/epics.md:75`).
 */
export const CROSS_SECTIONS: readonly Readonly<CrossSection>[] = [
  // --- Steel: AISC W-shapes (source: A in^2, Ix in^4) ---
  {
    id: "W12X26",
    label: "W12X26",
    material: "STEEL",
    // A = 7.65 in^2, Ix = 204 in^4
    area: 0.0049354740000000005,
    inertia: 0.00008491121082239998,
  },
  {
    id: "W14X30",
    label: "W14X30",
    material: "STEEL",
    // A = 8.85 in^2, Ix = 291 in^4
    area: 0.0057096659999999995,
    inertia: 0.00012112334484959998,
  },
  {
    id: "W16X40",
    label: "W16X40",
    material: "STEEL",
    // A = 11.8 in^2, Ix = 518 in^4
    area: 0.007612888,
    inertia: 0.00021560787846079996,
  },
  {
    id: "W18X50",
    label: "W18X50",
    material: "STEEL",
    // A = 14.7 in^2, Ix = 800 in^4
    area: 0.009483852,
    inertia: 0.0003329851404799999,
  },
  {
    id: "W21X62",
    label: "W21X62",
    material: "STEEL",
    // A = 18.3 in^2, Ix = 1330 in^4
    area: 0.011806428,
    inertia: 0.0005535877960479999,
  },
  {
    id: "W24X76",
    label: "W24X76",
    material: "STEEL",
    // A = 22.4 in^2, Ix = 2100 in^4
    area: 0.014451583999999998,
    inertia: 0.0008740859937599998,
  },

  // --- Concrete: gross rectangular sections (A = b*h, I = b*h^3/12) ---
  {
    id: "RECT-300X300",
    label: "Rectangular 300 x 300 mm",
    material: "CONCRETE",
    // b = 0.3 m, h = 0.3 m
    area: 0.09,
    inertia: 0.000675,
  },
  {
    id: "RECT-300X500",
    label: "Rectangular 300 x 500 mm",
    material: "CONCRETE",
    // b = 0.3 m, h = 0.5 m
    area: 0.15,
    inertia: 0.003125,
  },
  {
    id: "RECT-400X600",
    label: "Rectangular 400 x 600 mm",
    material: "CONCRETE",
    // b = 0.4 m, h = 0.6 m
    area: 0.24,
    inertia: 0.0072,
  },

  // --- Concrete: gross circular sections (A = pi*d^2/4, I = pi*d^4/64) ---
  {
    id: "CIRC-D300",
    label: "Circular 300 mm dia.",
    material: "CONCRETE",
    // d = 0.3 m
    area: 0.07068583470577035,
    inertia: 0.00039760782021995816,
  },
  {
    id: "CIRC-D500",
    label: "Circular 500 mm dia.",
    material: "CONCRETE",
    // d = 0.5 m
    area: 0.19634954084936207,
    inertia: 0.0030679615757712823,
  },
];

/**
 * Every catalog entry for one Material, in catalog order. Never mixes
 * Materials -- a Steel W-shape can never be offered for a Concrete Element.
 */
export function sectionsFor(material: Material): readonly Readonly<CrossSection>[] {
  return CROSS_SECTIONS.filter((section) => section.material === material);
}

/**
 * Resolves a stored `crossSectionId` pointer. Returns undefined for an
 * unknown id rather than throwing, so a stale pointer degrades to
 * "unassigned" instead of crashing a render. The entry is returned readonly:
 * the catalog is module-level state shared by every caller for the process
 * lifetime, so no consumer may write through it.
 */
export function findCrossSection(id: string): Readonly<CrossSection> | undefined {
  return CROSS_SECTIONS.find((section) => section.id === id);
}

import { beforeEach, describe, expect, it } from "vitest";
import useStructureStore from "./useStructureStore";
import { findCrossSection } from "../engine/catalog/crossSections";
import type { StructuralElement } from "../engine/types";

const W12X26 = findCrossSection("W12X26")!;
const RECT = findCrossSection("RECT-300X500")!;

function unassignedElement(): StructuralElement {
  return {
    id: "e1",
    material: null,
    startNode: "a",
    endNode: "b",
    crossSectionId: null,
    area: null,
    inertia: null,
  };
}

function seed(overrides: Partial<StructuralElement> = {}) {
  useStructureStore.getState().clearAll();
  useStructureStore
    .getState()
    .addElement({ ...unassignedElement(), ...overrides });
}

function element() {
  return useStructureStore.getState().elements[0];
}

describe("updateElement Cross-Section invariants", () => {
  beforeEach(() => {
    useStructureStore.getState().clearAll();
  });

  it("auto-fills area and inertia from the catalog when a section is chosen", () => {
    seed({ material: "STEEL" });
    useStructureStore.getState().updateElement("e1", {
      crossSectionId: "W12X26",
    });
    expect(element().crossSectionId).toBe("W12X26");
    expect(element().area).toBe(W12X26.area);
    expect(element().inertia).toBe(W12X26.inertia);
  });

  it("lets a catalog section replace a manual override outright", () => {
    seed({ material: "STEEL", area: 0.01, inertia: 0.002 });
    useStructureStore.getState().updateElement("e1", {
      crossSectionId: "W12X26",
    });
    expect(element().area).toBe(W12X26.area);
    expect(element().inertia).toBe(W12X26.inertia);
  });

  it("detaches from the catalog when area is entered by hand, keeping the untouched inertia", () => {
    seed({ material: "STEEL" });
    // Seeded through the store so *both* values are genuinely catalog-derived.
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    expect(element().inertia).toBe(W12X26.inertia);

    useStructureStore.getState().updateElement("e1", { area: 0.02 });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBe(0.02);
    // The sibling the user never touched keeps its number and becomes a manual
    // override too, rather than being discarded with the pointer.
    expect(element().inertia).toBe(W12X26.inertia);
  });

  it("clears a catalog section and its derived values when Material changes", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    useStructureStore.getState().updateElement("e1", { material: "CONCRETE" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
    expect(element().inertia).toBeNull();
  });

  it("preserves a manual override across a Material change", () => {
    seed({ material: "STEEL", area: 0.01, inertia: 0.002 });
    useStructureStore.getState().updateElement("e1", { material: "CONCRETE" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBe(0.01);
    expect(element().inertia).toBe(0.002);
  });

  it("leaves everything alone when Material is re-set to the same value", () => {
    seed({ material: "CONCRETE" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: RECT.id });
    useStructureStore.getState().updateElement("e1", { material: "CONCRETE" });
    expect(element().crossSectionId).toBe(RECT.id);
    expect(element().area).toBe(RECT.area);
  });

  it("clears derived values when a catalog section is un-picked", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    useStructureStore.getState().updateElement("e1", { crossSectionId: null });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
    expect(element().inertia).toBeNull();
  });

  it("refuses to attach a Steel W-shape to a Concrete Element", () => {
    seed({ material: "CONCRETE" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
    expect(element().inertia).toBeNull();
  });

  it("leaves a Concrete Element's manual override intact when a Steel section is rejected", () => {
    seed({ material: "CONCRETE", area: 0.01, inertia: 0.002 });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBe(0.01);
    expect(element().inertia).toBe(0.002);
  });

  it("clears the section when one patch carries both Material and a mismatched section", () => {
    seed({ material: "STEEL" });
    useStructureStore.getState().updateElement("e1", {
      material: "CONCRETE",
      crossSectionId: "W12X26",
    });
    expect(element().material).toBe("CONCRETE");
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
    expect(element().inertia).toBeNull();
  });

  it("clears a catalog section when one patch carries both Material and the old pointer", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    // A caller that spreads the whole Element back with a new Material used to
    // slip past the Material-change rule entirely.
    useStructureStore.getState().updateElement("e1", {
      material: "CONCRETE",
      crossSectionId: "W12X26",
    });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
  });

  it("refuses a section for an Element with no Material", () => {
    seed();
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
  });

  it("rejects a non-positive or non-finite area or inertia from any caller", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      seed({ material: "STEEL", area: 0.01, inertia: 0.002 });
      useStructureStore.getState().updateElement("e1", { area: bad });
      expect(element().area).toBe(0.01);

      useStructureStore.getState().updateElement("e1", { inertia: bad });
      expect(element().inertia).toBe(0.002);
    }
  });

  it("keeps a rejected area from detaching the Element from its catalog section", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    useStructureStore.getState().updateElement("e1", { area: -1 });
    expect(element().crossSectionId).toBe("W12X26");
    expect(element().area).toBe(W12X26.area);
  });

  it("still applies a valid sibling edit when the other field is rejected", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { area: 0.03, inertia: -1 });
    expect(element().area).toBe(0.03);
    expect(element().inertia).toBeNull();
  });

  it("degrades an unknown catalog pointer to unassigned instead of keeping stale values", () => {
    seed({ material: "STEEL", area: 0.01, inertia: 0.002 });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "NOT-A-SECTION" });
    expect(element().crossSectionId).toBeNull();
    // The pre-existing manual override had no catalog pointer, so it stands.
    expect(element().area).toBe(0.01);
  });
});

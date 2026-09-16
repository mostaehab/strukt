import { describe, expect, it } from "vitest";
import { validateElements } from "./validation";
import type { Load, StructuralElement } from "./types";

const label = (id: string) => (id === "e1" ? "E1" : "E2");

function element(overrides: Partial<StructuralElement> = {}): StructuralElement {
  return {
    id: "e1",
    material: "STEEL",
    startNode: "n1",
    endNode: "n2",
    crossSectionId: null,
    area: 0.01,
    inertia: 8e-5,
    ...overrides,
  };
}

function udlOn(elementId: string): Load {
  return {
    id: "l1",
    kind: "udl",
    target: { type: "element", elementId },
    magnitude: 1000,
    direction: [0, -1],
  };
}

describe("validateElements", () => {
  it("passes a fully defined Frame Element", () => {
    expect(validateElements([element()], [], "FRAME", label)).toEqual([]);
  });

  it("names the Element that has no Material", () => {
    const errors = validateElements([element({ material: null })], [], "FRAME", label);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("ELEMENT_NO_MATERIAL");
    expect(errors[0].elementId).toBe("e1");
    expect(errors[0].message).toBe(
      "Can't solve: Element E1 has no Material assigned. Choose Steel or Concrete to continue.",
    );
  });

  it("names the Element that has no Cross-Section", () => {
    const errors = validateElements([element({ area: null })], [], "FRAME", label);
    expect(errors[0].code).toBe("ELEMENT_NO_SECTION");
    expect(errors[0].message).toBe(
      "Can't solve: Element E1 has no Cross-Section. Pick one from the catalog or enter area and inertia directly to continue.",
    );
  });

  it("rejects a non-positive area", () => {
    expect(validateElements([element({ area: 0 })], [], "FRAME", label)).toHaveLength(1);
    expect(validateElements([element({ area: -1 })], [], "FRAME", label)).toHaveLength(1);
  });

  it("requires inertia on a Frame but not on a Truss", () => {
    const missing = element({ inertia: null });
    expect(validateElements([missing], [], "FRAME", label)).toHaveLength(1);
    // A Truss member carries no bending, so demanding inertia would be a dead
    // requirement -- the panel hides the field for exactly this reason.
    expect(validateElements([missing], [], "TRUSS", label)).toEqual([]);
  });

  it("blocks a UDL on a Truss member and says what to do instead", () => {
    const errors = validateElements([element()], [udlOn("e1")], "TRUSS", label);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("ELEMENT_TRUSS_UDL");
    expect(errors[0].message).toBe(
      "Can't solve: Element E1 is a Truss member and can't carry a distributed load. Apply the Load to its end Nodes instead, or switch the Project to Frame.",
    );
  });

  it("allows a UDL on a Frame member", () => {
    expect(validateElements([element()], [udlOn("e1")], "FRAME", label)).toEqual([]);
  });

  it("ignores a UDL targeting a different Element", () => {
    expect(validateElements([element()], [udlOn("other")], "TRUSS", label)).toEqual([]);
  });

  it("reports every problem at once rather than only the first", () => {
    const errors = validateElements(
      [element({ material: null, area: null })],
      [],
      "FRAME",
      label,
    );
    expect(errors.map((e) => e.code).sort()).toEqual([
      "ELEMENT_NO_MATERIAL",
      "ELEMENT_NO_SECTION",
    ]);
  });

  it("reports problems across several Elements", () => {
    const errors = validateElements(
      [element({ material: null }), element({ id: "e2", area: null })],
      [],
      "FRAME",
      label,
    );
    expect(errors.map((e) => e.elementId)).toEqual(["e1", "e2"]);
    expect(errors[1].message).toContain("Element E2");
  });
});

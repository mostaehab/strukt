import { describe, expect, it } from "vitest";
import { createElement } from "./element";

describe("createElement", () => {
  it("leaves Material unassigned rather than defaulting to Steel", () => {
    expect(createElement("e1", "n1", "n2").material).toBeNull();
  });

  it("leaves the Cross-Section pointer and both properties unassigned", () => {
    const element = createElement("e1", "n1", "n2");
    expect(element.crossSectionId).toBeNull();
    expect(element.area).toBeNull();
    expect(element.inertia).toBeNull();
  });

  it("never defaults area or inertia to zero", () => {
    const element = createElement("e1", "n1", "n2");
    expect(element.area).not.toBe(0);
    expect(element.inertia).not.toBe(0);
  });

  it("carries through the id and both endpoint Node ids", () => {
    const element = createElement("e7", "n3", "n4");
    expect(element.id).toBe("e7");
    expect(element.startNode).toBe("n3");
    expect(element.endNode).toBe("n4");
  });
});

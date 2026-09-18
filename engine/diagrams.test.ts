import { describe, expect, it } from "vitest";
import { peaksOf, structureDiagrams, type DiagramSet } from "./diagrams";
import { solve } from "./stiffness";
import type {
  EnginePayload,
  Load,
  StructuralElement,
  StructuralNode,
  StructureType,
  Support,
} from "./types";

/**
 * Closed-form checks for the internal-force distributions.
 *
 * These pin the sign convention. The solver's member end actions could be
 * mapped to `V(x)` and `M(x)` in a way that draws a perfectly plausible
 * upside-down diagram, so the constants are settled by values a student would
 * recognise: sagging moment positive, `wL^2/8` at the midspan of a simply
 * supported beam, `wL^2/2` hogging at a cantilever's fixed end.
 */

const AREA = 0.01;
const INERTIA = 8e-5;
const TOLERANCE = 0.005;

function near(actual: number, expected: number, what: string) {
  const error = Math.abs(actual - expected) / Math.abs(expected);
  expect(error, `${what}: expected ${expected}, got ${actual}`).toBeLessThan(
    TOLERANCE,
  );
}

function node(id: string, x: number, y: number, support: Support = "FREE"): StructuralNode {
  return { id, x, y, support };
}

function member(id: string, startNode: string, endNode: string): StructuralElement {
  return {
    id,
    material: "STEEL",
    startNode,
    endNode,
    crossSectionId: null,
    area: AREA,
    inertia: INERTIA,
  };
}

function pointLoad(id: string, nodeId: string, magnitude: number): Load {
  return {
    id,
    kind: "concentrated",
    target: { type: "node", nodeId },
    magnitude,
    direction: [0, -1],
  };
}

function udl(id: string, elementId: string, intensity: number): Load {
  return {
    id,
    kind: "udl",
    target: { type: "element", elementId },
    magnitude: intensity,
    direction: [0, -1],
  };
}

function diagramsFor(
  type: StructureType,
  nodes: StructuralNode[],
  elements: StructuralElement[],
  loads: Load[],
): DiagramSet {
  const payload: EnginePayload = { type, nodes, elements, loads };
  const outcome = solve(payload);
  if (!outcome.ok) {
    throw new Error(outcome.errors.map((e) => e.message).join(" | "));
  }
  return structureDiagrams(
    nodes,
    elements,
    loads,
    type,
    outcome.result.elementForces,
  );
}

describe("simply supported beam under a UDL", () => {
  const L = 6;
  const w = 2_000;
  const set = diagramsFor(
    "FRAME",
    [node("a", 0, 0, "HINGE"), node("b", L / 2, 0), node("c", L, 0, "ROLLER")],
    [member("ab", "a", "b"), member("bc", "b", "c")],
    [udl("w1", "ab", w), udl("w2", "bc", w)],
  );

  it("peaks at wL^2/8, sagging positive", () => {
    near(set.momentPeaks.max!.value, (w * L ** 2) / 8, "midspan moment");
  });

  it("puts that peak at midspan, not at a Node", () => {
    // Midspan is the far end of the first member / start of the second.
    const peak = set.momentPeaks.max!;
    const element = set.elements.find((e) => e.elementId === peak.elementId)!;
    const distanceAlongBeam =
      peak.elementId === "ab" ? peak.at : element.length + peak.at;
    near(distanceAlongBeam, L / 2, "peak location");
  });

  it("carries shear of wL/2 at the supports, falling to zero at midspan", () => {
    const first = set.elements.find((e) => e.elementId === "ab")!;
    near(Math.abs(first.shear[0].value), (w * L) / 2, "support shear");
    const atMidspan = first.shear[first.shear.length - 1].value;
    expect(Math.abs(atMidspan)).toBeLessThan((w * L) / 2 * 0.01);
  });

  it("never dips into hogging, which a simply supported beam cannot do", () => {
    // A sign flip would show this entire diagram below the axis. There is no
    // hogging extreme at all -- the curve only touches zero at the supports.
    expect(set.momentPeaks.min).toBeNull();
    expect(set.momentPeaks.max!.value).toBeGreaterThan(0);
  });

  it("curves rather than running straight between the supports", () => {
    // The whole reason for sampling: a straight line between two correct
    // endpoints would miss the peak entirely.
    const first = set.elements.find((e) => e.elementId === "ab")!;
    const quarter = first.moment[Math.floor(first.moment.length / 2)];
    const ends = (first.moment[0].value + first.moment[first.moment.length - 1].value) / 2;
    expect(quarter.value).toBeGreaterThan(ends);
  });
});

describe("simply supported beam under a central point load", () => {
  const L = 6;
  const P = 10_000;
  const set = diagramsFor(
    "FRAME",
    [node("a", 0, 0, "HINGE"), node("b", L / 2, 0), node("c", L, 0, "ROLLER")],
    [member("ab", "a", "b"), member("bc", "b", "c")],
    [pointLoad("p", "b", P)],
  );

  it("peaks at PL/4 under the load", () => {
    near(set.momentPeaks.max!.value, (P * L) / 4, "midspan moment");
  });

  it("holds shear constant at P/2 between supports and load", () => {
    const first = set.elements.find((e) => e.elementId === "ab")!;
    near(Math.abs(first.shear[0].value), P / 2, "shear at the left support");
    near(
      Math.abs(first.shear[first.shear.length - 1].value),
      P / 2,
      "shear just left of the load",
    );
  });
});

describe("cantilever under a UDL", () => {
  const L = 4;
  const w = 2_000;
  const set = diagramsFor(
    "FRAME",
    [node("a", 0, 0, "FIXED"), node("b", L, 0)],
    [member("ab", "a", "b")],
    [udl("w", "ab", w)],
  );

  it("hogs wL^2/2 at the fixed end, negative by the sagging-positive rule", () => {
    near(set.momentPeaks.min!.value, -((w * L ** 2) / 2), "fixing moment");
  });

  it("falls to zero at the free tip", () => {
    const only = set.elements[0];
    const tip = only.moment[only.moment.length - 1];
    expect(Math.abs(tip.value)).toBeLessThan((w * L ** 2) / 2 * 0.01);
  });

  it("varies shear linearly from wL at the root to zero at the tip", () => {
    const only = set.elements[0];
    near(Math.abs(only.shear[0].value), w * L, "root shear");
    expect(Math.abs(only.shear[only.shear.length - 1].value)).toBeLessThan(
      w * L * 0.01,
    );
  });
});

describe("cantilever under an end load", () => {
  const L = 4;
  const P = 5_000;
  const set = diagramsFor(
    "FRAME",
    [node("a", 0, 0, "FIXED"), node("b", L, 0)],
    [member("ab", "a", "b")],
    [pointLoad("p", "b", P)],
  );

  it("hogs PL at the fixed end", () => {
    near(set.momentPeaks.min!.value, -(P * L), "fixing moment");
  });

  it("holds shear constant along the member", () => {
    const only = set.elements[0];
    near(Math.abs(only.shear[0].value), P, "root shear");
    near(Math.abs(only.shear[only.shear.length - 1].value), P, "tip shear");
  });
});

describe("truss members", () => {
  const set = diagramsFor(
    "TRUSS",
    [node("a", 0, 0, "HINGE"), node("b", 4, 0, "HINGE"), node("c", 2, 3)],
    [member("ac", "a", "c"), member("bc", "b", "c")],
    [pointLoad("p", "c", 12_000)],
  );

  it("carries axial force", () => {
    expect(Math.abs(set.axialPeaks.min!.value)).toBeGreaterThan(0);
  });

  it("carries no shear or moment anywhere", () => {
    for (const element of set.elements) {
      for (const sample of element.shear) expect(sample.value).toBe(0);
      for (const sample of element.moment) expect(sample.value).toBe(0);
    }
  });
});

describe("degenerate cases", () => {
  it("reports flat zero diagrams for an unloaded structure", () => {
    const set = diagramsFor(
      "FRAME",
      [node("a", 0, 0, "FIXED"), node("b", 4, 0)],
      [member("ab", "a", "b")],
      [],
    );
    for (const element of set.elements) {
      for (const sample of element.moment) expect(Math.abs(sample.value)).toBeLessThan(1e-6);
      for (const sample of element.shear) expect(Math.abs(sample.value)).toBeLessThan(1e-6);
    }
  });

  it("returns null peaks when there is nothing to peak over", () => {
    const set = structureDiagrams([], [], [], "FRAME", {});
    expect(set.momentPeaks.max).toBeNull();
    expect(set.elements).toEqual([]);
  });

  it("skips an Element whose forces are missing rather than throwing", () => {
    const set = structureDiagrams(
      [node("a", 0, 0), node("b", 4, 0)],
      [member("ab", "a", "b")],
      [],
      "FRAME",
      {},
    );
    expect(set.elements).toEqual([]);
  });

  it("reports no peak at all when a distribution is zero everywhere", () => {
    // A Truss carries axial force only, so its bending arrays are zero by
    // construction. Naming a member and a station for that zero states a
    // computed result where nothing was computed.
    const zero = [
      {
        elementId: "a",
        length: 4,
        axial: [{ x: 0, value: 0 }, { x: 4, value: 5 }],
        shear: [{ x: 0, value: 0 }, { x: 4, value: 0 }],
        moment: [{ x: 0, value: 0 }, { x: 4, value: 0 }],
      },
    ];
    expect(peaksOf(zero, (d) => d.moment)).toEqual({ max: null, min: null });
    expect(peaksOf(zero, (d) => d.shear)).toEqual({ max: null, min: null });
    // A one-sided distribution reports only the side it actually has: this
    // one reaches 5 in tension and never goes into compression.
    const axial = peaksOf(zero, (d) => d.axial);
    expect(axial.max?.value).toBe(5);
    expect(axial.min).toBeNull();
  });
});

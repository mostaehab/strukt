import { describe, expect, it } from "vitest";
import { solve } from "./stiffness";
import { structureDiagrams } from "./diagrams";
import type { Load, StructuralElement, StructuralNode } from "./types";

/**
 * Point Loads applied along a member, away from either end.
 *
 * On a Frame a student could add a Node under the load instead. On a Truss
 * they cannot: a Node mid-chord is a pin, which turns one member into a
 * two-bar mechanism and makes the structure unsolvable rather than loadable.
 * So this is the only way to state a whole class of truss problem, and these
 * tests check it against closed-form values rather than against itself.
 */

const node = (
  id: string,
  x: number,
  y: number,
  support: StructuralNode["support"],
): StructuralNode => ({ id, x, y, support });

const member = (
  id: string,
  startNode: string,
  endNode: string,
): StructuralElement => ({
  id,
  material: "STEEL",
  startNode,
  endNode,
  crossSectionId: null,
  area: 0.01,
  inertia: 1e-4,
});

function pointLoad(
  id: string,
  elementId: string,
  magnitude: number,
  position: number,
): Load {
  return {
    id,
    kind: "point",
    magnitude,
    direction: [0, -1],
    target: { type: "element", elementId },
    position,
  };
}

function run(
  type: "FRAME" | "TRUSS",
  nodes: StructuralNode[],
  elements: StructuralElement[],
  loads: Load[],
) {
  const outcome = solve({ type, nodes, elements, loads });
  if (!outcome.ok) {
    throw new Error(outcome.errors.map((e) => e.message).join("; "));
  }
  return {
    result: outcome.result,
    diagrams: structureDiagrams(nodes, elements, loads, type, outcome.result.elementForces),
  };
}

const P = 12000;
const L = 6;

describe("a point Load along a simply supported member", () => {
  const nodes = [node("a", 0, 0, "HINGE"), node("b", L, 0, "ROLLER")];
  const elements = [member("ab", "a", "b")];

  it("gives PL/4 at midspan, the closed-form answer", () => {
    const { diagrams } = run("FRAME", nodes, elements, [
      pointLoad("p", "ab", P, L / 2),
    ]);
    const span = diagrams.elements[0];
    const midspan = span.moment.find((s) => Math.abs(s.x - L / 2) < 1e-9)!;
    expect(midspan.value).toBeCloseTo((P * L) / 4, 6);
  });

  it("gives Pab/L for a load off-centre", () => {
    const a = 2;
    const b = L - a;
    const { diagrams } = run("FRAME", nodes, elements, [pointLoad("p", "ab", P, a)]);
    const span = diagrams.elements[0];
    const under = span.moment.find((s) => Math.abs(s.x - a) < 1e-9)!;
    expect(under.value).toBeCloseTo((P * a * b) / L, 6);
  });

  it("steps the shear at the load rather than ramping through it", () => {
    const a = 2;
    const { diagrams } = run("FRAME", nodes, elements, [pointLoad("p", "ab", P, a)]);
    const span = diagrams.elements[0];
    const atLoad = span.shear.filter((s) => Math.abs(s.x - a) < 1e-9);

    // Two readings at one station: the discontinuity is real, and drawing a
    // ramp through it would misstate the shear either side of the load.
    expect(atLoad).toHaveLength(2);
    expect(atLoad[0].value).toBeCloseTo((P * (L - a)) / L, 6);
    expect(atLoad[1].value).toBeCloseTo(-(P * a) / L, 6);
    expect(atLoad[0].value - atLoad[1].value).toBeCloseTo(P, 6);
  });

  it("splits the reactions Pb/L and Pa/L", () => {
    const a = 2;
    const { result } = run("FRAME", nodes, elements, [pointLoad("p", "ab", P, a)]);
    expect(result.reactions.a[1]).toBeCloseTo((P * (L - a)) / L, 6);
    expect(result.reactions.b[1]).toBeCloseTo((P * a) / L, 6);
  });
});

describe("a point Load on a Truss chord", () => {
  // Triangle with the load hung mid-chord -- unrepresentable before, because
  // a Node there would pin the chord into a mechanism.
  const nodes = [
    node("a", 0, 0, "HINGE"),
    node("b", L, 0, "ROLLER"),
    node("c", L / 2, 4, "FREE"),
  ];
  const elements = [member("ab", "a", "b"), member("ac", "a", "c"), member("bc", "b", "c")];

  it("solves, where splitting the chord with a Node would be a mechanism", () => {
    expect(() =>
      run("TRUSS", nodes, elements, [pointLoad("p", "ab", P, L / 2)]),
    ).not.toThrow();
  });

  it("bends the loaded chord by PL/4 and leaves the others straight", () => {
    const { diagrams } = run("TRUSS", nodes, elements, [
      pointLoad("p", "ab", P, L / 2),
    ]);
    const chord = diagrams.elements.find((d) => d.elementId === "ab")!;
    const midspan = chord.moment.find((s) => Math.abs(s.x - L / 2) < 1e-9)!;
    expect(midspan.value).toBeCloseTo((P * L) / 4, 6);

    for (const id of ["ac", "bc"]) {
      const other = diagrams.elements.find((d) => d.elementId === id)!;
      for (const sample of other.moment) expect(sample.value).toBeCloseTo(0, 6);
    }
  });

  it("transmits only the simple-beam reactions into the joints", () => {
    // Exactness check: the axial forces must equal those of the same truss
    // with the load hand-lumped as P/2 at each end of the chord.
    const loaded = run("TRUSS", nodes, elements, [pointLoad("p", "ab", P, L / 2)]);
    const lumped = run("TRUSS", nodes, elements, [
      {
        id: "pa",
        kind: "concentrated",
        magnitude: P / 2,
        direction: [0, -1],
        target: { type: "node", nodeId: "a" },
      },
      {
        id: "pb",
        kind: "concentrated",
        magnitude: P / 2,
        direction: [0, -1],
        target: { type: "node", nodeId: "b" },
      },
    ]);

    for (const id of ["ab", "ac", "bc"]) {
      expect(loaded.result.elementForces[id].axial).toBeCloseTo(
        lumped.result.elementForces[id].axial,
        6,
      );
    }
  });
});

describe("a point Load that has slid off its member", () => {
  it("is refused by name rather than silently clamped", () => {
    const nodes = [node("a", 0, 0, "HINGE"), node("b", 4, 0, "ROLLER")];
    const elements = [member("ab", "a", "b")];
    const outcome = solve({
      type: "FRAME",
      nodes,
      elements,
      // A Node dragged shorter can leave a Load past the end of its own member.
      loads: [pointLoad("p", "ab", P, 9)],
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors[0].code).toBe("LOAD_OFF_ELEMENT");
    expect(outcome.errors[0].message).toContain("9.0 m");
    expect(outcome.errors[0].message).toContain("4.0 m");
    expect(outcome.errors[0].elementId).toBe("ab");
  });
});

describe("the shear-zero search with point Loads present", () => {
  const SPAN = 10;
  const nodes = [node("a", 0, 0, "HINGE"), node("b", SPAN, 0, "ROLLER")];
  const elements = [member("ab", "a", "b")];

  const udl = (magnitude: number): Load => ({
    id: "w",
    kind: "udl",
    magnitude,
    direction: [0, -1],
    target: { type: "element", elementId: "ab" },
  });

  it("finds the true crossing when two Loads share one station", () => {
    // Regression: the running total of passed Loads added a shared station
    // once per duplicate, so the crossing landed in the wrong segment and was
    // discarded -- and the peak fell back to the nearest grid sample, which is
    // the one thing sampling the crossing exists to prevent.
    const { diagrams } = run("FRAME", nodes, elements, [
      udl(1000),
      pointLoad("p1", "ab", 1000, 2),
      pointLoad("p2", "ab", 1000, 2),
    ]);
    // R1 = 6600, so beyond x = 2 the shear is 4600 - 1000x and the moment
    // turns over at 4.6 -- not at the 4.5 grid sample either side of it.
    expect(diagrams.momentPeaks.max!.at).toBeCloseTo(4.6, 6);
  });

  it("finds the true crossing with three Loads on one station", () => {
    const { diagrams } = run("FRAME", nodes, elements, [
      udl(1000),
      pointLoad("p1", "ab", 800, 3),
      pointLoad("p2", "ab", 800, 3),
      pointLoad("p3", "ab", 800, 3),
    ]);
    // R1 = 6680; beyond x = 3 the shear is 4280 - 1000x.
    expect(diagrams.momentPeaks.max!.at).toBeCloseTo(4.28, 6);
  });

  it("is not skewed by a Load sitting exactly at the member start", () => {
    // A station at x = 0 is behind every segment, including the first, and
    // was previously counted in the sampled shear but not in the search.
    const { diagrams } = run("FRAME", nodes, elements, [
      udl(1000),
      pointLoad("p", "ab", 4000, 0),
    ]);
    // That Load goes straight into the support, leaving a plain UDL span.
    expect(diagrams.momentPeaks.max!.at).toBeCloseTo(SPAN / 2, 6);
    expect(diagrams.momentPeaks.max!.value).toBeCloseTo((1000 * SPAN ** 2) / 8, 6);
  });

  it("accepts a station at the far end and refuses one past it", () => {
    expect(() =>
      run("FRAME", nodes, elements, [pointLoad("p", "ab", 4000, SPAN)]),
    ).not.toThrow();
    expect(() =>
      run("FRAME", nodes, elements, [pointLoad("p", "ab", 4000, SPAN + 0.001)]),
    ).toThrow();
  });
});

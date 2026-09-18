import { describe, expect, it } from "vitest";
import { solve } from "./stiffness";
import { structureDiagrams } from "./diagrams";
import type { Load, StructuralElement, StructuralNode } from "./types";

/**
 * A pin-jointed member loaded between its joints.
 *
 * The idealisation says the *joints* transmit no moment. It does not say a
 * member cannot bend: a chord carrying deck load or its own self-weight is a
 * simply supported beam spanning between two pins, and carries that load in
 * shear and bending on top of the axial force the truss analysis gives it.
 *
 * Refusing this made a whole class of real truss problem unsolvable, so these
 * tests pin the treatment as exact rather than approximate -- the joint forces
 * a loaded member produces must equal the joint loads a student would have
 * hand-lumped, to the last digit.
 */

const node = (
  id: string,
  x: number,
  y: number,
  support: StructuralNode["support"],
): StructuralNode => ({ id, x, y, support });

const bar = (id: string, startNode: string, endNode: string): StructuralElement => ({
  id,
  material: "STEEL",
  startNode,
  endNode,
  crossSectionId: null,
  area: 0.01,
  inertia: null,
});

/** Triangle truss: bottom chord a-b, apex c. */
function triangle() {
  return {
    nodes: [
      node("a", 0, 0, "HINGE"),
      node("b", 6, 0, "ROLLER"),
      node("c", 3, 4, "FREE"),
    ],
    elements: [bar("ab", "a", "b"), bar("ac", "a", "c"), bar("bc", "b", "c")],
  };
}

const W = 8000; // N/m, downward
const SPAN = 6;

function run(loads: Load[]) {
  const { nodes, elements } = triangle();
  const outcome = solve({ type: "TRUSS", nodes, elements, loads });
  if (!outcome.ok) {
    throw new Error(outcome.errors.map((e) => e.message).join("; "));
  }
  return {
    result: outcome.result,
    diagrams: structureDiagrams(
      nodes,
      elements,
      loads,
      "TRUSS",
      outcome.result.elementForces,
    ),
  };
}

const udlOnBottomChord: Load[] = [
  {
    id: "w",
    kind: "udl",
    magnitude: W,
    direction: [0, -1],
    target: { type: "element", elementId: "ab" },
  },
];

/** The same load a student would hand-lump: wL/2 at each end of the chord. */
const equivalentJointLoads: Load[] = [
  {
    id: "pa",
    kind: "concentrated",
    magnitude: (W * SPAN) / 2,
    direction: [0, -1],
    target: { type: "node", nodeId: "a" },
  },
  {
    id: "pb",
    kind: "concentrated",
    magnitude: (W * SPAN) / 2,
    direction: [0, -1],
    target: { type: "node", nodeId: "b" },
  },
];

describe("a Truss member carrying load between its joints", () => {
  it("solves at all", () => {
    expect(() => run(udlOnBottomChord)).not.toThrow();
  });

  it("bends as a simply supported beam: wL^2/8 at midspan", () => {
    const { diagrams } = run(udlOnBottomChord);
    const chord = diagrams.elements.find((d) => d.elementId === "ab")!;
    const midspan = chord.moment.find((s) => Math.abs(s.x - SPAN / 2) < 1e-9)!;
    expect(midspan.value).toBeCloseTo((W * SPAN ** 2) / 8, 6);
  });

  it("carries the simple-beam shear, wL/2 at each end and zero at midspan", () => {
    const { diagrams } = run(udlOnBottomChord);
    const chord = diagrams.elements.find((d) => d.elementId === "ab")!;
    expect(chord.shear[0].value).toBeCloseTo((W * SPAN) / 2, 6);
    expect(chord.shear[chord.shear.length - 1].value).toBeCloseTo(
      -(W * SPAN) / 2,
      6,
    );
    const midspan = chord.shear.find((s) => Math.abs(s.x - SPAN / 2) < 1e-9)!;
    expect(midspan.value).toBeCloseTo(0, 6);
  });

  it("transmits no moment to the joints, which is what pinned means", () => {
    const { result } = run(udlOnBottomChord);
    for (const force of Object.values(result.elementForces)) {
      expect(force.momentStart).toBe(0);
      expect(force.momentEnd).toBe(0);
    }
    // No reaction moment either -- a Truss Node has no rotational freedom.
    for (const reaction of Object.values(result.reactions)) {
      expect(reaction[2]).toBe(0);
    }
  });

  it("is exact, not a lumping approximation", () => {
    // The whole justification for solving this on the axial-only truss model:
    // a pinned member transmits precisely the simple-beam reactions to its
    // joints and nothing else, so the axial forces must be identical to the
    // hand-lumped problem to the last digit.
    const loaded = run(udlOnBottomChord);
    const lumped = run(equivalentJointLoads);

    for (const id of ["ab", "ac", "bc"]) {
      expect(loaded.result.elementForces[id].axial).toBeCloseTo(
        lumped.result.elementForces[id].axial,
        6,
      );
    }
    for (const id of ["a", "b"]) {
      expect(loaded.result.reactions[id][0]).toBeCloseTo(
        lumped.result.reactions[id][0],
        6,
      );
      expect(loaded.result.reactions[id][1]).toBeCloseTo(
        lumped.result.reactions[id][1],
        6,
      );
    }
  });

  it("leaves the unloaded members with no bending at all", () => {
    const { diagrams } = run(udlOnBottomChord);
    for (const id of ["ac", "bc"]) {
      const member = diagrams.elements.find((d) => d.elementId === id)!;
      for (const sample of member.moment) expect(sample.value).toBeCloseTo(0, 6);
      for (const sample of member.shear) expect(sample.value).toBeCloseTo(0, 6);
    }
  });

  it("still reports no bending anywhere when every load is at a joint", () => {
    const { diagrams } = run(equivalentJointLoads);
    // The classic truss problem is unchanged: this must stay exactly zero, or
    // the BMD and SFD would start appearing for structures that have none.
    expect(diagrams.momentPeaks.max).toBeNull();
    expect(diagrams.momentPeaks.min).toBeNull();
    expect(diagrams.shearPeaks.max).toBeNull();
    expect(diagrams.shearPeaks.min).toBeNull();
  });

  it("keeps the axial force in the loaded chord equal to the lumped case", () => {
    // Superposition sanity: the chord's own bending does not feed back into
    // the axial answer, because a pinned member's end moments are zero.
    const { result } = run(udlOnBottomChord);
    const lumped = run(equivalentJointLoads);
    expect(result.elementForces.ab.axial).toBeCloseTo(
      lumped.result.elementForces.ab.axial,
      6,
    );
  });
});

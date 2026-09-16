import { describe, expect, it } from "vitest";
import { equilibriumResidual, solve } from "./stiffness";
import type {
  EnginePayload,
  Load,
  StructuralElement,
  StructuralNode,
  StructureType,
  Support,
} from "./types";

/**
 * AD-9's correctness gate: closed-form textbook problems, each asserted to
 * within 0.1% relative error (NFR1).
 *
 * Every expected value here is computed from the standard formula in the test
 * itself rather than hard-coded, so the assertion states the engineering
 * relationship it is checking and a reader can verify it by hand.
 */

// Steel, and a section stiff enough that deflections stay in a sane range.
const E = 200_000_000_000; // Pa
const AREA = 0.01; // m^2
const INERTIA = 8e-5; // m^4

/** 0.1% relative error, the tolerance NFR1 names. */
const TOLERANCE = 0.001;

function expectWithin(actual: number, expected: number, what: string) {
  const error = Math.abs(actual - expected) / Math.abs(expected);
  expect(
    error,
    `${what}: expected ${expected}, got ${actual} (${(error * 100).toFixed(4)}% off)`,
  ).toBeLessThan(TOLERANCE);
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

function pointLoad(id: string, nodeId: string, magnitude: number, direction: readonly [number, number]): Load {
  return {
    id,
    kind: "concentrated",
    target: { type: "node", nodeId },
    magnitude,
    direction,
  };
}

function udl(id: string, elementId: string, intensity: number, direction: readonly [number, number]): Load {
  return {
    id,
    kind: "udl",
    target: { type: "element", elementId },
    magnitude: intensity,
    direction,
  };
}

function payload(
  type: StructureType,
  nodes: StructuralNode[],
  elements: StructuralElement[],
  loads: Load[],
): EnginePayload {
  return { type, nodes, elements, loads };
}

function solved(input: EnginePayload) {
  const outcome = solve(input);
  if (!outcome.ok) {
    throw new Error(
      `expected a solvable structure, got: ${outcome.errors.map((e) => e.message).join(" | ")}`,
    );
  }
  return outcome.result;
}

const DOWN = [0, -1] as const;

describe("benchmark: simply supported beam, central point load", () => {
  // L = 6 m, P = 10 kN at midspan. Modelled with a midspan Node so the
  // deflection under the load is an actual degree of freedom.
  const L = 6;
  const P = 10_000;
  const input = payload(
    "FRAME",
    [node("a", 0, 0, "HINGE"), node("b", L / 2, 0), node("c", L, 0, "ROLLER")],
    [member("ab", "a", "b"), member("bc", "b", "c")],
    [pointLoad("p", "b", P, DOWN)],
  );

  it("splits the load evenly between the two Supports", () => {
    const result = solved(input);
    expectWithin(result.reactions.a[1], P / 2, "left reaction");
    expectWithin(result.reactions.c[1], P / 2, "right reaction");
  });

  it("deflects PL^3/48EI at midspan", () => {
    const result = solved(input);
    const expected = (P * L ** 3) / (48 * E * INERTIA);
    expectWithin(Math.abs(result.displacements.b[1]), expected, "midspan deflection");
    expect(result.displacements.b[1]).toBeLessThan(0);
  });

  it("is in equilibrium", () => {
    const result = solved(input);
    const residual = equilibriumResidual(result, input.loads);
    expect(Math.abs(residual.y)).toBeLessThan(P * TOLERANCE);
  });
});

describe("benchmark: cantilever with an end load", () => {
  const L = 4;
  const P = 5_000;
  const input = payload(
    "FRAME",
    [node("a", 0, 0, "FIXED"), node("b", L, 0)],
    [member("ab", "a", "b")],
    [pointLoad("p", "b", P, DOWN)],
  );

  it("deflects PL^3/3EI at the tip", () => {
    const result = solved(input);
    const expected = (P * L ** 3) / (3 * E * INERTIA);
    expectWithin(Math.abs(result.displacements.b[1]), expected, "tip deflection");
  });

  it("carries the whole load as reaction and PL as fixing moment", () => {
    const result = solved(input);
    expectWithin(result.reactions.a[1], P, "vertical reaction");
    expectWithin(Math.abs(result.reactions.a[2]), P * L, "fixing moment");
  });

  it("reports the fixing moment as the member's start moment", () => {
    const result = solved(input);
    expectWithin(Math.abs(result.elementForces.ab.momentStart), P * L, "member end moment");
  });
});

describe("benchmark: cantilever under a UDL", () => {
  const L = 4;
  const w = 2_000;
  const input = payload(
    "FRAME",
    [node("a", 0, 0, "FIXED"), node("b", L, 0)],
    [member("ab", "a", "b")],
    [udl("w", "ab", w, DOWN)],
  );

  it("deflects wL^4/8EI at the tip", () => {
    const result = solved(input);
    const expected = (w * L ** 4) / (8 * E * INERTIA);
    expectWithin(Math.abs(result.displacements.b[1]), expected, "tip deflection");
  });

  it("carries wL as reaction and wL^2/2 as fixing moment", () => {
    const result = solved(input);
    expectWithin(result.reactions.a[1], w * L, "vertical reaction");
    expectWithin(Math.abs(result.reactions.a[2]), (w * L ** 2) / 2, "fixing moment");
  });
});

describe("benchmark: simply supported beam under a UDL", () => {
  const L = 6;
  const w = 2_000;
  const input = payload(
    "FRAME",
    [node("a", 0, 0, "HINGE"), node("b", L / 2, 0), node("c", L, 0, "ROLLER")],
    [member("ab", "a", "b"), member("bc", "b", "c")],
    [udl("w1", "ab", w, DOWN), udl("w2", "bc", w, DOWN)],
  );

  it("splits the total load evenly between the Supports", () => {
    const result = solved(input);
    expectWithin(result.reactions.a[1], (w * L) / 2, "left reaction");
    expectWithin(result.reactions.c[1], (w * L) / 2, "right reaction");
  });

  it("deflects 5wL^4/384EI at midspan", () => {
    const result = solved(input);
    const expected = (5 * w * L ** 4) / (384 * E * INERTIA);
    expectWithin(Math.abs(result.displacements.b[1]), expected, "midspan deflection");
  });
});

describe("benchmark: two-bar truss", () => {
  // Two bars from pinned bases up to a loaded apex. Statically determinate, so
  // the member force follows from joint equilibrium alone: 2 * F * (h/L) = P.
  const halfSpan = 2;
  const height = 3;
  const P = 12_000;
  const barLength = Math.hypot(halfSpan, height);
  const input = payload(
    "TRUSS",
    [
      node("a", 0, 0, "HINGE"),
      node("b", 2 * halfSpan, 0, "HINGE"),
      node("c", halfSpan, height),
    ],
    [member("ac", "a", "c"), member("bc", "b", "c")],
    [pointLoad("p", "c", P, DOWN)],
  );

  it("puts both bars in compression at PL/2h", () => {
    const result = solved(input);
    const expected = (P * barLength) / (2 * height);
    expectWithin(Math.abs(result.elementForces.ac.axial), expected, "left bar force");
    expectWithin(Math.abs(result.elementForces.bc.axial), expected, "right bar force");
    // Negative is compression: the bars are being squashed, not stretched.
    expect(result.elementForces.ac.axial).toBeLessThan(0);
    expect(result.elementForces.bc.axial).toBeLessThan(0);
  });

  it("carries no bending, being a Truss", () => {
    const result = solved(input);
    for (const force of Object.values(result.elementForces)) {
      expect(force.momentStart).toBe(0);
      expect(force.momentEnd).toBe(0);
      expect(force.shearStart).toBe(0);
      expect(force.shearEnd).toBe(0);
    }
  });

  it("shares the load equally by symmetry", () => {
    const result = solved(input);
    expectWithin(result.reactions.a[1], P / 2, "left reaction");
    expectWithin(result.reactions.b[1], P / 2, "right reaction");
  });
});

describe("benchmark: portal frame under a UDL", () => {
  const span = 6;
  const height = 4;
  const w = 3_000;
  const input = payload(
    "FRAME",
    [
      node("a", 0, 0, "FIXED"),
      node("b", 0, height),
      node("c", span, height),
      node("d", span, 0, "FIXED"),
    ],
    [member("ab", "a", "b"), member("bc", "b", "c"), member("cd", "c", "d")],
    [udl("w", "bc", w, DOWN)],
  );

  it("carries the whole beam load on the two bases", () => {
    const result = solved(input);
    expectWithin(result.reactions.a[1] + result.reactions.d[1], w * span, "total vertical reaction");
  });

  it("is symmetric under a symmetric load", () => {
    const result = solved(input);
    expectWithin(result.reactions.a[1], result.reactions.d[1], "base symmetry");
    // Equal and opposite horizontal thrust at the two bases.
    expectWithin(result.reactions.a[0], -result.reactions.d[0], "horizontal thrust");
  });

  it("is in equilibrium horizontally and vertically", () => {
    const result = solved(input);
    const residual = equilibriumResidual(result, input.loads);
    // The UDL is not a concentrated Load, so only the reactions appear in the
    // horizontal sum -- they must cancel.
    expect(Math.abs(residual.x)).toBeLessThan(w * span * TOLERANCE);
  });
});

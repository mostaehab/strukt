import { describe, expect, it } from "vitest";
import {
  localStiffnessMatrix,
  solve,
  transformationMatrix,
  udlEquivalentLoads,
} from "./stiffness";
import { NO_DOF } from "./types";
import type {
  EnginePayload,
  Load,
  StructuralElement,
  StructuralNode,
  StructureType,
  Support,
} from "./types";

const E = 200_000_000_000;
const AREA = 0.01;
const INERTIA = 8e-5;

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

function pointLoad(nodeId: string, magnitude: number, direction: readonly [number, number]): Load {
  return {
    id: `l-${nodeId}`,
    kind: "concentrated",
    target: { type: "node", nodeId },
    magnitude,
    direction,
  };
}

function payload(
  type: StructureType,
  nodes: StructuralNode[],
  elements: StructuralElement[],
  loads: Load[] = [],
): EnginePayload {
  return { type, nodes, elements, loads };
}

/** A minimal solvable cantilever, used wherever the structure isn't the point. */
function cantilever(): EnginePayload {
  return payload(
    "FRAME",
    [node("a", 0, 0, "FIXED"), node("b", 4, 0)],
    [member("ab", "a", "b")],
    [pointLoad("b", 5_000, [0, -1])],
  );
}

describe("localStiffnessMatrix", () => {
  it("is 4x4 for a Truss and carries axial terms only", () => {
    const k = localStiffnessMatrix("TRUSS", E, AREA, INERTIA, 2);
    expect(k).toHaveLength(4);
    expect(k[0]).toHaveLength(4);
    const ea = (E * AREA) / 2;
    expect(k[0][0]).toBeCloseTo(ea);
    expect(k[0][2]).toBeCloseTo(-ea);
    // No bending anywhere: every transverse row and column is zero.
    expect(k[1].every((v) => v === 0)).toBe(true);
    expect(k[3].every((v) => v === 0)).toBe(true);
  });

  it("is 6x6 for a Frame with the standard bending terms", () => {
    const L = 2;
    const k = localStiffnessMatrix("FRAME", E, AREA, INERTIA, L);
    expect(k).toHaveLength(6);
    expect(k[0][0]).toBeCloseTo((E * AREA) / L);
    expect(k[1][1]).toBeCloseTo((12 * E * INERTIA) / L ** 3);
    expect(k[1][2]).toBeCloseTo((6 * E * INERTIA) / L ** 2);
    expect(k[2][2]).toBeCloseTo((4 * E * INERTIA) / L);
    expect(k[2][5]).toBeCloseTo((2 * E * INERTIA) / L);
  });

  it("is symmetric, as any stiffness matrix must be", () => {
    for (const type of ["TRUSS", "FRAME"] as const) {
      const k = localStiffnessMatrix(type, E, AREA, INERTIA, 3);
      for (let i = 0; i < k.length; i += 1) {
        for (let j = 0; j < k.length; j += 1) {
          expect(k[i][j]).toBeCloseTo(k[j][i]);
        }
      }
    }
  });

  it("gets stiffer as the member gets shorter", () => {
    const short = localStiffnessMatrix("FRAME", E, AREA, INERTIA, 1);
    const long = localStiffnessMatrix("FRAME", E, AREA, INERTIA, 4);
    expect(short[0][0]).toBeGreaterThan(long[0][0]);
    expect(short[1][1]).toBeGreaterThan(long[1][1]);
  });
});

describe("transformationMatrix", () => {
  it("is the identity for a horizontal Frame member", () => {
    const T = transformationMatrix("FRAME", 1, 0);
    T.forEach((row, i) =>
      row.forEach((value, j) => expect(value).toBeCloseTo(i === j ? 1 : 0)),
    );
  });

  it("rotates a vertical member by ninety degrees", () => {
    const T = transformationMatrix("FRAME", 0, 1);
    // Local x now points along global +y.
    expect(T[0][0]).toBeCloseTo(0);
    expect(T[0][1]).toBeCloseTo(1);
    expect(T[1][0]).toBeCloseTo(-1);
    expect(T[1][1]).toBeCloseTo(0);
    // Rotation DOF is untouched by the in-plane rotation.
    expect(T[2][2]).toBe(1);
  });

  it("is orthogonal, so it rotates without stretching", () => {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    const T = transformationMatrix("FRAME", c, s);
    for (let i = 0; i < 6; i += 1) {
      const norm = T[i].reduce((sum, v) => sum + v * v, 0);
      expect(norm).toBeCloseTo(1);
    }
  });

  it("is 4x4 for a Truss", () => {
    expect(transformationMatrix("TRUSS", 1, 0)).toHaveLength(4);
  });
});

describe("udlEquivalentLoads", () => {
  const geometry = { length: 4, cos: 1, sin: 0 };

  it("splits a transverse load into half-shears and balancing end moments", () => {
    const w = 2_000;
    const [axialStart, shearStart, momentStart, axialEnd, shearEnd, momentEnd] =
      udlEquivalentLoads(w, 0, -1, geometry, "FRAME");
    expect(axialStart).toBeCloseTo(0);
    expect(axialEnd).toBeCloseTo(0);
    expect(shearStart).toBeCloseTo((-w * 4) / 2);
    expect(shearEnd).toBeCloseTo((-w * 4) / 2);
    // Equal and opposite, which is what makes the substitution work-equivalent.
    expect(momentStart).toBeCloseTo(-momentEnd);
    expect(Math.abs(momentStart)).toBeCloseTo((w * 4 ** 2) / 12);
  });

  it("lumps a load along the member axially, with no moment", () => {
    const w = 2_000;
    const [axialStart, shearStart, momentStart] = udlEquivalentLoads(
      w,
      1,
      0,
      geometry,
      "FRAME",
    );
    expect(axialStart).toBeCloseTo((w * 4) / 2);
    expect(shearStart).toBeCloseTo(0);
    expect(momentStart).toBeCloseTo(0);
  });

  it("resolves a load on an inclined member into both components", () => {
    const diagonal = { length: 5, cos: 0.6, sin: 0.8 };
    const [axialStart, shearStart] = udlEquivalentLoads(1_000, 0, -1, diagonal, "FRAME");
    // Neither purely axial nor purely transverse.
    expect(Math.abs(axialStart)).toBeGreaterThan(0);
    expect(Math.abs(shearStart)).toBeGreaterThan(0);
  });
});

describe("solve: the AD-3 contract", () => {
  it("returns a result that survives a JSON round-trip", () => {
    const outcome = solve(cantilever());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Proves no mathjs Matrix escaped: a Matrix would not survive this intact.
    expect(JSON.parse(JSON.stringify(outcome.result))).toEqual(outcome.result);
  });

  it("keys every per-entity field by entity id, never array index", () => {
    const outcome = solve(cantilever());
    if (!outcome.ok) throw new Error("expected a solvable structure");
    expect(Object.keys(outcome.result.displacements)).toContain("b");
    expect(Object.keys(outcome.result.localStiffness)).toContain("ab");
    expect(Object.keys(outcome.result.elementForces)).toContain("ab");
  });

  it("carries the local stiffness matrix, not the assembled global one", () => {
    const outcome = solve(cantilever());
    if (!outcome.ok) throw new Error("expected a solvable structure");
    const k = outcome.result.localStiffness.ab;
    expect(k).toHaveLength(6);
    // Local: axial sits at [0][0] and equals EA/L exactly, which the global
    // matrix of a rotated member would not.
    expect(k[0][0]).toBeCloseTo((E * AREA) / 4);
  });

  it("maps every Node's three DOF slots, marking the Truss rotation absent", () => {
    const frame = solve(cantilever());
    if (!frame.ok) throw new Error("expected a solvable structure");
    expect(frame.result.dofMap.a).toEqual([0, 1, 2]);
    expect(frame.result.dofMap.b).toEqual([3, 4, 5]);

    // Both bases pinned: m + r = 2 + 4 = 6 = 2j, so the truss is stable. With
    // one base on a Roller it would be a mechanism, which the solver refuses.
    const truss = solve(
      payload(
        "TRUSS",
        [node("a", 0, 0, "HINGE"), node("b", 4, 0, "HINGE"), node("c", 2, 3)],
        [member("ac", "a", "c"), member("bc", "b", "c")],
        [pointLoad("c", 1_000, [0, -1])],
      ),
    );
    if (!truss.ok) throw new Error("expected a solvable truss");
    expect(truss.result.dofMap.a[2]).toBe(NO_DOF);
  });

  it("labels each free DOF so Show Steps can name it", () => {
    const outcome = solve(cantilever());
    if (!outcome.ok) throw new Error("expected a solvable structure");
    // The fixed base contributes nothing; the free tip contributes all three.
    expect(outcome.result.reducedSystem.freeDofs).toEqual([
      "N2:ux",
      "N2:uy",
      "N2:theta",
    ]);
  });

  it("sizes the reduced system to the free DOFs alone", () => {
    const outcome = solve(cantilever());
    if (!outcome.ok) throw new Error("expected a solvable structure");
    const { K, F, freeDofs } = outcome.result.reducedSystem;
    expect(K).toHaveLength(freeDofs.length);
    expect(K[0]).toHaveLength(freeDofs.length);
    expect(F).toHaveLength(freeDofs.length);
  });

  it("reports Reactions only at restrained Nodes", () => {
    const outcome = solve(cantilever());
    if (!outcome.ok) throw new Error("expected a solvable structure");
    expect(Object.keys(outcome.result.reactions)).toEqual(["a"]);
  });

  it("holds restrained displacements at exactly zero", () => {
    const outcome = solve(cantilever());
    if (!outcome.ok) throw new Error("expected a solvable structure");
    expect(outcome.result.displacements.a).toEqual([0, 0, 0]);
  });
});

describe("solve: blocked structures", () => {
  it("blocks an empty canvas with its own wording", () => {
    const outcome = solve(payload("FRAME", [], [], []));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors[0].code).toBe("NOTHING_TO_ANALYZE");
  });

  it("blocks an incomplete Element before assembly", () => {
    const outcome = solve(
      payload(
        "FRAME",
        [node("a", 0, 0, "FIXED"), node("b", 4, 0)],
        [{ ...member("ab", "a", "b"), material: null }],
      ),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors[0].code).toBe("ELEMENT_NO_MATERIAL");
  });

  it("reports instability before completeness, as the more useful problem", () => {
    const outcome = solve(
      payload(
        "FRAME",
        [node("a", 0, 0), node("b", 4, 0)],
        [{ ...member("ab", "a", "b"), material: null }],
      ),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors[0].code).toBe("COMPONENT_UNRESTRAINED");
  });

  it("catches a degenerate structure the restraint count alone accepts", () => {
    // Three Rollers restrain three DOF, so the cheap count passes -- but every
    // roller restrains the same direction, leaving the frame free to slide
    // horizontally. This is the singular-system backstop.
    const outcome = solve(
      payload(
        "FRAME",
        [
          node("a", 0, 0, "ROLLER"),
          node("b", 3, 0, "ROLLER"),
          node("c", 6, 0, "ROLLER"),
        ],
        [member("ab", "a", "b"), member("bc", "b", "c")],
        [pointLoad("b", 1_000, [1, 0])],
      ),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors[0].code).toBe("SINGULAR_SYSTEM");
  });

  it("never throws on an unsolvable structure", () => {
    expect(() => solve(payload("FRAME", [node("a", 0, 0)], []))).not.toThrow();
  });
});

describe("solve: Loads", () => {
  it("sums two Loads on one Node rather than taking the last", () => {
    const base = cantilever();
    const doubled = {
      ...base,
      loads: [pointLoad("b", 5_000, [0, -1]), { ...pointLoad("b", 5_000, [0, -1]), id: "l2" }],
    };
    const single = solve(base);
    const both = solve(doubled);
    if (!single.ok || !both.ok) throw new Error("expected solvable structures");
    expect(both.result.displacements.b[1]).toBeCloseTo(
      single.result.displacements.b[1] * 2,
    );
  });

  it("cancels opposing Loads to no deflection at all", () => {
    const outcome = solve({
      ...cantilever(),
      loads: [
        pointLoad("b", 5_000, [0, -1]),
        { ...pointLoad("b", 5_000, [0, 1]), id: "l2" },
      ],
    });
    if (!outcome.ok) throw new Error("expected a solvable structure");
    expect(outcome.result.displacements.b[1]).toBeCloseTo(0);
  });

  it("solves an unloaded structure to rest rather than refusing", () => {
    const outcome = solve({ ...cantilever(), loads: [] });
    if (!outcome.ok) throw new Error("an unloaded structure is still solvable");
    expect(outcome.result.displacements.b).toEqual([0, 0, 0]);
  });
});

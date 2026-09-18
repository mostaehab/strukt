import { describe, expect, it } from "vitest";
import { projectDiagrams } from "./diagramGeometry";
import { structureDiagrams } from "./diagrams";
import { solve } from "./stiffness";
import type { Load, StructuralElement, StructuralNode } from "./types";

/**
 * The projection has one job the strip view could not do: put each member's
 * ordinate on that member, in the structure's own frame. These tests pin the
 * two properties that makes true -- symmetry and draw-direction invariance --
 * rather than asserting coordinates, which a mirrored derivation would satisfy
 * just as convincingly backwards.
 */

const node = (
  id: string,
  x: number,
  y: number,
  support: StructuralNode["support"],
): StructuralNode => ({ id, x, y, support });

const steel = (id: string, startNode: string, endNode: string): StructuralElement => ({
  id,
  material: "STEEL",
  startNode,
  endNode,
  crossSectionId: null,
  area: 0.01,
  inertia: 1e-4,
});

function project(
  nodes: StructuralNode[],
  elements: StructuralElement[],
  loads: Load[],
  type: "FRAME" | "TRUSS",
  kind: "moment" | "shear" | "axial",
) {
  const outcome = solve({ type, nodes, elements, loads });
  if (!outcome.ok) throw new Error(outcome.errors.map((e) => e.message).join("; "));
  const diagrams = structureDiagrams(
    nodes,
    elements,
    loads,
    type,
    outcome.result.elementForces,
  );
  return projectDiagrams(nodes, elements, diagrams.elements, kind);
}

/** Portal frame with the two columns drawn in opposite directions. */
function portalFrame() {
  const nodes = [
    node("a", 0, 0, "FIXED"),
    node("b", 0, 4, "FREE"),
    node("c", 6, 4, "FREE"),
    node("d", 6, 0, "FIXED"),
  ];
  const elements = [
    steel("ab", "a", "b"), // drawn bottom-up
    steel("bc", "b", "c"),
    steel("cd", "c", "d"), // drawn top-down
  ];
  const loads: Load[] = [
    {
      id: "w",
      kind: "udl",
      magnitude: 10000,
      direction: [0, -1],
      target: { type: "element", elementId: "bc" },
    },
  ];
  return { nodes, elements, loads };
}

describe("projectDiagrams", () => {
  it("draws a symmetric frame symmetrically despite opposite draw directions", () => {
    const { nodes, elements, loads } = portalFrame();
    const projected = project(nodes, elements, loads, "FRAME", "moment");

    const left = projected.members.find((m) => m.elementId === "ab");
    const right = projected.members.find((m) => m.elementId === "cd");
    expect(left && right).toBeTruthy();

    // Mirroring the right column about the frame's centreline must reproduce
    // the left one. This is the defect the strip view showed: reversing a
    // member negates its sampled moment, and only flipping the normal with it
    // cancels that back out.
    const mirrored = right!.ordinate
      .map((p) => ({ x: 6 - p.x, y: p.y }))
      .sort((p, q) => p.y - q.y);
    const reference = [...left!.ordinate].sort((p, q) => p.y - q.y);

    expect(mirrored.length).toBe(reference.length);
    for (let i = 0; i < reference.length; i += 1) {
      expect(mirrored[i].x).toBeCloseTo(reference[i].x, 6);
      expect(mirrored[i].y).toBeCloseTo(reference[i].y, 6);
    }
  });

  it("puts a sagging moment on the tension side, below the member", () => {
    const nodes = [
      node("a", 0, 0, "HINGE"),
      node("b", 6, 0, "ROLLER"),
    ];
    const elements = [steel("ab", "a", "b")];
    const loads: Load[] = [
      {
        id: "w",
        kind: "udl",
        magnitude: 10000,
        direction: [0, -1],
        target: { type: "element", elementId: "ab" },
      },
    ];
    const projected = project(nodes, elements, loads, "FRAME", "moment");
    const midspan = projected.members[0].ordinate.find((p) =>
      Math.abs(p.x - 3) < 1e-9,
    );
    // Sagging puts the tension face underneath, which is where a student
    // draws the parabola -- not above the beam.
    expect(midspan).toBeDefined();
    expect(midspan!.y).toBeLessThan(0);
  });

  it("is invariant to the direction a member was drawn in", () => {
    const nodes = [node("a", 0, 0, "FIXED"), node("b", 4, 0, "FREE")];
    const loads: Load[] = [
      {
        id: "p",
        kind: "concentrated",
        magnitude: 5000,
        direction: [0, -1],
        target: { type: "node", nodeId: "b" },
      },
    ];
    const forward = project(nodes, [steel("e", "a", "b")], loads, "FRAME", "moment");
    const reversed = project(nodes, [steel("e", "b", "a")], loads, "FRAME", "moment");

    const key = (points: { x: number; y: number }[]) =>
      points
        .map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`)
        .sort()
        .join("|");

    // Same member, same structure, same picture -- the cantilever's hogging
    // moment must sit on the same side either way it was drawn.
    expect(key(reversed.members[0].ordinate)).toBe(key(forward.members[0].ordinate));
  });

  it("keeps every ordinate inside the reported bounds", () => {
    const { nodes, elements, loads } = portalFrame();
    const projected = project(nodes, elements, loads, "FRAME", "moment");
    const { minX, minY, maxX, maxY } = projected.bounds;

    for (const member of projected.members) {
      for (const point of member.ordinate) {
        expect(point.x).toBeGreaterThanOrEqual(minX);
        expect(point.x).toBeLessThanOrEqual(maxX);
        expect(point.y).toBeGreaterThanOrEqual(minY);
        expect(point.y).toBeLessThanOrEqual(maxY);
      }
    }
    // The ordinate leaves the structure's own box, so fitting to the Nodes
    // alone would clip the diagram.
    expect(minX).toBeLessThan(0);
  });

  it("lays a Truss member's constant axial force flat along that member", () => {
    const nodes = [
      node("a", 0, 0, "HINGE"),
      node("b", 4, 0, "ROLLER"),
      node("c", 2, 3, "FREE"),
    ];
    const elements = [steel("ab", "a", "b"), steel("ac", "a", "c"), steel("bc", "b", "c")];
    const loads: Load[] = [
      {
        id: "p",
        kind: "concentrated",
        magnitude: 20000,
        direction: [0, -1],
        target: { type: "node", nodeId: "c" },
      },
    ];
    const projected = project(nodes, elements, loads, "TRUSS", "axial");

    for (const member of projected.members) {
      const offsets = member.ordinate.map((p, i) => {
        const t = i / (member.ordinate.length - 1);
        const base = {
          x: member.start.x + (member.end.x - member.start.x) * t,
          y: member.start.y + (member.end.y - member.start.y) * t,
        };
        return Math.hypot(p.x - base.x, p.y - base.y);
      });
      // Axial force is constant along a truss member, so the ordinate is a
      // straight band parallel to it -- never a taper.
      for (const offset of offsets) expect(offset).toBeCloseTo(offsets[0], 6);
      expect(offsets[0]).toBeGreaterThan(0);
    }
  });

  it("collapses onto the members when every value is zero", () => {
    const nodes = [node("a", 0, 0, "FIXED"), node("b", 4, 0, "FREE")];
    const elements = [steel("ab", "a", "b")];
    const projected = project(nodes, elements, [], "FRAME", "moment");

    expect(projected.scale).toBe(0);
    for (const point of projected.members[0].ordinate) {
      expect(point.y).toBeCloseTo(0, 9);
      expect(Number.isNaN(point.x)).toBe(false);
    }
  });
});

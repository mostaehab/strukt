import { describe, expect, it } from "vitest";
import { checkStability, connectedComponents } from "./stability";
import type { StructuralElement, StructuralNode, Support } from "./types";

const label = (id: string) => `N${id.replace("n", "")}`;

function node(id: string, support: Support = "FREE"): StructuralNode {
  return { id, x: 0, y: 0, support };
}

function member(id: string, startNode: string, endNode: string): StructuralElement {
  return {
    id,
    material: "STEEL",
    startNode,
    endNode,
    crossSectionId: null,
    area: 0.01,
    inertia: 8e-5,
  };
}

describe("connectedComponents", () => {
  it("groups Nodes joined by Elements", () => {
    const groups = connectedComponents(
      [node("n1"), node("n2"), node("n3")],
      [member("e1", "n1", "n2"), member("e2", "n2", "n3")],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].sort()).toEqual(["n1", "n2", "n3"]);
  });

  it("keeps unconnected Nodes in separate components", () => {
    const groups = connectedComponents(
      [node("n1"), node("n2"), node("n3"), node("n4")],
      [member("e1", "n1", "n2"), member("e2", "n3", "n4")],
    );
    expect(groups).toHaveLength(2);
  });

  it("makes an isolated Node its own component rather than dropping it", () => {
    const groups = connectedComponents(
      [node("n1"), node("n2"), node("n3")],
      [member("e1", "n1", "n2")],
    );
    expect(groups).toHaveLength(2);
    expect(groups.some((g) => g.length === 1 && g[0] === "n3")).toBe(true);
  });

  it("ignores an Element pointing at a Node that no longer exists", () => {
    const groups = connectedComponents(
      [node("n1"), node("n2")],
      [member("e1", "n1", "gone")],
    );
    expect(groups).toHaveLength(2);
  });

  it("places every Node in exactly one component", () => {
    const nodes = [node("n1"), node("n2"), node("n3"), node("n4")];
    const groups = connectedComponents(nodes, [
      member("e1", "n1", "n2"),
      member("e2", "n2", "n3"),
    ]);
    expect(groups.flat().sort()).toEqual(["n1", "n2", "n3", "n4"]);
  });
});

describe("checkStability", () => {
  it("reports nothing to analyze when there are no Elements", () => {
    const errors = checkStability([node("n1", "FIXED")], [], "FRAME", label);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("NOTHING_TO_ANALYZE");
    // Deliberately not instability wording -- the epic requires these read
    // differently, because an empty canvas is not a broken structure.
    expect(errors[0].message).toBe(
      "Nothing to analyze yet. Draw at least one Element between two Nodes, then Solve.",
    );
    expect(errors[0].message).not.toContain("Can't solve");
  });

  it("accepts a Frame held by a Fixed support", () => {
    const errors = checkStability(
      [node("n1", "FIXED"), node("n2")],
      [member("e1", "n1", "n2")],
      "FRAME",
      label,
    );
    expect(errors).toEqual([]);
  });

  it("accepts a Frame held by a Hinge and a Roller", () => {
    const errors = checkStability(
      [node("n1", "HINGE"), node("n2", "ROLLER")],
      [member("e1", "n1", "n2")],
      "FRAME",
      label,
    );
    expect(errors).toEqual([]);
  });

  it("blocks a Frame with too little restraint", () => {
    const errors = checkStability(
      [node("n1", "ROLLER"), node("n2")],
      [member("e1", "n1", "n2")],
      "FRAME",
      label,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("COMPONENT_UNRESTRAINED");
  });

  it("names an unrestrained lone Node", () => {
    const errors = checkStability(
      [node("n1", "FIXED"), node("n2"), node("n5")],
      [member("e1", "n1", "n2")],
      "FRAME",
      label,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("NODE_UNRESTRAINED");
    expect(errors[0].nodeId).toBe("n5");
    expect(errors[0].message).toBe(
      "Can't solve: Node N5 is unrestrained. Assign a Support (Fixed, Hinged, or Roller) to continue.",
    );
  });

  it("names the floating region when a whole sub-structure is unrestrained", () => {
    const errors = checkStability(
      [node("n1", "FIXED"), node("n2"), node("n3"), node("n4")],
      [member("e1", "n1", "n2"), member("e2", "n3", "n4")],
      "FRAME",
      label,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("COMPONENT_UNRESTRAINED");
    expect(errors[0].message).toContain("region containing Node N3");
  });

  it("leaves a restrained component alone while reporting an unrestrained one", () => {
    const errors = checkStability(
      [node("n1", "FIXED"), node("n2"), node("n3"), node("n4", "ROLLER")],
      [member("e1", "n1", "n2"), member("e2", "n3", "n4")],
      "FRAME",
      label,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].nodeId).toBe("n3");
  });

  it("counts a Fixed support as two restraints on a Truss, not three", () => {
    // A Truss Node has no rotational freedom, so one Fixed support leaves a
    // Truss short of the three a planar body needs.
    const errors = checkStability(
      [node("n1", "FIXED"), node("n2")],
      [member("e1", "n1", "n2")],
      "TRUSS",
      label,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("COMPONENT_UNRESTRAINED");
  });

  it("accepts a Truss held by a Hinge and a Roller", () => {
    // m + r = 1 + 3 = 4 = 2j for two joints, so this is exactly determinate.
    const errors = checkStability(
      [node("n1", "HINGE"), node("n2", "ROLLER")],
      [member("e1", "n1", "n2")],
      "TRUSS",
      label,
    );
    expect(errors).toEqual([]);
  });

  it("catches a pin-jointed mechanism the restraint count alone accepts", () => {
    // Two bars up to a free apex, with one base on a Roller: three restraints
    // satisfies the rigid-body count, but m + r = 5 < 2j = 6, so the truss can
    // still fold. Naming it here is better than leaving it to the solver's
    // singular-system backstop, which can name nothing.
    const errors = checkStability(
      [node("n1", "HINGE"), node("n2", "ROLLER"), node("n3")],
      [member("e1", "n1", "n3"), member("e2", "n2", "n3")],
      "TRUSS",
      label,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("COMPONENT_UNRESTRAINED");
    expect(errors[0].message).toContain("mechanism");
  });

  it("accepts the same Truss once both bases are pinned", () => {
    const errors = checkStability(
      [node("n1", "HINGE"), node("n2", "HINGE"), node("n3")],
      [member("e1", "n1", "n3"), member("e2", "n2", "n3")],
      "TRUSS",
      label,
    );
    expect(errors).toEqual([]);
  });

  it("leaves Frames to the rigid-body check, where member count means something else", () => {
    // The same geometry as the mechanism above is fine as a Frame, because
    // rigid joints carry moment.
    const errors = checkStability(
      [node("n1", "HINGE"), node("n2", "ROLLER"), node("n3")],
      [member("e1", "n1", "n3"), member("e2", "n2", "n3")],
      "FRAME",
      label,
    );
    expect(errors).toEqual([]);
  });
});

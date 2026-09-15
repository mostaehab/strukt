import { describe, expect, it } from "vitest";
import {
  AXIS_DIRECTIONS,
  createLoad,
  elementTarget,
  nodeTarget,
  type AxisDirection,
} from "./load";
import { resolveElementLoad, resolveNodeLoad } from "./loadResolution";
import type { Load } from "./types";

function nodeLoad(
  id: string,
  nodeId: string,
  magnitude: number,
  axis: AxisDirection,
): Load {
  return createLoad(
    id,
    "concentrated",
    nodeTarget(nodeId),
    magnitude,
    AXIS_DIRECTIONS[axis],
  );
}

function elementLoad(
  id: string,
  elementId: string,
  magnitude: number,
  axis: AxisDirection,
): Load {
  return createLoad(
    id,
    "udl",
    elementTarget(elementId),
    magnitude,
    AXIS_DIRECTIONS[axis],
  );
}

describe("resolveNodeLoad", () => {
  // Matrix row: Nothing assigned -- a Node with no Load resolves to zero.
  it("resolves an unloaded Node to a genuine zero", () => {
    expect(resolveNodeLoad([], "n1")).toEqual({ x: 0, y: 0 });
    expect(resolveNodeLoad([nodeLoad("l1", "n2", 5000, "-y")], "n1")).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("resolves one downward Load to a negative y component", () => {
    expect(resolveNodeLoad([nodeLoad("l1", "n1", 5000, "-y")], "n1")).toEqual({
      x: 0,
      y: -5000,
    });
  });

  // Matrix row: Loads on one target sum.
  it("sums two Loads targeting the same Node", () => {
    const loads = [
      nodeLoad("l1", "n1", 5000, "-y"),
      nodeLoad("l2", "n1", 3000, "-y"),
    ];
    expect(resolveNodeLoad(loads, "n1")).toEqual({ x: 0, y: -8000 });
  });

  it("sums Loads on different axes into one vector", () => {
    const loads = [
      nodeLoad("l1", "n1", 4000, "+x"),
      nodeLoad("l2", "n1", 3000, "-y"),
    ];
    expect(resolveNodeLoad(loads, "n1")).toEqual({ x: 4000, y: -3000 });
  });

  // Matrix row: Opposing Loads cancel -- 5 N up and 5 N down resolve to zero,
  // not 5. The row a "last write wins" scalar field could never pass.
  it("cancels opposing Loads to zero rather than keeping one of them", () => {
    const loads = [nodeLoad("l1", "n1", 5, "-y"), nodeLoad("l2", "n1", 5, "+y")];
    expect(resolveNodeLoad(loads, "n1")).toEqual({ x: 0, y: 0 });
  });

  // Matrix row: Delete one of two Loads -- the sum drops to the survivor.
  it("drops to the surviving Load when the other is removed", () => {
    const loads = [
      nodeLoad("l1", "n1", 5000, "-y"),
      nodeLoad("l2", "n1", 3000, "-y"),
    ];
    const survivors = loads.filter((load) => load.id !== "l1");
    expect(resolveNodeLoad(survivors, "n1")).toEqual({ x: 0, y: -3000 });
  });

  it("ignores Loads targeting other Nodes", () => {
    const loads = [
      nodeLoad("l1", "n1", 5000, "-y"),
      nodeLoad("l2", "n2", 9000, "-y"),
    ];
    expect(resolveNodeLoad(loads, "n1")).toEqual({ x: 0, y: -5000 });
  });

  it("never picks up a Load targeting an Element", () => {
    // Matching on the target, not the kind: an Element id that happens to
    // equal a Node id must not leak across the two.
    const loads = [elementLoad("l1", "n1", 2000, "-y")];
    expect(resolveNodeLoad(loads, "n1")).toEqual({ x: 0, y: 0 });
  });

  it("resolves an off-axis direction by its components", () => {
    const load = createLoad("l1", "concentrated", nodeTarget("n1"), 1000, [
      Math.SQRT1_2,
      -Math.SQRT1_2,
    ]);
    const resolved = resolveNodeLoad([load], "n1");
    expect(resolved.x).toBeCloseTo(707.1067811865, 6);
    expect(resolved.y).toBeCloseTo(-707.1067811865, 6);
  });

  it("leaves the input list untouched", () => {
    const loads = [nodeLoad("l1", "n1", 5000, "-y")];
    resolveNodeLoad(loads, "n1");
    expect(loads).toHaveLength(1);
    expect(loads[0].direction).toEqual([0, -1]);
  });
});

describe("resolveElementLoad", () => {
  // Matrix row: UDL on an Element -- newtons per metre, same summing rule.
  it("resolves one UDL to its signed components", () => {
    expect(
      resolveElementLoad([elementLoad("l1", "e1", 2000, "-y")], "e1"),
    ).toEqual({ x: 0, y: -2000 });
  });

  // Matrix row: Loads on one target sum -- Elements too (FR-9).
  it("sums two UDLs on the same Element", () => {
    const loads = [
      elementLoad("l1", "e1", 2000, "-y"),
      elementLoad("l2", "e1", 500, "-y"),
    ];
    expect(resolveElementLoad(loads, "e1")).toEqual({ x: 0, y: -2500 });
  });

  it("cancels opposing UDLs to zero", () => {
    const loads = [
      elementLoad("l1", "e1", 2000, "-y"),
      elementLoad("l2", "e1", 2000, "+y"),
    ];
    expect(resolveElementLoad(loads, "e1")).toEqual({ x: 0, y: 0 });
  });

  it("ignores UDLs on other Elements and Loads on its end Nodes", () => {
    const loads = [
      elementLoad("l1", "e1", 2000, "-y"),
      elementLoad("l2", "e2", 9000, "-y"),
      nodeLoad("l3", "e1", 7000, "-y"),
    ];
    expect(resolveElementLoad(loads, "e1")).toEqual({ x: 0, y: -2000 });
  });

  it("resolves an Element with no UDL to zero", () => {
    expect(resolveElementLoad([], "e1")).toEqual({ x: 0, y: 0 });
  });
});

import { describe, expect, it } from "vitest";
import {
  AXIS_DIRECTIONS,
  createLoad,
  elementTarget,
  nodeTarget,
  type AxisDirection,
} from "./load";

const AXES = Object.keys(AXIS_DIRECTIONS) as AxisDirection[];

describe("AXIS_DIRECTIONS", () => {
  it("offers exactly the four axis directions the panel can enter", () => {
    expect(AXES).toEqual(["+x", "-x", "+y", "-y"]);
  });

  it("is a unit vector in every direction", () => {
    for (const axis of AXES) {
      const [x, y] = AXIS_DIRECTIONS[axis];
      expect(Math.hypot(x, y)).toBe(1);
    }
  });

  // Matrix row: Direction picker -- choosing down stores [0, -1].
  it("points -y downward and +y upward, per the global convention", () => {
    expect(AXIS_DIRECTIONS["-y"]).toEqual([0, -1]);
    expect(AXIS_DIRECTIONS["+y"]).toEqual([0, 1]);
  });

  it("points +x rightward and -x leftward, per the global convention", () => {
    expect(AXIS_DIRECTIONS["+x"]).toEqual([1, 0]);
    expect(AXIS_DIRECTIONS["-x"]).toEqual([-1, 0]);
  });
});

describe("createLoad", () => {
  // Matrix row: Concentrated Load on a Node.
  it("stores a concentrated Load against its Node target", () => {
    const load = createLoad(
      "l1",
      "concentrated",
      nodeTarget("n1"),
      5000,
      AXIS_DIRECTIONS["-y"],
    );
    expect(load.id).toBe("l1");
    expect(load.kind).toBe("concentrated");
    expect(load.target).toEqual({ type: "node", nodeId: "n1" });
    expect(load.magnitude).toBe(5000);
    expect(load.direction).toEqual([0, -1]);
  });

  // Matrix row: UDL on an Element.
  it("stores a UDL against its Element target", () => {
    const load = createLoad(
      "l2",
      "udl",
      elementTarget("e1"),
      2000,
      AXIS_DIRECTIONS["-y"],
    );
    expect(load.kind).toBe("udl");
    expect(load.target).toEqual({ type: "element", elementId: "e1" });
    expect(load.magnitude).toBe(2000);
  });

  it("keeps the magnitude in SI newtons, never a converted kN value", () => {
    // 5 kN entered in the panel arrives here already multiplied (AD-4).
    const load = createLoad(
      "l1",
      "concentrated",
      nodeTarget("n1"),
      5000,
      [0, -1],
    );
    expect(load.magnitude).toBe(5000);
  });

  it("copies the direction rather than aliasing a shared axis vector", () => {
    const first = createLoad(
      "l1",
      "concentrated",
      nodeTarget("n1"),
      1,
      AXIS_DIRECTIONS["-y"],
    );
    const second = createLoad(
      "l2",
      "concentrated",
      nodeTarget("n1"),
      1,
      AXIS_DIRECTIONS["-y"],
    );
    // Three distinct arrays: neither Load shares the other's vector, and
    // neither shares the shared axis constant.
    expect(first.direction).not.toBe(second.direction);
    expect(first.direction).not.toBe(AXIS_DIRECTIONS["-y"]);
    expect(second.direction).not.toBe(AXIS_DIRECTIONS["-y"]);
    expect(first.direction).toEqual([0, -1]);
    expect(second.direction).toEqual([0, -1]);
  });

  // `Load["direction"]` is readonly, so a holder cannot edit a vector that has
  // already passed the store's validators. This is a compile-time guarantee;
  // the runtime check below pins the escape hatch a cast would open.
  it("hands out a direction no holder can edit in place", () => {
    const load = createLoad(
      "l1",
      "concentrated",
      nodeTarget("n1"),
      1,
      AXIS_DIRECTIONS["-y"],
    );
    const escaped = load.direction as [number, number];
    escaped[1] = 99;
    // The shared constant is still intact -- the copy absorbed the damage.
    expect(AXIS_DIRECTIONS["-y"]).toEqual([0, -1]);
  });

  it("carries an off-axis unit vector through unchanged", () => {
    // Storage is more expressive than the panel's four options on purpose.
    const diagonal: [number, number] = [Math.SQRT1_2, -Math.SQRT1_2];
    const load = createLoad(
      "l1",
      "concentrated",
      nodeTarget("n1"),
      1,
      diagonal,
    );
    expect(load.direction).toEqual(diagonal);
  });

  // A UDL on a Node would draw one arrow labelled per-metre and be summed as
  // a point force. The pairing is a compile error, not a runtime check: these
  // two are the only shapes the constructor can produce.
  it("pairs each kind with the only target type it is legal for", () => {
    const concentrated = createLoad(
      "l1",
      "concentrated",
      nodeTarget("n1"),
      1,
      [0, -1],
    );
    const udl = createLoad("l2", "udl", elementTarget("e1"), 1, [0, -1]);
    expect(concentrated.target.type).toBe("node");
    expect(udl.target.type).toBe("element");
  });

  it("never throws on an unusable magnitude -- rejection lives elsewhere", () => {
    expect(() =>
      createLoad("l1", "concentrated", nodeTarget("n1"), 0, [0, -1]),
    ).not.toThrow();
  });
});

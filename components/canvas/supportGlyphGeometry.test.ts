import { describe, expect, it } from "vitest";
import { supportGlyph } from "./supportGlyphGeometry";
import { NODE_GLYPH_Z, SUPPORT_GLYPH_Z } from "./canvasConstants";

/** Every point across every stroke of a glyph. */
function allPoints(strokes: [number, number, number][][]) {
  return strokes.flat();
}

describe("supportGlyph", () => {
  it("draws nothing for a Free Node", () => {
    // An absence of restraint should look like an absence, not a placeholder.
    expect(supportGlyph("FREE", 0, 0)).toBeNull();
  });

  it("gives each restraining Support its own glyph", () => {
    const hinge = supportGlyph("HINGE", 0, 0)!;
    const roller = supportGlyph("ROLLER", 0, 0)!;
    const fixed = supportGlyph("FIXED", 0, 0)!;
    // Distinguishable by shape, not only by stroke count -- but the counts
    // differing at all is the cheapest proof they are not the same drawing.
    expect(new Set([hinge.length, roller.length, fixed.length]).size).toBe(3);
  });

  it("sits below the Node glyph so the Node stays readable on top", () => {
    for (const support of ["HINGE", "ROLLER", "FIXED"] as const) {
      for (const point of allPoints(supportGlyph(support, 0, 0)!)) {
        expect(point[2]).toBe(SUPPORT_GLYPH_Z);
      }
    }
    expect(SUPPORT_GLYPH_Z).toBeLessThan(NODE_GLYPH_Z);
  });

  it("hangs entirely below the Node it belongs to", () => {
    // A glyph drawn above the Node would sit over the structure itself.
    for (const support of ["HINGE", "ROLLER", "FIXED"] as const) {
      for (const point of allPoints(supportGlyph(support, 0, 5)!)) {
        expect(point[1]).toBeLessThanOrEqual(5);
      }
    }
  });

  it("touches the Node with the Hinge and Roller triangle apex", () => {
    for (const support of ["HINGE", "ROLLER"] as const) {
      const [triangle] = supportGlyph(support, 2, 3)!;
      // First point is the apex, and it lands exactly on the Node.
      expect(triangle[0][0]).toBeCloseTo(2);
      expect(triangle[0][1]).toBeCloseTo(3);
      // Closed shape: the last point returns to the apex.
      expect(triangle[triangle.length - 1]).toEqual(triangle[0]);
    }
  });

  it("gives the Fixed support no triangle, because it cannot pivot", () => {
    const fixed = supportGlyph("FIXED", 0, 0)!;
    // Every stroke is a straight two-point segment: a wall and its hatching,
    // with nothing that reads as the pin a triangle implies.
    for (const stroke of fixed) expect(stroke).toHaveLength(2);
  });

  it("puts the Roller on wheels clear of its ground line", () => {
    const [, leftWheel, rightWheel, ground] = supportGlyph("ROLLER", 0, 0)!;
    // Wheels are closed loops, the ground is a straight segment.
    expect(leftWheel.length).toBeGreaterThan(2);
    expect(rightWheel.length).toBeGreaterThan(2);
    expect(ground).toHaveLength(2);
    // The ground sits below both wheels rather than through them.
    const lowestWheelY = Math.min(...[...leftWheel, ...rightWheel].map((p) => p[1]));
    expect(ground[0][1]).toBeLessThanOrEqual(lowestWheelY + 1e-9);
  });

  it("leaves the Roller's ground unhatched, since it is free to travel", () => {
    const roller = supportGlyph("ROLLER", 0, 0)!;
    const hinge = supportGlyph("HINGE", 0, 0)!;
    // The Hinge's hatching is what makes it more strokes than the Roller.
    expect(hinge.length).toBeGreaterThan(roller.length);
  });

  it("follows the Node wherever it is placed", () => {
    const origin = supportGlyph("HINGE", 0, 0)!;
    const moved = supportGlyph("HINGE", 10, -4)!;
    expect(moved[0][0][0] - origin[0][0][0]).toBeCloseTo(10);
    expect(moved[0][0][1] - origin[0][0][1]).toBeCloseTo(-4);
  });
});

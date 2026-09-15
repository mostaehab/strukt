import { describe, expect, it } from "vitest";
import {
  LOAD_GLYPH_Z,
  NODE_GLYPH_Z,
  PIXELS_PER_WORLD_UNIT,
} from "./canvasConstants";
import {
  LOAD_HEAD_HALO_SCALE,
  LOAD_HEAD_LENGTH,
  LOAD_HEAD_VERTICES,
  LOAD_HEAD_WIDTH,
  LOAD_LABEL_GAP,
  LOAD_SHAFT_LENGTH,
  LOAD_STACK_OFFSET,
  LOAD_UDL_ARROW_LENGTH,
  LOAD_UDL_MAX_ARROWS,
  LOAD_UDL_MIN_ARROWS,
  loadGlyphGeometry,
  udlArrowCount,
  udlGlyphGeometry,
} from "./loadGlyphGeometry";

const DOWN: [number, number] = [0, -1];
const UP: [number, number] = [0, 1];
const RIGHT: [number, number] = [1, 0];

describe("load glyph sizing", () => {
  it("matches the mockup: a 60px shaft with a 12x12 head", () => {
    expect(LOAD_SHAFT_LENGTH * PIXELS_PER_WORLD_UNIT).toBeCloseTo(60, 9);
    expect(LOAD_HEAD_LENGTH * PIXELS_PER_WORLD_UNIT).toBeCloseTo(12, 9);
    expect(LOAD_HEAD_WIDTH * PIXELS_PER_WORLD_UNIT).toBeCloseTo(12, 9);
  });

  it("keeps the head shorter than the shaft it terminates", () => {
    expect(LOAD_HEAD_LENGTH).toBeLessThan(LOAD_SHAFT_LENGTH);
  });

  // The head lands on the Node glyph, whose radius is nearly the head's whole
  // length, so an arrow painted underneath would lose its head entirely.
  it("draws above the Node glyphs so the head stays visible", () => {
    expect(LOAD_GLYPH_Z).toBeGreaterThan(NODE_GLYPH_Z);
  });

  // The Node glyph underneath is drawn in the same accent whenever it is
  // selected, so the head needs an outline that is wider than the head.
  it("halos the head wider than the head itself", () => {
    expect(LOAD_HEAD_HALO_SCALE).toBeGreaterThan(1);
  });

  it("separates stacked Loads by more than a head width", () => {
    expect(LOAD_STACK_OFFSET).toBeGreaterThan(LOAD_HEAD_WIDTH);
  });
});

describe("LOAD_HEAD_VERTICES", () => {
  it("is one triangle: three vertices of three components", () => {
    expect(LOAD_HEAD_VERTICES).toHaveLength(9);
  });

  it("puts the apex at the local origin, so it lands on the target", () => {
    expect(LOAD_HEAD_VERTICES.slice(0, 3)).toEqual([0, 0, 0]);
  });

  it("puts the base one head-length behind the apex, spanning its width", () => {
    const [bx, by] = LOAD_HEAD_VERTICES.slice(3, 5);
    const [cx, cy] = LOAD_HEAD_VERTICES.slice(6, 8);
    expect(bx).toBeCloseTo(-LOAD_HEAD_LENGTH, 12);
    expect(cx).toBeCloseTo(-LOAD_HEAD_LENGTH, 12);
    expect(Math.abs(cy - by)).toBeCloseTo(LOAD_HEAD_WIDTH, 12);
  });

  it("is flat -- every vertex sits on the glyph plane", () => {
    expect([
      LOAD_HEAD_VERTICES[2],
      LOAD_HEAD_VERTICES[5],
      LOAD_HEAD_VERTICES[8],
    ]).toEqual([0, 0, 0]);
  });
});

describe("loadGlyphGeometry", () => {
  // Matrix row: Canvas arrow orientation -- [0, -1] draws along -y with the
  // head at the target and the label at the tail.
  it("puts the head at the target and the tail above it for a downward Load", () => {
    const glyph = loadGlyphGeometry(2, 3, DOWN);
    expect(glyph.head.position[0]).toBe(2);
    expect(glyph.head.position[1]).toBe(3);
    // Tail is *up* from the target: the arrow comes from above and points down.
    expect(glyph.shaftStart[0]).toBe(2);
    expect(glyph.shaftStart[1]).toBeCloseTo(3 + LOAD_SHAFT_LENGTH, 12);
  });

  it("rotates the head to point along the Load direction", () => {
    expect(loadGlyphGeometry(0, 0, RIGHT).head.rotation).toEqual([0, 0, 0]);
    expect(loadGlyphGeometry(0, 0, DOWN).head.rotation[2]).toBeCloseTo(
      -Math.PI / 2,
      12,
    );
    expect(loadGlyphGeometry(0, 0, UP).head.rotation[2]).toBeCloseTo(
      Math.PI / 2,
      12,
    );
  });

  it("flips the whole arrow when the direction flips", () => {
    const down = loadGlyphGeometry(0, 0, DOWN);
    const up = loadGlyphGeometry(0, 0, UP);
    expect(down.shaftStart[1]).toBeCloseTo(LOAD_SHAFT_LENGTH, 12);
    expect(up.shaftStart[1]).toBeCloseTo(-LOAD_SHAFT_LENGTH, 12);
  });

  it("ends the shaft on the head's base, leaving no gap and no overshoot", () => {
    const glyph = loadGlyphGeometry(0, 0, DOWN);
    expect(glyph.shaftEnd[1]).toBeCloseTo(LOAD_HEAD_LENGTH, 12);
    expect(Math.abs(glyph.shaftEnd[1])).toBeLessThan(
      Math.abs(glyph.shaftStart[1]),
    );
  });

  it("labels the tail, further from the target than the tail itself", () => {
    const glyph = loadGlyphGeometry(0, 0, DOWN);
    expect(glyph.labelPosition[1]).toBeCloseTo(
      LOAD_SHAFT_LENGTH + LOAD_LABEL_GAP,
      12,
    );
    expect(glyph.labelPosition[1]).toBeGreaterThan(glyph.shaftStart[1]);
  });

  it("keeps every part of the glyph on one plane, above the Nodes", () => {
    const glyph = loadGlyphGeometry(1, -4, RIGHT);
    for (const z of [
      glyph.shaftStart[2],
      glyph.shaftEnd[2],
      glyph.head.position[2],
      glyph.labelPosition[2],
    ]) {
      expect(z).toBe(LOAD_GLYPH_Z);
    }
  });

  it("draws the same arrow for a non-unit direction as for its unit form", () => {
    // Magnitude is carried by the label, never by the arrow's length.
    expect(loadGlyphGeometry(0, 0, [0, -5000])).toEqual(
      loadGlyphGeometry(0, 0, DOWN),
    );
  });

  it("places a diagonal Load along its own bearing", () => {
    const glyph = loadGlyphGeometry(0, 0, [3, -4]);
    expect(glyph.shaftStart[0]).toBeCloseTo(-0.6 * LOAD_SHAFT_LENGTH, 12);
    expect(glyph.shaftStart[1]).toBeCloseTo(0.8 * LOAD_SHAFT_LENGTH, 12);
  });

  it("degrades a zero or non-finite direction to straight down, never NaN", () => {
    for (const bad of [
      [0, 0],
      [Number.NaN, 0],
      [Number.POSITIVE_INFINITY, 1],
    ] as [number, number][]) {
      const glyph = loadGlyphGeometry(0, 0, bad);
      expect(glyph.shaftStart.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(glyph.head.rotation[2])).toBe(true);
      expect(glyph.shaftStart[1]).toBeCloseTo(LOAD_SHAFT_LENGTH, 12);
    }
  });

  // Two Loads pointing the same way at one Node must not draw as one arrow --
  // the whole point of "sum, don't overwrite" being visible.
  it("offsets a stacked Load across the shaft, leaving the first in place", () => {
    const first = loadGlyphGeometry(0, 0, DOWN, 0);
    const second = loadGlyphGeometry(0, 0, DOWN, 1);
    expect(first).toEqual(loadGlyphGeometry(0, 0, DOWN));
    expect(second.head.position[0]).toBeCloseTo(LOAD_STACK_OFFSET, 12);
    // Across the shaft, not along it: the arrow must not grow longer, which
    // would read as a larger Load.
    expect(second.head.position[1]).toBeCloseTo(0, 12);
    expect(second.shaftStart[1] - second.head.position[1]).toBeCloseTo(
      first.shaftStart[1] - first.head.position[1],
      12,
    );
  });

  it("offsets each further Load one step more", () => {
    expect(loadGlyphGeometry(0, 0, DOWN, 2).head.position[0]).toBeCloseTo(
      2 * LOAD_STACK_OFFSET,
      12,
    );
  });
});

describe("udlArrowCount", () => {
  it("draws about one arrow per grid square of span", () => {
    expect(udlArrowCount(4)).toBe(5);
    expect(udlArrowCount(8)).toBe(9);
  });

  it("never drops below one arrow at each end", () => {
    expect(udlArrowCount(1)).toBe(LOAD_UDL_MIN_ARROWS);
    expect(udlArrowCount(0.2)).toBe(LOAD_UDL_MIN_ARROWS);
  });

  it("never turns a long member into a comb", () => {
    expect(udlArrowCount(40)).toBe(LOAD_UDL_MAX_ARROWS);
  });

  it("degrades a zero or non-finite span to the minimum, never NaN", () => {
    expect(udlArrowCount(0)).toBe(LOAD_UDL_MIN_ARROWS);
    expect(udlArrowCount(Number.NaN)).toBe(LOAD_UDL_MIN_ARROWS);
  });
});

describe("udlGlyphGeometry", () => {
  // Matrix row: UDL on an Element -- drawn over the member it acts on, which
  // is what distinguishes it from a concentrated Load at midspan.
  it("spans the whole member rather than sitting at its midpoint", () => {
    const glyph = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    expect(glyph.spineStart[0]).toBe(0);
    expect(glyph.spineEnd[0]).toBe(4);
    // Lifted clear of the member, on the side the Load comes from.
    expect(glyph.spineStart[1]).toBeCloseTo(LOAD_UDL_ARROW_LENGTH, 12);
    expect(glyph.spineEnd[1]).toBeCloseTo(LOAD_UDL_ARROW_LENGTH, 12);
  });

  it("is visibly a different glyph from a concentrated Load", () => {
    const udl = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    const concentrated = loadGlyphGeometry(2, 0, DOWN);

    // A row of arrows under a line spanning the member, not the single
    // long arrow at midspan that means "concentrated load here".
    expect(udl.arrows.length).toBeGreaterThan(1);
    expect(udl.spineStart).not.toEqual(udl.spineEnd);

    const udlArrowLength = Math.hypot(
      udl.arrows[0].shaftStart[0] - udl.arrows[0].head.position[0],
      udl.arrows[0].shaftStart[1] - udl.arrows[0].head.position[1],
    );
    const concentratedLength = Math.hypot(
      concentrated.shaftStart[0] - concentrated.head.position[0],
      concentrated.shaftStart[1] - concentrated.head.position[1],
    );
    expect(udlArrowLength).toBeLessThan(concentratedLength);
  });

  it("lands one arrow on each end of the member", () => {
    const glyph = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    const heads = glyph.arrows.map((arrow) => arrow.head.position);
    expect(heads[0][0]).toBeCloseTo(0, 12);
    expect(heads[heads.length - 1][0]).toBeCloseTo(4, 12);
  });

  it("spaces the arrows evenly along the member", () => {
    const glyph = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    const xs = glyph.arrows.map((arrow) => arrow.head.position[0]);
    const gaps = xs.slice(1).map((x, index) => x - xs[index]);
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(gaps[0], 12);
    }
    expect(glyph.arrows).toHaveLength(udlArrowCount(4));
  });

  it("points every arrow the same way as the Load", () => {
    const glyph = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    for (const arrow of glyph.arrows) {
      expect(arrow.head.rotation[2]).toBeCloseTo(-Math.PI / 2, 12);
      // Tail on the spine, head on the member.
      expect(arrow.shaftStart[1]).toBeGreaterThan(arrow.head.position[1]);
    }
  });

  it("follows a diagonal member", () => {
    const glyph = udlGlyphGeometry(0, 0, 3, 4, DOWN);
    const heads = glyph.arrows.map((arrow) => arrow.head.position);
    expect(heads[0][0]).toBeCloseTo(0, 12);
    expect(heads[0][1]).toBeCloseTo(0, 12);
    expect(heads[heads.length - 1][0]).toBeCloseTo(3, 12);
    expect(heads[heads.length - 1][1]).toBeCloseTo(4, 12);
    expect(glyph.arrows).toHaveLength(udlArrowCount(5));
  });

  it("labels the middle of the spine, clear of it", () => {
    const glyph = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    expect(glyph.labelPosition[0]).toBeCloseTo(2, 12);
    expect(glyph.labelPosition[1]).toBeGreaterThan(glyph.spineStart[1]);
  });

  it("keeps every part of the glyph on the Load plane", () => {
    const glyph = udlGlyphGeometry(0, 0, 4, 0, DOWN);
    const zs = [
      glyph.spineStart[2],
      glyph.spineEnd[2],
      glyph.labelPosition[2],
      ...glyph.arrows.flatMap((arrow) => [
        arrow.shaftStart[2],
        arrow.shaftEnd[2],
        arrow.head.position[2],
      ]),
    ];
    for (const z of zs) expect(z).toBe(LOAD_GLYPH_Z);
  });

  it("lifts a stacked UDL clear of the one below it", () => {
    const first = udlGlyphGeometry(0, 0, 4, 0, DOWN, 0);
    const second = udlGlyphGeometry(0, 0, 4, 0, DOWN, 1);
    expect(second.spineStart[1] - first.spineStart[1]).toBeCloseTo(
      LOAD_STACK_OFFSET,
      12,
    );
    // The arrows still land on the member: only their tails move.
    expect(second.arrows[0].head.position).toEqual(
      first.arrows[0].head.position,
    );
  });

  it("degrades a zero-length member safely", () => {
    const glyph = udlGlyphGeometry(2, 2, 2, 2, DOWN);
    expect(glyph.arrows).toHaveLength(LOAD_UDL_MIN_ARROWS);
    for (const arrow of glyph.arrows) {
      expect(arrow.head.position.every(Number.isFinite)).toBe(true);
    }
  });
});

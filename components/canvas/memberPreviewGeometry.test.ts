import { describe, expect, it } from "vitest";
import {
  memberPreviewGeometry,
  PREVIEW_LABEL_OFFSET,
} from "./memberPreviewGeometry";
import { LOAD_GLYPH_Z } from "./canvasConstants";

describe("memberPreviewGeometry", () => {
  it("measures an axis-aligned band", () => {
    const preview = memberPreviewGeometry(0, 0, 4, 0);
    expect(preview.length).toBeCloseTo(4, 10);
    expect(preview.angle).toBeCloseTo(0, 10);
  });

  it("measures the case the grid cannot be counted for", () => {
    // 3-4-5. Neither the length nor the angle is readable off the grid, which
    // is the whole reason the dimension is drawn.
    const preview = memberPreviewGeometry(0, 0, 3, 4);
    expect(preview.length).toBeCloseTo(5, 10);
    expect(preview.angle).toBeCloseTo(53.13010235, 6);
  });

  it("reports the direction it was drawn in, not a folded inclination", () => {
    // The same line, drawn the other way. A band leaves a specific Node, so
    // -30 and 150 are the same geometry but not the same gesture.
    const out = memberPreviewGeometry(0, 0, -Math.sqrt(3), 1);
    expect(out.angle).toBeCloseTo(150, 6);
    const back = memberPreviewGeometry(0, 0, Math.sqrt(3), -1);
    expect(back.angle).toBeCloseTo(-30, 6);
  });

  it("sets the label off the band rather than on it", () => {
    const preview = memberPreviewGeometry(0, 0, 4, 0);
    const [x, y] = preview.labelPosition;
    // Midpoint in x, cleared perpendicular in y.
    expect(x).toBeCloseTo(2, 10);
    expect(Math.abs(y)).toBeCloseTo(PREVIEW_LABEL_OFFSET, 10);
  });

  it("clears the band perpendicular whichever way it runs", () => {
    const preview = memberPreviewGeometry(0, 0, 0, 4);
    const [x, y] = preview.labelPosition;
    // Vertical band, so the label steps sideways.
    expect(Math.abs(x)).toBeCloseTo(PREVIEW_LABEL_OFFSET, 10);
    expect(y).toBeCloseTo(2, 10);
  });

  it("degrades to a finite point when the cursor sits on the start Node", () => {
    const preview = memberPreviewGeometry(2, 3, 2, 3);
    expect(preview.length).toBe(0);
    expect(preview.angle).toBe(0);
    for (const value of [...preview.labelPosition, ...preview.start, ...preview.end]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("draws at the glyph plane, over the Elements it is measured against", () => {
    const preview = memberPreviewGeometry(0, 0, 1, 1);
    expect(preview.start[2]).toBe(LOAD_GLYPH_Z);
    expect(preview.end[2]).toBe(LOAD_GLYPH_Z);
    expect(preview.labelPosition[2]).toBe(LOAD_GLYPH_Z);
  });
});

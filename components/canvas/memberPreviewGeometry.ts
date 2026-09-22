import { LOAD_GLYPH_Z, worldUnitsFromPixels } from "./canvasConstants";

/**
 * The rubber band shown while an Element is being drawn, and its dimension.
 *
 * An Element connects two existing Nodes, so its length is fixed before the
 * second click -- but nothing on screen said what it would be. On an
 * axis-aligned member a student can count grid squares; on an inclined one the
 * length is `sqrt(dx^2 + dy^2)` and the angle is not readable at all, which is
 * exactly the geometry a Truss is made of.
 *
 * Kept free of React and three.js so the arithmetic is unit-tested in the node
 * environment, like the load and support glyphs: a flipped perpendicular or a
 * degrees/radians slip would otherwise only show as a label in the wrong place.
 */

/** How far off the line the dimension label sits. Mockup hairline gap: 14px. */
export const PREVIEW_LABEL_OFFSET = worldUnitsFromPixels(14);

export interface MemberPreview {
  start: [number, number, number];
  end: [number, number, number];
  /** Metres, SI (AD-4) -- the caller converts for display. */
  length: number;
  /**
   * Degrees from the +x axis, in (-180, 180], measured from the start Node
   * toward the cursor.
   *
   * Directional rather than folded into an acute inclination: the band is
   * drawn from a specific Node outward, and "150 degrees" and "-30 degrees"
   * are the same line but not the same drawing gesture.
   */
  angle: number;
  /** Label anchor, set clear of the line so the band never runs through it. */
  labelPosition: [number, number, number];
}

const DEGREES_PER_RADIAN = 180 / Math.PI;

export function memberPreviewGeometry(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): MemberPreview {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy);

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Perpendicular to the band. A zero-length band has no direction to offset
  // along, so the label goes straight above the Node rather than producing NaN
  // -- which three.js would carry into the whole scene graph.
  const acrossX = length === 0 ? 0 : -dy / length;
  const acrossY = length === 0 ? 1 : dx / length;

  return {
    start: [startX, startY, LOAD_GLYPH_Z],
    end: [endX, endY, LOAD_GLYPH_Z],
    length,
    angle: length === 0 ? 0 : Math.atan2(dy, dx) * DEGREES_PER_RADIAN,
    labelPosition: [
      midX + acrossX * PREVIEW_LABEL_OFFSET,
      midY + acrossY * PREVIEW_LABEL_OFFSET,
      LOAD_GLYPH_Z,
    ],
  };
}

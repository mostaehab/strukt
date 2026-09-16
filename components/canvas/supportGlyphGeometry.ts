import type { Support } from "@/engine/types";
import { SUPPORT_GLYPH_Z, worldUnitsFromPixels } from "./canvasConstants";

/**
 * Drafting glyphs for the three restraining Supports.
 *
 * Pure geometry: every glyph is a list of polylines in world coordinates, so
 * the component that draws them owns no arithmetic and this module can be
 * tested without a renderer. Sizes come from `mockups/key-canvas.html:265-273`,
 * converted once through `worldUnitsFromPixels`.
 *
 * The three read differently at a glance, the way they do on paper: a Hinge is
 * a triangle on hatched ground, a Roller is the same triangle up on wheels, and
 * a Fixed support is a hatched wall with no triangle at all. A Free Node draws
 * nothing -- an absence of restraint should look like an absence.
 */

const TRIANGLE_HALF_WIDTH = worldUnitsFromPixels(10);
const TRIANGLE_HEIGHT = worldUnitsFromPixels(18);
const GROUND_HALF_WIDTH = worldUnitsFromPixels(14);
const HATCH_LENGTH = worldUnitsFromPixels(6);
const HATCH_COUNT = 5;
const ROLLER_RADIUS = worldUnitsFromPixels(3);
const FIXED_HALF_WIDTH = worldUnitsFromPixels(13);

export type Point3 = [number, number, number];

/** One glyph: a set of independent polylines, all on the Support plane. */
export type SupportStrokes = Point3[][];

function at(x: number, y: number): Point3 {
  return [x, y, SUPPORT_GLYPH_Z];
}

/** The diagonal tick marks that read as "ground" on any drawing. */
function hatching(x: number, y: number, halfWidth: number): SupportStrokes {
  const strokes: SupportStrokes = [];
  const span = halfWidth * 2;
  for (let i = 0; i < HATCH_COUNT; i += 1) {
    const start = x - halfWidth + (span * i) / (HATCH_COUNT - 1);
    strokes.push([at(start, y), at(start - HATCH_LENGTH, y - HATCH_LENGTH)]);
  }
  return strokes;
}

/** A closed circle approximated by a polyline, for the Roller's wheels. */
function circle(cx: number, cy: number, radius: number): Point3[] {
  const segments = 12;
  const points: Point3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(at(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)));
  }
  return points;
}

/**
 * The glyph for one Support, positioned with its contact point at the Node.
 *
 * Returns null for FREE: there is nothing to draw, and drawing a placeholder
 * would imply a restraint the solver does not have.
 */
export function supportGlyph(
  support: Support,
  x: number,
  y: number,
): SupportStrokes | null {
  if (support === "FREE") return null;

  if (support === "FIXED") {
    // A wall, not a triangle: fully restrained, including rotation, so nothing
    // about it should suggest the pivot a triangle implies.
    const groundY = y - worldUnitsFromPixels(4);
    return [
      [at(x - FIXED_HALF_WIDTH, groundY), at(x + FIXED_HALF_WIDTH, groundY)],
      ...hatching(x, groundY, FIXED_HALF_WIDTH),
    ];
  }

  const baseY = y - TRIANGLE_HEIGHT;
  const triangle: Point3[] = [
    at(x, y),
    at(x - TRIANGLE_HALF_WIDTH, baseY),
    at(x + TRIANGLE_HALF_WIDTH, baseY),
    at(x, y),
  ];

  if (support === "HINGE") {
    return [
      triangle,
      [at(x - GROUND_HALF_WIDTH, baseY), at(x + GROUND_HALF_WIDTH, baseY)],
      ...hatching(x, baseY, GROUND_HALF_WIDTH),
    ];
  }

  // ROLLER: the same triangle, lifted onto wheels, with a plain ground line --
  // no hatching, because it is free to travel along that surface.
  const wheelY = baseY - ROLLER_RADIUS;
  const groundY = wheelY - ROLLER_RADIUS;
  return [
    triangle,
    circle(x - TRIANGLE_HALF_WIDTH / 2, wheelY, ROLLER_RADIUS),
    circle(x + TRIANGLE_HALF_WIDTH / 2, wheelY, ROLLER_RADIUS),
    [at(x - GROUND_HALF_WIDTH, groundY), at(x + GROUND_HALF_WIDTH, groundY)],
  ];
}

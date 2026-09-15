/**
 * Arrow geometry for canvas Loads.
 *
 * A concentrated Load draws as a single accent arrow: a straight shaft with a
 * filled triangular head sitting on the Node it acts on, and its magnitude
 * labelled at the tail. A UDL draws as the standard distributed-load notation
 * instead -- a line spanning the member with a row of short arrows dropping
 * from it onto the member -- because a single arrow at midspan is the notation
 * for a *concentrated* load at midspan, and a per-metre unit in the label is
 * not enough to tell the two apart.
 *
 * This module holds that arithmetic, kept free of React and three.js so it can
 * be unit-tested in the node environment: a flipped sign or a swapped
 * perpendicular would otherwise only show up as arrows pointing the wrong way
 * on screen.
 *
 * Sizes come from the load glyphs in
 * `_bmad-output/planning-artifacts/ux-designs/ux-strukt-2026-08-30/mockups/key-canvas.html`
 * (60px shaft, a 12x12 head at the target end, the label at the tail),
 * converted into world units through `./canvasConstants`.
 */

import { LOAD_GLYPH_Z, worldUnitsFromPixels } from "./canvasConstants";

/** Shaft length of a concentrated Load, measured back from the Node. 60px. */
export const LOAD_SHAFT_LENGTH = worldUnitsFromPixels(60);

/** Head length along the shaft, at the target end. Mockup: 12px. */
export const LOAD_HEAD_LENGTH = worldUnitsFromPixels(12);

/** Head width across the shaft. Mockup: 12px. */
export const LOAD_HEAD_WIDTH = worldUnitsFromPixels(12);

/** Gap between the tail and its label. Mockup: 9px beyond the tail. */
export const LOAD_LABEL_GAP = worldUnitsFromPixels(9);

/**
 * Perpendicular offset between Loads stacked on the same target.
 *
 * Two Loads in the same direction on one Node would otherwise draw perfectly
 * coincident shafts, heads and labels and read as a single Load -- the exact
 * case "sum, don't overwrite" (FR-8/FR-9) exists to make visible. Wider than
 * one head, so two heads never touch.
 */
export const LOAD_STACK_OFFSET = worldUnitsFromPixels(14);

/**
 * Scale of the contrast halo painted behind each head.
 *
 * The head lands on a Node glyph that is drawn in the accent colour whenever
 * that Node is selected, and DESIGN.md gives loads and selection the same
 * accent -- so without a halo in the canvas background colour the head
 * disappears into the selection disc exactly when the user is looking at it.
 */
export const LOAD_HEAD_HALO_SCALE = 1.45;

/**
 * Arrow length of one UDL tick -- shorter than a concentrated shaft, so a row
 * of them reads as one distributed load rather than as many point loads.
 */
export const LOAD_UDL_ARROW_LENGTH = worldUnitsFromPixels(30);

/** Target spacing between UDL arrows, in world units (one grid square). */
export const LOAD_UDL_ARROW_SPACING = 1;

/** Fewest arrows a UDL ever draws -- one at each end of the member. */
export const LOAD_UDL_MIN_ARROWS = 2;

/** Most arrows a UDL draws, so a long member never becomes a solid comb. */
export const LOAD_UDL_MAX_ARROWS = 9;

/**
 * The head triangle in its own local frame: apex at the origin pointing along
 * +x, base one head-length behind it. Flat `[x, y, z, ...]` triples, ready for
 * a `THREE.BufferAttribute`.
 *
 * Static on purpose. Every rendered head is this one triangle *placed* at a
 * target and rotated to the Load's direction, so moving a Node never rebuilds
 * a buffer -- it only changes a position and a rotation, exactly as an
 * Element's pick proxy does.
 *
 * Wound counter-clockwise as seen from the camera; the material still draws
 * both sides, so a mirrored direction can never render an invisible head.
 */
export const LOAD_HEAD_VERTICES: readonly number[] = [
  // apex, which lands on the target
  0, 0, 0,
  // base corners, one head-length back and half a head-width either side
  -LOAD_HEAD_LENGTH, -LOAD_HEAD_WIDTH / 2, 0,
  -LOAD_HEAD_LENGTH, LOAD_HEAD_WIDTH / 2, 0,
];

/** One arrow: a shaft, and a placement for `LOAD_HEAD_VERTICES`. */
export interface LoadArrow {
  /** Tail of the shaft. */
  shaftStart: [number, number, number];
  /** Where the shaft meets the head's base, so the two never leave a gap. */
  shaftEnd: [number, number, number];
  head: {
    /** Apex position -- the point this arrow acts on. */
    position: [number, number, number];
    /** Euler rotation about z aligning the local +x apex with the direction. */
    rotation: [number, number, number];
  };
}

export interface ConcentratedGlyphGeometry extends LoadArrow {
  /** Label anchor, just beyond the tail and away from the target. */
  labelPosition: [number, number, number];
}

export interface UdlGlyphGeometry {
  /** The line spanning the member, which every arrow drops from. */
  spineStart: [number, number, number];
  spineEnd: [number, number, number];
  /** One arrow per tick, from the first end of the member to the second. */
  arrows: LoadArrow[];
  /** Label anchor, beyond the middle of the spine. */
  labelPosition: [number, number, number];
}

/**
 * Normalised bearing of a Load direction.
 *
 * A zero-length or non-finite direction degrades to straight down rather than
 * producing NaN geometry, which three.js would carry into the whole scene
 * graph; it never throws. Only the bearing is used, so a non-unit vector draws
 * the same arrow as its unit equivalent -- magnitude is carried by the label,
 * never by the arrow's length.
 */
function bearing(direction: readonly [number, number]): [number, number] {
  const [dx, dy] = direction;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return [0, -1];
  return [dx / length, dy / length];
}

/**
 * How many arrows a UDL draws: roughly one per grid square of span, clamped so
 * a short member still shows two (one at each end) and a long one never turns
 * into a solid comb.
 *
 * The shortest member the canvas can produce spans one grid square, because
 * Nodes snap to integer coordinates and `canConnect` blocks coincident ones --
 * so the two-arrow minimum is never drawn closer together than one grid
 * square, which is four head-widths apart.
 */
export function udlArrowCount(span: number): number {
  if (!Number.isFinite(span) || span <= 0) return LOAD_UDL_MIN_ARROWS;
  const ideal = Math.round(span / LOAD_UDL_ARROW_SPACING) + 1;
  return Math.min(Math.max(ideal, LOAD_UDL_MIN_ARROWS), LOAD_UDL_MAX_ARROWS);
}

/**
 * Places one concentrated-Load arrow: head on the Node, shaft running back
 * along the Load's direction, label at the tail.
 *
 * `stackIndex` separates Loads that share a target -- 0 draws on the target
 * itself, and each subsequent Load is offset one `LOAD_STACK_OFFSET` across
 * the shaft, so two identical Loads never draw as one.
 */
export function loadGlyphGeometry(
  targetX: number,
  targetY: number,
  direction: readonly [number, number],
  stackIndex = 0,
): ConcentratedGlyphGeometry {
  const [ux, uy] = bearing(direction);
  // Perpendicular to the shaft, so a stack fans out sideways rather than
  // lengthening the arrows, which would read as a bigger Load.
  const offset = stackIndex * LOAD_STACK_OFFSET;
  const offsetX = -uy * offset;
  const offsetY = ux * offset;

  const back = (distance: number): [number, number, number] => [
    targetX + offsetX - ux * distance,
    targetY + offsetY - uy * distance,
    LOAD_GLYPH_Z,
  ];

  return {
    shaftStart: back(LOAD_SHAFT_LENGTH),
    shaftEnd: back(LOAD_HEAD_LENGTH),
    head: {
      position: back(0),
      rotation: [0, 0, Math.atan2(uy, ux)],
    },
    labelPosition: back(LOAD_SHAFT_LENGTH + LOAD_LABEL_GAP),
  };
}

/**
 * Places a UDL over its whole member: a spine parallel to the Element, one
 * arrow-length back along the Load direction, with a row of arrows dropping
 * from it onto the member itself.
 *
 * Span-aware on purpose -- the notation has to cover the member it is applied
 * to, which is what distinguishes it from a concentrated Load at midspan.
 *
 * `stackIndex` steps a second UDL further back along its own direction, away
 * from the member, so two UDLs never share a spine.
 */
export function udlGlyphGeometry(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  direction: readonly [number, number],
  stackIndex = 0,
): UdlGlyphGeometry {
  const [ux, uy] = bearing(direction);
  const lift = LOAD_UDL_ARROW_LENGTH + stackIndex * LOAD_STACK_OFFSET;
  const count = udlArrowCount(Math.hypot(endX - startX, endY - startY));

  const arrows: LoadArrow[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    arrows.push({
      shaftStart: [x - ux * lift, y - uy * lift, LOAD_GLYPH_Z],
      shaftEnd: [
        x - ux * LOAD_HEAD_LENGTH,
        y - uy * LOAD_HEAD_LENGTH,
        LOAD_GLYPH_Z,
      ],
      head: {
        position: [x, y, LOAD_GLYPH_Z],
        rotation: [0, 0, Math.atan2(uy, ux)],
      },
    });
  }

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  return {
    spineStart: [startX - ux * lift, startY - uy * lift, LOAD_GLYPH_Z],
    spineEnd: [endX - ux * lift, endY - uy * lift, LOAD_GLYPH_Z],
    arrows,
    labelPosition: [
      midX - ux * (lift + LOAD_LABEL_GAP),
      midY - uy * (lift + LOAD_LABEL_GAP),
      LOAD_GLYPH_Z,
    ],
  };
}

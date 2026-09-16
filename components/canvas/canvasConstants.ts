/**
 * Shared canvas constants: the world/pixel scale, and the z layers everything
 * on the canvas is painted into.
 *
 * Framework-free so the geometry modules and their node-environment tests can
 * read them without pulling in three.js, and shared so the camera, the pick
 * proxies and the Load glyphs can never drift apart -- a mockup size in pixels
 * only converts correctly while the camera's zoom is exactly this number.
 */

/** Screen pixels per world unit == the orthographic camera's zoom. */
export const PIXELS_PER_WORLD_UNIT = 48;

/** Converts a mockup measurement in CSS pixels to world units. */
export function worldUnitsFromPixels(pixels: number): number {
  return pixels / PIXELS_PER_WORLD_UNIT;
}

/**
 * z of an Element's pick proxy. Must stay below NODE_GLYPH_Z so a tap on a
 * shared endpoint resolves to the Node, which is the smaller target.
 */
export const ELEMENT_PROXY_Z = 0.1;

/** z the Node glyphs render at -- nearer the camera than any Element proxy. */
export const NODE_GLYPH_Z = 0.2;

/**
 * z the Load arrows render at.
 *
 * Above `NODE_GLYPH_Z`, deliberately: the head lands *on* the Node it points
 * at, and the Node glyph's radius is nearly the whole length of the head, so
 * painting the arrow underneath would swallow the head and leave a bare line
 * indistinguishable from an Element. The arrow carries no pointer handlers, so
 * sitting on top costs no hit-testing -- r3f only dispatches events to objects
 * that have handlers.
 */
export const LOAD_GLYPH_Z = 0.25;

/**
 * How far behind the head its contrast halo is painted. Small enough to read
 * as one glyph, large enough that the two never z-fight.
 */
export const LOAD_HALO_Z_OFFSET = 0.01;

/**
 * z of a Support glyph. Below the Node it belongs to, so the Node circle stays
 * readable on top of it, and above the Element pick proxy so a Support drawn
 * under a joint never hides the member. Carries no pointer handlers, so it
 * takes no taps from either.
 */
export const SUPPORT_GLYPH_Z = 0.15;

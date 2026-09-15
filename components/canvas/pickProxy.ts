/**
 * Pick-proxy geometry for canvas Elements.
 *
 * An Element renders as a hairline, which raycasts only within its own pixel
 * width -- far too thin to tap. Selection is therefore handled by an invisible
 * plane laid along the Element. This module holds the arithmetic that places
 * that plane, kept free of React and three.js so it can be unit-tested in the
 * node environment: a swapped `atan2` argument order or swapped plane
 * dimensions would otherwise only show up as taps mysteriously missing.
 */

import { ELEMENT_PROXY_Z } from "./canvasConstants";

export interface PickProxy {
  /** Centre of the proxy plane, at ELEMENT_PROXY_Z. */
  position: [number, number, number];
  /** Euler rotation about z that aligns the plane's width with the Element. */
  rotation: [number, number, number];
  /** Element length -- the plane's width, i.e. its first planeGeometry arg. */
  length: number;
}

export function elementPickProxy(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): PickProxy {
  const dx = endX - startX;
  const dy = endY - startY;
  return {
    position: [(startX + endX) / 2, (startY + endY) / 2, ELEMENT_PROXY_Z],
    rotation: [0, 0, Math.atan2(dy, dx)],
    length: Math.hypot(dx, dy),
  };
}

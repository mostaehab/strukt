import { describe, expect, it } from "vitest";
import {
  ELEMENT_PROXY_Z,
  NODE_GLYPH_Z,
  elementPickProxy,
} from "./pickProxy";

describe("elementPickProxy", () => {
  it("centres the proxy on the Element's midpoint", () => {
    const proxy = elementPickProxy(1, 2, 5, 6);
    expect(proxy.position[0]).toBe(3);
    expect(proxy.position[1]).toBe(4);
  });

  it("centres the proxy on the midpoint for negative coordinates too", () => {
    const proxy = elementPickProxy(-4, -2, 2, 6);
    expect(proxy.position[0]).toBe(-1);
    expect(proxy.position[1]).toBe(2);
  });

  it("sits below the Node glyph so a shared endpoint resolves to the Node", () => {
    expect(ELEMENT_PROXY_Z).toBeLessThan(NODE_GLYPH_Z);
    expect(elementPickProxy(0, 0, 1, 0).position[2]).toBe(ELEMENT_PROXY_Z);
  });

  it("leaves a horizontal Element unrotated", () => {
    expect(elementPickProxy(0, 0, 4, 0).rotation).toEqual([0, 0, 0]);
  });

  it("rotates a vertical Element a quarter turn", () => {
    expect(elementPickProxy(0, 0, 0, 4).rotation[2]).toBeCloseTo(
      Math.PI / 2,
      12,
    );
  });

  it("rotates by atan2(dy, dx), not atan2(dx, dy)", () => {
    // A 1:2 slope separates the two argument orders: atan2(2,1) = 1.107,
    // atan2(1,2) = 0.4636.
    expect(elementPickProxy(0, 0, 1, 2).rotation[2]).toBeCloseTo(
      Math.atan2(2, 1),
      12,
    );
  });

  it("rotates a downward-right Element negatively", () => {
    expect(elementPickProxy(0, 0, 3, -3).rotation[2]).toBeCloseTo(
      -Math.PI / 4,
      12,
    );
  });

  it("uses the Element's full length as the plane's width", () => {
    expect(elementPickProxy(0, 0, 3, 4).length).toBe(5);
    expect(elementPickProxy(2, 2, 2, 7).length).toBe(5);
  });

  it("degenerates safely for a zero-length Element", () => {
    const proxy = elementPickProxy(2, 2, 2, 2);
    expect(proxy.length).toBe(0);
    expect(proxy.position[0]).toBe(2);
    expect(Number.isFinite(proxy.rotation[2])).toBe(true);
  });
});

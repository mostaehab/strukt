import { describe, expect, it } from "vitest";
import { canConnect } from "./geometry";
import type { StructuralNode } from "./types";

function makeNode(id: string, x: number, y: number): StructuralNode {
  return { id, x, y, support: "FREE", fx: 0, fy: 0, mz: 0 };
}

describe("canConnect", () => {
  const nodes: StructuralNode[] = [
    makeNode("a", 0, 0),
    makeNode("b", 1, 0),
    makeNode("c", 0, 0), // coincident with "a"
  ];

  it("blocks connecting a Node to itself", () => {
    expect(canConnect(nodes, "a", "a")).toBe(false);
  });

  it("blocks connecting two distinct Nodes at coincident coordinates", () => {
    expect(canConnect(nodes, "a", "c")).toBe(false);
  });

  it("allows connecting two distinct, non-coincident Nodes", () => {
    expect(canConnect(nodes, "a", "b")).toBe(true);
  });

  it("returns false when the start Node id does not exist", () => {
    expect(canConnect(nodes, "missing", "a")).toBe(false);
  });

  it("returns false when the end Node id does not exist", () => {
    expect(canConnect(nodes, "a", "missing")).toBe(false);
  });
});

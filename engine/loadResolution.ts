import type { Load } from "./types";

/**
 * Resolved force components in the global frame -- positive x rightward,
 * positive y upward (AD-10). Newtons for a Node (concentrated Loads), newtons
 * per metre for an Element (UDLs).
 */
export interface ResolvedLoad {
  x: number;
  y: number;
}

/**
 * Vector-sums every Load matching a predicate.
 *
 * Each Load contributes `magnitude * direction`, so two Loads on one target sum
 * and opposing Loads cancel -- the derived replacement for the per-Node force
 * scalars `StructuralNode` no longer carries, which could only ever hold one
 * value and so had to be overwritten (AD-10 forbids re-accumulating into a
 * field, so the total is computed on read instead).
 */
function sumLoads(
  loads: Load[],
  matches: (load: Load) => boolean,
): ResolvedLoad {
  let x = 0;
  let y = 0;
  for (const load of loads) {
    if (!matches(load)) continue;
    x += load.magnitude * load.direction[0];
    y += load.magnitude * load.direction[1];
  }
  return { x, y };
}

/**
 * Total force on one Node, in newtons. Pure and framework-free (AD-1) so
 * Story 1.5 assembles its force vector from a unit-tested function instead of
 * re-summing inline.
 *
 * Matches on the Load's *target*, not its `kind`: the target is what a Node
 * owns, and a Load pointing at an Element is that Element's, whatever it is
 * labelled. A Node with no Loads resolves to a genuine zero.
 */
export function resolveNodeLoad(loads: Load[], nodeId: string): ResolvedLoad {
  return sumLoads(
    loads,
    (load) => load.target.type === "node" && load.target.nodeId === nodeId,
  );
}

/**
 * Total distributed load on one Element, in newtons per metre. Same summing
 * rule as `resolveNodeLoad`; never mixes in a Load targeting one of the
 * Element's end Nodes, which belongs to that Node.
 */
export function resolveElementLoad(
  loads: Load[],
  elementId: string,
): ResolvedLoad {
  return sumLoads(
    loads,
    (load) =>
      load.target.type === "element" && load.target.elementId === elementId,
  );
}

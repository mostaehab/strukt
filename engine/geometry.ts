import type { StructuralNode } from "./types";

/**
 * Determines whether a new Element is allowed to connect two Nodes.
 *
 * Blocks:
 * - self-connection (start and end reference the same Node id)
 * - coincident connection (two distinct Nodes occupying the same position)
 *
 * Pure and framework-free (AD-1) so it can be reused outside the canvas
 * (e.g. a future import/paste entry point) and unit-tested without React.
 */
export function canConnect(
  nodes: StructuralNode[],
  startNodeId: string,
  endNodeId: string,
): boolean {
  if (startNodeId === endNodeId) {
    return false;
  }

  const start = nodes.find((node) => node.id === startNodeId);
  const end = nodes.find((node) => node.id === endNodeId);

  if (!start || !end) {
    return false;
  }

  if (start.x === end.x && start.y === end.y) {
    return false;
  }

  return true;
}

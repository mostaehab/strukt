import { SUPPORTS } from "./constants";
import type {
  SolveError,
  StructuralElement,
  StructuralNode,
  StructureType,
} from "./types";

/**
 * Structural stability checks that run before assembly (FR-11).
 *
 * Pure and framework-free (AD-1). These are the cheap checks, done first
 * because they can name the responsible Node or region -- which the epic's
 * Voice rules require and which a bare singular-matrix result cannot do. The
 * singular-system check in `stiffness.ts` is the backstop for degenerate cases
 * these miss, such as three parallel rollers: countable restraints that still
 * leave the structure free to move.
 */

/** Rigid-body freedoms a disconnected piece of structure has in 2D. */
const PLANAR_RIGID_BODY_DOF = 3;

/** How many DOF a single Support restrains, given the Structure Type. */
function restraintsFrom(
  support: StructuralNode["support"],
  structureType: StructureType,
): number {
  const flags = SUPPORTS[support];
  let count = 0;
  if (flags.u_x) count += 1;
  if (flags.u_y) count += 1;
  // A Truss Node has no rotational freedom to restrain, so a Fixed support on
  // a Truss restrains two DOF, not three.
  if (structureType === "FRAME" && flags.theta_z) count += 1;
  return count;
}

/**
 * Groups Nodes into connected components by Element adjacency.
 *
 * Returned in first-appearance order, and every Node appears in exactly one
 * component -- an isolated Node is its own component of one, which is how a
 * loaded-but-unconnected Node gets reported rather than silently ignored.
 */
export function connectedComponents(
  nodes: StructuralNode[],
  elements: StructuralElement[],
): string[][] {
  const parent = new Map<string, string>();
  for (const node of nodes) parent.set(node.id, node.id);

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    // Path compression, so a long chain of Elements doesn't make this quadratic.
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor) as string;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  for (const element of elements) {
    // An Element referencing a Node that no longer exists can't join anything.
    if (!parent.has(element.startNode) || !parent.has(element.endNode)) continue;
    const a = find(element.startNode);
    const b = find(element.endNode);
    if (a !== b) parent.set(a, b);
  }

  const groups = new Map<string, string[]>();
  for (const node of nodes) {
    const root = find(node.id);
    const group = groups.get(root);
    if (group) group.push(node.id);
    else groups.set(root, [node.id]);
  }
  return [...groups.values()];
}

/**
 * Checks the structure can be solved at all.
 *
 * Order matters: zero Elements first, because "nothing to analyze yet" is a
 * different message from instability and the epic is explicit that it must not
 * read as one. Then per-component restraint sufficiency, so the error names
 * the piece that can float away rather than the structure as a whole.
 *
 * `nodeLabel` maps a Node id to the name a student reads (`N1`), so no message
 * ever quotes a UUID.
 */
export function checkStability(
  nodes: StructuralNode[],
  elements: StructuralElement[],
  structureType: StructureType,
  nodeLabel: (nodeId: string) => string,
): SolveError[] {
  if (elements.length === 0) {
    return [
      {
        code: "NOTHING_TO_ANALYZE",
        message:
          "Nothing to analyze yet. Draw at least one Element between two Nodes, then Solve.",
      },
    ];
  }

  const errors: SolveError[] = [];
  const supportOf = new Map(nodes.map((node) => [node.id, node.support]));
  const memberCount = new Map<string, number>();
  if (structureType === "TRUSS") {
    // Which component each Node belongs to, so members can be counted per
    // component rather than across the whole structure.
    const componentOf = new Map<string, number>();
    connectedComponents(nodes, elements).forEach((component, index) => {
      for (const nodeId of component) componentOf.set(nodeId, index);
    });
    for (const element of elements) {
      const index = componentOf.get(element.startNode);
      if (index === undefined) continue;
      memberCount.set(String(index), (memberCount.get(String(index)) ?? 0) + 1);
    }
  }

  connectedComponents(nodes, elements).forEach((component, index) => {
    const restraints = component.reduce(
      (total, nodeId) =>
        total + restraintsFrom(supportOf.get(nodeId) ?? "FREE", structureType),
      0,
    );

    // A pin-jointed truss needs `m + r >= 2j` to be stable: every joint has two
    // freedoms and every member removes one. A frame's rigid joints make the
    // member count a different question, so only the rigid-body check applies
    // there -- `stiffness.ts`'s singular-system check is the backstop for both.
    if (structureType === "TRUSS") {
      const members = memberCount.get(String(index)) ?? 0;
      const joints = component.length;
      if (members + restraints < 2 * joints) {
        errors.push({
          code: "COMPONENT_UNRESTRAINED",
          message: `Can't solve: the Truss around Node ${nodeLabel(component[0])} is a mechanism -- it has too few members or Supports to hold its shape. Add a member or another Support to continue.`,
          nodeId: component[0],
        });
        return;
      }
    }

    if (restraints >= PLANAR_RIGID_BODY_DOF) return;

    // A single unrestrained Node is the common case and the most actionable
    // message; a larger floating region names one Node as the place to start.
    if (component.length === 1) {
      errors.push({
        code: "NODE_UNRESTRAINED",
        message: `Can't solve: Node ${nodeLabel(component[0])} is unrestrained. Assign a Support (Fixed, Hinged, or Roller) to continue.`,
        nodeId: component[0],
      });
      return;
    }

    errors.push({
      code: "COMPONENT_UNRESTRAINED",
      message: `Can't solve: the region containing Node ${nodeLabel(component[0])} isn't restrained enough to hold still. Assign a Support (Fixed, Hinged, or Roller) to a Node in it to continue.`,
      nodeId: component[0],
    });
  });

  return errors;
}

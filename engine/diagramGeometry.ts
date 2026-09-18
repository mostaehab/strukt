import type { DiagramKind, ElementDiagram } from "./diagrams";
import type { StructuralElement, StructuralNode } from "./types";

/**
 * Projects each member's local-frame diagram onto the structure's real
 * geometry, so a Frame's BMD is drawn across the actual frame rather than on a
 * fictional straight axis.
 *
 * Pure and framework-free (AD-1), and derived entirely from `diagrams.ts`'s
 * samples -- nothing here re-derives an internal force (AD-3).
 *
 * Why this module exists: laying members end to end on one horizontal strip is
 * the correct picture for a Beam, whose members are collinear by construction,
 * and a meaningless one for anything else. A portal frame drawn that way
 * becomes a 14 m "beam" that does not exist, with no way to tell which stretch
 * of the curve is the column and which the beam.
 */

export interface Point {
  /** World metres. y is up, as in the model -- the renderer flips it. */
  x: number;
  y: number;
}

export interface MemberProjection {
  elementId: string;
  start: Point;
  end: Point;
  /** The diagram ordinate, one point per sample. */
  ordinate: Point[];
  /** Closed region between the member and its ordinate, for the fill. */
  region: Point[];
}

export interface ProjectedDiagram {
  members: MemberProjection[];
  /** Covers the structure and every ordinate, so nothing is clipped. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Metres of ordinate per unit of value. Zero when every sample is zero. */
  scale: number;
}

/**
 * Peak ordinate as a fraction of the structure's own size.
 *
 * Relative rather than absolute so a 0.5 m truss and a 50 m frame draw the
 * same shape -- the diagram is read for its form and its labelled peaks, and
 * an ordinate in metres would swamp one and vanish on the other.
 */
const ORDINATE_FRACTION = 0.22;

/**
 * Which side of the member a positive value is plotted on.
 *
 * Moment is negated because the civil convention draws the BMD on the tension
 * side: the engine reports sagging positive (`diagrams.ts`), and a sagging
 * member is in tension on the face away from its local +y normal. So a simply
 * supported beam's parabola hangs below the member and a hogging support
 * moment sits above it, which is how a student draws it by hand.
 *
 * Shear and axial carry no such convention and plot on the +y side directly.
 */
const SIDE: Record<DiagramKind, number> = { moment: -1, shear: 1, axial: 1 };

/**
 * The member's own local +y, in global coordinates.
 *
 * This is what makes draw direction stop mattering. Reversing a member negates
 * both its sampled values and this normal, and the two cancel -- so a
 * symmetric portal frame draws symmetrically even though a student draws one
 * column bottom-up and the other top-down.
 */
function normalOf(dx: number, dy: number, length: number): Point {
  return { x: -dy / length, y: dx / length };
}

export function projectDiagrams(
  nodes: StructuralNode[],
  elements: StructuralElement[],
  diagrams: ElementDiagram[],
  kind: DiagramKind,
): ProjectedDiagram {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const elementById = new Map(elements.map((element) => [element.id, element]));

  const empty = {
    members: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    scale: 0,
  };
  if (nodes.length === 0) return empty;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (point: Point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  };
  for (const node of nodes) grow(node);

  // Scale from the structure's extent and the whole diagram's peak, decided
  // once for every member so their ordinates stay comparable to each other.
  const span = Math.max(maxX - minX, maxY - minY, 1);
  let peak = 0;
  for (const diagram of diagrams) {
    for (const sample of diagram[kind]) {
      peak = Math.max(peak, Math.abs(sample.value));
    }
  }
  const scale = peak === 0 ? 0 : (span * ORDINATE_FRACTION) / peak;
  const side = SIDE[kind];

  const members: MemberProjection[] = [];

  for (const diagram of diagrams) {
    const element = elementById.get(diagram.elementId);
    if (!element) continue;
    const startNode = nodeById.get(element.startNode);
    const endNode = nodeById.get(element.endNode);
    if (!startNode || !endNode) continue;

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;

    const axis = { x: dx / length, y: dy / length };
    const normal = normalOf(dx, dy, length);

    const ordinate = diagram[kind].map((sample) => {
      const offset = sample.value * scale * side;
      const point = {
        x: startNode.x + axis.x * sample.x + normal.x * offset,
        y: startNode.y + axis.y * sample.x + normal.y * offset,
      };
      grow(point);
      return point;
    });

    members.push({
      elementId: diagram.elementId,
      start: { x: startNode.x, y: startNode.y },
      end: { x: endNode.x, y: endNode.y },
      ordinate,
      // Closed back along the member itself, so the fill is the area between
      // the curve and the member rather than a shape closed through the origin.
      region:
        ordinate.length === 0
          ? []
          : [
              { x: startNode.x, y: startNode.y },
              ...ordinate,
              { x: endNode.x, y: endNode.y },
            ],
    });
  }

  return { members, bounds: { minX, minY, maxX, maxY }, scale };
}

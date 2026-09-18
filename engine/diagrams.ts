import { resolveElementLoad } from "./loadResolution";
import type {
  ElementForce,
  Load,
  StructuralElement,
  StructuralNode,
  StructureType,
} from "./types";

/**
 * Internal-force distributions along each member, for the BMD, SFD and NFD.
 *
 * Pure and framework-free (AD-1). Derived from the solver's member end actions
 * and the member's own distributed load -- nothing here re-runs any part of the
 * solve (AD-3).
 *
 * Sampling matters: under a UDL the shear is linear and the moment quadratic,
 * so reading only the two member ends would draw a straight line between two
 * correct endpoints and miss the midspan peak entirely -- which is exactly the
 * value a student is checking by hand.
 */

/** Points sampled along a member, enough to render a parabola smoothly. */
const SAMPLES_PER_ELEMENT = 21;

export interface DiagramSample {
  /** Distance from the member's start Node, in metres. */
  x: number;
  value: number;
}

export interface DiagramPeak {
  value: number;
  /** Distance from the member's start Node, in metres. */
  at: number;
  elementId: string;
}

export interface ElementDiagram {
  elementId: string;
  length: number;
  /** Axial force, positive in tension. */
  axial: DiagramSample[];
  shear: DiagramSample[];
  moment: DiagramSample[];
}

/** The three distributions, named so a consumer can pick one generically. */
export type DiagramKind = "moment" | "shear" | "axial";

export interface DiagramSet {
  elements: ElementDiagram[];
  /** Peak positive and negative across the whole structure, with location. */
  axialPeaks: { max: DiagramPeak | null; min: DiagramPeak | null };
  shearPeaks: { max: DiagramPeak | null; min: DiagramPeak | null };
  momentPeaks: { max: DiagramPeak | null; min: DiagramPeak | null };
}

interface MemberGeometry {
  length: number;
  cos: number;
  sin: number;
}

function geometryOf(
  element: StructuralElement,
  nodeById: Map<string, StructuralNode>,
): MemberGeometry | null {
  const start = nodeById.get(element.startNode);
  const end = nodeById.get(element.endNode);
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  return { length, cos: dx / length, sin: dy / length };
}

/**
 * Samples one member's three distributions.
 *
 * The sign convention is the classroom one -- sagging moment positive -- and is
 * pinned by `diagrams.test.ts` against closed-form values (`wL^2/8` sagging at
 * the midspan of a simply supported beam, `wL^2/2` hogging at a cantilever's
 * fixed end) rather than asserted from the end-action signs, which a flipped
 * derivation would satisfy just as convincingly upside-down.
 *
 * `V = dM/dx` holds by construction: both come from the same integration, so
 * the two diagrams can never disagree about where the moment turns over.
 */
export function sampleElement(
  element: StructuralElement,
  force: ElementForce,
  geometry: MemberGeometry,
  structureType: StructureType,
  loads: Load[],
): ElementDiagram {
  const { length, cos, sin } = geometry;
  const resolved = resolveElementLoad(loads, element.id);
  // Into the member's own frame: along it, and across it.
  const along = resolved.x * cos + resolved.y * sin;
  const across = -resolved.x * sin + resolved.y * cos;

  const axial: DiagramSample[] = [];
  const shear: DiagramSample[] = [];
  const moment: DiagramSample[] = [];

  const positions = samplePositions(length, across, force.shearStart);

  for (const x of positions) {
    // Axial equilibrium of the segment beyond x: the end action plus whatever
    // the distributed load adds over the remaining length.
    axial.push({ x, value: force.axial + along * (length - x) });

    if (structureType === "TRUSS") {
      // A Truss member carries axial force only -- no bending to report, and
      // saying so explicitly beats leaving the arrays empty.
      shear.push({ x, value: 0 });
      moment.push({ x, value: 0 });
      continue;
    }

    // Moments about the cut, taking the segment from the start Node to x: the
    // start moment acts as a couple, the start shear at distance x, and the
    // distributed load's resultant at x/2. Reported so that dM/dx = V, which is
    // the convention a student's own diagrams follow.
    shear.push({ x, value: force.shearStart + across * x });
    moment.push({
      x,
      value: -force.momentStart + force.shearStart * x + (across * x * x) / 2,
    });
  }

  return { elementId: element.id, length, axial, shear, moment };
}

/**
 * Even sampling, plus the point where the shear crosses zero.
 *
 * That crossing is where the moment turns over, so without it the reported
 * peak would be the nearest sample rather than the true maximum -- off by
 * however coarse the sampling happens to be, and wrong in exactly the place a
 * student is looking.
 */
function samplePositions(
  length: number,
  across: number,
  shearStart: number,
): number[] {
  const positions: number[] = [];
  for (let i = 0; i < SAMPLES_PER_ELEMENT; i += 1) {
    positions.push((length * i) / (SAMPLES_PER_ELEMENT - 1));
  }
  if (across !== 0) {
    const stationary = -shearStart / across;
    if (stationary > 0 && stationary < length) positions.push(stationary);
  }
  return positions.sort((a, b) => a - b);
}

/**
 * Largest positive and largest negative sample, with where each occurs.
 *
 * A distribution that is zero everywhere has no peak, and both sides come back
 * null rather than naming whichever member happened to be sampled first. That
 * case is not hypothetical: a Truss carries no bending at all, so its shear and
 * moment arrays are zero by construction, and reporting `0.0 kN.m at 0.00 m
 * along E1` states a fact about E1 that is true of every member equally -- it
 * reads as a computed result when nothing was computed.
 */
export function peaksOf(
  diagrams: ElementDiagram[],
  pick: (diagram: ElementDiagram) => DiagramSample[],
): { max: DiagramPeak | null; min: DiagramPeak | null } {
  let max: DiagramPeak | null = null;
  let min: DiagramPeak | null = null;
  let anyNonZero = false;

  for (const diagram of diagrams) {
    for (const sample of pick(diagram)) {
      if (sample.value !== 0) anyNonZero = true;
      if (max === null || sample.value > max.value) {
        max = { value: sample.value, at: sample.x, elementId: diagram.elementId };
      }
      if (min === null || sample.value < min.value) {
        min = { value: sample.value, at: sample.x, elementId: diagram.elementId };
      }
    }
  }
  return anyNonZero ? { max, min } : { max: null, min: null };
}

/** Every member's diagrams, plus the structure-wide peaks FR-12/13 label. */
export function structureDiagrams(
  nodes: StructuralNode[],
  elements: StructuralElement[],
  loads: Load[],
  structureType: StructureType,
  elementForces: Record<string, ElementForce>,
): DiagramSet {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const diagrams: ElementDiagram[] = [];

  for (const element of elements) {
    const geometry = geometryOf(element, nodeById);
    const force = elementForces[element.id];
    if (!geometry || !force) continue;
    diagrams.push(
      sampleElement(element, force, geometry, structureType, loads),
    );
  }

  return {
    elements: diagrams,
    axialPeaks: peaksOf(diagrams, (d) => d.axial),
    shearPeaks: peaksOf(diagrams, (d) => d.shear),
    momentPeaks: peaksOf(diagrams, (d) => d.moment),
  };
}

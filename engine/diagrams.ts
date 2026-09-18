import { elementPointLoads, resolveElementLoad } from "./loadResolution";
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

/**
 * Share of a distribution's own peak below which an extreme is treated as zero.
 *
 * Far below any real result and far above solver round-off, so it separates
 * "this side of the diagram does not exist" from "this side is small".
 */
const NEGLIGIBLE = 1e-9;

/**
 * How close two stations must be, relative to the member's length, to count as
 * the same place. Scale-free, so it means the same on a 0.5 m member and a
 * 50 m one.
 */
const POSITION_TOLERANCE = 1e-9;

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
/** One point Load, resolved into the member's own frame. */
interface LocalPointLoad {
  /** Metres from the member's start. */
  at: number;
  /** Component along the member, newtons. */
  along: number;
  /** Component across the member, newtons. */
  across: number;
}

/** A station to evaluate at, and which side of a step to read there. */
interface Station {
  x: number;
  /**
   * Whether a point Load sitting exactly at `x` counts as passed. A step in
   * the shear needs both readings -- the value just before the load and just
   * after -- or the diagram draws a ramp through a discontinuity that is real.
   */
  after: boolean;
}

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

  const points: LocalPointLoad[] = elementPointLoads(loads, element.id)
    .map((load) => ({
      at: load.position,
      along: load.magnitude * (load.direction[0] * cos + load.direction[1] * sin),
      across:
        load.magnitude * (-load.direction[0] * sin + load.direction[1] * cos),
    }))
    .sort((a, b) => a.at - b.at);

  const epsilon = length * POSITION_TOLERANCE;
  const passed = (station: Station, at: number) =>
    station.after ? at <= station.x + epsilon : at < station.x - epsilon;

  const axial: DiagramSample[] = [];
  const shear: DiagramSample[] = [];
  const moment: DiagramSample[] = [];

  for (const station of samplePositions(length, across, force.shearStart, points)) {
    const { x } = station;

    // Axial equilibrium of the segment beyond x: the end action, whatever the
    // distributed load adds over the remaining length, and any point Load
    // still ahead of the cut.
    let ahead = 0;
    for (const point of points) {
      if (!passed(station, point.at)) ahead += point.along;
    }
    axial.push({ x, value: force.axial + along * (length - x) + ahead });

    // Moments about the cut, taking the segment from the start Node to x: the
    // start moment acts as a couple, the start shear at distance x, the
    // distributed load's resultant at x/2, and each passed point Load at its
    // own lever arm. Reported so that dM/dx = V, which is the convention a
    // student's own diagrams follow.
    let stepShear = 0;
    let stepMoment = 0;
    for (const point of points) {
      if (!passed(station, point.at)) continue;
      stepShear += point.across;
      stepMoment += point.across * (x - point.at);
    }

    shear.push({ x, value: force.shearStart + across * x + stepShear });
    moment.push({
      x,
      value:
        -force.momentStart +
        force.shearStart * x +
        (across * x * x) / 2 +
        stepMoment,
    });
  }

  return { elementId: element.id, length, axial, shear, moment };
}

/**
 * Even sampling, both sides of every point Load, and every shear zero.
 *
 * The zero crossing is where the moment turns over, so without it the reported
 * peak would be the nearest sample rather than the true maximum. It is solved
 * segment by segment because a point Load steps the shear: a single crossing
 * derived from the member's end values would be wrong wherever one exists, and
 * a member can have a crossing in more than one segment.
 */
function samplePositions(
  length: number,
  across: number,
  shearStart: number,
  points: LocalPointLoad[],
): Station[] {
  const epsilon = length * POSITION_TOLERANCE;
  const interior = points
    .map((point) => point.at)
    .filter((at) => at > epsilon && at < length - epsilon);

  const stations: Station[] = [];
  for (let i = 0; i < SAMPLES_PER_ELEMENT; i += 1) {
    const x = (length * i) / (SAMPLES_PER_ELEMENT - 1);
    // Skipped where a point Load already contributes its own pair, so a
    // station never appears three times.
    if (interior.some((at) => Math.abs(at - x) <= epsilon)) continue;
    stations.push({ x, after: true });
  }

  for (const at of interior) {
    stations.push({ x: at, after: false });
    stations.push({ x: at, after: true });
  }

  if (across !== 0) {
    const breaks = [0, ...interior, length];
    // Point Loads already behind the start of the current segment.
    let stepped = 0;
    for (let i = 0; i < breaks.length - 1; i += 1) {
      const from = breaks[i];
      const to = breaks[i + 1];
      if (i > 0) {
        for (const point of points) {
          if (Math.abs(point.at - from) <= epsilon) stepped += point.across;
        }
      }
      const crossing = -(shearStart + stepped) / across;
      if (crossing > from && crossing < to) {
        stations.push({ x: crossing, after: true });
      }
    }
  }

  // Ties resolve left-limit first, so a step is drawn in the direction the
  // member is read rather than backwards.
  return stations.sort((a, b) =>
    a.x === b.x ? Number(a.after) - Number(b.after) : a.x - b.x,
  );
}

/**
 * Largest positive and largest negative sample, with where each occurs.
 *
 * An extreme of exactly zero is not reported. Zero is where the diagram meets
 * its member, not a peak of it: a purely sagging beam touches zero at both
 * pinned ends, and `0.0 kN.m at 0.00 m along E1` names one of them as though a
 * search had found it. A Truss makes the same point at full size -- it carries
 * no bending at all, so both its shear and moment arrays are zero by
 * construction and neither side has anything to report.
 */
export function peaksOf(
  diagrams: ElementDiagram[],
  pick: (diagram: ElementDiagram) => DiagramSample[],
): { max: DiagramPeak | null; min: DiagramPeak | null } {
  let max: DiagramPeak | null = null;
  let min: DiagramPeak | null = null;

  for (const diagram of diagrams) {
    for (const sample of pick(diagram)) {
      if (max === null || sample.value > max.value) {
        max = { value: sample.value, at: sample.x, elementId: diagram.elementId };
      }
      if (min === null || sample.value < min.value) {
        min = { value: sample.value, at: sample.x, elementId: diagram.elementId };
      }
    }
  }
  // Relative to the distribution's own magnitude, never an absolute figure: a
  // simply supported beam's support moment is zero in theory and about 1e-12
  // in floating point, and no fixed threshold in N.m can tell that apart from
  // a real result on a structure of unknown size.
  const largest = Math.max(Math.abs(max?.value ?? 0), Math.abs(min?.value ?? 0));
  const meaningful = (peak: DiagramPeak | null) =>
    peak && Math.abs(peak.value) > largest * NEGLIGIBLE ? peak : null;

  return { max: meaningful(max), min: meaningful(min) };
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

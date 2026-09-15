import type {
  ConcentratedLoad,
  DistributedLoad,
  ElementLoadTarget,
  Load,
  LoadKind,
  LoadTarget,
  NodeLoadTarget,
  StructuralElement,
} from "./types";

/**
 * The four global-frame axis unit vectors, keyed by the label the properties
 * panel offers. Positive x is rightward and positive y is upward (AD-10) --
 * the one convention every consumer reads against, so a Load's direction is
 * never re-derived from a local frame.
 *
 * A Load stores an arbitrary unit vector; these are only the directions the
 * panel can *enter*. Storage stays deliberately more expressive than the input.
 */
export const AXIS_DIRECTIONS = {
  "+x": [1, 0],
  "-x": [-1, 0],
  "+y": [0, 1],
  "-y": [0, -1],
} as const satisfies Record<string, readonly [number, number]>;

/** One of the four axis directions the properties panel can enter. */
export type AxisDirection = keyof typeof AXIS_DIRECTIONS;

/**
 * Builds a Load (AD-10).
 *
 * Pure and framework-free (AD-1). Two overloads rather than one free pairing:
 * the kind fixes the target type, so a UDL cannot be constructed against a
 * Node. `Load` is a union of the two legal pairings and this is its only
 * constructor, so the illegal combination has nowhere to come from.
 *
 * The body branches on the *target*, which is what actually determines the
 * shape, so both branches build a concrete union member -- no cast, and no
 * unreachable fallback to fabricate. `kind` is carried by the overloads,
 * which is where it does its work.
 *
 * `magnitude` is SI throughout -- newtons for a concentrated Load, newtons per
 * metre for a UDL (AD-4) -- so no call site can smuggle a kN value in;
 * conversion is the panel's business.
 *
 * `direction` is copied into a fresh tuple rather than stored by reference, so
 * passing a shared `AXIS_DIRECTIONS` entry can never alias four Loads onto one
 * vector. It is *not* normalised here: a Load that would be stored is
 * normalised by the store, which is the layer that decides what is storable.
 *
 * Never throws: an unusable magnitude or direction is rejected by the field
 * that produced it and again by `store/useStructureStore.ts`, not by an
 * exception from the entity constructor.
 */
export function createLoad(
  id: string,
  kind: "concentrated",
  target: NodeLoadTarget,
  magnitude: number,
  direction: readonly [number, number],
): ConcentratedLoad;
export function createLoad(
  id: string,
  kind: "udl",
  target: ElementLoadTarget,
  magnitude: number,
  direction: readonly [number, number],
): DistributedLoad;
export function createLoad(
  id: string,
  kind: LoadKind,
  target: LoadTarget,
  magnitude: number,
  direction: readonly [number, number],
): Load {
  const copied: [number, number] = [direction[0], direction[1]];
  return target.type === "node"
    ? { id, kind: "concentrated", target, magnitude, direction: copied }
    : { id, kind: "udl", target, magnitude, direction: copied };
}

/** A Load targeting one Node -- the shape a concentrated Load always takes. */
export function nodeTarget(nodeId: string): NodeLoadTarget {
  return { type: "node", nodeId };
}

/** A Load targeting one Element -- the shape a UDL always takes. */
export function elementTarget(elementId: string): ElementLoadTarget {
  return { type: "element", elementId };
}

/**
 * Normalises a direction to the unit vector AD-10 says it is, or null when it
 * has no direction at all (zero-length, or non-finite).
 *
 * Length is not a second magnitude: a Load of 5000 N with direction [0, -5000]
 * must resolve to 5000 N downward, not 25 MN. Storing the vector as given
 * would let the resolver multiply the two together silently, so the store
 * normalises on write and every reader can trust the invariant.
 *
 * A vector that is already unit-length within float tolerance is returned with
 * its components untouched: the four axis directions stay exact, and a stored
 * diagonal does not drift a digit every time it is written back.
 */
const UNIT_LENGTH_TOLERANCE = 1e-12;

export function normalizeDirection(
  direction: readonly [number, number],
): readonly [number, number] | null {
  const [x, y] = direction;
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length === 0) return null;
  if (Math.abs(length - 1) <= UNIT_LENGTH_TOLERANCE) return [x, y];
  return [x / length, y / length];
}

/**
 * The ids of every Element a Node's deletion takes with it -- an Element
 * cannot reference a Node that no longer exists.
 *
 * Shared by the store's cascade and by the delete confirmation that has to
 * name what is about to go, so the two can never disagree about what a delete
 * removes.
 */
export function elementIdsOnNode(
  elements: StructuralElement[],
  nodeId: string,
): Set<string> {
  return new Set(
    elements
      .filter((e) => e.startNode === nodeId || e.endNode === nodeId)
      .map((e) => e.id),
  );
}

/**
 * Every Load a Node's deletion takes with it: the Loads on the Node itself,
 * and the UDLs on each Element the cascade removes with it. Two levels, so no
 * orphaned Load can survive pointing at either.
 */
export function loadsRemovedWithNode(
  loads: Load[],
  elements: StructuralElement[],
  nodeId: string,
): Load[] {
  const removedElementIds = elementIdsOnNode(elements, nodeId);
  return loads.filter((load) =>
    load.target.type === "node"
      ? load.target.nodeId === nodeId
      : removedElementIds.has(load.target.elementId),
  );
}

/**
 * Every Load an Element's deletion takes with it: its own UDLs. Loads on its
 * end Nodes belong to those Nodes and stay.
 */
export function loadsRemovedWithElement(
  loads: Load[],
  elementId: string,
): Load[] {
  return loads.filter(
    (load) =>
      load.target.type === "element" && load.target.elementId === elementId,
  );
}

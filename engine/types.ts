export type StructureType = "TRUSS" | "FRAME";

export type Support = "FIXED" | "HINGE" | "ROLLER" | "FREE";

export type Material = "STEEL" | "CONCRETE";

export interface StructuralNode {
  id: string;
  x: number;
  y: number;
  support: Support;
}

export type LoadKind = "concentrated" | "udl";

/**
 * What a Load is applied to. Discriminated on `type` so a Load can never
 * carry both a Node and an Element id, and so a cascade delete can tell the
 * two apart without guessing from `kind`.
 */
export interface NodeLoadTarget {
  type: "node";
  nodeId: string;
}

export interface ElementLoadTarget {
  type: "element";
  elementId: string;
}

export type LoadTarget = NodeLoadTarget | ElementLoadTarget;

interface LoadCommon {
  id: string;
  /**
   * SI, AD-4: newtons for a concentrated Load, newtons per metre for a UDL.
   * kN is display-only -- neither `engine/` nor `store/` holds a converted
   * value. Always positive; direction lives in `direction`, not in the sign.
   */
  magnitude: number;
  /**
   * Unit vector in the global frame -- positive x rightward, positive y upward
   * (AD-10). The properties panel exposes the four axis directions only, so
   * storage is deliberately more expressive than the input.
   *
   * `readonly` so no holder can mutate a vector already past the store's
   * validators -- a direction is replaced through `updateLoad`, never edited
   * in place.
   */
  direction: readonly [number, number];
}

/** A point force on one Node -- newtons. */
export interface ConcentratedLoad extends LoadCommon {
  kind: "concentrated";
  target: NodeLoadTarget;
}

/** A uniformly distributed load along one Element -- newtons per metre. */
export interface DistributedLoad extends LoadCommon {
  kind: "udl";
  target: ElementLoadTarget;
}

/**
 * A first-class Load (AD-10), replacing the scalar per-Node force and moment
 * fields `StructuralNode` used to carry. Multiple Loads may target the same
 * Node or Element -- each is its own list entry, never accumulated into a
 * field (FR-8/FR-9's "sum, don't overwrite"), so summing is derived on read by
 * `engine/loadResolution.ts`.
 *
 * A union of the two legal (kind, target) pairings rather than a free pairing
 * of both: a UDL on a Node would draw a single arrow labelled per-metre and
 * would be summed as a point force, so the combination is made
 * unrepresentable rather than merely undocumented. The shape of each member is
 * exactly AD-10's.
 *
 * Applied moment loads are an explicit FR-9 non-goal: there is no input-side
 * moment field here and none is reserved. `NodeResult.rmz` is the *output*
 * reaction moment and is unrelated.
 */
export type Load = ConcentratedLoad | DistributedLoad;

/**
 * The only fields an applied Load may change. `id`, `kind` and `target` are
 * immutable: rewriting an id duplicates React keys and makes `deleteLoad`
 * remove two entries, and retargeting can point a Load at an entity that no
 * longer exists -- both of which the cascade rules assume cannot happen.
 */
export interface LoadPatch {
  magnitude?: number;
  direction?: readonly [number, number];
}

export interface StructuralElement {
  id: string;
  /** null until a Material is explicitly assigned -- "unassigned" is a real state. */
  material: Material | null;
  startNode: string;
  endNode: string;
  /**
   * Pointer to the `engine/catalog/crossSections.ts` entry that produced
   * `area`/`inertia` (AD-5/AD-8). Non-null means the values came from the
   * catalog; null with non-null area/inertia means a manual override. The two
   * never coexist -- see `store/useStructureStore.ts`'s `updateElement`.
   */
  crossSectionId: string | null;
  /** Cross-sectional area in m^2 (SI, AD-4). null until assigned. */
  area: number | null;
  /** Moment of inertia in m^4 (SI, AD-4). null until assigned. */
  inertia: number | null;
}

interface NodeResult {
  ux: number;
  uy: number;
  theta_z: number;
  rx: number;
  ry: number;
  rmz: number;
}

interface ElementResult {
  axialForce: number;
  shearForce: number;
  bendingMoment: number;
  stress: number;
}

export interface AnalysisResults {
  nodeResults: Record<string, NodeResult>;
  elementResults: Record<string, ElementResult>;
}

export interface StructureState {
  type: StructureType;
  name: string;
  nodes: StructuralNode[];
  elements: StructuralElement[];
  loads: Load[];
  analysisResults?: AnalysisResults;

  addNode: (node: StructuralNode) => void;
  updateNode: (id: string, updatedNode: Partial<StructuralNode>) => void;
  deleteNode: (id: string) => void;
  addElement: (element: StructuralElement) => void;
  updateElement: (
    id: string,
    updatedElement: Partial<StructuralElement>,
  ) => void;
  deleteElement: (id: string) => void;
  /** false when the Load was refused -- the caller surfaces the rejection. */
  addLoad: (load: Load) => boolean;
  /** false when every field in the patch was refused. */
  updateLoad: (id: string, updatedLoad: LoadPatch) => boolean;
  deleteLoad: (id: string) => void;
  setStructureType: (type: StructureType) => boolean;
  setAnalysisResults: (results: AnalysisResults) => void;
  clearAll: () => void;
}

export interface EnginePayload {
  type: StructureType;
  nodes: StructuralNode[];
  elements: StructuralElement[];
  loads: Load[];
}

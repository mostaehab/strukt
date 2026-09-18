export type StructureType = "TRUSS" | "FRAME";

export type Support = "FIXED" | "HINGE" | "ROLLER" | "FREE";

export type Material = "STEEL" | "CONCRETE";

export interface StructuralNode {
  id: string;
  x: number;
  y: number;
  support: Support;
}

export type LoadKind = "concentrated" | "udl" | "point";

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
 * A point force applied along an Element, away from either end -- newtons.
 *
 * Not the same thing as a concentrated Load on a Node, and not replaceable by
 * one. On a Truss, splitting a member to put a Node under the load introduces
 * a pin mid-member, which turns the chord into a two-bar mechanism -- the
 * structure stops being solvable rather than gaining a load point. So a load
 * hung between two joints has to be a load *on the member*.
 */
export interface ElementPointLoad extends LoadCommon {
  kind: "point";
  target: ElementLoadTarget;
  /**
   * Metres from the Element's start Node, along the member. Stored in metres
   * rather than as a fraction because that is how a problem states it ("2 m
   * from A"); a Node moved afterwards can leave it past the end, which the
   * solver reports rather than silently clamping.
   */
  position: number;
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
export type Load = ConcentratedLoad | DistributedLoad | ElementPointLoad;

/**
 * The only fields an applied Load may change. `id`, `kind` and `target` are
 * immutable: rewriting an id duplicates React keys and makes `deleteLoad`
 * remove two entries, and retargeting can point a Load at an entity that no
 * longer exists -- both of which the cascade rules assume cannot happen.
 */
export interface LoadPatch {
  magnitude?: number;
  direction?: readonly [number, number];
  /** Only meaningful on a point Load; ignored on the other kinds. */
  position?: number;
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

/** Sentinel in `dofMap` for a degree of freedom this Structure Type has none of. */
export const NO_DOF = -1;

/**
 * One Element's end forces, in the member's own local frame.
 *
 * Axial is positive in tension, which is what FR-14's NFD label reads off
 * ("+12.0 kN (tension)"). Shear and moment are reported at both ends because
 * Story 1.6's SFD and BMD need the value at each end to draw the diagram
 * between them; on a Truss member all four are zero, since a truss carries
 * axial force only.
 */
export interface ElementForce {
  /** N, positive in tension. */
  axial: number;
  /** N, at the start Node. */
  shearStart: number;
  /** N, at the end Node. */
  shearEnd: number;
  /** N·m, at the start Node. */
  momentStart: number;
  /** N·m, at the end Node. */
  momentEnd: number;
}

export type SolveErrorCode =
  | "NOTHING_TO_ANALYZE"
  | "ELEMENT_NO_MATERIAL"
  | "ELEMENT_NO_SECTION"
  | "LOAD_OFF_ELEMENT"
  | "NODE_UNRESTRAINED"
  | "COMPONENT_UNRESTRAINED"
  | "SINGULAR_SYSTEM";

/**
 * A blocked Solve. `message` is always the specific, actionable text FR-11
 * requires -- never a generic string -- and names the responsible entity, whose
 * id is carried alongside so the UI can highlight it without parsing prose.
 */
export interface SolveError {
  code: SolveErrorCode;
  message: string;
  nodeId?: string;
  elementId?: string;
}

/**
 * Everything one `solve()` produces (AD-3): final answers *and* every
 * intermediate Show Steps (FR-17 to FR-19) will need, computed once. No second
 * code path ever re-derives any of this for display.
 *
 * Every per-entity field is keyed by entity id, never array index, so a result
 * survives reordering. Every numeric field is a plain number, number[] or
 * number[][] -- no mathjs Matrix crosses this boundary, which keeps the whole
 * result JSON-serialisable.
 */
export interface SolveResult {
  /** Per Node: [ux, uy, theta_z] in metres and radians. theta_z is 0 on a Truss. */
  displacements: Record<string, [number, number, number]>;
  /**
   * Per *supported* Node: [rx, ry, rmz] in newtons and newton-metres. Free
   * Nodes are absent rather than present-and-zero -- FR-15 reports Reactions at
   * supported Nodes, and an entry implies a restraint.
   */
  reactions: Record<string, [number, number, number]>;
  /** Per Element, in its local frame. */
  elementForces: Record<string, ElementForce>;
  /**
   * Per Element: the *local* stiffness matrix, which is what FR-17 displays
   * with that Element's own values substituted in. 4x4 on a Truss, 6x6 on a
   * Frame. The assembled global matrix is an implementation detail Show Steps
   * never names.
   */
  localStiffness: Record<string, number[][]>;
  /**
   * Per Node: the global DOF index of [ux, uy, theta_z], which is the mapping
   * FR-18 displays. `NO_DOF` marks a rotational slot on a Truss, which has no
   * such freedom.
   */
  dofMap: Record<string, [number, number, number]>;
  /**
   * Per Element: the global DOF indices its local matrix scatters into, in
   * local matrix order. This is the local-to-global mapping FR-18 displays.
   *
   * Carried rather than rebuilt from `dofMap` and the Element's endpoints: the
   * ordering is the assembly's own, and a consumer reconstructing it would be a
   * second statement of the same rule that could fall out of step.
   */
  elementDofs: Record<string, number[]>;
  /**
   * The assembled global stiffness matrix, before boundary conditions reduce
   * it -- the other half of what FR-18 displays. Square, of side
   * (Nodes x DOF per Node).
   *
   * Never persisted (AD-3), so its size costs memory only; a classroom-scale
   * frame is 150x150, which is large to hold but trivial beside the fact that
   * it is unreadable on screen. The panel caps what it renders.
   */
  globalStiffness: number[][];
  /**
   * The boundary-condition-reduced system FR-19 displays: the free-DOF
   * stiffness matrix, its load vector, and a human-readable label per free DOF
   * (for example `N1:ux`). `freeDofs` is carried rather than re-derived from
   * Supports at render time -- re-deriving it is the same solver drift AD-3
   * exists to prevent, through a loophole.
   */
  reducedSystem: {
    K: number[][];
    F: number[];
    freeDofs: string[];
    /**
     * The DOFs the Supports eliminated, which is what FR-19 displays. Carried
     * rather than derived: labelling them in the consumer would mean a second
     * copy of the `N1:ux` convention, and the two could silently disagree --
     * the same drift AD-3 names when it forbids re-deriving `freeDofs` from
     * Supports at render time.
     */
    restrainedDofs: string[];
  };
}

/**
 * What `solve()` hands back. A blocked Solve carries every reason it was
 * blocked, so a student fixing three incomplete Elements sees all three rather
 * than rediscovering them one Solve at a time.
 */
export type SolveOutcome =
  | { ok: true; result: SolveResult }
  | { ok: false; errors: SolveError[] };

export interface StructureState {
  type: StructureType;
  name: string;
  nodes: StructuralNode[];
  elements: StructuralElement[];
  loads: Load[];
  /**
   * The last successful Solve, or null when there is none (AD-2's renamed
   * field). Cleared by any structural edit in that edit's own action (AD-3),
   * so a displayed answer is always true of the structure on screen. Never
   * persisted (AD-3).
   */
  results: SolveResult | null;
  /** Why the last Solve was refused. Empty when nothing has been refused. */
  solveErrors: SolveError[];
  /**
   * Whether Show Steps is open (AD-2). Epic 2 renders it; the field lives here
   * now because AD-3's stale-results rule has to clear it alongside `results`,
   * and retrofitting that across nine mutations later is how it gets missed.
   */
  showSteps: boolean;

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
  /**
   * Runs the engine against the current structure and stores the outcome:
   * `results` on success, `solveErrors` on a refusal. Exactly one `solve()`
   * call per invocation -- nothing recomputes any part of the result (AD-3).
   */
  solve: () => void;
  setShowSteps: (value: boolean) => void;
  clearAll: () => void;
}

export interface EnginePayload {
  type: StructureType;
  nodes: StructuralNode[];
  elements: StructuralElement[];
  loads: Load[];
}

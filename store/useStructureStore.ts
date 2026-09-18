import { create } from "zustand";
import {
  StructureState,
  StructuralElement,
  Load,
  LoadPatch,
  Material,
} from "../engine/types";
import { solve as engineSolve } from "../engine/stiffness";
import { findCrossSection } from "../engine/catalog/crossSections";
import {
  elementIdsOnNode,
  loadsRemovedWithElement,
  loadsRemovedWithNode,
  normalizeDirection,
} from "../engine/load";

/**
 * A storable area/inertia: unassigned, or a finite positive number. The
 * properties panel rejects bad input field-level, but it is not the only
 * writer -- a loaded Project (Epic 3) or an import path patches the store
 * directly -- so the invariant is enforced here too.
 */
function isStorableProperty(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value > 0);
}

/**
 * A storable Load magnitude: finite and strictly positive. Direction lives in
 * `direction`, so a magnitude never carries a sign, and a zero-magnitude Load
 * is not a Load at all. The properties panel rejects bad input field-level, but
 * it is not the only writer -- a loaded Project (Epic 3) or an import path
 * patches the store directly -- so the invariant is enforced here too.
 */
function isStorableMagnitude(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Does the entity a Load points at actually exist?
 *
 * An orphaned Load is invisible in the panel and skipped by the canvas, yet it
 * still counts against the Structure Type guard -- a Project the user cannot
 * see a reason for and has no control to fix. Refusing it on write is the only
 * place that can be enforced for every caller.
 */
function hasTarget(load: Load, state: StructureState): boolean {
  const { target } = load;
  return target.type === "node"
    ? state.nodes.some((node) => node.id === target.nodeId)
    : state.elements.some((element) => element.id === target.elementId);
}

/**
 * Applies a Load patch field by field, under the same rejection rule as
 * `applyElementUpdate`: an unusable value is dropped from the patch rather
 * than written, so the prior value stands and a sibling's valid edit still
 * lands. Returns null when nothing in the patch was usable.
 *
 * Only `magnitude`, `direction` and `position` are read, whatever else a
 * caller passes: `id`, `kind` and `target` are immutable, and spreading the
 * patch would let an untyped caller rewrite them past every invariant here.
 */
function applyLoadUpdate(load: Load, patch: LoadPatch): Load | null {
  let next = load;

  if (patch.magnitude !== undefined && isStorableMagnitude(patch.magnitude)) {
    next = { ...next, magnitude: patch.magnitude };
  }
  if (patch.direction !== undefined) {
    // Copied and normalised, never written in by reference: the caller's array
    // must not stay reachable from store state.
    const direction = normalizeDirection(patch.direction);
    if (direction) next = { ...next, direction };
  }
  // Only a point Load has a station, and only a non-negative finite one is
  // storable. Whether it actually lands on the member is the solver's call --
  // it is the only layer that knows the member's length, and a Node dragged
  // later can invalidate a position that was fine when it was written.
  if (
    patch.position !== undefined &&
    next.kind === "point" &&
    Number.isFinite(patch.position) &&
    patch.position >= 0
  ) {
    next = { ...next, position: patch.position };
  }

  return next === load ? null : next;
}

/**
 * Resolves a `crossSectionId` for an Element of a given Material. A section
 * whose Material differs is treated as no section at all -- a Steel W-shape is
 * not a Concrete section, whatever the pointer says.
 */
function resolveSectionFor(
  crossSectionId: string | null,
  material: Material | null,
) {
  if (crossSectionId == null) return undefined;
  const section = findCrossSection(crossSectionId);
  return section && section.material === material ? section : undefined;
}

/**
 * Applies an Element patch under the Material/Cross-Section invariants, so no
 * call site can bypass them by spreading fields directly:
 *
 * 1. A catalog Cross-Section always supplies its own area/inertia, replacing a
 *    prior manual override outright -- an override never persists alongside a
 *    displayed shape name.
 * 2. Editing area/inertia by hand detaches the Element from the catalog, so
 *    `crossSectionId != null` always means "these values came from the catalog".
 *    The sibling value the user did not touch keeps its number and becomes a
 *    manual override alongside the edited one -- deliberately not discarded,
 *    because destroying data the user never touched is worse than carrying a
 *    formerly-catalog-derived number forward.
 * 3. The resulting (Material, Cross-Section) pair is re-validated after every
 *    patch shape -- including one carrying Material and section together -- so
 *    a Steel W-shape can never remain attached to a Concrete Element. Clearing
 *    the pointer clears its derived area/inertia with it. A manual override is
 *    not material-specific and has no pointer, so it survives a Material change.
 * 4. area/inertia are never stored non-positive or non-finite; such a field is
 *    dropped from the patch rather than written.
 */
function applyElementUpdate(
  element: StructuralElement,
  patch: Partial<StructuralElement>,
): StructuralElement {
  const areaEdited = patch.area !== undefined && isStorableProperty(patch.area);
  const inertiaEdited =
    patch.inertia !== undefined && isStorableProperty(patch.inertia);

  const next: StructuralElement = { ...element, ...patch };

  // Reject just the offending field, so a sibling's valid edit still lands.
  if (patch.area !== undefined && !areaEdited) next.area = element.area;
  if (patch.inertia !== undefined && !inertiaEdited) {
    next.inertia = element.inertia;
  }

  if (patch.crossSectionId !== undefined) {
    const section = resolveSectionFor(patch.crossSectionId, next.material);
    if (section) {
      next.crossSectionId = section.id;
      next.area = section.area;
      next.inertia = section.inertia;
    } else {
      // Un-picked ("none assigned"), or a pointer that is unknown or belongs to
      // the wrong Material: the Element goes back to unassigned and its
      // catalog-derived values go with it, rather than lingering as something
      // that looks like a manual override. A pre-existing manual override had
      // no pointer, so it isn't touched.
      next.crossSectionId = null;
      if (element.crossSectionId != null) {
        if (!areaEdited) next.area = null;
        if (!inertiaEdited) next.inertia = null;
      }
    }
  } else if (areaEdited || inertiaEdited) {
    next.crossSectionId = null;
  }

  // Rule 3's re-validation: runs for every patch shape rather than being gated
  // on one branch, so Material and Cross-Section can never disagree.
  if (
    next.crossSectionId != null &&
    !resolveSectionFor(next.crossSectionId, next.material)
  ) {
    next.crossSectionId = null;
    if (!areaEdited) next.area = null;
    if (!inertiaEdited) next.inertia = null;
  }

  return next;
}

/**
 * What every structural edit resets.
 *
 * AD-3's stale-results rule: an answer must never outlive the structure it was
 * computed from, and the clearing happens *in the mutation's own action* --
 * not in an effect watching the structure, which would repaint one frame
 * showing a stale result before catching up. Spread into what each mutation
 * returns so there is one statement of the rule rather than nine.
 */
function invalidated(): Pick<
  StructureState,
  "results" | "solveErrors" | "showSteps"
> {
  return { results: null, solveErrors: [], showSteps: false };
}

const useStructureStore = create<StructureState>((set, get) => ({
  type: "FRAME",
  name: "",
  nodes: [],
  elements: [],
  loads: [],
  results: null,
  solveErrors: [],
  showSteps: false,

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node], ...invalidated() })),
  updateNode: (id, updatedNode) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updatedNode } : node,
      ),
      ...invalidated(),
    })),
  deleteNode: (id) =>
    set((state) => {
      // Two-level cascade: the Node's Elements go with it, and so do the Loads
      // on the Node *and* the UDLs on each of those Elements. The rule lives
      // in `engine/load.ts` so the delete confirmation names exactly what this
      // removes.
      const removedElementIds = elementIdsOnNode(state.elements, id);
      const removedLoadIds = new Set(
        loadsRemovedWithNode(state.loads, state.elements, id).map((l) => l.id),
      );
      return {
        nodes: state.nodes.filter((n) => n.id !== id),
        // Cascade-delete: an Element can't reference a Node that no longer
        // exists.
        elements: state.elements.filter((e) => !removedElementIds.has(e.id)),
        loads: state.loads.filter((load) => !removedLoadIds.has(load.id)),
        ...invalidated(),
      };
    }),
  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
      ...invalidated(),
    })),

  updateElement: (id, updatedElement) =>
    set((state) => ({
      elements: state.elements.map((e) =>
        e.id === id ? applyElementUpdate(e, updatedElement) : e,
      ),
      ...invalidated(),
    })),
  deleteElement: (id) =>
    set((state) => {
      // A UDL can't reference an Element that no longer exists. Loads on the
      // Element's end Nodes belong to those Nodes and are untouched.
      const removedLoadIds = new Set(
        loadsRemovedWithElement(state.loads, id).map((load) => load.id),
      );
      return {
        elements: state.elements.filter((e) => e.id !== id),
        loads: state.loads.filter((load) => !removedLoadIds.has(load.id)),
        ...invalidated(),
      };
    }),
  addLoad: (load) => {
    // Reported back rather than silently dropped: the panel has a rejection
    // message for exactly this and no other way to know it happened.
    const state = get();
    const direction = normalizeDirection(load.direction);
    if (
      !isStorableMagnitude(load.magnitude) ||
      direction === null ||
      !hasTarget(load, state)
    ) {
      return false;
    }
    // A station off the front of its own member is never storable. Past the
    // far end is left to the solver, which is the only layer that knows how
    // long the member is.
    if (
      load.kind === "point" &&
      (!Number.isFinite(load.position) || load.position < 0)
    ) {
      return false;
    }
    // Each Load is its own list entry, never accumulated into a field (AD-10):
    // two Loads on one Node both persist and are summed on read by
    // `engine/loadResolution.ts`.
    set({ loads: [...state.loads, { ...load, direction }], ...invalidated() });
    return true;
  },
  updateLoad: (id, updatedLoad) => {
    const state = get();
    const load = state.loads.find((l) => l.id === id);
    if (!load) return false;
    const next = applyLoadUpdate(load, updatedLoad);
    if (!next) return false;
    set({
      loads: state.loads.map((l) => (l.id === id ? next : l)),
      ...invalidated(),
    });
    return true;
  },
  deleteLoad: (id) =>
    set((state) => ({
      loads: state.loads.filter((load) => load.id !== id),
      ...invalidated(),
    })),
  setStructureType: (type) => {
    // Guard: once any Element/Support/Load exists (a Support only ever exists
    // on a Node), changing Structure Type is blocked -- a Truss has no bending
    // stiffness to carry a Frame's Loads. The calling UI is responsible for
    // showing a warning based on the returned value.
    const { nodes, elements, loads } = get();
    if (nodes.length > 0 || elements.length > 0 || loads.length > 0) {
      return false;
    }
    // Only reachable on an empty Project, so there is nothing to invalidate --
    // reset anyway, so the rule holds without depending on that guard.
    set({ type, ...invalidated() });
    return true;
  },
  solve: () => {
    const { type, nodes, elements, loads } = get();
    const outcome = engineSolve({ type, nodes, elements, loads });
    // One solve() call, one result. A blocked Solve clears any previous answer
    // and closes Show Steps with it (FR-16) -- a refusal must not leave the
    // last successful result on screen beside it.
    set(
      outcome.ok
        ? { results: outcome.result, solveErrors: [], showSteps: false }
        : { results: null, solveErrors: outcome.errors, showSteps: false },
    );
  },
  setShowSteps: (value) => set({ showSteps: value }),
  clearAll: () =>
    set({
      type: "FRAME",
      name: "",
      nodes: [],
      elements: [],
      loads: [],
      ...invalidated(),
    }),
}));

export default useStructureStore;

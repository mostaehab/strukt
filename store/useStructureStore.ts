import { create } from "zustand";
import {
  StructureState,
  StructuralElement,
  Material,
} from "../engine/types";
import { findCrossSection } from "../engine/catalog/crossSections";

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

const useStructureStore = create<StructureState>((set, get) => ({
  type: "FRAME",
  name: "",
  nodes: [],
  elements: [],
  analysisResults: undefined,

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  updateNode: (id, updatedNode) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updatedNode } : node,
      ),
    })),
  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      // Cascade-delete: an Element can't reference a Node that no longer exists.
      elements: state.elements.filter(
        (e) => e.startNode !== id && e.endNode !== id,
      ),
    })),
  addElement: (element) =>
    set((state) => ({ elements: [...state.elements, element] })),

  updateElement: (id, updatedElement) =>
    set((state) => ({
      elements: state.elements.map((e) =>
        e.id === id ? applyElementUpdate(e, updatedElement) : e,
      ),
    })),
  deleteElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((e) => e.id !== id),
    })),
  setStructureType: (type) => {
    // Guard: once any Element/Support exists (a Support only ever exists on a
    // Node), changing Structure Type is blocked. The calling UI is
    // responsible for showing a warning based on the returned value.
    const { nodes, elements } = get();
    if (nodes.length > 0 || elements.length > 0) {
      return false;
    }
    set({ type });
    return true;
  },
  setAnalysisResults: (analysisResults) => set({ analysisResults }),
  clearAll: () =>
    set({
      type: "FRAME",
      name: "",
      nodes: [],
      elements: [],
      analysisResults: undefined,
    }),
}));

export default useStructureStore;

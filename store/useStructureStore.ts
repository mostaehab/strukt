import { create } from "zustand";
import { StructureState } from "../engine/types";

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
        e.id === id ? { ...e, ...updatedElement } : e,
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

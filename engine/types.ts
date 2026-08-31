export type StructureType = "TRUSS" | "FRAME";

export type Support = "FIXED" | "HINGE" | "ROLLER" | "FREE";

export type Material = "STEEL" | "CONCRETE";

export interface StructuralNode {
  id: string;
  x: number;
  y: number;
  support: Support;
  fx: number;
  fy: number;
  mz: number;
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
  setStructureType: (type: StructureType) => boolean;
  setAnalysisResults: (results: AnalysisResults) => void;
  clearAll: () => void;
}

export interface EnginePayload {
  type: StructureType;
  nodes: StructuralNode[];
  elements: StructuralElement[];
}

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
  material: Material;
  startNode: string;
  endNode: string;
  crossSectionArea: number;
  inertia: number;
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

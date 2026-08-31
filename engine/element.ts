import type { StructuralElement } from "./types";

/**
 * Builds a new Element with its physical properties explicitly unassigned.
 *
 * Pure and framework-free (AD-1). A new Element carries no Material, no
 * Cross-Section pointer, and no area/inertia, because "not yet assigned" is a
 * real state Solve must be able to reject (FR5/FR7). Defaulting to Steel with
 * zero area would make an unsolvable structure look solvable and feed the
 * solver a singular stiffness matrix.
 *
 * Single-sources the defaults so no call site can invent its own.
 */
export function createElement(
  id: string,
  startNode: string,
  endNode: string,
): StructuralElement {
  return {
    id,
    material: null,
    startNode,
    endNode,
    crossSectionId: null,
    area: null,
    inertia: null,
  };
}

import type {
  Load,
  SolveError,
  StructuralElement,
  StructuralNode,
  StructureType,
} from "./types";

/**
 * Pre-solve completeness checks, per Element.
 *
 * Pure and framework-free (AD-1). Runs before any assembly, because
 * `StructuralElement.area` and `.inertia` are `number | null` -- "unassigned"
 * is a real state the canvas can produce (FR-5/FR-7) and the solver must
 * refuse rather than coerce. Returns every problem it finds rather than the
 * first, so a student fixing three Elements sees all three at once.
 *
 * Messages name the Element and say what to do, per FR-11's requirement and
 * the exemplar at
 * `_bmad-output/planning-artifacts/ux-designs/ux-strukt-2026-08-30/mockups/key-canvas.html:356`.
 */

/** Positive, finite, and actually a number -- null and NaN both fail. */
function isUsableProperty(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

/**
 * Checks every Element for the properties assembly will need.
 *
 * `label` maps an Element id to the name a student reads on screen (`E1`), so
 * the message never quotes a UUID.
 */
export function validateElements(
  elements: StructuralElement[],
  structureType: StructureType,
  label: (elementId: string) => string,
): SolveError[] {
  const errors: SolveError[] = [];

  for (const element of elements) {
    const name = label(element.id);

    if (element.material === null) {
      errors.push({
        code: "ELEMENT_NO_MATERIAL",
        message: `Can't solve: Element ${name} has no Material assigned. Choose Steel or Concrete to continue.`,
        elementId: element.id,
      });
    }

    // A Truss member needs area only -- it carries no bending, so a missing
    // inertia is not a problem there and demanding one would be a dead field.
    const needsInertia = structureType === "FRAME";
    const sectionMissing =
      !isUsableProperty(element.area) ||
      (needsInertia && !isUsableProperty(element.inertia));

    if (sectionMissing) {
      errors.push({
        code: "ELEMENT_NO_SECTION",
        message: `Can't solve: Element ${name} has no Cross-Section. Pick one from the catalog or enter area and inertia directly to continue.`,
        elementId: element.id,
      });
    }

  }

  return errors;
}

/**
 * Checks every point Load actually lands on the member it is applied to.
 *
 * A point Load stores its station in metres from the start Node, so dragging
 * that Node can leave a Load hanging past the end of its own member. Clamping
 * it silently would move a load a student placed deliberately, so this reports
 * it instead and names the member and the length to fix it against.
 */
export function validateLoadPositions(
  loads: Load[],
  elements: StructuralElement[],
  nodes: StructuralNode[],
  label: (elementId: string) => string,
  formatLength: (metres: number) => string,
): SolveError[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const errors: SolveError[] = [];

  for (const load of loads) {
    if (load.kind !== "point") continue;
    const element = elementById.get(load.target.elementId);
    if (!element) continue;
    const start = nodeById.get(element.startNode);
    const end = nodeById.get(element.endNode);
    if (!start || !end) continue;

    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (
      !Number.isFinite(load.position) ||
      load.position < 0 ||
      load.position > length
    ) {
      errors.push({
        code: "LOAD_OFF_ELEMENT",
        message: `Can't solve: a Load on Element ${label(element.id)} sits ${formatLength(load.position)} along a member that is only ${formatLength(length)} long. Move it onto the member to continue.`,
        elementId: element.id,
      });
    }
  }

  return errors;
}

import type {
  Load,
  SolveError,
  StructuralElement,
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
  loads: Load[],
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

    if (structureType === "TRUSS") {
      const carriesUdl = loads.some(
        (load) =>
          load.kind === "udl" && load.target.elementId === element.id,
      );
      if (carriesUdl) {
        errors.push({
          code: "ELEMENT_TRUSS_UDL",
          message: `Can't solve: Element ${name} is a Truss member and can't carry a distributed load. Apply the Load to its end Nodes instead, or switch the Project to Frame.`,
          elementId: element.id,
        });
      }
    }
  }

  return errors;
}

"use client";

import "katex/dist/katex.min.css";
import { useMemo } from "react";
import katex from "katex";
import useStructureStore from "@/store/useStructureStore";
import useUnitStore from "@/store/useUnitStore";
import StiffnessMatrix from "./StiffnessMatrix";
import GlobalAssembly from "./GlobalAssembly";
import ReducedSystem from "./ReducedSystem";
import { elementLabel } from "@/utils/labels";
import {
  areaToDisplay,
  areaUnit,
  formatLength,
  formatScaled,
  inertiaToDisplay,
  inertiaUnit,
  lengthUnit,
} from "@/utils/units";
import { MATERIALS } from "@/engine/constants";
import type { SolveResult, StructuralElement, StructuralNode } from "@/engine/types";

/**
 * The Show Steps panel (FR-16's surface, FR-17's first content).
 *
 * Everything numeric here comes straight out of `SolveResult`. NFR8 is the
 * constraint the epic turns on -- what Show Steps displays must be exactly
 * what the solver used, so nothing is recomputed for display. The symbolic
 * formula beside each matrix is a static template with no arithmetic in it.
 */

/** Verbatim, and only for Beam-preset Projects (UX-DR11). */
const BEAM_CAPTION =
  "Beam is solved as a Frame — the matrices below use Frame notation.";

/**
 * The local stiffness matrix in symbols, so the numbers beside it are
 * recognisable rather than just large. Static LaTeX -- it computes nothing.
 */
const FRAME_FORMULA = String.raw`k_{local} = \begin{bmatrix}
\tfrac{EA}{L} & 0 & 0 & -\tfrac{EA}{L} & 0 & 0 \\
0 & \tfrac{12EI}{L^3} & \tfrac{6EI}{L^2} & 0 & -\tfrac{12EI}{L^3} & \tfrac{6EI}{L^2} \\
0 & \tfrac{6EI}{L^2} & \tfrac{4EI}{L} & 0 & -\tfrac{6EI}{L^2} & \tfrac{2EI}{L} \\
-\tfrac{EA}{L} & 0 & 0 & \tfrac{EA}{L} & 0 & 0 \\
0 & -\tfrac{12EI}{L^3} & -\tfrac{6EI}{L^2} & 0 & \tfrac{12EI}{L^3} & -\tfrac{6EI}{L^2} \\
0 & \tfrac{6EI}{L^2} & \tfrac{2EI}{L} & 0 & -\tfrac{6EI}{L^2} & \tfrac{4EI}{L}
\end{bmatrix}`;

const TRUSS_FORMULA = String.raw`k_{local} = \tfrac{EA}{L}\begin{bmatrix}
1 & 0 & -1 & 0 \\ 0 & 0 & 0 & 0 \\ -1 & 0 & 1 & 0 \\ 0 & 0 & 0 & 0
\end{bmatrix}`;

/**
 * Member length.
 *
 * The one value here computed rather than read: it is not part of
 * `SolveResult`. It is `Math.hypot` over two Node positions -- the same
 * deterministic expression `engine/stiffness.ts` uses -- so there is nothing
 * for a second code path to drift from.
 */
function memberLength(
  element: StructuralElement,
  nodeById: Map<string, StructuralNode>,
): number | null {
  const start = nodeById.get(element.startNode);
  const end = nodeById.get(element.endNode);
  if (!start || !end) return null;
  return Math.hypot(end.x - start.x, end.y - start.y);
}

interface ShowStepsPanelProps {
  results: SolveResult;
  /** Beam is stored as FRAME, so the preset can only come from the shell. */
  isBeamPreset: boolean;
}

export default function ShowStepsPanel({
  results,
  isBeamPreset,
}: ShowStepsPanelProps) {
  const nodes = useStructureStore((s) => s.nodes);
  const elements = useStructureStore((s) => s.elements);
  const structureType = useStructureStore((s) => s.type);
  const unitSystem = useUnitStore((s) => s.system);

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const isTruss = structureType === "TRUSS";

  // The symbolic template never changes for a given Structure Type, so it is
  // rendered once rather than on every re-render of the panel.
  const formulaHtml = useMemo(
    () =>
      katex.renderToString(isTruss ? TRUSS_FORMULA : FRAME_FORMULA, {
        throwOnError: false,
        displayMode: true,
      }),
    [isTruss],
  );

  return (
    <section className="show-steps" aria-label="Show Steps">
      {isBeamPreset && <p className="steps-caption">{BEAM_CAPTION}</p>}

      <h4>Local stiffness matrices</h4>
      <p className="steps-note">
        One per Element, in its own local frame, with that Element&apos;s values
        substituted in.
      </p>

      <div
        className="steps-formula"
        // Static symbolic template -- shown so the numbers below are
        // recognisable. It computes nothing.
        dangerouslySetInnerHTML={{ __html: formulaHtml }}
      />

      {elements.map((element) => {
        const matrix = results.localStiffness[element.id];
        if (!matrix) return null;
        const name = elementLabel(elements, element.id);
        const length = memberLength(element, nodeById);

        return (
          <article key={element.id} className="steps-element">
            <h5>Element {name}</h5>
            <dl className="steps-values">
              <dt>E</dt>
              <dd>
                {element.material
                  ? `${formatScaled(MATERIALS[element.material].E / 1e9, 0)} GPa`
                  : "—"}
              </dd>
              <dt>A</dt>
              <dd>
                {element.area === null
                  ? "—"
                  : `${formatScaled(areaToDisplay(element.area, unitSystem), 4)} ${areaUnit(unitSystem)}`}
              </dd>
              {!isTruss && (
                <>
                  <dt>I</dt>
                  <dd>
                    {element.inertia === null
                      ? "—"
                      : `${formatScaled(inertiaToDisplay(element.inertia, unitSystem), 6)} ${inertiaUnit(unitSystem)}`}
                  </dd>
                </>
              )}
              <dt>L</dt>
              <dd>
                {length === null
                  ? "—"
                  : `${formatLength(length, unitSystem)} ${lengthUnit(unitSystem)}`}
              </dd>
            </dl>
            <StiffnessMatrix
              matrix={matrix}
              label={`Local stiffness matrix for Element ${name}`}
            />
          </article>
        );
      })}

      <GlobalAssembly results={results} />

      <ReducedSystem results={results} />
    </section>
  );
}


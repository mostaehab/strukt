"use client";

import { useMemo } from "react";
import katex from "katex";
import useStructureStore from "@/store/useStructureStore";
import useUnitStore from "@/store/useUnitStore";
import StiffnessMatrix from "./StiffnessMatrix";
import { nodeLabel } from "@/utils/labels";
import { formatScaled, lengthToDisplay, lengthUnit } from "@/utils/units";
import { NO_DOF, type SolveResult } from "@/engine/types";

/**
 * The boundary-condition-reduced solve (FR-19).
 *
 * Three things the FR names: which DOFs the Supports eliminated, the reduced
 * system of equations itself, and how that yields the nodal displacements.
 *
 * Every value is read from `SolveResult` -- including `freeDofs` and
 * `restrainedDofs`, which AD-3 is explicit must not be re-derived from the
 * Supports at render time. Re-deriving them here would be the same solver
 * drift the rule exists to prevent, through a loophole.
 */

const AXIS_NAMES = ["ux", "uy", "theta"] as const;

interface ReducedSystemProps {
  results: SolveResult;
}

export default function ReducedSystem({ results }: ReducedSystemProps) {
  const nodes = useStructureStore((s) => s.nodes);
  const unitSystem = useUnitStore((s) => s.system);
  const { K, F, freeDofs, restrainedDofs } = results.reducedSystem;

  const equationHtml = useMemo(
    () =>
      katex.renderToString(
        String.raw`\mathbf{K}_{ff}\,\mathbf{d}_f = \mathbf{F}_f
        \quad\Longrightarrow\quad
        \mathbf{d}_f = \mathbf{K}_{ff}^{-1}\,\mathbf{F}_f`,
        { throwOnError: false, displayMode: true },
      ),
    [],
  );

  return (
    <>
      <h4>Degrees of freedom</h4>
      <p className="steps-note">
        A Support removes a degree of freedom from the system: its displacement
        is known to be zero, so its row and column leave the equations entirely
        rather than being solved for.
      </p>

      <dl className="steps-values">
        <dt>Eliminated by Supports</dt>
        <dd>{restrainedDofs.length > 0 ? restrainedDofs.join(", ") : "none"}</dd>
        <dt>Solved for</dt>
        <dd>{freeDofs.length > 0 ? freeDofs.join(", ") : "none"}</dd>
      </dl>

      <h4>Reduced system</h4>
      <p className="steps-note">
        {freeDofs.length} unknown{freeDofs.length === 1 ? "" : "s"}, ordered as
        listed above.
      </p>

      <div
        className="steps-formula"
        dangerouslySetInnerHTML={{ __html: equationHtml }}
      />

      {freeDofs.length > 0 && (
        <>
          <StiffnessMatrix
            matrix={K}
            lead={String.raw`\mathbf{K}_{ff} = `}
            label="Reduced stiffness matrix"
          />
          <StiffnessMatrix
            // A column vector is a one-column matrix; rendering it through the
            // same component keeps its formatting identical to the matrix it
            // sits beside.
            matrix={F.map((value) => [value])}
            lead={String.raw`\mathbf{F}_f = `}
            label="Reduced load vector"
          />
        </>
      )}

      <h4>Resulting displacements</h4>
      <p className="steps-note">
        Solving the reduced system gives the free displacements; the eliminated
        ones are zero by definition of their Support.
      </p>

      <table className="react-table">
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">DOF</th>
            <th scope="col">Value</th>
            <th scope="col">From</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const dofs = results.dofMap[node.id];
            const values = results.displacements[node.id];
            if (!dofs || !values) return null;

            return AXIS_NAMES.map((axis, index) => {
              // A Truss has no rotational freedom, so there is no row to show.
              if (dofs[index] === NO_DOF) return null;
              const label = `${nodeLabel(nodes, node.id)}:${axis}`;
              const eliminated = restrainedDofs.includes(label);

              return (
                <tr key={label}>
                  <th scope="row">{nodeLabel(nodes, node.id)}</th>
                  <td>{axis}</td>
                  <td>
                    {/* Translations are a length and convert with the unit
                        system; a rotation is radians, which is dimensionless
                        and the same in both. */}
                    {axis === "theta"
                      ? `${formatScaled(values[index], 6)} rad`
                      : `${formatScaled(lengthToDisplay(values[index], unitSystem), 6)} ${lengthUnit(unitSystem)}`}
                  </td>
                  <td>{eliminated ? "Support (zero)" : "solved"}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </>
  );
}

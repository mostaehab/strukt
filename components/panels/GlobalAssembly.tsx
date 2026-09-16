"use client";

import useStructureStore from "@/store/useStructureStore";
import StiffnessMatrix from "./StiffnessMatrix";
import { elementLabel, nodeLabel } from "@/utils/labels";
import { NO_DOF, type SolveResult } from "@/engine/types";

/**
 * Local-to-global assembly (FR-18): the DOF mapping, and the matrix it builds.
 *
 * Both halves are read from `SolveResult`. `elementDofs` in particular records
 * the ordering the assembly itself used, rather than the panel rebuilding it
 * from `dofMap` and the Element's endpoints -- that would be a second statement
 * of the same rule, free to fall out of step with the first.
 */

/**
 * Above this many DOFs the global matrix is shown by its shape rather than its
 * contents.
 *
 * A three-Node Frame is 9x9, which reads fine. A classroom-scale structure is
 * 150x150: some 22,500 exponential terms, which is not a matrix a student can
 * learn anything from and is slow to typeset besides. The threshold keeps the
 * teaching cases and declines the rest honestly, rather than rendering
 * something unusable and calling it a feature.
 */
const MAX_RENDERED_DOFS = 12;

const AXIS_NAMES = ["ux", "uy", "theta"] as const;

interface GlobalAssemblyProps {
  results: SolveResult;
}

export default function GlobalAssembly({ results }: GlobalAssemblyProps) {
  const nodes = useStructureStore((s) => s.nodes);
  const elements = useStructureStore((s) => s.elements);
  const size = results.globalStiffness.length;

  return (
    <>
      <h4>Degree of freedom numbering</h4>
      <p className="steps-note">
        Every Node contributes its degrees of freedom to one global numbering.
        Each Element&apos;s local matrix is then added into the rows and columns
        its own Nodes occupy.
      </p>

      <table className="react-table">
        <thead>
          <tr>
            <th scope="col">Node</th>
            {AXIS_NAMES.map((axis) => (
              <th scope="col" key={axis}>
                {axis}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const dofs = results.dofMap[node.id];
            if (!dofs) return null;
            return (
              <tr key={node.id}>
                <th scope="row">{nodeLabel(nodes, node.id)}</th>
                {dofs.map((dof, index) => (
                  <td key={index}>
                    {/* A Truss Node has no rotational freedom to number. */}
                    {dof === NO_DOF ? "—" : dof}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>Where each Element lands</h4>
      <table className="react-table">
        <thead>
          <tr>
            <th scope="col">Element</th>
            <th scope="col">Global DOFs, in local order</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((element) => {
            const dofs = results.elementDofs[element.id];
            if (!dofs) return null;
            return (
              <tr key={element.id}>
                <th scope="row">{elementLabel(elements, element.id)}</th>
                <td>{dofs.join(", ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>Assembled global matrix</h4>
      {size <= MAX_RENDERED_DOFS ? (
        <StiffnessMatrix
          matrix={results.globalStiffness}
          lead={String.raw`\mathbf{K} = `}
          label="Assembled global stiffness matrix"
        />
      ) : (
        <p className="steps-note">
          {size} × {size} — too large to read as an equation, so it is not shown.
          The Supports below reduce it to the system that was actually solved.
        </p>
      )}
    </>
  );
}

"use client";

import { useMemo } from "react";
import katex from "katex";

interface StiffnessMatrixProps {
  /** Rendered verbatim -- never recomputed for display (NFR8). */
  matrix: number[][];
  /** LaTeX shown to the left of the matrix, e.g. `k_{local}` with its factor. */
  lead?: string;
  label: string;
}

/**
 * Renders a numeric matrix as a KaTeX bmatrix.
 *
 * A stiffness matrix is an equation, not a table: reading `12EI/L³` as a
 * bracketed grid of decimals loses the structure a student is trying to
 * recognise, which is the whole point of showing the working.
 *
 * Values are formatted to three significant figures in exponential form --
 * stiffness terms span many orders of magnitude within one matrix (an axial
 * term against a rotational one), so a fixed decimal count would render half
 * the matrix as zeros.
 */
function cell(value: number): string {
  if (value === 0) return "0";
  return value.toExponential(2).replace("e", "{\times}10^{") + "}";
}

export default function StiffnessMatrix({
  matrix,
  lead,
  label,
}: StiffnessMatrixProps) {
  const html = useMemo(() => {
    const body = matrix
      .map((row) => row.map(cell).join(" & "))
      .join(" \\ ");
    const tex = `${lead ?? ""}\begin{bmatrix}${body}\end{bmatrix}`;
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode: true,
    });
  }, [matrix, lead]);

  return (
    <div
      className="stiffness-matrix"
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

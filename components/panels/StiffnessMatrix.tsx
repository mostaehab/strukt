"use client";

import { useMemo } from "react";
import katex from "katex";

interface StiffnessMatrixProps {
  /** Rendered verbatim -- never recomputed for display (NFR8). */
  matrix: number[][];
  /** LaTeX shown to the left of the matrix, e.g. `k_{local} =`. */
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
 * Every LaTeX fragment here is a `String.raw` literal. A normal string would
 * turn `\times` into a tab and `\begin` into a backspace, which KaTeX cannot
 * parse -- and with `throwOnError: false` it renders the broken source instead
 * of failing loudly, so the mistake reaches the screen looking like output.
 */

const BEGIN = String.raw`\begin{bmatrix}`;
const END = String.raw`\end{bmatrix}`;
/** LaTeX row separator: two backslashes. */
const ROW_BREAK = String.raw` \\ `;
const TIMES = String.raw`{\times}`;

/**
 * Three significant figures in exponential form.
 *
 * Stiffness terms span many orders of magnitude inside a single matrix -- an
 * axial term against a rotational one -- so a fixed decimal count would render
 * half the matrix as zeros.
 */
function cell(value: number): string {
  if (value === 0) return "0";
  const [mantissa, exponent] = value.toExponential(2).split("e");
  // Number() drops the leading "+", so the exponent reads 8 rather than +8.
  return `${mantissa}${TIMES}10^{${Number(exponent)}}`;
}

export default function StiffnessMatrix({
  matrix,
  lead,
  label,
}: StiffnessMatrixProps) {
  const html = useMemo(() => {
    const body = matrix
      .map((row) => row.map(cell).join(" & "))
      .join(ROW_BREAK);
    return katex.renderToString(`${lead ?? ""}${BEGIN}${body}${END}`, {
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

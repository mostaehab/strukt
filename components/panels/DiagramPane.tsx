"use client";

import { useMemo } from "react";
import DiagramView from "./DiagramView";
import useStructureStore from "@/store/useStructureStore";
import useUnitStore from "@/store/useUnitStore";
import { structureDiagrams, type DiagramKind } from "@/engine/diagrams";
import {
  axialForceLabel,
  forceUnit,
  formatForce,
  formatMoment,
  momentUnit,
} from "@/utils/units";

/**
 * The workspace's diagram mode: one diagram, filling the area the canvas
 * otherwise occupies.
 *
 * Thin by design -- it reads the store, picks the right formatter for the
 * quantity, and hands `DiagramView` plain data. The diagrams themselves come
 * from the one `SolveResult` the solver already produced (AD-3); nothing here
 * re-derives an internal force.
 */

/**
 * Sign conventions, stated on the drawing.
 *
 * The PRD's own review flagged that FR-12 to FR-14 never state one, which
 * leaves a student unable to tell a correct diagram from an upside-down one.
 * These are the conventions the engine actually uses, written where the
 * diagram is read rather than in a doc.
 */
const CAPTIONS: Record<DiagramKind, string> = {
  moment:
    "Bending moment, drawn on the tension side — a sagging span falls below its member, a hogging joint sits above it.",
  shear: "Shear force, positive drawn on the member's left-hand side looking from start to end.",
  axial: "Normal force, positive in tension.",
};

const TITLES: Record<DiagramKind, string> = {
  moment: "Bending moment diagram",
  shear: "Shear force diagram",
  axial: "Normal force diagram",
};

interface DiagramPaneProps {
  kind: DiagramKind;
}

export default function DiagramPane({ kind }: DiagramPaneProps) {
  const results = useStructureStore((s) => s.results);
  const nodes = useStructureStore((s) => s.nodes);
  const elements = useStructureStore((s) => s.elements);
  const loads = useStructureStore((s) => s.loads);
  const structureType = useStructureStore((s) => s.type);
  const unitSystem = useUnitStore((s) => s.system);

  const diagrams = useMemo(
    () =>
      results
        ? structureDiagrams(
            nodes,
            elements,
            loads,
            structureType,
            results.elementForces,
          )
        : null,
    [results, nodes, elements, loads, structureType],
  );

  // The shell only switches here once a Solve has succeeded, but results are
  // cleared by any structural edit (AD-3) and this can render on that frame.
  if (!diagrams) return null;

  const format =
    kind === "moment"
      ? (value: number) =>
          `${formatMoment(value, unitSystem, 1)} ${momentUnit(unitSystem)}`
      : kind === "shear"
        ? (value: number) =>
            `${formatForce(value, unitSystem, 1)} ${forceUnit(unitSystem)}`
        : // FR-14: tension and compression are told apart by the label text,
          // never by an added colour.
          (value: number) => axialForceLabel(value, unitSystem);

  const peaks =
    kind === "moment"
      ? diagrams.momentPeaks
      : kind === "shear"
        ? diagrams.shearPeaks
        : diagrams.axialPeaks;

  return (
    <DiagramView
      kind={kind}
      title={TITLES[kind]}
      caption={CAPTIONS[kind]}
      nodes={nodes}
      elements={elements}
      diagrams={diagrams.elements}
      peaks={peaks}
      format={format}
    />
  );
}

"use client";

import { useMemo } from "react";
import useStructureStore from "@/store/useStructureStore";
import DiagramCard from "./DiagramCard";
import { structureDiagrams, type DiagramPeak } from "@/engine/diagrams";
import { elementLabel, nodeLabel } from "@/utils/labels";
import {
  FORCE_UNIT,
  MOMENT_UNIT,
  axialForceLabel,
  formatKilonewtonMetres,
  formatKilonewtons,
} from "@/utils/units";

/**
 * The results area: BMD, SFD, NFD and Reactions, docked below the canvas.
 *
 * Not a separate route -- `EXPERIENCE.md` resolves the PRD's "results view"
 * into an inline bottom expansion of the Canvas Workspace. Results render
 * immediately and unprompted after a successful Solve; they are never behind a
 * second gate, which is the fast path UJ-1 depends on.
 */

const EMPTY_NOTE = "No results to show — fix the structure above, then Solve again.";

/** "20.0 kN·m at 3.00 m along E1", or a plain zero when there is no peak. */
function peakLabel(
  peak: DiagramPeak | null,
  format: (value: number) => string,
  elementName: (elementId: string) => string,
): string {
  if (peak === null) return "—";
  return `${format(peak.value)} at ${peak.at.toFixed(2)} m along ${elementName(peak.elementId)}`;
}

export default function ResultsArea() {
  const results = useStructureStore((s) => s.results);
  const nodes = useStructureStore((s) => s.nodes);
  const elements = useStructureStore((s) => s.elements);
  const loads = useStructureStore((s) => s.loads);
  const structureType = useStructureStore((s) => s.type);

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

  if (!results || !diagrams) {
    return (
      <section className="results-area" aria-label="Results">
        <p className="empty-note">{EMPTY_NOTE}</p>
      </section>
    );
  }

  // Shared with the panel and canvas, so E1 means the same Element everywhere.
  const elementName = (elementId: string) => elementLabel(elements, elementId);

  // Members laid end to end, so the three curves read as one structure rather
  // than as a row of disconnected member plots.
  const offsets = diagrams.elements.map((_, index) =>
    diagrams.elements
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.length, 0),
  );
  const seriesFor = (pick: "moment" | "shear" | "axial") =>
    diagrams.elements.map((element, index) => ({
      offset: offsets[index],
      length: element.length,
      samples: element[pick],
    }));

  const moment = diagrams.momentPeaks;
  const shear = diagrams.shearPeaks;
  const axial = diagrams.axialPeaks;

  const momentText = (value: number) =>
    `${formatKilonewtonMetres(value, 1)} ${MOMENT_UNIT}`;
  const forceText = (value: number) =>
    `${formatKilonewtons(value, 1)} ${FORCE_UNIT}`;

  return (
    <section className="results-area" aria-label="Results">
      <header className="results-head">
        <h3>Results</h3>
        <span className="tag-outline tag-solved">Solved ✓</span>
      </header>

      <div className="diagrams">
        <DiagramCard
          title="BMD"
          peakLabel={`max ${peakLabel(moment.max, momentText, elementName)} · min ${peakLabel(moment.min, momentText, elementName)}`}
          series={seriesFor("moment")}
        />
        <DiagramCard
          title="SFD"
          peakLabel={`max ${peakLabel(shear.max, forceText, elementName)} · min ${peakLabel(shear.min, forceText, elementName)}`}
          series={seriesFor("shear")}
        />
        <DiagramCard
          title="NFD"
          // Tension and compression are distinguished by sign in the text
          // alone (FR-14) -- the palette carries no hue for it and DESIGN.md
          // forbids inventing one.
          peakLabel={`max ${axial.max ? axialForceLabel(axial.max.value) : "—"} · min ${axial.min ? axialForceLabel(axial.min.value) : "—"}`}
          series={seriesFor("axial")}
        />

        <section className="diagram-card">
          <h4>Reactions</h4>
          <table className="react-table">
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Rx</th>
                <th scope="col">Ry</th>
                <th scope="col">M</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(results.reactions).map(([id, reaction]) => (
                <tr key={id}>
                  <th scope="row">{nodeLabel(nodes, id)}</th>
                  {/* "R:" prefixed in the label itself, so hue is never the
                      sole thing telling a Reaction from a Load (both accents
                      sit only ~1.23:1 apart). */}
                  <td>
                    <span className="tag-outline tag-reaction">
                      R: {formatKilonewtons(reaction[0], 2)} {FORCE_UNIT}
                    </span>
                  </td>
                  <td>
                    <span className="tag-outline tag-reaction">
                      R: {formatKilonewtons(reaction[1], 2)} {FORCE_UNIT}
                    </span>
                  </td>
                  <td>
                    <span className="tag-outline tag-reaction">
                      R: {formatKilonewtonMetres(reaction[2], 2)} {MOMENT_UNIT}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}

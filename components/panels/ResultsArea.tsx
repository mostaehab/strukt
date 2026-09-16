"use client";

import { useMemo } from "react";
import useStructureStore from "@/store/useStructureStore";
import DiagramCard from "./DiagramCard";
import { structureDiagrams, type DiagramPeak } from "@/engine/diagrams";
import { elementLabel, nodeLabel } from "@/utils/labels";
import {
  axialForceLabel,
  forceUnit,
  formatForce,
  formatLength,
  formatMoment,
  lengthUnit,
  momentUnit,
} from "@/utils/units";
import useUnitStore from "@/store/useUnitStore";

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
  distance: (metres: number) => string,
): string {
  if (peak === null) return "—";
  return `${format(peak.value)} at ${distance(peak.at)} along ${elementName(peak.elementId)}`;
}

export default function ResultsArea() {
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
    `${formatMoment(value, unitSystem, 1)} ${momentUnit(unitSystem)}`;
  const forceText = (value: number) =>
    `${formatForce(value, unitSystem, 1)} ${forceUnit(unitSystem)}`;
  const distanceText = (metres: number) =>
    `${formatLength(metres, unitSystem)} ${lengthUnit(unitSystem)}`;

  return (
    <section className="results-area" aria-label="Results">
      <header className="results-head">
        <h3>Results</h3>
        <span className="tag-outline tag-solved">Solved ✓</span>
      </header>

      <div className="diagrams">
        <DiagramCard
          title="BMD"
          peakLabel={`max ${peakLabel(moment.max, momentText, elementName, distanceText)} · min ${peakLabel(moment.min, momentText, elementName, distanceText)}`}
          series={seriesFor("moment")}
        />
        <DiagramCard
          title="SFD"
          peakLabel={`max ${peakLabel(shear.max, forceText, elementName, distanceText)} · min ${peakLabel(shear.min, forceText, elementName, distanceText)}`}
          series={seriesFor("shear")}
        />
        <DiagramCard
          title="NFD"
          // Tension and compression are distinguished by sign in the text
          // alone (FR-14) -- the palette carries no hue for it and DESIGN.md
          // forbids inventing one.
          peakLabel={`max ${axial.max ? axialForceLabel(axial.max.value, unitSystem) : "—"} · min ${axial.min ? axialForceLabel(axial.min.value, unitSystem) : "—"}`}
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
                      R: {formatForce(reaction[0], unitSystem, 2)} {forceUnit(unitSystem)}
                    </span>
                  </td>
                  <td>
                    <span className="tag-outline tag-reaction">
                      R: {formatForce(reaction[1], unitSystem, 2)} {forceUnit(unitSystem)}
                    </span>
                  </td>
                  <td>
                    <span className="tag-outline tag-reaction">
                      R: {formatMoment(reaction[2], unitSystem, 2)} {momentUnit(unitSystem)}
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

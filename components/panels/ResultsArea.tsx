"use client";

import { useMemo } from "react";
import useStructureStore from "@/store/useStructureStore";
import StepsToggle from "./StepsToggle";
import ShowStepsPanel from "./ShowStepsPanel";
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

interface ResultsAreaProps {
  /** Beam is stored as FRAME, so only the shell knows a Project was drawn as one. */
  isBeamPreset: boolean;
}

export default function ResultsArea({ isBeamPreset }: ResultsAreaProps) {
  const results = useStructureStore((s) => s.results);
  const nodes = useStructureStore((s) => s.nodes);
  const elements = useStructureStore((s) => s.elements);
  const loads = useStructureStore((s) => s.loads);
  const structureType = useStructureStore((s) => s.type);
  const unitSystem = useUnitStore((s) => s.system);
  const showSteps = useStructureStore((s) => s.showSteps);
  const setShowSteps = useStructureStore((s) => s.setShowSteps);

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
        <header className="results-head">
          <h3>Results</h3>
          {/* Present but inert before a Solve: "disabled (not merely empty)". */}
          <StepsToggle checked={false} disabled onChange={() => {}} />
        </header>
        <p className="empty-note">{EMPTY_NOTE}</p>
      </section>
    );
  }

  // Shared with the panel and canvas, so E1 means the same Element everywhere.
  const elementName = (elementId: string) => elementLabel(elements, elementId);

  // The drawings live in the workspace view (DiagramPane), at a size worth
  // reading. What stays here is what a student writes down: peak values with
  // their locations, the Reactions, and a Truss's member forces.
  const isTruss = structureType === "TRUSS";

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
        <StepsToggle
          checked={showSteps}
          disabled={false}
          onChange={setShowSteps}
        />
      </header>

      <div className="diagrams">
        {/* One row per quantity: its peaks and where they occur. FR-12 to
            FR-14 require exactly this labelling; the curve itself is in the
            workspace view above, which is where it can be read. */}
        <section className="diagram-card">
          <h4>Peak values</h4>
          <table className="react-table">
            <thead>
              <tr>
                <th scope="col">Diagram</th>
                <th scope="col">Max</th>
                <th scope="col">Min</th>
              </tr>
            </thead>
            <tbody>
              {!isTruss && (
                <tr>
                  <th scope="row">BMD</th>
                  <td>{peakLabel(moment.max, momentText, elementName, distanceText)}</td>
                  <td>{peakLabel(moment.min, momentText, elementName, distanceText)}</td>
                </tr>
              )}
              {!isTruss && (
                <tr>
                  <th scope="row">SFD</th>
                  <td>{peakLabel(shear.max, forceText, elementName, distanceText)}</td>
                  <td>{peakLabel(shear.min, forceText, elementName, distanceText)}</td>
                </tr>
              )}
              <tr>
                <th scope="row">NFD</th>
                {/* Tension and compression are distinguished by sign in the
                    text alone (FR-14) -- the palette carries no hue for it and
                    DESIGN.md forbids inventing one. */}
                <td>{axial.max ? axialForceLabel(axial.max.value, unitSystem) : "—"}</td>
                <td>{axial.min ? axialForceLabel(axial.min.value, unitSystem) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* A Truss's whole answer is which members are in tension and which in
            compression, and by how much -- the number a student checks against
            their method-of-joints working. */}
        {isTruss && (
          <section className="diagram-card">
            <h4>Member forces</h4>
            <table className="react-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Axial</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((element) => {
                  const force = results.elementForces[element.id];
                  if (!force) return null;
                  return (
                    <tr key={element.id}>
                      <th scope="row">{elementName(element.id)}</th>
                      <td>
                        <span className="tag-outline tag-reaction">
                          {axialForceLabel(force.axial, unitSystem)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

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

      {/* The one deliberate second-order gate (UX-DR9): results render
          unprompted, this does not. */}
      {showSteps && (
        <ShowStepsPanel results={results} isBeamPreset={isBeamPreset} />
      )}
    </section>
  );
}

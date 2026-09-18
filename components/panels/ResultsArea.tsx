"use client";

import { useMemo } from "react";
import useStructureStore from "@/store/useStructureStore";
import DiagramCard from "./DiagramCard";
import StructureDiagram from "./StructureDiagram";
import StepsToggle from "./StepsToggle";
import ShowStepsPanel from "./ShowStepsPanel";
import {
  structureDiagrams,
  type DiagramKind,
  type DiagramPeak,
} from "@/engine/diagrams";
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

  // A Beam's members are collinear, so laying them end to end on one axis is
  // the structure itself. Anything else is drawn on its real geometry -- see
  // StructureDiagram for why the strip cannot represent a Frame.
  const offsets = diagrams.elements.map((_, index) =>
    diagrams.elements
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.length, 0),
  );
  const seriesFor = (pick: DiagramKind) =>
    diagrams.elements.map((element, index) => ({
      offset: offsets[index],
      length: element.length,
      samples: element[pick],
    }));

  // FR-12 and FR-13 scope the BMD and SFD to "a solved Frame/Beam structure".
  // A Truss member carries axial force only, so its bending arrays are zero by
  // construction -- rendering two flat cards for them would dress the absence
  // of bending up as a computed result.
  const isTruss = structureType === "TRUSS";

  const bendingCard = (
    title: string,
    kind: DiagramKind,
    label: string,
  ) =>
    isBeamPreset ? (
      <DiagramCard title={title} peakLabel={label} series={seriesFor(kind)} />
    ) : (
      <StructureDiagram
        title={title}
        peakLabel={label}
        kind={kind}
        nodes={nodes}
        elements={elements}
        diagrams={diagrams.elements}
      />
    );

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
        {!isTruss &&
          bendingCard(
            "BMD",
            "moment",
            `max ${peakLabel(moment.max, momentText, elementName, distanceText)} · min ${peakLabel(moment.min, momentText, elementName, distanceText)}`,
          )}
        {!isTruss &&
          bendingCard(
            "SFD",
            "shear",
            `max ${peakLabel(shear.max, forceText, elementName, distanceText)} · min ${peakLabel(shear.min, forceText, elementName, distanceText)}`,
          )}
        {/* Tension and compression are distinguished by sign in the text alone
            (FR-14) -- the palette carries no hue for it and DESIGN.md forbids
            inventing one. */}
        {bendingCard(
          "NFD",
          "axial",
          `max ${axial.max ? axialForceLabel(axial.max.value, unitSystem) : "—"} · min ${axial.min ? axialForceLabel(axial.min.value, unitSystem) : "—"}`,
        )}

        {/* A Truss's whole answer is which members are in tension and which in
            compression, and by how much. On the NFD that is a constant ordinate
            per member; read off a table it is the number a student checks
            against their method-of-joints working. */}
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

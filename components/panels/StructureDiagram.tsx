"use client";

import { projectDiagrams, type Point } from "@/engine/diagramGeometry";
import type { DiagramKind, ElementDiagram } from "@/engine/diagrams";
import type { StructuralElement, StructuralNode } from "@/engine/types";

/**
 * A diagram drawn on the structure's own geometry.
 *
 * The card view (`DiagramCard`) lays members end to end on one horizontal
 * axis, which is exactly right for a Beam -- its members are collinear, so the
 * strip *is* the structure -- and wrong for anything else. A portal frame has
 * a column, a beam and a second column meeting at right angles; flattening
 * them into a strip loses which part of the curve belongs to which member and
 * invents continuity across joints where none exists.
 *
 * So a Frame and a Truss get this instead: each member's ordinate plotted
 * perpendicular to that member, over the real structure, the way it is drawn
 * by hand.
 */

/** Padding around the fitted content, as a fraction of its larger dimension. */
const PAD_FRACTION = 0.08;

interface StructureDiagramProps {
  title: string;
  /** Peak text, already formatted with its unit by the caller. */
  peakLabel: string;
  kind: DiagramKind;
  nodes: StructuralNode[];
  elements: StructuralElement[];
  diagrams: ElementDiagram[];
}

/** World metres to SVG user units: y is up in the model and down on screen. */
function path(points: Point[], close: boolean): string {
  if (points.length === 0) return "";
  const head = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(4)} ${(-p.y).toFixed(4)}`)
    .join(" ");
  return close ? `${head} Z` : head;
}

export default function StructureDiagram({
  title,
  peakLabel,
  kind,
  nodes,
  elements,
  diagrams,
}: StructureDiagramProps) {
  const projected = projectDiagrams(nodes, elements, diagrams, kind);
  const { minX, minY, maxX, maxY } = projected.bounds;

  // A single Node, or a structure with no extent, has no box to fit. Guarding
  // here draws nothing rather than emitting a zero-width viewBox, which
  // renders as a blank card in some browsers and an error in others.
  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;
  const pad = Math.max(rawWidth, rawHeight, 1) * PAD_FRACTION;
  const width = rawWidth + pad * 2;
  const height = rawHeight + pad * 2;

  return (
    <section className="diagram-card diagram-card-geometry">
      <h4>
        {title} <span className="diagram-peak">{peakLabel}</span>
      </h4>
      <svg
        className="structure-diagram"
        viewBox={`${minX - pad} ${-(maxY + pad)} ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
        focusable="false"
      >
        {/* The members first, so the diagram reads as drawn over the
            structure rather than the structure over the diagram. */}
        {projected.members.map((member) => (
          <path
            key={`m-${member.elementId}`}
            d={path([member.start, member.end], false)}
            className="structure-member"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {projected.members.map((member) => (
          <g key={`d-${member.elementId}`}>
            <path
              d={path(member.region, true)}
              className="diagram-region"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path(member.ordinate, false)}
              fill="none"
              className="diagram-curve"
              vectorEffect="non-scaling-stroke"
            />
            {/* The tie lines back to the member: without them an ordinate
                that leaves the member at an angle reads as a free-floating
                curve rather than as a value measured off that member. */}
            {member.ordinate.length > 0 && (
              <>
                <path
                  d={path([member.start, member.ordinate[0]], false)}
                  className="diagram-tie"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={path(
                    [member.end, member.ordinate[member.ordinate.length - 1]],
                    false,
                  )}
                  className="diagram-tie"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </g>
        ))}
      </svg>
    </section>
  );
}

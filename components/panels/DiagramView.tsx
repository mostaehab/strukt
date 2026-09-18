"use client";

import { projectDiagrams, type Point } from "@/engine/diagramGeometry";
import type { DiagramKind, DiagramPeak, ElementDiagram } from "@/engine/diagrams";
import type { StructuralElement, StructuralNode } from "@/engine/types";
import { elementLabel } from "@/utils/labels";

/**
 * A diagram at full workspace size, drawn on the structure's own geometry.
 *
 * This takes the canvas's place rather than docking under it. A diagram read
 * in a 220px card is a shape; read at this size it is a set of values a
 * student can check against their own working, which is the point of the
 * product. The results area below keeps the numbers.
 *
 * One projection serves every Structure Type: a Beam's members are collinear,
 * so plotting each ordinate perpendicular to its own member degenerates to
 * exactly the classic single-axis diagram, at true scale.
 */

/** Padding around the fitted content, as a fraction of its larger dimension. */
const PAD_FRACTION = 0.12;

/**
 * Below this share of the peak, a member end value is left unlabelled.
 *
 * A pinned support carries no moment and a free end no shear, so labelling
 * every member end would print a row of zeroes around the values that matter.
 */
const LABEL_THRESHOLD = 0.01;

interface DiagramViewProps {
  kind: DiagramKind;
  title: string;
  /** Sign convention, stated on the drawing rather than left to be inferred. */
  caption: string;
  nodes: StructuralNode[];
  elements: StructuralElement[];
  diagrams: ElementDiagram[];
  peaks: { max: DiagramPeak | null; min: DiagramPeak | null };
  /** Formats a value with its unit, in the user's unit system. */
  format: (value: number) => string;
}

/** World metres to SVG user units: y is up in the model and down on screen. */
function path(points: Point[], close: boolean): string {
  if (points.length === 0) return "";
  const head = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(4)} ${(-p.y).toFixed(4)}`)
    .join(" ");
  return close ? `${head} Z` : head;
}

export default function DiagramView({
  kind,
  title,
  caption,
  nodes,
  elements,
  diagrams,
  peaks,
  format,
}: DiagramViewProps) {
  const projected = projectDiagrams(nodes, elements, diagrams, kind);
  const { minX, minY, maxX, maxY } = projected.bounds;

  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;
  const extent = Math.max(rawWidth, rawHeight, 1);
  const pad = extent * PAD_FRACTION;

  // Glyphs and type are sized in world metres because the viewBox is, so they
  // scale with the structure instead of needing a second coordinate system.
  const unit = extent / 100;

  /** Where a peak sits on the drawing, by the sample that produced it. */
  const locate = (peak: DiagramPeak | null) => {
    if (!peak) return null;
    const member = projected.members.find((m) => m.elementId === peak.elementId);
    const diagram = diagrams.find((d) => d.elementId === peak.elementId);
    if (!member || !diagram || member.ordinate.length === 0) return null;
    const index = diagram[kind].findIndex(
      (sample) => sample.x === peak.at && sample.value === peak.value,
    );
    const point = index < 0 ? null : member.ordinate[index];
    return point ? { point, peak } : null;
  };

  const marked = [locate(peaks.max), locate(peaks.min)].filter(
    (entry): entry is { point: Point; peak: DiagramPeak } => entry !== null,
  );
  const largest = Math.max(
    Math.abs(peaks.max?.value ?? 0),
    Math.abs(peaks.min?.value ?? 0),
  );

  return (
    <div className="diagram-view">
      <svg
        viewBox={`${minX - pad} ${-(maxY + pad)} ${rawWidth + pad * 2} ${rawHeight + pad * 2}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${title}. ${caption}`}
      >
        {/* The structure first, so the diagram reads as drawn over it. */}
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
            {/* Ties back to the member at each end: without them an ordinate
                that leaves at an angle reads as a free-floating curve rather
                than a value measured off that member. */}
            <path
              d={path([member.start, member.ordinate[0] ?? member.start], false)}
              className="diagram-tie"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path(
                [
                  member.end,
                  member.ordinate[member.ordinate.length - 1] ?? member.end,
                ],
                false,
              )}
              className="diagram-tie"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path(member.ordinate, false)}
              fill="none"
              className="diagram-curve"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {/* Member end values. On a Frame these are the joint moments, which is
            the number a student checks before anything else. */}
        {projected.members.map((member) => {
          const diagram = diagrams.find((d) => d.elementId === member.elementId);
          if (!diagram || member.ordinate.length === 0 || largest === 0) {
            return null;
          }
          const samples = diagram[kind];
          const ends = [
            { point: member.ordinate[0], value: samples[0].value },
            {
              point: member.ordinate[member.ordinate.length - 1],
              value: samples[samples.length - 1].value,
            },
          ];
          return ends.map((end, i) =>
            Math.abs(end.value) / largest > LABEL_THRESHOLD ? (
              <text
                key={`v-${member.elementId}-${i}`}
                className="diagram-value"
                x={end.point.x}
                y={-end.point.y - unit * 1.4}
                textAnchor="middle"
                style={{ fontSize: `${unit * 3.4}px` }}
              >
                {format(end.value)}
              </text>
            ) : null,
          );
        })}

        {/* The structure-wide peaks, marked where they actually occur rather
            than named only in the text below. */}
        {marked.map(({ point, peak }) => (
          <g key={`p-${peak.elementId}-${peak.at}-${peak.value}`}>
            <circle
              cx={point.x}
              cy={-point.y}
              r={unit * 1.2}
              className="diagram-peak-dot"
            />
            <text
              className="diagram-peak-label"
              x={point.x}
              y={-point.y - unit * 3.6}
              textAnchor="middle"
              style={{ fontSize: `${unit * 4.4}px` }}
            >
              {format(peak.value)}
            </text>
          </g>
        ))}

        {/* Member names, set off the member on the side the diagram is not
            drawn, so a label never lands on its own curve. */}
        {projected.members.map((member) => {
          const dx = member.end.x - member.start.x;
          const dy = member.end.y - member.start.y;
          const length = Math.hypot(dx, dy) || 1;
          const offset = kind === "moment" ? unit * 2.6 : -unit * 2.6;
          return (
            <text
              key={`l-${member.elementId}`}
              className="diagram-member-label"
              x={(member.start.x + member.end.x) / 2 + (-dy / length) * offset}
              y={-((member.start.y + member.end.y) / 2 + (dx / length) * offset)}
              textAnchor="middle"
              style={{ fontSize: `${unit * 3.2}px` }}
            >
              {elementLabel(elements, member.elementId)}
            </text>
          );
        })}

        {nodes.map((node) => (
          <circle
            key={node.id}
            cx={node.x}
            cy={-node.y}
            r={unit}
            className="diagram-node"
          />
        ))}
      </svg>

      <p className="diagram-caption">{caption}</p>
    </div>
  );
}

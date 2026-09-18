"use client";

import { projectDiagrams, type Point } from "@/engine/diagramGeometry";
import type { DiagramKind, ElementDiagram } from "@/engine/diagrams";
import type { StructuralElement, StructuralNode } from "@/engine/types";
import { elementLabel } from "@/utils/labels";
import { layoutLabels, type LabelCandidate } from "@/utils/labelLayout";

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

  // The scale the end-value threshold is measured against. Read off the
  // samples rather than taken from the reported peaks, so this stays a
  // property of what is drawn.
  const largest = diagrams.reduce(
    (worst, diagram) =>
      diagram[kind].reduce((m, sample) => Math.max(m, Math.abs(sample.value)), worst),
    0,
  );

  const candidates: LabelCandidate[] = [];

  for (const member of projected.members) {
    const diagram = diagrams.find((d) => d.elementId === member.elementId);
    const dx = member.end.x - member.start.x;
    const dy = member.end.y - member.start.y;
    const span = Math.hypot(dx, dy) || 1;

    if (diagram && member.ordinate.length > 0 && largest > 0) {
      const samples = diagram[kind];
      const ends = [
        { point: member.ordinate[0], value: samples[0].value, at: "start" },
        {
          point: member.ordinate[member.ordinate.length - 1],
          value: samples[samples.length - 1].value,
          at: "end",
        },
      ];
      for (const end of ends) {
        if (Math.abs(end.value) / largest <= LABEL_THRESHOLD) continue;
        // Which side of the member the ordinate put this label on, so a label
        // that has to give way moves further out rather than back across its
        // own curve.
        const side =
          Math.sign(
            (end.point.x - member.start.x) * -dy +
              (end.point.y - member.start.y) * dx,
          ) || 1;
        candidates.push({
          id: `value-${member.elementId}-${end.at}`,
          x: end.point.x,
          y: -end.point.y - unit * 1.4,
          text: format(end.value),
          fontSize: unit * 3.4,
          pushX: (-dy / span) * side,
          pushY: -((dx / span) * side),
          priority: 0,
        });
      }
    }

    // Set on the side the diagram is not drawn, so a name never lands on its
    // own curve. Lower priority than the values: a name is recoverable from
    // position, a number is not.
    const offset = kind === "moment" ? unit * 2.6 : -unit * 2.6;
    candidates.push({
      id: `name-${member.elementId}`,
      x: (member.start.x + member.end.x) / 2 + (-dy / span) * offset,
      y: -((member.start.y + member.end.y) / 2 + (dx / span) * offset),
      text: elementLabel(elements, member.elementId),
      fontSize: unit * 3.2,
      pushX: (-dy / span) * Math.sign(offset),
      pushY: -((dx / span) * Math.sign(offset)),
      priority: 1,
    });
  }

  const labels = layoutLabels(candidates);

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

        {/* Every label goes through one layout pass. Placed by formula alone
            they pile up exactly where the values matter -- two members meeting
            at a joint each label the same point, and a symmetric frame
            produces the same number four times. */}
        {labels.map((label) => (
          <text
            key={label.id}
            className={
              label.id.startsWith("name-")
                ? "diagram-member-label"
                : "diagram-value"
            }
            x={label.x}
            y={label.y}
            textAnchor="middle"
            style={{ fontSize: `${label.fontSize}px` }}
          >
            {label.text}
          </text>
        ))}

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

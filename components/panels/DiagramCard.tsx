"use client";

import type { DiagramSample } from "@/engine/diagrams";

/**
 * One results card for a Beam: a title, its peak label, and the curve.
 *
 * Members laid end to end on a single horizontal axis, which is the correct
 * picture *only* for a Beam -- its members are collinear by construction, so
 * the strip is the structure. A Frame or a Truss uses `StructureDiagram`
 * instead, which plots each ordinate perpendicular to its own member.
 *
 * The peak label is the accessible representation of the diagram.
 * `EXPERIENCE.md` records that a fuller description of the curve's shape was
 * considered for screen readers and explicitly decided against, so the labelled
 * peaks carry that weight and the SVG itself is presentational.
 */

const VIEW_WIDTH = 220;
const VIEW_HEIGHT = 70;
const PADDING = 10;

interface Series {
  /** Distance along the whole structure, so members join into one curve. */
  offset: number;
  length: number;
  samples: DiagramSample[];
}

interface DiagramCardProps {
  title: string;
  /** Peak text, already formatted with its unit by the caller. */
  peakLabel: string;
  /** One entry per member, in order along the structure. */
  series: Series[];
}

/**
 * Maps values onto the card, with the zero line placed wherever zero falls in
 * the range.
 *
 * A diagram whose values are all equal -- including all zero, which is every
 * diagram of an unloaded structure -- has no range to divide by. Guarding that
 * draws a flat line on the baseline instead of producing NaN coordinates,
 * which would silently blank the card rather than showing the honest answer.
 */
function project(series: Series[]) {
  const values = series.flatMap((s) => s.samples.map((sample) => sample.value));
  const totalLength = series.reduce((sum, s) => sum + s.length, 0);

  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const range = max - min;
  const usableHeight = VIEW_HEIGHT - PADDING * 2;

  const yOf = (value: number) =>
    range === 0
      ? VIEW_HEIGHT / 2
      : PADDING + ((max - value) / range) * usableHeight;

  const xOf = (distance: number) =>
    totalLength === 0
      ? PADDING
      : PADDING + (distance / totalLength) * (VIEW_WIDTH - PADDING * 2);

  return { yOf, xOf, zeroY: yOf(0) };
}

export default function DiagramCard({
  title,
  peakLabel,
  series,
}: DiagramCardProps) {
  const { yOf, xOf, zeroY } = project(series);

  // One polyline per member, never one across all of them. Joining them would
  // draw a segment between the end of one member's diagram and the start of
  // the next, which is fiction wherever the two values differ -- a step in
  // shear at a point load is a real discontinuity, not a ramp.
  const polylines = series.map((s) =>
    s.samples
      .map((sample) => {
        const x = xOf(s.offset + sample.x);
        return `${x.toFixed(2)},${yOf(sample.value).toFixed(2)}`;
      })
      .join(" "),
  );

  return (
    <section className="diagram-card">
      <h4>
        {title} <span className="diagram-peak">{peakLabel}</span>
      </h4>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="presentation"
        focusable="false"
      >
        <line
          x1={PADDING}
          y1={zeroY}
          x2={VIEW_WIDTH - PADDING}
          y2={zeroY}
          className="diagram-baseline"
        />
        {polylines.map((points, index) =>
          points ? (
            <polyline
              key={series[index].offset}
              points={points}
              fill="none"
              className="diagram-curve"
            />
          ) : null,
        )}
      </svg>
    </section>
  );
}

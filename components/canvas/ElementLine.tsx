"use client";

import { Line } from "@react-three/drei";

interface ElementLineProps {
  start: [number, number, number];
  end: [number, number, number];
  dashed: boolean;
  color: string;
}

/**
 * Renders a single Element as a line between two Node positions.
 * Dashed for Truss, solid for Frame -- per DESIGN.md's
 * Canvas-element-stroke convention.
 */
export default function ElementLine({
  start,
  end,
  dashed,
  color,
}: ElementLineProps) {
  return (
    <Line
      points={[start, end]}
      color={color}
      lineWidth={dashed ? 1.5 : 2}
      dashed={dashed}
      dashSize={dashed ? 0.15 : undefined}
      gapSize={dashed ? 0.1 : undefined}
    />
  );
}

"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { Support } from "@/engine/types";
import { supportGlyph } from "./supportGlyphGeometry";

interface SupportGlyphProps {
  support: Support;
  x: number;
  y: number;
  color: string;
}

/**
 * Draws a Node's Support on the canvas.
 *
 * Carries no pointer handlers on purpose: the Node underneath stays the tap
 * target, so a student aiming at a supported Node selects the Node rather than
 * the drawing under it.
 */
export default function SupportGlyph({
  support,
  x,
  y,
  color,
}: SupportGlyphProps) {
  const strokes = useMemo(() => supportGlyph(support, x, y), [support, x, y]);
  if (!strokes) return null;

  return (
    <>
      {strokes.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={color}
          lineWidth={1.5}
          // The Node owns the tap; this is drafting, not a control.
          raycast={() => null}
        />
      ))}
    </>
  );
}

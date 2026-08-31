"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { elementPickProxy } from "./pickProxy";

interface ElementLineProps {
  start: [number, number, number];
  end: [number, number, number];
  dashed: boolean;
  color: string;
  /**
   * World-space width of the invisible pick proxy. Kept separate from the
   * rendered stroke so hit-testing never inflates the hairline: the
   * Canvas-element-stroke of
   * `_bmad-output/planning-artifacts/ux-designs/ux-strukt-2026-08-30/DESIGN.md`
   * stays 1.5/2px regardless of how wide the target is.
   */
  hitWidth: number;
  /**
   * Omit when the active tool doesn't select Elements. Without a handler the
   * proxy carries no r3f events at all, so a Node-tool click that happens to
   * land on an Element still reaches the background catcher plane.
   */
  onSelect?: () => void;
}

/**
 * Renders a single Element as a line between two Node positions.
 * Dashed for Truss, solid for Frame -- per the Canvas-element-stroke
 * convention in
 * `_bmad-output/planning-artifacts/ux-designs/ux-strukt-2026-08-30/DESIGN.md`.
 *
 * A drei <Line> raycasts only within its own pixel width, which is far too
 * thin for touch -- the touch-parity requirement in
 * `_bmad-output/planning-artifacts/ux-designs/ux-strukt-2026-08-30/EXPERIENCE.md`.
 * So selection is handled by a transparent plane laid along the Element -- see
 * ./pickProxy -- sized to match the Node glyph's target, using r3f's own
 * pointer events: no hand-rolled raycasting, and no change to the visible
 * stroke.
 */
export default function ElementLine({
  start,
  end,
  dashed,
  color,
  hitWidth,
  onSelect,
}: ElementLineProps) {
  // Depends on the scalar coordinates, not the `start`/`end` tuples: the
  // parent rebuilds those array literals every render, so tuple identity would
  // never match and the memo would never hit.
  const [startX, startY] = start;
  const [endX, endY] = end;
  const proxy = useMemo(
    () => elementPickProxy(startX, startY, endX, endY),
    [startX, startY, endX, endY],
  );

  return (
    <group>
      <Line
        points={[start, end]}
        color={color}
        lineWidth={dashed ? 1.5 : 2}
        dashed={dashed}
        dashSize={dashed ? 0.15 : undefined}
        gapSize={dashed ? 0.1 : undefined}
      />
      <mesh
        position={proxy.position}
        rotation={proxy.rotation}
        onClick={
          onSelect
            ? (event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onSelect();
              }
            : undefined
        }
      >
        <planeGeometry args={[proxy.length, hitWidth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

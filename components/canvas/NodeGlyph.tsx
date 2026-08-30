"use client";

import type { ThreeEvent } from "@react-three/fiber";

interface NodeGlyphProps {
  position: [number, number, number];
  radius: number;
  color: string;
  onSelect?: () => void;
  onPointerDown?: () => void;
}

/**
 * Renders a single Node as a small filled circle. Uses r3f's own
 * pointer-event system (onClick/onPointerDown) so mouse and touch input are
 * handled uniformly -- no hand-rolled raycasting.
 */
export default function NodeGlyph({
  position,
  radius,
  color,
  onSelect,
  onPointerDown,
}: NodeGlyphProps) {
  return (
    <mesh
      position={position}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect?.();
      }}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        onPointerDown?.();
      }}
    >
      <circleGeometry args={[radius, 32]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

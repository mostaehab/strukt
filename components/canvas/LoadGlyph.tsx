"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";
import { Html, Line } from "@react-three/drei";
import { LOAD_HALO_Z_OFFSET } from "./canvasConstants";
import {
  LOAD_HEAD_HALO_SCALE,
  LOAD_HEAD_VERTICES,
  loadGlyphGeometry,
  udlGlyphGeometry,
  type LoadArrow,
} from "./loadGlyphGeometry";

/**
 * The head triangle, shared by every arrow on the canvas.
 *
 * A module-level array, not a per-Load allocation: the triangle is identical
 * for every Load and only its placement differs. It is handed to a declarative
 * `<bufferGeometry>` so r3f owns the GPU buffer and disposes it on unmount,
 * the same way `ElementLine` lets r3f own its `<planeGeometry>` -- an
 * imperatively built geometry would leak one buffer per Load added.
 */
const HEAD_POSITIONS = new Float32Array(LOAD_HEAD_VERTICES);

interface ArrowProps {
  arrow: LoadArrow;
  color: string;
  /** Canvas background, painted as a halo so the head never merges into an
   *  accent-coloured Node glyph underneath it. */
  haloColor: string;
}

/** One shaft plus its filled head, halo included. */
function Arrow({ arrow, color, haloColor }: ArrowProps) {
  const [headX, headY, headZ] = arrow.head.position;

  return (
    <>
      <Line
        points={[arrow.shaftStart, arrow.shaftEnd]}
        color={color}
        lineWidth={2}
      />
      {/* Halo first and fractionally further back, so it reads as an outline
          rather than z-fighting with the head it sits behind. */}
      <mesh
        position={[headX, headY, headZ - LOAD_HALO_Z_OFFSET]}
        rotation={arrow.head.rotation}
        scale={LOAD_HEAD_HALO_SCALE}
      >
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[HEAD_POSITIONS, 3]}
          />
        </bufferGeometry>
        <meshBasicMaterial color={haloColor} side={DoubleSide} />
      </mesh>
      <mesh position={arrow.head.position} rotation={arrow.head.rotation}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[HEAD_POSITIONS, 3]}
          />
        </bufferGeometry>
        {/* DoubleSide: a direction that mirrors the triangle must never
            render an invisible head. */}
        <meshBasicMaterial color={color} side={DoubleSide} />
      </mesh>
    </>
  );
}

interface LoadLabelProps {
  position: [number, number, number];
  label: string;
}

/**
 * The magnitude caption, as DOM text through drei's <Html> rather than 3D
 * text: troika (drei's <Text>) resolves its glyphs from a CDN at runtime, and
 * a canvas caption that silently fails to appear offline is worse than a DOM
 * node. It also renders in the same numeral font token as every other
 * engineering value in the app, and carries no pointer events, so it can never
 * swallow a canvas tap.
 */
function LoadLabel({ position, label }: LoadLabelProps) {
  return (
    <Html position={position} center pointerEvents="none">
      <span className="load-label">{label}</span>
    </Html>
  );
}

interface CommonProps {
  /** The Load's stored direction vector, in the global frame. */
  direction: readonly [number, number];
  color: string;
  haloColor: string;
  /** Already formatted for display, e.g. `5 kN` -- unprefixed on the canvas. */
  label: string;
  /** Position among the Loads sharing this target, so two never coincide. */
  stackIndex?: number;
}

type LoadGlyphProps = CommonProps &
  (
    | { kind: "concentrated"; target: [number, number] }
    | { kind: "udl"; start: [number, number]; end: [number, number] }
  );

function ConcentratedGlyph({
  target,
  direction,
  color,
  haloColor,
  label,
  stackIndex = 0,
}: CommonProps & { target: [number, number] }) {
  // Depends on the scalar coordinates, not the tuples: the parent rebuilds
  // those array literals every render, so tuple identity would never match and
  // the memo would never hit (same reasoning as ElementLine).
  const [targetX, targetY] = target;
  const [dx, dy] = direction;
  const glyph = useMemo(
    () => loadGlyphGeometry(targetX, targetY, [dx, dy], stackIndex),
    [targetX, targetY, dx, dy, stackIndex],
  );

  return (
    <group>
      <Arrow arrow={glyph} color={color} haloColor={haloColor} />
      <LoadLabel position={glyph.labelPosition} label={label} />
    </group>
  );
}

function UdlGlyph({
  start,
  end,
  direction,
  color,
  haloColor,
  label,
  stackIndex = 0,
}: CommonProps & { start: [number, number]; end: [number, number] }) {
  const [startX, startY] = start;
  const [endX, endY] = end;
  const [dx, dy] = direction;
  const glyph = useMemo(
    () => udlGlyphGeometry(startX, startY, endX, endY, [dx, dy], stackIndex),
    [startX, startY, endX, endY, dx, dy, stackIndex],
  );

  return (
    <group>
      {/* The spine: what makes this read as a load spread over the member
          rather than a point load at its midpoint. */}
      <Line
        points={[glyph.spineStart, glyph.spineEnd]}
        color={color}
        lineWidth={2}
      />
      {glyph.arrows.map((arrow, index) => (
        <Arrow
          key={index}
          arrow={arrow}
          color={color}
          haloColor={haloColor}
        />
      ))}
      <LoadLabel position={glyph.labelPosition} label={label} />
    </group>
  );
}

/**
 * Renders a single Load in accent: a concentrated Load as one arrow with its
 * head on the Node, a UDL as a spine over the member with a row of arrows
 * dropping onto it -- the load glyphs of
 * `_bmad-output/planning-artifacts/ux-designs/ux-strukt-2026-08-30/mockups/key-canvas.html`
 * and the standard distributed-load notation respectively. Geometry comes from
 * ./loadGlyphGeometry, unit-tested without three.js.
 *
 * Nothing here takes an r3f event handler: a Load is selected through the Node
 * or Element it belongs to, and an unhandled object is invisible to r3f's
 * raycaster -- which is what lets the arrow paint on top of a Node glyph
 * without stealing its taps.
 */
export default function LoadGlyph(props: LoadGlyphProps) {
  return props.kind === "concentrated" ? (
    <ConcentratedGlyph {...props} />
  ) : (
    <UdlGlyph {...props} />
  );
}

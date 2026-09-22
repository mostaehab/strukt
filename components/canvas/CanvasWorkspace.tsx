"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import useStructureStore from "@/store/useStructureStore";
import { canConnect } from "@/engine/geometry";
import { createElement } from "@/engine/element";
import type { Load, StructuralNode } from "@/engine/types";
import {
  formatForce,
  formatLength,
  lengthUnit,
  loadUnitLabel,
} from "@/utils/units";
import useUnitStore, { type UnitSystem } from "@/store/useUnitStore";
import { nodeLabel } from "@/utils/labels";
import type { Tool } from "@/components/panels/Toolbar";
import NodeGlyph from "./NodeGlyph";
import ElementLine from "./ElementLine";
import LoadGlyph from "./LoadGlyph";
import { memberPreviewGeometry } from "./memberPreviewGeometry";
import SupportGlyph from "./SupportGlyph";
import useCanvasColors from "./useCanvasColors";
import { NODE_GLYPH_Z, PIXELS_PER_WORLD_UNIT } from "./canvasConstants";

const GRID_SIZE = 1;
const GRID_EXTENT = 15;
const NODE_RADIUS = 0.22;
// Invisible pick-target width for an Element, matched to the Node glyph's
// diameter so both entities are equally tappable. The rendered stroke stays a
// hairline -- this only widens hit-testing.
const ELEMENT_HIT_WIDTH = NODE_RADIUS * 2;
// Single-sourced with the Load glyph sizes, which are the mockup's pixel
// dimensions divided by exactly this number.
const CAMERA_ZOOM = PIXELS_PER_WORLD_UNIT;
const BEAM_Y = 0;

function snap(value: number, gridSize = GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

function nextNodeId() {
  return crypto.randomUUID();
}

function nextElementId() {
  return crypto.randomUUID();
}

/** Canvas labels carry no `L:` prefix -- that belongs to the panel tag only. */
function loadLabel(load: Load, system: UnitSystem): string {
  return `${formatForce(load.magnitude, system)} ${loadUnitLabel(load.kind, system)}`;
}

/**
 * Position of each Load among the Loads sharing its target.
 *
 * Two Loads pointing the same way at one Node would otherwise draw perfectly
 * coincident arrows and read as one -- so each is handed its index and the
 * glyph offsets itself. Computed once per `loads` change rather than by
 * scanning the list per arrow.
 */
function stackIndexes(loads: Load[]): Map<string, number> {
  const seen = new Map<string, number>();
  const indexes = new Map<string, number>();
  for (const load of loads) {
    const { target } = load;
    // A point Load's station is part of its identity here: two at different
    // places on one member are not a stack and must not be fanned apart, while
    // two at the same station are and must be.
    const key =
      target.type === "node"
        ? `n:${target.nodeId}`
        : load.kind === "point"
          ? `p:${target.elementId}:${load.position}`
          : `e:${target.elementId}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    indexes.set(load.id, index);
  }
  return indexes;
}

interface CanvasWorkspaceProps {
  tool: Tool;
  beamPreset: boolean;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
}

/**
 * r3f <Canvas> with an orthographic camera: grid rendering, Node/Element
 * placement and selection, touch + mouse pointer handling. World coordinates
 * come straight from r3f's built-in raycasting (event.point), so "snap to
 * nearest grid point" is a plain Math.round in world space.
 */
export default function CanvasWorkspace({
  tool,
  beamPreset,
  selectedNodeId,
  onSelectNode,
  selectedElementId,
  onSelectElement,
}: CanvasWorkspaceProps) {
  // Read from the CSS tokens rather than a second copy of the palette in JS,
  // so the canvas follows the theme instead of staying light under a dark UI.
  const COLORS = useCanvasColors();
  const unitSystem = useUnitStore((s) => s.system);

  const nodes = useStructureStore((s) => s.nodes);
  const elements = useStructureStore((s) => s.elements);
  const loads = useStructureStore((s) => s.loads);
  const structureType = useStructureStore((s) => s.type);
  const addNode = useStructureStore((s) => s.addNode);
  const addElement = useStructureStore((s) => s.addElement);
  const updateNode = useStructureStore((s) => s.updateNode);

  const [pendingStartId, setPendingStartId] = useState<string | null>(null);
  // Snapped grid point under the cursor, tracked only while an Element is
  // half-drawn. Null the rest of the time so no pointer move re-renders the
  // canvas when there is no band to move.
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  // Switching tools cancels any in-progress Element draw. Adjusted during
  // render (React's recommended "resetting state when a prop changes"
  // pattern) rather than in an effect, so it doesn't trigger a cascading
  // post-commit render.
  const [prevTool, setPrevTool] = useState(tool);
  if (tool !== prevTool) {
    setPrevTool(tool);
    setPendingStartId(null);
    setPointer(null);
    setStatusMessage("");
    setDraggingNodeId(null);
  }

  // A pending connection can go stale if its start Node is deleted (e.g. via
  // the properties panel or Delete/Backspace) while the Element tool is
  // mid-connection. Cleared during render (same "resetting state when a
  // prop changes" pattern as the tool-switch reset above, not an effect)
  // so it can't trigger a cascading post-commit render.
  const [prevNodes, setPrevNodes] = useState(nodes);
  if (nodes !== prevNodes) {
    setPrevNodes(nodes);
    if (pendingStartId && !nodes.some((node) => node.id === pendingStartId)) {
      setPendingStartId(null);
      setStatusMessage("");
    }
  }

  // Release a drag even if the pointer is lifted outside the canvas --
  // important for touch, where a finger can lift anywhere.
  useEffect(() => {
    function handlePointerUp() {
      setDraggingNodeId(null);
    }
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  // Escape cancels an in-progress Element connection. Form controls don't
  // live inside the <Canvas>, so no focused-element guard is needed here
  // (unlike app/page.tsx's Escape handler, which does need one).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPendingStartId(null);
        setStatusMessage("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadStackIndexes = useMemo(() => stackIndexes(loads), [loads]);

  const gridGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += 1) {
      for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += 1) {
        positions.push(x * GRID_SIZE, y * GRID_SIZE, -1);
      }
    }
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return geometry;
  }, []);

  const handleBackgroundClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (tool === "SELECT") {
        onSelectNode(null);
        onSelectElement(null);
        return;
      }
      if (tool !== "NODE") return;

      const x = snap(event.point.x);
      const y = beamPreset ? BEAM_Y : snap(event.point.y);
      const existingNode = nodes.find((node) => node.x === x && node.y === y);
      if (existingNode) {
        onSelectNode(existingNode.id);
        setStatusMessage("A Node already exists here.");
        return;
      }
      // No force fields here: a Load is its own entity (AD-10), applied from
      // the properties panel, so a new Node carries no zero-valued placeholder.
      addNode({ id: nextNodeId(), x, y, support: "FREE" });
    },
    [tool, beamPreset, nodes, addNode, onSelectNode, onSelectElement],
  );

  const handleBackgroundPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (pendingStartId) {
        // The band follows the grid, not the raw cursor: an Element can only
        // ever end on a Node, and Nodes are snapped, so a smooth band would
        // report lengths no Element could have.
        setPointer({
          x: snap(event.point.x),
          y: beamPreset ? BEAM_Y : snap(event.point.y),
        });
      }
      if (!draggingNodeId) return;
      const x = snap(event.point.x);
      const y = beamPreset ? BEAM_Y : snap(event.point.y);
      const occupied = nodes.some(
        (node) => node.id !== draggingNodeId && node.x === x && node.y === y,
      );
      if (occupied) return;
      updateNode(draggingNodeId, { x, y });
    },
    [draggingNodeId, pendingStartId, beamPreset, nodes, updateNode],
  );

  const handleNodeSelect = useCallback(
    (node: StructuralNode) => {
      if (tool === "ELEMENT") {
        if (!pendingStartId) {
          setPendingStartId(node.id);
          setPointer(null);
          setStatusMessage(
            // The positional label the panel shows, not the stored UUID.
            `Node ${nodeLabel(nodes, node.id)} selected. Choose an end Node to connect.`,
          );
          return;
        }
        if (pendingStartId === node.id) {
          setStatusMessage("Cannot connect a Node to itself. No Element created.");
          setPendingStartId(null);
          setPointer(null);
          return;
        }
        if (!canConnect(nodes, pendingStartId, node.id)) {
          setStatusMessage("Nodes are coincident. No Element created.");
          setPendingStartId(null);
          setPointer(null);
          return;
        }
        // Material and Cross-Section start unassigned -- "no Material yet" is
        // a real state, not a silent default to Steel with zero properties.
        addElement(createElement(nextElementId(), pendingStartId, node.id));
        setStatusMessage("");
        setPendingStartId(null);
        setPointer(null);
        return;
      }
      if (tool === "SELECT") {
        onSelectNode(node.id);
      }
    },
    [tool, pendingStartId, nodes, addElement, onSelectNode],
  );

  const handleNodePointerDown = useCallback(
    (node: StructuralNode) => {
      if (tool === "SELECT") {
        setDraggingNodeId(node.id);
      }
    },
    [tool],
  );

  // The half-drawn Element, if there is one. A band is only meaningful to a
  // Node that could actually receive the connection, so the target is resolved
  // here rather than left as "wherever the cursor is".
  const pendingStart = pendingStartId
    ? nodes.find((node) => node.id === pendingStartId)
    : undefined;
  const hoveredNode = pointer
    ? nodes.find((node) => node.x === pointer.x && node.y === pointer.y)
    : undefined;
  const willConnect = Boolean(
    pendingStartId &&
      hoveredNode &&
      canConnect(nodes, pendingStartId, hoveredNode.id),
  );
  const preview =
    pendingStart && pointer
      ? memberPreviewGeometry(pendingStart.x, pendingStart.y, pointer.x, pointer.y)
      : null;

  return (
    <div className="canvas-workspace">
      <Canvas
        orthographic
        camera={{ zoom: CAMERA_ZOOM, position: [0, 0, 100] }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={[COLORS.background]} />
        <ambientLight intensity={1} />

        <points geometry={gridGeometry}>
          <pointsMaterial color={COLORS.grid} size={4} sizeAttenuation={false} />
        </points>

        {/* Invisible catcher plane: gives Node-tool placement and Select-tool
            drag a world-space point even where no Node/Element was hit. */}
        <mesh
          position={[0, 0, -0.9]}
          onClick={handleBackgroundClick}
          onPointerMove={handleBackgroundPointerMove}
        >
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {elements.map((el) => {
          const start = nodes.find((n) => n.id === el.startNode);
          const end = nodes.find((n) => n.id === el.endNode);
          if (!start || !end) return null;
          return (
            <ElementLine
              key={el.id}
              start={[start.x, start.y, 0]}
              end={[end.x, end.y, 0]}
              dashed={structureType === "TRUSS"}
              color={el.id === selectedElementId ? COLORS.accent : COLORS.ink}
              hitWidth={ELEMENT_HIT_WIDTH}
              onSelect={
                tool === "SELECT" ? () => onSelectElement(el.id) : undefined
              }
            />
          );
        })}

        {/* The half-drawn Element: solid and in accent when the cursor is on a
            Node that can take the connection, hairline-dashed otherwise. The
            dimension is the point of it -- an inclined member's length and
            angle are not readable off the grid. */}
        {preview && preview.length > 0 && (
          <group>
            <Line
              points={[preview.start, preview.end]}
              color={willConnect ? COLORS.accent : COLORS.grid}
              lineWidth={willConnect ? 2 : 1.5}
              dashed={!willConnect}
              dashSize={willConnect ? undefined : 0.15}
              gapSize={willConnect ? undefined : 0.1}
            />
            <Html position={preview.labelPosition} center pointerEvents="none">
              <span
                className={
                  willConnect
                    ? "member-preview-label is-connectable"
                    : "member-preview-label"
                }
              >
                {formatLength(preview.length, unitSystem)}{" "}
                {lengthUnit(unitSystem)} · {preview.angle.toFixed(1)}°
              </span>
            </Html>
          </group>
        )}

        {/* Supports are drawn under their Node, so an assigned restraint is
            visible on the canvas rather than only in the properties panel --
            a student reads a structure by its supports. FREE draws nothing. */}
        {nodes.map((node) => (
          <SupportGlyph
            key={`support-${node.id}`}
            support={node.support}
            x={node.x}
            y={node.y}
            color={COLORS.ink}
          />
        ))}

        {nodes.map((node) => (
          <NodeGlyph
            key={node.id}
            position={[node.x, node.y, NODE_GLYPH_Z]}
            radius={NODE_RADIUS}
            color={
              node.id === selectedNodeId || node.id === pendingStartId
                ? COLORS.accent
                : COLORS.ink
            }
            onSelect={() => handleNodeSelect(node)}
            onPointerDown={() => handleNodePointerDown(node)}
          />
        ))}

        {/* One glyph per Load, never one per loaded entity: two Loads on a
            Node draw two offset arrows, which is what makes "sum, don't
            overwrite" visible instead of implied. A missing target is skipped
            the way a dangling Element is -- the store's cascades mean it
            should be unreachable, and a stale reference must not blank the
            view if it ever isn't. */}
        {loads.map((load) => {
          const stackIndex = loadStackIndexes.get(load.id) ?? 0;
          // Destructured, not read through `load`: a discriminant narrowed on
          // a parameter does not stay narrowed inside these callbacks.
          const { target } = load;
          if (target.type === "node") {
            const node = nodes.find((n) => n.id === target.nodeId);
            if (!node) return null;
            return (
              <LoadGlyph
                key={load.id}
                kind="concentrated"
                target={[node.x, node.y]}
                direction={load.direction}
                color={COLORS.accent}
                haloColor={COLORS.background}
                label={loadLabel(load, unitSystem)}
                stackIndex={stackIndex}
              />
            );
          }
          const element = elements.find((e) => e.id === target.elementId);
          if (!element) return null;
          const start = nodes.find((n) => n.id === element.startNode);
          const end = nodes.find((n) => n.id === element.endNode);
          if (!start || !end) return null;
          if (load.kind === "point") {
            return (
              <LoadGlyph
                key={load.id}
                kind="point"
                start={[start.x, start.y]}
                end={[end.x, end.y]}
                position={load.position}
                direction={load.direction}
                color={COLORS.accent}
                haloColor={COLORS.background}
                label={loadLabel(load, unitSystem)}
                stackIndex={stackIndex}
              />
            );
          }
          return (
            <LoadGlyph
              key={load.id}
              kind="udl"
              start={[start.x, start.y]}
              end={[end.x, end.y]}
              direction={load.direction}
              color={COLORS.accent}
              haloColor={COLORS.background}
              label={loadLabel(load, unitSystem)}
              stackIndex={stackIndex}
            />
          );
        })}
      </Canvas>
      <p className="canvas-status" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  );
}

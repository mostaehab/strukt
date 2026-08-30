"use client";

import type { ChangeEvent } from "react";
import useStructureStore from "@/store/useStructureStore";
import type { StructureType, Support } from "@/engine/types";

export type StructurePreset = "TRUSS" | "FRAME" | "BEAM";

interface PropertiesPanelProps {
  preset: StructurePreset;
  onPresetChange: (preset: StructurePreset) => void;
  selectedNodeId: string | null;
  onDeleteSelectedNode: () => void;
}

const SUPPORT_OPTIONS: { value: Support; label: string }[] = [
  { value: "FIXED", label: "Fixed" },
  { value: "HINGE", label: "Hinged" },
  { value: "ROLLER", label: "Roller" },
  { value: "FREE", label: "Free" },
];

/**
 * Structure Type selector (Truss/Frame/Beam preset) + per-Node Support
 * dropdown. Plain <select> elements, styled via tokens.css.
 */
export default function PropertiesPanel({
  preset,
  onPresetChange,
  selectedNodeId,
  onDeleteSelectedNode,
}: PropertiesPanelProps) {
  const nodes = useStructureStore((s) => s.nodes);
  const elements = useStructureStore((s) => s.elements);
  const updateNode = useStructureStore((s) => s.updateNode);
  const setStructureType = useStructureStore((s) => s.setStructureType);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const hasContent = nodes.length > 0 || elements.length > 0;

  const handlePresetChange = (
    value: StructurePreset,
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    // Beam is a drawing-time preset; it's stored as "FRAME" like any other Frame.
    const targetType: StructureType = value === "BEAM" ? "FRAME" : value;
    const ok = setStructureType(targetType);
    if (!ok) {
      window.alert(
        "Structure Type can't be changed while the Project has Elements or Supports. Clear the canvas first.",
      );
      // Force the native <select> to visually snap back to the current
      // preset immediately, rather than potentially showing the rejected
      // option until an unrelated re-render.
      event.target.value = preset;
      return;
    }
    onPresetChange(value);
  };

  return (
    <aside className="properties-panel" aria-label="Properties">
      <section>
        <h2>Structure Type</h2>
        <select
          aria-label="Structure Type"
          value={preset}
          onChange={(event) =>
            handlePresetChange(event.target.value as StructurePreset, event)
          }
        >
          <option value="TRUSS">Truss</option>
          <option value="FRAME">Frame</option>
          <option value="BEAM">Beam</option>
        </select>
        {hasContent && (
          <p className="hint">Clear the canvas to change Structure Type.</p>
        )}
      </section>

      <section>
        <h2>Node</h2>
        {selectedNode ? (
          <>
            <p className="node-id">Node {selectedNode.id}</p>
            <label htmlFor="support-select">Support</label>
            <select
              id="support-select"
              value={selectedNode.support}
              onChange={(event) =>
                updateNode(selectedNode.id, {
                  support: event.target.value as Support,
                })
              }
            >
              {SUPPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={onDeleteSelectedNode}>
              Delete Node
            </button>
          </>
        ) : (
          <p className="hint">Select a Node to view its properties.</p>
        )}
      </section>
    </aside>
  );
}

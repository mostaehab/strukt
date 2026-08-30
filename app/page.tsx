"use client";

import { useCallback, useEffect, useState } from "react";
import Toolbar, { type Tool } from "@/components/panels/Toolbar";
import PropertiesPanel, {
  type StructurePreset,
} from "@/components/panels/PropertiesPanel";
import CanvasWorkspace from "@/components/canvas/CanvasWorkspace";
import useStructureStore from "@/store/useStructureStore";

export default function Home() {
  const [tool, setTool] = useState<Tool>("NODE");
  const [preset, setPreset] = useState<StructurePreset>("FRAME");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const elements = useStructureStore((s) => s.elements);
  const deleteNode = useStructureStore((s) => s.deleteNode);

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    const hasElements = elements.some(
      (el) => el.startNode === selectedNodeId || el.endNode === selectedNodeId,
    );
    const confirmed = window.confirm(
      hasElements
        ? "Delete this Node and its connected Elements?"
        : "Delete this Node?",
    );
    if (!confirmed) return;
    deleteNode(selectedNodeId);
    setSelectedNodeId(null);
  }, [selectedNodeId, elements, deleteNode]);

  // Escape deselects; Delete/Backspace removes the selected Node (with the
  // same confirmation as the panel's Delete button). Skipped while typing
  // into a form control. This is a supplement to the touch-friendly button
  // in PropertiesPanel, not a replacement for it.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      if (event.key === "Escape") {
        setSelectedNodeId(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeId) {
        handleDeleteSelectedNode();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, handleDeleteSelectedNode]);

  return (
    <div className="app-shell">
      <Toolbar tool={tool} onToolChange={setTool} />
      <div className="workspace-body">
        <CanvasWorkspace
          tool={tool}
          beamPreset={preset === "BEAM"}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
        <PropertiesPanel
          preset={preset}
          onPresetChange={setPreset}
          selectedNodeId={selectedNodeId}
          onDeleteSelectedNode={handleDeleteSelectedNode}
        />
      </div>
    </div>
  );
}

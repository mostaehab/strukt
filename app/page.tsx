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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );

  const elements = useStructureStore((s) => s.elements);
  // A primitive selector, not the whole `nodes` array: dragging a Node changes
  // that array on every pointer move, and the shell only cares whether the
  // selected id still exists.
  const selectedNodeMissing = useStructureStore(
    (s) =>
      selectedNodeId !== null &&
      !s.nodes.some((node) => node.id === selectedNodeId),
  );
  const deleteNode = useStructureStore((s) => s.deleteNode);
  const deleteElement = useStructureStore((s) => s.deleteElement);

  // Node and Element selection are mutually exclusive -- the properties panel
  // shows exactly one entity at a time.
  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id !== null) setSelectedElementId(null);
  }, []);

  const handleSelectElement = useCallback((id: string | null) => {
    setSelectedElementId(id);
    if (id !== null) setSelectedNodeId(null);
  }, []);

  // Any delete path (the cascade in deleteNode, a future clear/undo/load) can
  // leave a selection pointing at an id that no longer exists. Both are
  // reconciled during render (React's "adjusting state when props change"
  // pattern, as in CanvasWorkspace) so the panel never paints a frame
  // referencing a dead entity, and so a dangling selectedNodeId can't shadow
  // the Delete key from a selected Element below.
  if (selectedNodeMissing) {
    setSelectedNodeId(null);
  }
  if (selectedElementId && !elements.some((el) => el.id === selectedElementId)) {
    setSelectedElementId(null);
  }

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
    // No need to clear the Element selection here: selection is mutually
    // exclusive, so a selected Node means no Element is selected. An Element
    // the cascade removes by any other route is handled by the render-phase
    // reconcile above.
  }, [selectedNodeId, elements, deleteNode]);

  // No cascade here -- an Element owns no children. Confirmation still
  // matches the Node delete pattern (FR-3) rather than deleting on one keypress.
  const handleDeleteSelectedElement = useCallback(() => {
    if (!selectedElementId) return;
    if (!window.confirm("Delete this Element?")) return;
    deleteElement(selectedElementId);
    setSelectedElementId(null);
  }, [selectedElementId, deleteElement]);

  // Escape deselects both and collapses the panel; Delete/Backspace removes
  // whichever entity is selected (with the same confirmation as the panel's
  // Delete button).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inFormControl =
        target !== null &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      // Escape is deliberately handled *before* the form-control guard: it is
      // global ("Escape always closes the topmost panel"), so it must work
      // while a numeric field has focus rather than doing one thing on the
      // canvas and nothing in the panel. The control is blurred first so focus
      // doesn't linger inside a panel that just collapsed -- which also lets
      // the field commit a valid pending entry on its way out.
      if (event.key === "Escape") {
        if (inFormControl) target.blur();
        setSelectedNodeId(null);
        setSelectedElementId(null);
        return;
      }

      // Delete/Backspace stays guarded -- they're editing keys inside the
      // Element panel's numeric inputs.
      if (inFormControl) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (selectedNodeId) {
        handleDeleteSelectedNode();
        return;
      }
      if (selectedElementId) {
        handleDeleteSelectedElement();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedNodeId,
    selectedElementId,
    handleDeleteSelectedNode,
    handleDeleteSelectedElement,
  ]);

  return (
    <div className="app-shell">
      <Toolbar tool={tool} onToolChange={setTool} />
      <div className="workspace-body">
        <CanvasWorkspace
          tool={tool}
          beamPreset={preset === "BEAM"}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
          selectedElementId={selectedElementId}
          onSelectElement={handleSelectElement}
        />
        <PropertiesPanel
          preset={preset}
          onPresetChange={setPreset}
          selectedNodeId={selectedNodeId}
          onDeleteSelectedNode={handleDeleteSelectedNode}
          selectedElementId={selectedElementId}
        />
      </div>
    </div>
  );
}

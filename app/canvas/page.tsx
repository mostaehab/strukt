"use client";

import { useCallback, useEffect, useState } from "react";
import Toolbar, { type Tool } from "@/components/panels/Toolbar";
import PropertiesPanel, {
  type StructurePreset,
} from "@/components/panels/PropertiesPanel";
import CanvasWorkspace from "@/components/canvas/CanvasWorkspace";
import SolveBar from "@/components/panels/SolveBar";
import ResultsArea from "@/components/panels/ResultsArea";
import ViewSwitch, { type WorkspaceView } from "@/components/panels/ViewSwitch";
import DiagramPane from "@/components/panels/DiagramPane";
import useStructureStore from "@/store/useStructureStore";
import {
  loadsRemovedWithElement,
  loadsRemovedWithNode,
} from "@/engine/load";

/**
 * Verbatim and non-dismissible (NFR-5, UX-DR8). Footer-docked rather than a
 * modal or a toast: the claim has to be persistently visible, not acknowledged
 * once and dismissed.
 */
const DISCLAIMER =
  "strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment";

/**
 * What a Node delete is about to take with it. Named in full rather than
 * hedged: a confirmation that undersells the cascade is worse than none.
 */
function nodeDeleteMessage(hasElements: boolean, hasLoads: boolean): string {
  if (hasElements && hasLoads) {
    return "Delete this Node, its connected Elements, and their Loads?";
  }
  if (hasElements) return "Delete this Node and its connected Elements?";
  if (hasLoads) return "Delete this Node and its Loads?";
  return "Delete this Node?";
}

export default function Home() {
  const [tool, setTool] = useState<Tool>("NODE");
  const [preset, setPreset] = useState<StructurePreset>("FRAME");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );

  const [view, setView] = useState<WorkspaceView>("MODEL");

  const elements = useStructureStore((s) => s.elements);
  const results = useStructureStore((s) => s.results);
  const structureType = useStructureStore((s) => s.type);
  // A primitive selector, not the whole `nodes` array: dragging a Node changes
  // that array on every pointer move, and the shell only cares whether the
  // selected id still exists.
  const selectedNodeMissing = useStructureStore(
    (s) =>
      selectedNodeId !== null &&
      !s.nodes.some((node) => node.id === selectedNodeId),
  );
  const loads = useStructureStore((s) => s.loads);
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

  // Results render unprompted (UX-DR9's fast path), and at this size that means
  // switching the workspace to the diagram rather than making the user go
  // looking for it. Adjusted during render rather than in an effect -- React's
  // "adjusting state when props change" pattern, as used for the selections
  // below -- so the model is never painted for a frame after a Solve landed.
  const [lastResults, setLastResults] = useState(results);
  if (results !== lastResults) {
    setLastResults(results);
    // Back to the model when an edit invalidates the answer: a diagram of a
    // structure that no longer exists is worse than no diagram.
    setView(results ? (structureType === "TRUSS" ? "axial" : "moment") : "MODEL");
  }

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
    // The cascade takes Loads on the Node *and* the UDLs on every Element it
    // removes, so the confirmation has to name them -- deleting a Node should
    // never silently take work the user cannot see listed.
    const hasLoads =
      loadsRemovedWithNode(loads, elements, selectedNodeId).length > 0;
    const confirmed = window.confirm(
      nodeDeleteMessage(hasElements, hasLoads),
    );
    if (!confirmed) return;
    deleteNode(selectedNodeId);
    setSelectedNodeId(null);
    // No need to clear the Element selection here: selection is mutually
    // exclusive, so a selected Node means no Element is selected. An Element
    // the cascade removes by any other route is handled by the render-phase
    // reconcile above.
  }, [selectedNodeId, elements, loads, deleteNode]);

  // No cascade here -- an Element owns no children. Confirmation still
  // matches the Node delete pattern (FR-3) rather than deleting on one keypress.
  const handleDeleteSelectedElement = useCallback(() => {
    if (!selectedElementId) return;
    const hasLoads =
      loadsRemovedWithElement(loads, selectedElementId).length > 0;
    const message = hasLoads
      ? "Delete this Element and its Loads?"
      : "Delete this Element?";
    if (!window.confirm(message)) return;
    deleteElement(selectedElementId);
    setSelectedElementId(null);
  }, [selectedElementId, loads, deleteElement]);

  // Escape deselects both and collapses the panel; Delete/Backspace removes
  // whichever entity is selected (with the same confirmation as the panel's
  // Delete button).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // BUTTON included: the panel's delete controls are buttons, and
      // Delete with one focused would otherwise fall through to "delete the
      // whole Node" -- a destructive action two levels up from the control
      // the user is actually on.
      const inFormControl =
        target !== null &&
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);

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
      <ViewSwitch
        view={view}
        onViewChange={setView}
        isTruss={structureType === "TRUSS"}
        solved={results !== null}
      />
      <SolveBar />
      <div className="workspace-body">
        {/* One area, one thing in it. The canvas stays mounted only in model
            view: a WebGL context behind a diagram costs memory and keeps
            responding to pointer events it should not receive. */}
        {view === "MODEL" ? (
          <CanvasWorkspace
            tool={tool}
            beamPreset={preset === "BEAM"}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            selectedElementId={selectedElementId}
            onSelectElement={handleSelectElement}
          />
        ) : (
          <DiagramPane kind={view} />
        )}
        <PropertiesPanel
          preset={preset}
          onPresetChange={setPreset}
          selectedNodeId={selectedNodeId}
          onDeleteSelectedNode={handleDeleteSelectedNode}
          selectedElementId={selectedElementId}
        />
      </div>
      <ResultsArea isBeamPreset={preset === "BEAM"} />
      <footer className="app-footer">
        <p className="disclaimer-badge">{DISCLAIMER}</p>
      </footer>
    </div>
  );
}

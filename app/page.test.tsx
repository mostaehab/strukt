// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import useStructureStore from "@/store/useStructureStore";
import { createElement } from "@/engine/element";
import type { StructuralNode } from "@/engine/types";

// The real CanvasWorkspace mounts an r3f <Canvas>, which needs WebGL that jsdom
// does not provide. This stand-in exposes the same selection contract as
// buttons, so the shell's selection/keyboard logic is what gets tested here --
// not three.js rendering.
vi.mock("@/components/canvas/CanvasWorkspace", () => ({
  default: ({
    selectedNodeId,
    selectedElementId,
    onSelectNode,
    onSelectElement,
  }: {
    selectedNodeId: string | null;
    selectedElementId: string | null;
    onSelectNode: (id: string | null) => void;
    onSelectElement: (id: string | null) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelectNode(NODE_ID)}>
        stub-select-node
      </button>
      <button type="button" onClick={() => onSelectElement(ELEMENT_ID)}>
        stub-select-element
      </button>
      <span data-testid="canvas-selected-node">{String(selectedNodeId)}</span>
      <span data-testid="canvas-selected-element">
        {String(selectedElementId)}
      </span>
    </div>
  ),
}));

const NODE_ID = "n1";
const OTHER_NODE_ID = "n2";
const ELEMENT_ID = "el-1";

function makeNode(id: string, x: number): StructuralNode {
  return { id, x, y: 0, support: "FREE", fx: 0, fy: 0, mz: 0 };
}

function seedStructure() {
  const store = useStructureStore.getState();
  store.addNode(makeNode(NODE_ID, 0));
  store.addNode(makeNode(OTHER_NODE_ID, 1));
  store.addElement(createElement(ELEMENT_ID, NODE_ID, OTHER_NODE_ID));
}

async function renderHome() {
  const { default: Home } = await import("./page");
  return render(<Home />);
}

function elementCount() {
  return useStructureStore.getState().elements.length;
}

beforeEach(() => {
  useStructureStore.getState().clearAll();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Canvas Workspace selection shell", () => {
  // Matrix row: Select an Element -- selected Node deselects, panel switches.
  it("deselects the Node when an Element is selected", async () => {
    seedStructure();
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-node"));
    expect(screen.getByTestId("canvas-selected-node").textContent).toBe(NODE_ID);
    screen.getByText(`Node ${NODE_ID}`);

    fireEvent.click(screen.getByText("stub-select-element"));
    expect(screen.getByTestId("canvas-selected-node").textContent).toBe("null");
    expect(screen.getByTestId("canvas-selected-element").textContent).toBe(
      ELEMENT_ID,
    );
    screen.getByText("Element E1 — Properties");
    screen.getByText("Select a Node to view its properties.");
  });

  it("deselects the Element when a Node is selected", async () => {
    seedStructure();
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-element"));
    fireEvent.click(screen.getByText("stub-select-node"));

    expect(screen.getByTestId("canvas-selected-element").textContent).toBe(
      "null",
    );
    screen.getByText("Select an Element to view its properties.");
  });

  it("clears both selections on Escape", async () => {
    seedStructure();
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-element"));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByTestId("canvas-selected-element").textContent).toBe(
      "null",
    );
    expect(screen.getByTestId("canvas-selected-node").textContent).toBe("null");
  });

  // Escape is global: the form-control guard must not swallow it, or one key
  // does two different things depending on where focus happens to be.
  it("clears the selection on Escape from inside a numeric field", async () => {
    seedStructure();
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-element"));
    const area = screen.getByLabelText("Area (m²)");
    area.focus();
    expect(document.activeElement).toBe(area);

    fireEvent.keyDown(area, { key: "Escape" });

    expect(screen.getByTestId("canvas-selected-element").textContent).toBe(
      "null",
    );
    expect(screen.getByTestId("canvas-selected-node").textContent).toBe("null");
    // Focus doesn't linger inside a panel section that just collapsed.
    expect(document.activeElement).not.toBe(area);
  });

  // Matrix row: Delete selected Element -- removed, selection cleared, no cascade.
  it("deletes the selected Element on Delete and clears the selection", async () => {
    seedStructure();
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-element"));
    fireEvent.keyDown(window, { key: "Delete" });

    expect(elementCount()).toBe(0);
    expect(screen.getByTestId("canvas-selected-element").textContent).toBe(
      "null",
    );
    // No cascade -- an Element owns no children, so both Nodes survive.
    expect(useStructureStore.getState().nodes).toHaveLength(2);
  });

  it("leaves the Element in place when the delete confirmation is declined", async () => {
    seedStructure();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-element"));
    fireEvent.keyDown(window, { key: "Delete" });

    expect(elementCount()).toBe(1);
  });

  it("ignores Delete while typing in a form control", async () => {
    seedStructure();
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-element"));
    fireEvent.keyDown(screen.getByLabelText("Area (m²)"), { key: "Delete" });

    expect(elementCount()).toBe(1);
  });

  // Matrix row: Cascade kills selection -- panel collapses rather than
  // referencing a deleted Element.
  it("clears an Element selection when a cascade delete removes it", async () => {
    seedStructure();
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-element"));
    screen.getByText("Element E1 — Properties");

    act(() => {
      useStructureStore.getState().deleteNode(NODE_ID);
    });

    expect(elementCount()).toBe(0);
    expect(screen.getByTestId("canvas-selected-element").textContent).toBe(
      "null",
    );
    screen.getByText("Select an Element to view its properties.");
  });

  // P6: a selectedNodeId left pointing at a deleted Node used to swallow every
  // Delete keypress, so a selected Element could never be deleted.
  it("still deletes a selected Element after its Node selection went stale", async () => {
    seedStructure();
    await renderHome();

    fireEvent.click(screen.getByText("stub-select-node"));
    act(() => {
      // Node removed without going through the shell's delete handler.
      useStructureStore.setState({
        nodes: useStructureStore
          .getState()
          .nodes.filter((n) => n.id !== NODE_ID),
      });
    });
    expect(screen.getByTestId("canvas-selected-node").textContent).toBe("null");

    fireEvent.click(screen.getByText("stub-select-element"));
    fireEvent.keyDown(window, { key: "Delete" });
    expect(elementCount()).toBe(0);
  });
});

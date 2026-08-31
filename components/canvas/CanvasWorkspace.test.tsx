// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import useStructureStore from "@/store/useStructureStore";
import { createElement } from "@/engine/element";
import type { StructuralNode } from "@/engine/types";

// r3f's <Canvas> needs WebGL, which jsdom has none of; the two render
// primitives are stubbed as plain elements that publish the props
// CanvasWorkspace passes them, so the selection wiring is what gets tested
// here -- not three.js rendering.
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
}));

vi.mock("./ElementLine", () => ({
  default: ({
    color,
    hitWidth,
    onSelect,
  }: {
    color: string;
    hitWidth: number;
    onSelect?: () => void;
  }) => (
    <button
      type="button"
      data-testid="element-line"
      data-color={color}
      data-hit-width={String(hitWidth)}
      data-selectable={String(Boolean(onSelect))}
      onClick={() => onSelect?.()}
    />
  ),
}));

vi.mock("./NodeGlyph", () => ({
  default: ({ color, onSelect }: { color: string; onSelect?: () => void }) => (
    <button
      type="button"
      data-testid="node-glyph"
      data-color={color}
      onClick={() => onSelect?.()}
    />
  ),
}));

const INK = "#10151c";
const ACCENT = "#2f6fed";

const NODE_A = "n1";
const NODE_B = "n2";
const NODE_C = "n3";
const ELEMENT_1 = "el-1";
const ELEMENT_2 = "el-2";

function makeNode(id: string, x: number, y: number): StructuralNode {
  return { id, x, y, support: "FREE", fx: 0, fy: 0, mz: 0 };
}

function seedTwoElements() {
  const store = useStructureStore.getState();
  store.addNode(makeNode(NODE_A, 0, 0));
  store.addNode(makeNode(NODE_B, 2, 0));
  store.addNode(makeNode(NODE_C, 2, 3));
  store.addElement(createElement(ELEMENT_1, NODE_A, NODE_B));
  store.addElement(createElement(ELEMENT_2, NODE_B, NODE_C));
}

interface Overrides {
  tool?: "NODE" | "ELEMENT" | "SELECT";
  selectedElementId?: string | null;
  onSelectNode?: (id: string | null) => void;
  onSelectElement?: (id: string | null) => void;
}

async function renderWorkspace(overrides: Overrides = {}) {
  const { default: CanvasWorkspace } = await import("./CanvasWorkspace");
  return render(
    <CanvasWorkspace
      tool={overrides.tool ?? "SELECT"}
      beamPreset={false}
      selectedNodeId={null}
      onSelectNode={overrides.onSelectNode ?? (() => {})}
      selectedElementId={overrides.selectedElementId ?? null}
      onSelectElement={overrides.onSelectElement ?? (() => {})}
    />,
  );
}

function elementLines() {
  return screen.getAllByTestId("element-line");
}

beforeEach(() => {
  useStructureStore.getState().clearAll();
});

afterEach(cleanup);

describe("CanvasWorkspace Element selection", () => {
  // Matrix row: Select an Element -- click/tap an Element with the Select tool.
  it("selects the clicked Element with the Select tool", async () => {
    seedTwoElements();
    const onSelectElement = vi.fn();
    await renderWorkspace({ tool: "SELECT", onSelectElement });

    fireEvent.click(elementLines()[1]);
    expect(onSelectElement).toHaveBeenCalledWith(ELEMENT_2);
  });

  it("makes Elements selectable only with the Select tool", async () => {
    seedTwoElements();

    const { unmount } = await renderWorkspace({ tool: "SELECT" });
    expect(
      elementLines().every((el) => el.dataset.selectable === "true"),
    ).toBe(true);
    unmount();

    for (const tool of ["NODE", "ELEMENT"] as const) {
      const view = await renderWorkspace({ tool });
      // No handler at all, so a Node-tool click on an Element still reaches
      // the background catcher plane instead of being swallowed.
      expect(
        elementLines().every((el) => el.dataset.selectable === "false"),
      ).toBe(true);
      view.unmount();
    }
  });

  it("draws only the selected Element in the accent color", async () => {
    seedTwoElements();
    await renderWorkspace({ selectedElementId: ELEMENT_2 });

    const [first, second] = elementLines();
    expect(first.dataset.color).toBe(INK);
    expect(second.dataset.color).toBe(ACCENT);
  });

  it("draws every Element in ink when nothing is selected", async () => {
    seedTwoElements();
    await renderWorkspace({ selectedElementId: null });

    expect(elementLines().every((el) => el.dataset.color === INK)).toBe(true);
  });

  it("gives every Element a tappable hit width wider than the hairline stroke", async () => {
    seedTwoElements();
    await renderWorkspace();

    for (const line of elementLines()) {
      expect(Number(line.dataset.hitWidth)).toBeGreaterThan(0.4);
    }
  });

  it("clears both selections on a Select-tool background click", async () => {
    seedTwoElements();
    const onSelectNode = vi.fn();
    const onSelectElement = vi.fn();
    const { container } = await renderWorkspace({
      tool: "SELECT",
      onSelectNode,
      onSelectElement,
    });

    // The background catcher plane is the only <mesh> the workspace itself
    // renders; the render primitives above are stubbed.
    const background = container.querySelector("mesh");
    expect(background).not.toBeNull();
    fireEvent.click(background!);

    expect(onSelectNode).toHaveBeenCalledWith(null);
    expect(onSelectElement).toHaveBeenCalledWith(null);
  });

  it("skips an Element whose end Node no longer exists", async () => {
    seedTwoElements();
    // Node C removed without the store's cascade, leaving Element 2 dangling.
    useStructureStore.setState({
      nodes: useStructureStore.getState().nodes.filter((n) => n.id !== NODE_C),
    });

    await renderWorkspace();
    expect(elementLines()).toHaveLength(1);
  });
});

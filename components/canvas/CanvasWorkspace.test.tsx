// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import useStructureStore from "@/store/useStructureStore";
import { createElement } from "@/engine/element";
import {
  AXIS_DIRECTIONS,
  createLoad,
  elementTarget,
  nodeTarget,
  type AxisDirection,
} from "@/engine/load";
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

vi.mock("./LoadGlyph", () => ({
  default: ({
    kind,
    target,
    start,
    end,
    direction,
    color,
    haloColor,
    label,
    stackIndex,
  }: {
    kind: "concentrated" | "udl";
    target?: [number, number];
    start?: [number, number];
    end?: [number, number];
    direction: readonly [number, number];
    color: string;
    haloColor: string;
    label: string;
    stackIndex?: number;
  }) => (
    <span
      data-testid="load-glyph"
      data-kind={kind}
      data-target={target ? target.join(",") : ""}
      data-start={start ? start.join(",") : ""}
      data-end={end ? end.join(",") : ""}
      data-direction={direction.join(",")}
      data-color={color}
      data-halo-color={haloColor}
      data-label={label}
      data-stack-index={String(stackIndex ?? 0)}
    />
  ),
}));

const INK = "#10151c";
const ACCENT = "#2f6fed";
const BACKGROUND = "#eef1f5";

const NODE_A = "n1";
const NODE_B = "n2";
const NODE_C = "n3";
const ELEMENT_1 = "el-1";
const ELEMENT_2 = "el-2";

function makeNode(id: string, x: number, y: number): StructuralNode {
  return { id, x, y, support: "FREE" };
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

function loadGlyphs() {
  return screen.getAllByTestId("load-glyph");
}

function addNodeLoad(
  id: string,
  nodeId: string,
  magnitude: number,
  axis: AxisDirection,
) {
  useStructureStore
    .getState()
    .addLoad(
      createLoad(
        id,
        "concentrated",
        nodeTarget(nodeId),
        magnitude,
        AXIS_DIRECTIONS[axis],
      ),
    );
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

describe("CanvasWorkspace Load arrows", () => {
  // Matrix row: Canvas arrow orientation -- the stored direction reaches the
  // glyph unchanged, and the arrow is anchored on the Node it acts on.
  it("draws a Load arrow at its Node, in the accent color", async () => {
    seedTwoElements();
    addNodeLoad("l1", NODE_B, 5000, "-y");
    await renderWorkspace();

    const [glyph] = loadGlyphs();
    expect(glyph.dataset.kind).toBe("concentrated");
    expect(glyph.dataset.target).toBe("2,0");
    expect(glyph.dataset.direction).toBe("0,-1");
    expect(glyph.dataset.color).toBe(ACCENT);
    // Canvas labels are unprefixed and trimmed -- the `L:` prefix and the
    // 2-decimal form belong to the panel tag.
    expect(glyph.dataset.label).toBe("5 kN");
  });

  it("draws one arrow per Load, so two Loads on one Node draw two", async () => {
    seedTwoElements();
    addNodeLoad("l1", NODE_A, 5000, "-y");
    addNodeLoad("l2", NODE_A, 5000, "+y");
    await renderWorkspace();

    expect(loadGlyphs()).toHaveLength(2);
    expect(loadGlyphs().map((g) => g.dataset.direction)).toEqual([
      "0,-1",
      "0,1",
    ]);
  });

  // A UDL is drawn over the member it acts on, not as one arrow at its
  // midpoint -- which is the notation for a concentrated load at midspan.
  it("hands a UDL its Element's whole span, labelled per metre", async () => {
    seedTwoElements();
    // Element 1 spans (0,0) to (2,0).
    useStructureStore
      .getState()
      .addLoad(
        createLoad(
          "l1",
          "udl",
          elementTarget(ELEMENT_1),
          2000,
          AXIS_DIRECTIONS["-y"],
        ),
      );
    await renderWorkspace();

    const [glyph] = loadGlyphs();
    expect(glyph.dataset.kind).toBe("udl");
    expect(glyph.dataset.start).toBe("0,0");
    expect(glyph.dataset.end).toBe("2,0");
    expect(glyph.dataset.target).toBe("");
    expect(glyph.dataset.label).toBe("2 kN/m");
  });

  // Two Loads pointing the same way at one Node would draw as a single arrow
  // without this -- the case "sum, don't overwrite" exists to make visible.
  it("gives each Load on a target its own place in the stack", async () => {
    seedTwoElements();
    addNodeLoad("l1", NODE_A, 5000, "-y");
    addNodeLoad("l2", NODE_A, 5000, "-y");
    addNodeLoad("l3", NODE_B, 5000, "-y");
    await renderWorkspace();

    expect(loadGlyphs().map((g) => g.dataset.stackIndex)).toEqual([
      "0",
      "1",
      // A different target starts its own stack.
      "0",
    ]);
  });

  it("paints the head halo in the canvas background colour", async () => {
    seedTwoElements();
    addNodeLoad("l1", NODE_A, 5000, "-y");
    await renderWorkspace();
    // The head lands on a Node glyph that is *also* accent when selected, so
    // it needs an outline in something that is not the accent.
    expect(loadGlyphs()[0].dataset.color).toBe(ACCENT);
    expect(loadGlyphs()[0].dataset.haloColor).toBe(BACKGROUND);
  });

  it("draws no arrow when nothing is loaded", async () => {
    seedTwoElements();
    await renderWorkspace();
    expect(screen.queryAllByTestId("load-glyph")).toHaveLength(0);
  });

  it("skips a Load whose target no longer exists", async () => {
    seedTwoElements();
    addNodeLoad("l1", NODE_A, 5000, "-y");
    // The Node removed without the store's cascade, leaving the Load dangling.
    useStructureStore.setState({
      nodes: useStructureStore.getState().nodes.filter((n) => n.id !== NODE_A),
    });

    await renderWorkspace();
    expect(screen.queryAllByTestId("load-glyph")).toHaveLength(0);
  });

  // Matrix row: Load on an isolated Node -- drawn, nothing blocks it here.
  it("draws a Load on a Node with no Element", async () => {
    useStructureStore.getState().addNode(makeNode(NODE_A, 4, 1));
    addNodeLoad("l1", NODE_A, 5000, "-y");
    await renderWorkspace();

    expect(loadGlyphs()).toHaveLength(1);
    expect(loadGlyphs()[0].dataset.target).toBe("4,1");
  });
});

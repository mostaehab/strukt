// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import SolveBar from "./SolveBar";
import useStructureStore from "@/store/useStructureStore";
import { AXIS_DIRECTIONS, createLoad, nodeTarget } from "@/engine/load";

function seedSolvableBeam() {
  const store = useStructureStore.getState();
  store.addNode({ id: "a", x: 0, y: 0, support: "FIXED" });
  store.addNode({ id: "b", x: 4, y: 0, support: "FREE" });
  store.addElement({
    id: "ab",
    material: "STEEL",
    startNode: "a",
    endNode: "b",
    crossSectionId: null,
    area: 0.01,
    inertia: 8e-5,
  });
  useStructureStore
    .getState()
    .addLoad(
      createLoad("l1", "concentrated", nodeTarget("b"), 5000, AXIS_DIRECTIONS["-y"]),
    );
}

/** A beam whose Element never got a Material -- blocked, but not unstable. */
function seedIncompleteBeam() {
  const store = useStructureStore.getState();
  store.addNode({ id: "a", x: 0, y: 0, support: "FIXED" });
  store.addNode({ id: "b", x: 4, y: 0, support: "FREE" });
  store.addElement({
    id: "ab",
    material: null,
    startNode: "a",
    endNode: "b",
    crossSectionId: null,
    area: null,
    inertia: null,
  });
}

function solveButton() {
  return screen.getByRole("button", { name: /solve/i });
}

beforeEach(() => {
  useStructureStore.getState().clearAll();
  // jsdom leaves confirm unimplemented, and clearing the workspace asks first.
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SolveBar", () => {
  it("offers a plain Solve button before any attempt", () => {
    render(<SolveBar />);
    expect(solveButton().textContent).toBe("Solve");
    expect(screen.queryByText(/Can't solve/)).toBeNull();
  });

  it("keeps the live region in the DOM before there is anything to announce", () => {
    render(<SolveBar />);
    // A region introduced at the same moment as its content is not reliably
    // announced, so it has to exist while empty.
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("solves a valid structure and raises no complaint", () => {
    seedSolvableBeam();
    render(<SolveBar />);
    fireEvent.click(solveButton());

    expect(useStructureStore.getState().results).not.toBeNull();
    expect(screen.queryByText(/Can't solve/)).toBeNull();
    // The solved state itself is reported in the results head, not here --
    // see ResultsArea.test.tsx.
  });

  it("explains a refusal in the live region rather than only in the console", () => {
    seedIncompleteBeam();
    render(<SolveBar />);
    fireEvent.click(solveButton());

    const region = screen.getByRole("status");
    expect(region.textContent).toContain(
      "Can't solve: Element E1 has no Material assigned.",
    );
  });

  it("marks the button blocked without disabling it", () => {
    seedIncompleteBeam();
    render(<SolveBar />);
    fireEvent.click(solveButton());

    const button = solveButton();
    expect(button.textContent).toBe("Solve — blocked");
    // Never disabled-and-silent: it stays operable and keeps explaining itself.
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);
    expect(useStructureStore.getState().solveErrors.length).toBeGreaterThan(0);
  });

  it("lists every reason at once rather than one Solve at a time", () => {
    const store = useStructureStore.getState();
    store.addNode({ id: "a", x: 0, y: 0, support: "FIXED" });
    store.addNode({ id: "b", x: 4, y: 0, support: "FREE" });
    store.addElement({
      id: "ab",
      material: null,
      startNode: "a",
      endNode: "b",
      crossSectionId: null,
      area: null,
      inertia: null,
    });
    render(<SolveBar />);
    fireEvent.click(solveButton());

    const region = screen.getByRole("status");
    expect(region.textContent).toContain("has no Material assigned");
    expect(region.textContent).toContain("has no Cross-Section");
  });

  it("uses the empty-canvas wording, which is not instability wording", () => {
    render(<SolveBar />);
    fireEvent.click(solveButton());
    screen.getByText(
      "Nothing to analyze yet. Draw at least one Element between two Nodes, then Solve.",
    );
  });

  it("drops the banner as soon as the structure changes", () => {
    seedIncompleteBeam();
    render(<SolveBar />);
    fireEvent.click(solveButton());
    expect(screen.getByRole("status").textContent).toContain("Can't solve");

    // The complaint may no longer be true, so it must not linger.
    act(() => {
      useStructureStore.getState().updateElement("ab", { material: "STEEL" });
    });
    expect(screen.getByRole("status").textContent).toBe("");
    expect(solveButton().textContent).toBe("Solve");
  });

  it("drops the stored result as soon as the structure changes", () => {
    seedSolvableBeam();
    render(<SolveBar />);
    fireEvent.click(solveButton());
    expect(useStructureStore.getState().results).not.toBeNull();

    act(() => {
      useStructureStore.getState().updateNode("b", { x: 5 });
    });
    // What the user sees of this is the results area emptying; the bar's own
    // job is only to stop claiming the structure is solvable.
    expect(useStructureStore.getState().results).toBeNull();
  });

  it("is reachable and operable by keyboard", () => {
    seedSolvableBeam();
    render(<SolveBar />);
    const button = solveButton();
    button.focus();
    expect(document.activeElement).toBe(button);
    // A real <button> activates on Enter and Space without extra handlers,
    // which is why this is a button and not a styled div.
    expect(button.tagName).toBe("BUTTON");
  });
});

describe("SolveBar clear workspace", () => {
  function clearButton() {
    return screen.getByRole("button", { name: /clear workspace/i });
  }

  it("is disabled on an empty workspace, since there is nothing to clear", () => {
    render(<SolveBar />);
    expect(clearButton().hasAttribute("disabled")).toBe(true);
  });

  it("enables once there is something to lose", () => {
    seedSolvableBeam();
    render(<SolveBar />);
    expect(clearButton().hasAttribute("disabled")).toBe(false);
  });

  it("confirms before clearing, naming what it takes", () => {
    seedSolvableBeam();
    render(<SolveBar />);
    fireEvent.click(clearButton());

    const asked = vi.mocked(window.confirm).mock.calls[0][0] as string;
    expect(asked).toContain("Node");
    expect(asked).toContain("Element");
    expect(asked).toContain("Load");
    expect(asked).toContain("can't be undone");
  });

  it("empties the whole structure when confirmed", () => {
    seedSolvableBeam();
    render(<SolveBar />);
    fireEvent.click(clearButton());

    const state = useStructureStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.elements).toEqual([]);
    expect(state.loads).toEqual([]);
    expect(state.results).toBeNull();
  });

  it("leaves everything alone when the confirmation is declined", () => {
    seedSolvableBeam();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SolveBar />);
    fireEvent.click(clearButton());

    expect(useStructureStore.getState().nodes).toHaveLength(2);
    expect(useStructureStore.getState().elements).toHaveLength(1);
  });
});

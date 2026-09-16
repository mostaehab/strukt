// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

beforeEach(() => useStructureStore.getState().clearAll());
afterEach(cleanup);

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

  it("solves a valid structure and reports it solved", () => {
    seedSolvableBeam();
    render(<SolveBar />);
    fireEvent.click(solveButton());

    expect(useStructureStore.getState().results).not.toBeNull();
    screen.getByText("Solved");
    expect(screen.queryByText(/Can't solve/)).toBeNull();
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

  it("drops a solved state as soon as the structure changes", () => {
    seedSolvableBeam();
    render(<SolveBar />);
    fireEvent.click(solveButton());
    screen.getByText("Solved");

    act(() => {
      useStructureStore.getState().updateNode("b", { x: 5 });
    });
    expect(screen.queryByText("Solved")).toBeNull();
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

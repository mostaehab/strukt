// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ResultsArea from "./ResultsArea";
import useStructureStore from "@/store/useStructureStore";
import { AXIS_DIRECTIONS, createLoad, elementTarget, nodeTarget } from "@/engine/load";

const EMPTY_NOTE = "No results to show — fix the structure above, then Solve again.";

/** Simply supported beam under a UDL: sagging moment, both Supports reacting. */
function seedSolvedBeam() {
  const store = useStructureStore.getState();
  store.addNode({ id: "a", x: 0, y: 0, support: "HINGE" });
  store.addNode({ id: "b", x: 3, y: 0, support: "FREE" });
  store.addNode({ id: "c", x: 6, y: 0, support: "ROLLER" });
  store.addElement(steel("ab", "a", "b"));
  store.addElement(steel("bc", "b", "c"));
  useStructureStore
    .getState()
    .addLoad(createLoad("w1", "udl", elementTarget("ab"), 2000, AXIS_DIRECTIONS["-y"]));
  useStructureStore
    .getState()
    .addLoad(createLoad("w2", "udl", elementTarget("bc"), 2000, AXIS_DIRECTIONS["-y"]));
  useStructureStore.getState().solve();
}

/** Two-bar truss: one member in compression, so the NFD has a sense to report. */
function seedSolvedTruss() {
  const store = useStructureStore.getState();
  store.setStructureType("TRUSS");
  const fresh = useStructureStore.getState();
  fresh.addNode({ id: "a", x: 0, y: 0, support: "HINGE" });
  fresh.addNode({ id: "b", x: 4, y: 0, support: "HINGE" });
  fresh.addNode({ id: "c", x: 2, y: 3, support: "FREE" });
  useStructureStore.getState().addElement(steel("ac", "a", "c"));
  useStructureStore.getState().addElement(steel("bc", "b", "c"));
  useStructureStore
    .getState()
    .addLoad(createLoad("p", "concentrated", nodeTarget("c"), 12000, AXIS_DIRECTIONS["-y"]));
  useStructureStore.getState().solve();
}

function steel(id: string, startNode: string, endNode: string) {
  return {
    id,
    material: "STEEL" as const,
    startNode,
    endNode,
    crossSectionId: null,
    area: 0.01,
    inertia: 8e-5,
  };
}

beforeEach(() => useStructureStore.getState().clearAll());
afterEach(cleanup);

describe("ResultsArea", () => {
  it("shows the empty note before any Solve", () => {
    render(<ResultsArea />);
    screen.getByText(EMPTY_NOTE);
    expect(screen.queryByText("BMD")).toBeNull();
  });

  it("renders all four cards unprompted after a successful Solve", () => {
    seedSolvedBeam();
    render(<ResultsArea />);
    // No second gate: results appear without the user asking for them.
    screen.getByText(/BMD/);
    screen.getByText(/SFD/);
    screen.getByText(/NFD/);
    screen.getByText("Reactions");
    expect(screen.queryByText(EMPTY_NOTE)).toBeNull();
  });

  it("reports the solved state in the results head", () => {
    seedSolvedBeam();
    render(<ResultsArea />);
    screen.getByText("Solved ✓");
  });

  it("labels both peak values with their locations, not just the curve shape", () => {
    seedSolvedBeam();
    render(<ResultsArea />);
    const bmd = screen.getByText(/BMD/).textContent ?? "";
    // wL^2/8 = 2000 * 36 / 8 = 9000 N·m = 9.0 kN·m, at midspan.
    expect(bmd).toContain("9.0 kN·m");
    expect(bmd).toMatch(/at \d+\.\d+ m along E\d/);
    expect(bmd).toContain("max");
    expect(bmd).toContain("min");
  });

  it("labels shear peaks with a force unit, not a moment one", () => {
    seedSolvedBeam();
    render(<ResultsArea />);
    const sfd = screen.getByText(/SFD/).textContent ?? "";
    expect(sfd).toContain("kN");
    expect(sfd).not.toContain("kN·m");
  });

  it("distinguishes tension from compression by sign in the text alone", () => {
    seedSolvedTruss();
    render(<ResultsArea />);
    const nfd = screen.getByText(/NFD/).textContent ?? "";
    // FR-14: the sense is a word, never an extra colour.
    expect(nfd).toContain("compression");
    expect(nfd).toMatch(/[+−]/);
  });

  it("lists a Reaction for every supported Node, each prefixed R:", () => {
    seedSolvedBeam();
    render(<ResultsArea />);
    // The two Supports react; the free midspan Node does not appear.
    screen.getByText("N1");
    screen.getByText("N3");
    expect(screen.queryByText("N2")).toBeNull();
    const tags = screen.getAllByText(/^R: /);
    expect(tags.length).toBeGreaterThanOrEqual(6);
  });

  it("empties as soon as an edit invalidates the results", () => {
    seedSolvedBeam();
    render(<ResultsArea />);
    screen.getByText(/BMD/);

    act(() => {
      useStructureStore.getState().updateNode("b", { x: 4 });
    });

    // No stale curve left behind -- the structure on screen changed.
    screen.getByText(EMPTY_NOTE);
    expect(screen.queryByText(/BMD/)).toBeNull();
  });

  it("shows the empty note when a Solve is refused", () => {
    const store = useStructureStore.getState();
    store.addNode({ id: "a", x: 0, y: 0, support: "FIXED" });
    useStructureStore.getState().solve();
    render(<ResultsArea />);
    screen.getByText(EMPTY_NOTE);
  });

  it("draws a curve for each diagram rather than an empty card", () => {
    seedSolvedBeam();
    const { container } = render(<ResultsArea />);
    const curves = container.querySelectorAll("polyline.diagram-curve");
    expect(curves.length).toBe(3);
    for (const curve of curves) {
      expect(curve.getAttribute("points")).not.toBe("");
      expect(curve.getAttribute("points")).not.toContain("NaN");
    }
  });

  it("draws a flat line rather than NaN coordinates for an unloaded structure", () => {
    const store = useStructureStore.getState();
    store.addNode({ id: "a", x: 0, y: 0, support: "FIXED" });
    store.addNode({ id: "b", x: 4, y: 0, support: "FREE" });
    useStructureStore.getState().addElement(steel("ab", "a", "b"));
    useStructureStore.getState().solve();

    const { container } = render(<ResultsArea />);
    for (const curve of container.querySelectorAll("polyline.diagram-curve")) {
      expect(curve.getAttribute("points")).not.toContain("NaN");
    }
  });
});

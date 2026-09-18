// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

/**
 * Portal frame, fixed bases, UDL on the beam.
 *
 * The second column is drawn top-down while the first is drawn bottom-up,
 * which is how a student draws one -- and is exactly the case a strip view
 * renders antisymmetrically for a symmetric structure.
 */
function seedSolvedPortalFrame() {
  const store = useStructureStore.getState();
  store.addNode({ id: "a", x: 0, y: 0, support: "FIXED" });
  store.addNode({ id: "b", x: 0, y: 4, support: "FREE" });
  store.addNode({ id: "c", x: 6, y: 4, support: "FREE" });
  store.addNode({ id: "d", x: 6, y: 0, support: "FIXED" });
  useStructureStore.getState().addElement(steel("ab", "a", "b"));
  useStructureStore.getState().addElement(steel("bc", "b", "c"));
  useStructureStore.getState().addElement(steel("cd", "c", "d"));
  useStructureStore
    .getState()
    .addLoad(createLoad("w", "udl", elementTarget("bc"), 10000, AXIS_DIRECTIONS["-y"]));
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
    render(<ResultsArea isBeamPreset={false} />);
    screen.getByText(EMPTY_NOTE);
    expect(screen.queryByText("BMD")).toBeNull();
  });

  it("renders all four cards unprompted after a successful Solve", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    // No second gate: results appear without the user asking for them.
    screen.getByText(/BMD/);
    screen.getByText(/SFD/);
    screen.getByText(/NFD/);
    screen.getByText("Reactions");
    expect(screen.queryByText(EMPTY_NOTE)).toBeNull();
  });

  it("reports the solved state in the results head", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    screen.getByText("Solved ✓");
  });

  it("labels both peak values with their locations, not just the curve shape", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    const bmd = screen.getByText(/BMD/).textContent ?? "";
    // wL^2/8 = 2000 * 36 / 8 = 9000 N·m = 9.0 kN·m, at midspan.
    expect(bmd).toContain("9.0 kN·m");
    expect(bmd).toMatch(/at \d+\.\d+ m along E\d/);
    expect(bmd).toContain("max");
    expect(bmd).toContain("min");
  });

  it("labels shear peaks with a force unit, not a moment one", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    const sfd = screen.getByText(/SFD/).textContent ?? "";
    expect(sfd).toContain("kN");
    expect(sfd).not.toContain("kN·m");
  });

  it("distinguishes tension from compression by sign in the text alone", () => {
    seedSolvedTruss();
    render(<ResultsArea isBeamPreset={false} />);
    const nfd = screen.getByText(/NFD/).textContent ?? "";
    // FR-14: the sense is a word, never an extra colour.
    expect(nfd).toContain("compression");
    expect(nfd).toMatch(/[+−]/);
  });

  it("lists a Reaction for every supported Node, each prefixed R:", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    // The two Supports react; the free midspan Node does not appear.
    screen.getByText("N1");
    screen.getByText("N3");
    expect(screen.queryByText("N2")).toBeNull();
    const tags = screen.getAllByText(/^R: /);
    expect(tags.length).toBeGreaterThanOrEqual(6);
  });

  it("empties as soon as an edit invalidates the results", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
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
    render(<ResultsArea isBeamPreset={false} />);
    screen.getByText(EMPTY_NOTE);
  });

  it("draws a curve for each diagram rather than an empty card", () => {
    seedSolvedBeam();
    const { container } = render(<ResultsArea isBeamPreset />);
    // One polyline per member per card, never one spanning both: joining them
    // would draw a ramp across a shear step that is a real discontinuity.
    const curves = container.querySelectorAll("polyline.diagram-curve");
    expect(curves.length).toBe(6);
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

    const { container } = render(<ResultsArea isBeamPreset />);
    for (const curve of container.querySelectorAll("polyline.diagram-curve")) {
      expect(curve.getAttribute("points")).not.toContain("NaN");
    }
  });

  it("draws a Frame on its own geometry, not on a flattened strip", () => {
    seedSolvedPortalFrame();
    const { container } = render(<ResultsArea isBeamPreset={false} />);
    // The strip view is a polyline in card space; the geometry view is a path
    // in world metres. A Frame must never get the strip.
    expect(container.querySelectorAll("polyline.diagram-curve").length).toBe(0);
    const curves = container.querySelectorAll("path.diagram-curve");
    expect(curves.length).toBeGreaterThan(0);
    for (const curve of curves) {
      expect(curve.getAttribute("d")).not.toContain("NaN");
    }
    // The structure itself is drawn under the diagram, once per member.
    expect(container.querySelectorAll("path.structure-member").length).toBe(9);
  });

  it("omits the BMD and SFD for a Truss, which carries no bending", () => {
    seedSolvedTruss();
    render(<ResultsArea isBeamPreset={false} />);
    // FR-12/FR-13 scope both to "a solved Frame/Beam structure". Two flat
    // cards would present the absence of bending as a computed result.
    expect(screen.queryByText(/BMD/)).toBeNull();
    expect(screen.queryByText(/SFD/)).toBeNull();
    screen.getByText(/NFD/);
  });

  it("lists every Truss member's axial force with its sense", () => {
    seedSolvedTruss();
    render(<ResultsArea isBeamPreset={false} />);
    screen.getByText("Member forces");
    // Both members of the two-bar truss, each named and signed.
    const compression = screen.getAllByText(/compression/);
    expect(compression.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Show Steps (FR-16, FR-17)", () => {
  function stepsSwitch() {
    return screen.getByRole("switch", { name: /show steps/i });
  }

  it("offers the switch but disables it before any Solve", () => {
    render(<ResultsArea isBeamPreset={false} />);
    // Disabled, not absent: "disabled (not merely empty)".
    expect(stepsSwitch().hasAttribute("disabled")).toBe(true);
    expect(stepsSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("enables the switch after a successful Solve, still off", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    expect(stepsSwitch().hasAttribute("disabled")).toBe(false);
    // Never auto-opened: results are unprompted, this is the deliberate gate.
    expect(stepsSwitch().getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByLabelText("Show Steps")).toBeNull();
  });

  it("opens and closes the panel", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    expect(useStructureStore.getState().showSteps).toBe(true);
    screen.getByLabelText("Show Steps");

    fireEvent.click(stepsSwitch());
    expect(screen.queryByLabelText("Show Steps")).toBeNull();
  });

  it("closes the panel with the results when the structure is edited", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    screen.getByLabelText("Show Steps");

    act(() => {
      useStructureStore.getState().updateNode("b", { x: 4 });
    });

    // Together, not independently.
    expect(screen.queryByLabelText("Show Steps")).toBeNull();
    screen.getByText(EMPTY_NOTE);
    expect(stepsSwitch().hasAttribute("disabled")).toBe(true);
  });

  it("returns to closed when the structure is solved again", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    act(() => useStructureStore.getState().solve());
    expect(screen.queryByLabelText("Show Steps")).toBeNull();
  });

  it("shows one local stiffness matrix per Element, from the solved result", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    screen.getByText("Element E1");
    screen.getByText("Element E2");
    // Rendered as equations, labelled for assistive tech.
    expect(
      screen.getAllByRole("img", { name: /Local stiffness matrix for Element/ }),
    ).toHaveLength(2);
  });

  it("shows the values substituted into each matrix", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    const panel = screen.getByLabelText("Show Steps");
    // E, A, I and L, so the numbers are traceable to their inputs.
    expect(panel.textContent).toContain("200 GPa");
    expect(panel.textContent).toContain("m²");
    expect(panel.textContent).toContain("m⁴");
  });

  it("omits inertia for a Truss, which carries no bending", () => {
    seedSolvedTruss();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    expect(screen.getByLabelText("Show Steps").textContent).not.toContain("m⁴");
  });

  it("captions a Beam Project, verbatim", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset />);
    fireEvent.click(stepsSwitch());
    screen.getByText(
      "Beam is solved as a Frame — the matrices below use Frame notation.",
    );
  });

  it("renders every equation in the panel, with nothing left unparsed", () => {
    seedSolvedBeam();
    const { container } = render(<ResultsArea isBeamPreset />);
    fireEvent.click(stepsSwitch());
    // Covers the symbolic formula and both numeric matrices at once. KaTeX
    // marks a parse failure with this class rather than throwing, so without
    // this the broken source renders and every other assertion still passes.
    expect(container.querySelectorAll(".katex-error")).toHaveLength(0);
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(3);
  });

  it("numbers every Node's degrees of freedom (FR-18)", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    const panel = screen.getByLabelText("Show Steps");
    expect(panel.textContent).toContain("Degree of freedom numbering");
    expect(panel.textContent).toContain("Where each Element lands");
  });

  it("renders the assembled global matrix for a small structure", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    // Three Frame Nodes: 9x9, comfortably under the readable threshold.
    screen.getByRole("img", { name: "Assembled global stiffness matrix" });
  });

  it("declines to render a global matrix too large to read", () => {
    // Six Frame Nodes is 18x18, past the threshold: the panel says so rather
    // than typesetting something unusable.
    const store = useStructureStore.getState();
    for (let i = 0; i < 6; i += 1) {
      store.addNode({
        id: `n${i}`,
        x: i,
        y: 0,
        support: i === 0 ? "FIXED" : "FREE",
      });
    }
    for (let i = 0; i < 5; i += 1) {
      useStructureStore.getState().addElement(steel(`e${i}`, `n${i}`, `n${i + 1}`));
    }
    useStructureStore
      .getState()
      .addLoad(createLoad("p", "concentrated", nodeTarget("n5"), 5000, AXIS_DIRECTIONS["-y"]));
    useStructureStore.getState().solve();

    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    expect(screen.queryByRole("img", { name: "Assembled global stiffness matrix" })).toBeNull();
    expect(screen.getByLabelText("Show Steps").textContent).toContain("18 × 18");
  });

  it("omits the rotational DOF number for a Truss Node", () => {
    seedSolvedTruss();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    // A Truss Node has no rotation to number, shown as an em dash.
    expect(screen.getByLabelText("Show Steps").textContent).toContain("—");
  });

  it("names the DOFs the Supports eliminated (FR-19)", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    const panel = screen.getByLabelText("Show Steps");
    // Hinge at N1 removes ux and uy; Roller at N3 removes uy.
    expect(panel.textContent).toContain("N1:ux");
    expect(panel.textContent).toContain("N3:uy");
    expect(panel.textContent).toContain("Eliminated by Supports");
  });

  it("shows the reduced system it actually solved", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    screen.getByRole("img", { name: "Reduced stiffness matrix" });
    screen.getByRole("img", { name: "Reduced load vector" });
  });

  it("lists every displacement, marking which came from a Support", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    const panel = screen.getByLabelText("Show Steps");
    // Free DOFs are solved; restrained ones are zero by definition.
    expect(panel.textContent).toContain("Support (zero)");
    expect(panel.textContent).toContain("solved");
    expect(panel.textContent).toContain("rad");
  });

  it("omits the rotational row for a Truss, which has no such freedom", () => {
    seedSolvedTruss();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    expect(screen.getByLabelText("Show Steps").textContent).not.toContain("rad");
  });

  it("never captions a non-Beam Project", () => {
    seedSolvedBeam();
    render(<ResultsArea isBeamPreset={false} />);
    fireEvent.click(stepsSwitch());
    expect(screen.queryByText(/Beam is solved as a Frame/)).toBeNull();
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DiagramPane from "./DiagramPane";
import ViewSwitch, { viewsFor } from "./ViewSwitch";
import useStructureStore from "@/store/useStructureStore";
import { AXIS_DIRECTIONS, createLoad, elementTarget, nodeTarget } from "@/engine/load";

function steel(id: string, startNode: string, endNode: string) {
  return {
    id,
    material: "STEEL" as const,
    startNode,
    endNode,
    crossSectionId: null,
    area: 0.01,
    inertia: 1e-4,
  };
}

/** Portal frame with the columns drawn in opposite directions, as a user would. */
function seedPortalFrame() {
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

function seedTruss() {
  const store = useStructureStore.getState();
  store.setStructureType("TRUSS");
  const fresh = useStructureStore.getState();
  fresh.addNode({ id: "a", x: 0, y: 0, support: "HINGE" });
  fresh.addNode({ id: "b", x: 4, y: 0, support: "ROLLER" });
  fresh.addNode({ id: "c", x: 2, y: 3, support: "FREE" });
  useStructureStore.getState().addElement(steel("ab", "a", "b"));
  useStructureStore.getState().addElement(steel("ac", "a", "c"));
  useStructureStore.getState().addElement(steel("bc", "b", "c"));
  useStructureStore
    .getState()
    .addLoad(createLoad("p", "concentrated", nodeTarget("c"), 20000, AXIS_DIRECTIONS["-y"]));
  useStructureStore.getState().solve();
}

beforeEach(() => useStructureStore.getState().clearAll());
afterEach(cleanup);

describe("DiagramPane", () => {
  it("draws every member of the structure, not a flattened strip", () => {
    seedPortalFrame();
    const { container } = render(<DiagramPane kind="moment" />);
    expect(container.querySelectorAll("path.structure-member").length).toBe(3);
    const curves = container.querySelectorAll("path.diagram-curve");
    expect(curves.length).toBe(3);
    for (const curve of curves) {
      expect(curve.getAttribute("d")).not.toContain("NaN");
      expect(curve.getAttribute("d")).not.toBe("");
    }
  });

  it("labels the joint moments, which is what a Frame is read for", () => {
    seedPortalFrame();
    render(<DiagramPane kind="moment" />);
    // Both columns and both beam ends carry the same -22.48 kN·m at the
    // joints; the fixed bases carry 11.19.
    expect(screen.getAllByText("-22.5 kN·m").length).toBe(4);
    expect(screen.getAllByText("11.2 kN·m").length).toBe(2);
  });

  it("carries no peak marker of its own, which collided with the end values", () => {
    seedPortalFrame();
    const { container } = render(<DiagramPane kind="moment" />);
    // A peak that falls on a member end sat exactly on top of that end's
    // label. The peaks are reported in the results table below instead.
    expect(container.querySelectorAll("circle.diagram-peak-dot").length).toBe(0);
    expect(container.querySelectorAll(".diagram-peak-label").length).toBe(0);
  });

  it("names each member on the drawing", () => {
    seedPortalFrame();
    render(<DiagramPane kind="moment" />);
    screen.getByText("E1");
    screen.getByText("E2");
    screen.getByText("E3");
  });

  it("states the sign convention rather than leaving it to be inferred", () => {
    seedPortalFrame();
    render(<DiagramPane kind="moment" />);
    // The PRD never fixed one, so a student has no way to tell a correct
    // diagram from an upside-down one without this being said.
    expect(screen.getByText(/drawn on the tension side/)).toBeDefined();
  });

  it("carries an accessible name, since the drawing itself is not text", () => {
    seedPortalFrame();
    render(<DiagramPane kind="moment" />);
    const figure = screen.getByRole("img");
    expect(figure.getAttribute("aria-label")).toContain("Bending moment diagram");
  });

  it("labels a Truss member's axial force with its sense", () => {
    seedTruss();
    render(<DiagramPane kind="axial" />);
    // FR-14: the sense is a word, never an extra colour.
    expect(screen.getAllByText(/compression/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tension/).length).toBeGreaterThan(0);
  });

  it("renders nothing once an edit has invalidated the results", () => {
    seedPortalFrame();
    useStructureStore.getState().updateNode("b", { x: 1 });
    const { container } = render(<DiagramPane kind="moment" />);
    // AD-3 clears results on any structural edit; a diagram of a structure
    // that no longer exists is worse than no diagram.
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("ViewSwitch", () => {
  it("offers no BMD or SFD for a Truss", () => {
    // FR-12/FR-13 scope both to a Frame or Beam. Offering them disabled would
    // imply a Solve could fill them in.
    expect(viewsFor(true)).toEqual(["MODEL", "axial"]);
    expect(viewsFor(false)).toEqual(["MODEL", "moment", "shear", "axial"]);
  });

  it("disables the diagrams until a Solve succeeds, but still shows them", () => {
    render(
      <ViewSwitch view="MODEL" onViewChange={() => {}} isTruss={false} solved={false} />,
    );
    // Disabled, not absent: the diagrams are visibly something this structure
    // will have once it solves.
    const model = screen.getByRole("radio", { name: "Model" });
    const bmd = screen.getByRole("radio", { name: "Bending moment diagram" });
    expect(model.hasAttribute("disabled")).toBe(false);
    expect(bmd.hasAttribute("disabled")).toBe(true);
  });

  it("enables the diagrams once solved and marks the active one", () => {
    render(
      <ViewSwitch view="moment" onViewChange={() => {}} isTruss={false} solved />,
    );
    const bmd = screen.getByRole("radio", { name: "Bending moment diagram" });
    expect(bmd.hasAttribute("disabled")).toBe(false);
    expect(bmd.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByRole("radio", { name: "Model" }).getAttribute("aria-checked"),
    ).toBe("false");
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import UnitsToggle from "./UnitsToggle";
import useUnitStore from "@/store/useUnitStore";
import useStructureStore from "@/store/useStructureStore";
import { AXIS_DIRECTIONS, createLoad, nodeTarget } from "@/engine/load";

function unitSelect() {
  return screen.getByLabelText("Units") as HTMLSelectElement;
}

function choose(system: string) {
  fireEvent.change(unitSelect(), { target: { value: system } });
}

function seedSolvedBeam() {
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
    .addLoad(createLoad("l", "concentrated", nodeTarget("b"), 5000, AXIS_DIRECTIONS["-y"]));
  useStructureStore.getState().solve();
}

beforeEach(() => {
  useUnitStore.getState().setSystem("SI");
  useStructureStore.getState().clearAll();
});

afterEach(cleanup);

describe("UnitsToggle", () => {
  it("starts on SI", () => {
    render(<UnitsToggle />);
    expect(unitSelect().value).toBe("SI");
  });

  it("switches the preference", () => {
    render(<UnitsToggle />);
    choose("IMPERIAL");
    expect(useUnitStore.getState().system).toBe("IMPERIAL");
  });

  it("names the units in each option, not just the system", () => {
    render(<UnitsToggle />);
    const labels = Array.from(unitSelect().options).map((o) => o.textContent);
    expect(labels[0]).toContain("kN");
    expect(labels[1]).toContain("kip");
  });

  it("is reachable by its label", () => {
    render(<UnitsToggle />);
    expect(unitSelect().tagName).toBe("SELECT");
  });

  // The AC that matters most: a unit change is not a structural edit (AD-4).
  it("never clears a solved result", () => {
    seedSolvedBeam();
    const before = useStructureStore.getState().results;
    expect(before).not.toBeNull();

    render(<UnitsToggle />);
    choose("IMPERIAL");
    choose("SI");
    choose("IMPERIAL");

    // Same object, not merely an equal one: nothing re-solved or re-derived.
    expect(useStructureStore.getState().results).toBe(before);
    expect(useStructureStore.getState().solveErrors).toEqual([]);
  });

  it("never touches a stored value", () => {
    seedSolvedBeam();
    const storedArea = useStructureStore.getState().elements[0].area;
    const storedMagnitude = useStructureStore.getState().loads[0].magnitude;

    render(<UnitsToggle />);
    choose("IMPERIAL");
    choose("SI");

    // Bit-identical: the store is always SI, so a toggle cannot drift it.
    expect(useStructureStore.getState().elements[0].area).toBe(storedArea);
    expect(useStructureStore.getState().loads[0].magnitude).toBe(storedMagnitude);
  });

  it("never clears Show Steps either", () => {
    seedSolvedBeam();
    useStructureStore.getState().setShowSteps(true);
    render(<UnitsToggle />);
    choose("IMPERIAL");
    expect(useStructureStore.getState().showSteps).toBe(true);
  });
});

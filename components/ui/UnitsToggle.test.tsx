// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import UnitsToggle from "./UnitsToggle";
import useUnitStore from "@/store/useUnitStore";
import useStructureStore from "@/store/useStructureStore";
import { AXIS_DIRECTIONS, createLoad, nodeTarget } from "@/engine/load";

function option(name: string) {
  return screen.getByRole("button", { name });
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
    expect(option("SI").getAttribute("aria-pressed")).toBe("true");
    expect(option("Imperial").getAttribute("aria-pressed")).toBe("false");
  });

  it("switches the preference", () => {
    render(<UnitsToggle />);
    fireEvent.click(option("Imperial"));
    expect(useUnitStore.getState().system).toBe("IMPERIAL");
  });

  // The AC that matters most: a unit change is not a structural edit (AD-4).
  it("never clears a solved result", () => {
    seedSolvedBeam();
    const before = useStructureStore.getState().results;
    expect(before).not.toBeNull();

    render(<UnitsToggle />);
    fireEvent.click(option("Imperial"));
    fireEvent.click(option("SI"));
    fireEvent.click(option("Imperial"));

    // Same object, not merely an equal one: nothing re-solved or re-derived.
    expect(useStructureStore.getState().results).toBe(before);
    expect(useStructureStore.getState().solveErrors).toEqual([]);
  });

  it("never touches a stored value", () => {
    seedSolvedBeam();
    const storedArea = useStructureStore.getState().elements[0].area;
    const storedMagnitude = useStructureStore.getState().loads[0].magnitude;

    render(<UnitsToggle />);
    fireEvent.click(option("Imperial"));
    fireEvent.click(option("SI"));

    // Bit-identical: the store is always SI, so a toggle cannot drift it.
    expect(useStructureStore.getState().elements[0].area).toBe(storedArea);
    expect(useStructureStore.getState().loads[0].magnitude).toBe(storedMagnitude);
  });

  it("never clears Show Steps either", () => {
    seedSolvedBeam();
    useStructureStore.getState().setShowSteps(true);
    render(<UnitsToggle />);
    fireEvent.click(option("Imperial"));
    expect(useStructureStore.getState().showSteps).toBe(true);
  });
});

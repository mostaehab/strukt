import { beforeEach, describe, expect, it } from "vitest";
import useStructureStore from "./useStructureStore";
import { findCrossSection } from "../engine/catalog/crossSections";
import { createElement } from "../engine/element";
import {
  AXIS_DIRECTIONS,
  createLoad,
  elementTarget,
  nodeTarget,
  type AxisDirection,
} from "../engine/load";
import { resolveNodeLoad } from "../engine/loadResolution";
import type { StructuralElement, StructuralNode } from "../engine/types";

const W12X26 = findCrossSection("W12X26")!;
const RECT = findCrossSection("RECT-300X500")!;

function unassignedElement(): StructuralElement {
  return {
    id: "e1",
    material: null,
    startNode: "a",
    endNode: "b",
    crossSectionId: null,
    area: null,
    inertia: null,
  };
}

function seed(overrides: Partial<StructuralElement> = {}) {
  useStructureStore.getState().clearAll();
  useStructureStore
    .getState()
    .addElement({ ...unassignedElement(), ...overrides });
}

function element() {
  return useStructureStore.getState().elements[0];
}

describe("updateElement Cross-Section invariants", () => {
  beforeEach(() => {
    useStructureStore.getState().clearAll();
  });

  it("auto-fills area and inertia from the catalog when a section is chosen", () => {
    seed({ material: "STEEL" });
    useStructureStore.getState().updateElement("e1", {
      crossSectionId: "W12X26",
    });
    expect(element().crossSectionId).toBe("W12X26");
    expect(element().area).toBe(W12X26.area);
    expect(element().inertia).toBe(W12X26.inertia);
  });

  it("lets a catalog section replace a manual override outright", () => {
    seed({ material: "STEEL", area: 0.01, inertia: 0.002 });
    useStructureStore.getState().updateElement("e1", {
      crossSectionId: "W12X26",
    });
    expect(element().area).toBe(W12X26.area);
    expect(element().inertia).toBe(W12X26.inertia);
  });

  it("detaches from the catalog when area is entered by hand, keeping the untouched inertia", () => {
    seed({ material: "STEEL" });
    // Seeded through the store so *both* values are genuinely catalog-derived.
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    expect(element().inertia).toBe(W12X26.inertia);

    useStructureStore.getState().updateElement("e1", { area: 0.02 });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBe(0.02);
    // The sibling the user never touched keeps its number and becomes a manual
    // override too, rather than being discarded with the pointer.
    expect(element().inertia).toBe(W12X26.inertia);
  });

  it("clears a catalog section and its derived values when Material changes", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    useStructureStore.getState().updateElement("e1", { material: "CONCRETE" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
    expect(element().inertia).toBeNull();
  });

  it("preserves a manual override across a Material change", () => {
    seed({ material: "STEEL", area: 0.01, inertia: 0.002 });
    useStructureStore.getState().updateElement("e1", { material: "CONCRETE" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBe(0.01);
    expect(element().inertia).toBe(0.002);
  });

  it("leaves everything alone when Material is re-set to the same value", () => {
    seed({ material: "CONCRETE" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: RECT.id });
    useStructureStore.getState().updateElement("e1", { material: "CONCRETE" });
    expect(element().crossSectionId).toBe(RECT.id);
    expect(element().area).toBe(RECT.area);
  });

  it("clears derived values when a catalog section is un-picked", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    useStructureStore.getState().updateElement("e1", { crossSectionId: null });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
    expect(element().inertia).toBeNull();
  });

  it("refuses to attach a Steel W-shape to a Concrete Element", () => {
    seed({ material: "CONCRETE" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
    expect(element().inertia).toBeNull();
  });

  it("leaves a Concrete Element's manual override intact when a Steel section is rejected", () => {
    seed({ material: "CONCRETE", area: 0.01, inertia: 0.002 });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBe(0.01);
    expect(element().inertia).toBe(0.002);
  });

  it("clears the section when one patch carries both Material and a mismatched section", () => {
    seed({ material: "STEEL" });
    useStructureStore.getState().updateElement("e1", {
      material: "CONCRETE",
      crossSectionId: "W12X26",
    });
    expect(element().material).toBe("CONCRETE");
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
    expect(element().inertia).toBeNull();
  });

  it("clears a catalog section when one patch carries both Material and the old pointer", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    // A caller that spreads the whole Element back with a new Material used to
    // slip past the Material-change rule entirely.
    useStructureStore.getState().updateElement("e1", {
      material: "CONCRETE",
      crossSectionId: "W12X26",
    });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
  });

  it("refuses a section for an Element with no Material", () => {
    seed();
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    expect(element().crossSectionId).toBeNull();
    expect(element().area).toBeNull();
  });

  it("rejects a non-positive or non-finite area or inertia from any caller", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      seed({ material: "STEEL", area: 0.01, inertia: 0.002 });
      useStructureStore.getState().updateElement("e1", { area: bad });
      expect(element().area).toBe(0.01);

      useStructureStore.getState().updateElement("e1", { inertia: bad });
      expect(element().inertia).toBe(0.002);
    }
  });

  it("keeps a rejected area from detaching the Element from its catalog section", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "W12X26" });
    useStructureStore.getState().updateElement("e1", { area: -1 });
    expect(element().crossSectionId).toBe("W12X26");
    expect(element().area).toBe(W12X26.area);
  });

  it("still applies a valid sibling edit when the other field is rejected", () => {
    seed({ material: "STEEL" });
    useStructureStore
      .getState()
      .updateElement("e1", { area: 0.03, inertia: -1 });
    expect(element().area).toBe(0.03);
    expect(element().inertia).toBeNull();
  });

  it("degrades an unknown catalog pointer to unassigned instead of keeping stale values", () => {
    seed({ material: "STEEL", area: 0.01, inertia: 0.002 });
    useStructureStore
      .getState()
      .updateElement("e1", { crossSectionId: "NOT-A-SECTION" });
    expect(element().crossSectionId).toBeNull();
    // The pre-existing manual override had no catalog pointer, so it stands.
    expect(element().area).toBe(0.01);
  });
});

function node(id: string, x: number, y: number): StructuralNode {
  return { id, x, y, support: "FREE" };
}

function loads() {
  return useStructureStore.getState().loads;
}

function loadIds() {
  return loads().map((load) => load.id);
}

/**
 * Applies a concentrated Load, seeding its Node first when the test has not.
 * The store refuses a Load whose target does not exist, so a Load in these
 * tests always has a real Node behind it -- as it does in the app.
 */
function addNodeLoad(id: string, nodeId: string, axis: AxisDirection = "-y") {
  const store = useStructureStore.getState();
  if (!store.nodes.some((n) => n.id === nodeId)) {
    store.addNode(node(nodeId, 0, 0));
  }
  return useStructureStore
    .getState()
    .addLoad(
      createLoad(
        id,
        "concentrated",
        nodeTarget(nodeId),
        5000,
        AXIS_DIRECTIONS[axis],
      ),
    );
}

/** As above, for a UDL: the Element (and its end Nodes) must exist first. */
function addElementLoad(id: string, elementId: string) {
  const store = useStructureStore.getState();
  if (!store.elements.some((e) => e.id === elementId)) {
    store.addElement(createElement(elementId, "seed-a", "seed-b"));
  }
  return useStructureStore
    .getState()
    .addLoad(
      createLoad(
        id,
        "udl",
        elementTarget(elementId),
        2000,
        AXIS_DIRECTIONS["-y"],
      ),
    );
}

describe("Load actions", () => {
  beforeEach(() => {
    useStructureStore.getState().clearAll();
  });

  it("starts with no Loads", () => {
    expect(loads()).toEqual([]);
  });

  // Matrix row: Loads on one target sum -- both persist as separate entries,
  // never accumulated into a field (AD-10).
  it("keeps two Loads on one Node as separate entries", () => {
    addNodeLoad("l1", "n1");
    addNodeLoad("l2", "n1", "+y");
    expect(loadIds()).toEqual(["l1", "l2"]);
    // Matrix row: Opposing Loads cancel -- resolved off real store state, not
    // just off a hand-built array in the engine test.
    expect(resolveNodeLoad(loads(), "n1")).toEqual({ x: 0, y: 0 });
  });

  // Matrix row: Delete one of two Loads -- the other survives.
  it("deletes one Load and leaves its sibling on the same Node", () => {
    addNodeLoad("l1", "n1");
    addNodeLoad("l2", "n1");
    useStructureStore.getState().deleteLoad("l1");
    expect(loadIds()).toEqual(["l2"]);
    expect(resolveNodeLoad(loads(), "n1")).toEqual({ x: 0, y: -5000 });
  });

  it("updates a Load magnitude and direction in place", () => {
    addNodeLoad("l1", "n1");
    useStructureStore
      .getState()
      .updateLoad("l1", { magnitude: 8000, direction: [1, 0] });
    expect(loads()[0].magnitude).toBe(8000);
    expect(loads()[0].direction).toEqual([1, 0]);
  });

  // Matrix row: Non-positive magnitude. The panel rejects at the field, but it
  // is not the only writer, so the invariant is enforced here too.
  it("refuses a non-positive or non-finite magnitude from any caller", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      useStructureStore.getState().clearAll();
      useStructureStore
        .getState()
        .addLoad(
          createLoad("l1", "concentrated", nodeTarget("n1"), bad, [0, -1]),
        );
      expect(loads()).toEqual([]);
    }
  });

  it("leaves a stored magnitude intact when an update carries a bad one", () => {
    addNodeLoad("l1", "n1");
    useStructureStore.getState().updateLoad("l1", { magnitude: 0 });
    expect(loads()[0].magnitude).toBe(5000);
    useStructureStore.getState().updateLoad("l1", { magnitude: Number.NaN });
    expect(loads()[0].magnitude).toBe(5000);
  });

  it("leaves a stored direction intact when an update carries a bad one", () => {
    addNodeLoad("l1", "n1");
    useStructureStore
      .getState()
      .updateLoad("l1", { direction: [Number.NaN, 0] });
    expect(loads()[0].direction).toEqual([0, -1]);
  });

  it("clears Loads along with everything else", () => {
    addNodeLoad("l1", "n1");
    useStructureStore.getState().clearAll();
    expect(loads()).toEqual([]);
  });
});

describe("Load referential integrity and normalisation", () => {
  beforeEach(() => {
    useStructureStore.getState().clearAll();
  });

  // An orphaned Load is invisible in the panel and skipped by the canvas, yet
  // it still counts against the Structure Type guard -- a blocked Project with
  // no visible cause and no control to clear it.
  it("refuses a Load whose target Node does not exist", () => {
    const applied = useStructureStore
      .getState()
      .addLoad(
        createLoad("l1", "concentrated", nodeTarget("ghost"), 5000, [0, -1]),
      );
    expect(applied).toBe(false);
    expect(loads()).toEqual([]);
  });

  it("refuses a UDL whose target Element does not exist", () => {
    const applied = useStructureStore
      .getState()
      .addLoad(
        createLoad("l1", "udl", elementTarget("ghost"), 2000, [0, -1]),
      );
    expect(applied).toBe(false);
    expect(loads()).toEqual([]);
  });

  it("reports success when the Load is stored", () => {
    expect(addNodeLoad("l1", "n1")).toBe(true);
    expect(loadIds()).toEqual(["l1"]);
  });

  // Length is not a second magnitude: 5000 N along [0, -5000] is 5000 N down,
  // not 25 MN down.
  it("normalises a non-unit direction on the way in", () => {
    useStructureStore.getState().addNode(node("n1", 0, 0));
    useStructureStore
      .getState()
      .addLoad(
        createLoad("l1", "concentrated", nodeTarget("n1"), 5000, [0, -5000]),
      );
    expect(loads()[0].direction).toEqual([0, -1]);
    expect(resolveNodeLoad(loads(), "n1")).toEqual({ x: 0, y: -5000 });
  });

  it("leaves an already-unit direction exactly as it was", () => {
    useStructureStore.getState().addNode(node("n1", 0, 0));
    const diagonal: [number, number] = [Math.SQRT1_2, -Math.SQRT1_2];
    useStructureStore
      .getState()
      .addLoad(
        createLoad("l1", "concentrated", nodeTarget("n1"), 1000, diagonal),
      );
    expect(loads()[0].direction).toEqual(diagonal);
  });

  // [0, 0] would draw a convincing downward arrow while resolving to exactly
  // zero -- a Load that looks applied and does nothing.
  it("refuses a direction with no direction at all", () => {
    useStructureStore.getState().addNode(node("n1", 0, 0));
    const applied = useStructureStore
      .getState()
      .addLoad(createLoad("l1", "concentrated", nodeTarget("n1"), 5000, [0, 0]));
    expect(applied).toBe(false);
    expect(loads()).toEqual([]);
  });

  it("refuses a non-finite direction on the add path", () => {
    useStructureStore.getState().addNode(node("n1", 0, 0));
    for (const bad of [
      [Number.NaN, 0],
      [Number.POSITIVE_INFINITY, 1],
    ] as [number, number][]) {
      const applied = useStructureStore
        .getState()
        .addLoad(
          createLoad("l1", "concentrated", nodeTarget("n1"), 5000, bad),
        );
      expect(applied).toBe(false);
      expect(loads()).toEqual([]);
    }
  });

  it("never keeps a reference to the caller's direction array", () => {
    useStructureStore.getState().addNode(node("n1", 0, 0));
    const mutable: [number, number] = [0, -1];
    useStructureStore
      .getState()
      .addLoad(
        createLoad("l1", "concentrated", nodeTarget("n1"), 5000, mutable),
      );
    mutable[0] = 99;
    expect(loads()[0].direction).toEqual([0, -1]);

    const patch: [number, number] = [1, 0];
    useStructureStore.getState().updateLoad("l1", { direction: patch });
    patch[1] = 99;
    expect(loads()[0].direction).toEqual([1, 0]);
  });

  // Rewriting an id duplicates React keys and makes one deleteLoad remove two
  // entries; retargeting points a Load at an entity the cascades never check.
  it("refuses to rewrite a Load id, kind or target through updateLoad", () => {
    addNodeLoad("l1", "n1");
    useStructureStore.getState().updateLoad("l1", {
      id: "l2",
      kind: "udl",
      target: elementTarget("e9"),
      magnitude: 9000,
    } as never);

    const [load] = loads();
    expect(load.id).toBe("l1");
    expect(load.kind).toBe("concentrated");
    expect(load.target).toEqual({ type: "node", nodeId: "n1" });
    // The one mutable field in that patch still landed.
    expect(load.magnitude).toBe(9000);
  });

  it("reports whether an update changed anything", () => {
    addNodeLoad("l1", "n1");
    expect(useStructureStore.getState().updateLoad("l1", { magnitude: 1 })).toBe(
      true,
    );
    expect(useStructureStore.getState().updateLoad("l1", { magnitude: 0 })).toBe(
      false,
    );
    expect(
      useStructureStore.getState().updateLoad("gone", { magnitude: 1 }),
    ).toBe(false);
  });
});

describe("Load cascade deletes", () => {
  beforeEach(() => {
    useStructureStore.getState().clearAll();
  });

  // Matrix row: Node delete, two-level cascade -- the Node's own Loads *and*
  // the UDLs on every Element the cascade removes with it.
  it("removes a deleted Node's Loads and its Elements' UDLs together", () => {
    const store = useStructureStore.getState();
    store.addNode(node("n1", 0, 0));
    store.addNode(node("n2", 2, 0));
    store.addNode(node("n3", 5, 0));
    store.addElement(createElement("e1", "n1", "n2"));
    store.addElement(createElement("e2", "n2", "n3"));
    addNodeLoad("l-n1", "n1");
    addNodeLoad("l-n3", "n3");
    addElementLoad("l-e1", "e1");
    addElementLoad("l-e2", "e2");

    useStructureStore.getState().deleteNode("n1");

    // n1 went, e1 went with it, and both their Loads went with them; the
    // untouched Node's Load and the untouched Element's UDL stayed.
    expect(useStructureStore.getState().nodes.map((n) => n.id)).toEqual([
      "n2",
      "n3",
    ]);
    expect(useStructureStore.getState().elements.map((e) => e.id)).toEqual([
      "e2",
    ]);
    expect(loadIds()).toEqual(["l-n3", "l-e2"]);
  });

  // Acceptance criterion: no Load referencing either removed entity remains.
  it("leaves no orphaned Load pointing at a removed Node or Element", () => {
    const store = useStructureStore.getState();
    store.addNode(node("n1", 0, 0));
    store.addNode(node("n2", 2, 0));
    store.addElement(createElement("e1", "n1", "n2"));
    addNodeLoad("l-n1", "n1");
    addElementLoad("l-e1", "e1");

    useStructureStore.getState().deleteNode("n1");

    const state = useStructureStore.getState();
    for (const load of state.loads) {
      if (load.target.type === "node") {
        const { nodeId } = load.target;
        expect(state.nodes.some((n) => n.id === nodeId)).toBe(true);
      } else {
        const { elementId } = load.target;
        expect(state.elements.some((e) => e.id === elementId)).toBe(true);
      }
    }
    expect(loadIds()).toEqual([]);
  });

  it("keeps a Load on a Node the cascade never touched", () => {
    const store = useStructureStore.getState();
    store.addNode(node("n1", 0, 0));
    store.addNode(node("n2", 2, 0));
    store.addElement(createElement("e1", "n1", "n2"));
    addNodeLoad("l-n2", "n2");

    useStructureStore.getState().deleteNode("n1");
    expect(loadIds()).toEqual(["l-n2"]);
  });

  // Matrix row: Element delete -- its UDLs go, Loads on its end Nodes stay.
  it("removes a deleted Element's UDLs and leaves its end Nodes' Loads", () => {
    const store = useStructureStore.getState();
    store.addNode(node("n1", 0, 0));
    store.addNode(node("n2", 2, 0));
    store.addElement(createElement("e1", "n1", "n2"));
    addNodeLoad("l-n1", "n1");
    addNodeLoad("l-n2", "n2");
    addElementLoad("l-e1", "e1");

    useStructureStore.getState().deleteElement("e1");

    expect(loadIds()).toEqual(["l-n1", "l-n2"]);
    expect(useStructureStore.getState().nodes).toHaveLength(2);
  });

  it("leaves other Elements' UDLs alone when one Element is deleted", () => {
    const store = useStructureStore.getState();
    store.addNode(node("n1", 0, 0));
    store.addNode(node("n2", 2, 0));
    store.addNode(node("n3", 5, 0));
    store.addElement(createElement("e1", "n1", "n2"));
    store.addElement(createElement("e2", "n2", "n3"));
    addElementLoad("l-e1", "e1");
    addElementLoad("l-e2", "e2");

    useStructureStore.getState().deleteElement("e1");
    expect(loadIds()).toEqual(["l-e2"]);
  });

  // Matrix row: Load on an isolated Node -- stored, nothing blocks it here.
  it("stores a Load on a Node with no Element", () => {
    useStructureStore.getState().addNode(node("n1", 0, 0));
    addNodeLoad("l1", "n1");
    expect(loadIds()).toEqual(["l1"]);
  });
});

describe("setStructureType Load guard", () => {
  beforeEach(() => {
    useStructureStore.getState().clearAll();
  });

  it("allows a switch on a genuinely empty Project", () => {
    expect(useStructureStore.getState().setStructureType("TRUSS")).toBe(true);
    expect(useStructureStore.getState().type).toBe("TRUSS");
  });

  // Matrix row: Structure Type switch with a Load -- blocked, alongside the
  // existing Node/Element check.
  //
  // Set directly rather than through `addLoad`, which now refuses a Load whose
  // target does not exist: this is the only way to reach the Load half of the
  // guard on its own, with no Node or Element to trip the other half. It
  // proves the Load clause is load-bearing rather than shadowed.
  it("blocks a switch while any Load exists, with nothing else present", () => {
    useStructureStore.setState({
      loads: [
        createLoad("l1", "concentrated", nodeTarget("gone"), 5000, [0, -1]),
      ],
    });
    expect(useStructureStore.getState().nodes).toEqual([]);
    expect(useStructureStore.getState().elements).toEqual([]);
    expect(useStructureStore.getState().setStructureType("TRUSS")).toBe(false);
    expect(useStructureStore.getState().type).toBe("FRAME");
  });

  it("blocks a switch while a Load applied through the store exists", () => {
    addNodeLoad("l1", "n1");
    expect(useStructureStore.getState().setStructureType("TRUSS")).toBe(false);
    expect(useStructureStore.getState().type).toBe("FRAME");
  });

  it("allows a switch again once the Project is emptied", () => {
    addNodeLoad("l1", "n1");
    expect(useStructureStore.getState().setStructureType("TRUSS")).toBe(false);
    useStructureStore.getState().clearAll();
    expect(useStructureStore.getState().setStructureType("TRUSS")).toBe(true);
  });
});

/**
 * AD-3's stale-results rule: an answer must never outlive the structure it was
 * computed from, and the clearing must happen in the mutation's own action --
 * not in an effect, which would repaint one frame showing a stale result.
 *
 * Each case below solves a real structure, asserts a result exists, performs
 * one mutation, and asserts the result is gone. Every one of the nine
 * mutations gets its own case, because the rule is enforced at nine separate
 * sites and a missed one is invisible until a student trusts a stale number.
 */
function solvableBeam() {
  const store = useStructureStore.getState();
  store.clearAll();
  const fresh = useStructureStore.getState();
  fresh.addNode({ id: "s1", x: 0, y: 0, support: "FIXED" });
  fresh.addNode({ id: "s2", x: 4, y: 0, support: "FREE" });
  fresh.addElement({
    id: "se1",
    material: "STEEL",
    startNode: "s1",
    endNode: "s2",
    crossSectionId: null,
    area: 0.01,
    inertia: 8e-5,
  });
  useStructureStore
    .getState()
    .addLoad(createLoad("sl1", "concentrated", nodeTarget("s2"), 5000, AXIS_DIRECTIONS["-y"]));
  useStructureStore.getState().solve();
}

function hasResults() {
  return useStructureStore.getState().results !== null;
}

describe("solve", () => {
  beforeEach(() => useStructureStore.getState().clearAll());

  it("stores a result for a solvable structure", () => {
    solvableBeam();
    expect(hasResults()).toBe(true);
    expect(useStructureStore.getState().solveErrors).toEqual([]);
  });

  it("stores the refusal instead of a result when Solve is blocked", () => {
    useStructureStore.getState().solve();
    expect(useStructureStore.getState().results).toBeNull();
    expect(useStructureStore.getState().solveErrors[0].code).toBe(
      "NOTHING_TO_ANALYZE",
    );
  });

  it("drops a previous result when a later Solve is refused", () => {
    solvableBeam();
    expect(hasResults()).toBe(true);
    // Free the base, then Solve again: the old answer must not survive beside
    // the new complaint (FR-16).
    useStructureStore.getState().updateNode("s1", { support: "FREE" });
    useStructureStore.getState().solve();
    expect(useStructureStore.getState().results).toBeNull();
    expect(useStructureStore.getState().solveErrors.length).toBeGreaterThan(0);
  });

  it("closes Show Steps when a Solve is refused", () => {
    solvableBeam();
    useStructureStore.getState().setShowSteps(true);
    useStructureStore.getState().updateNode("s1", { support: "FREE" });
    useStructureStore.getState().solve();
    expect(useStructureStore.getState().showSteps).toBe(false);
  });

  it("replaces the previous result rather than accumulating errors", () => {
    solvableBeam();
    useStructureStore.getState().solve();
    expect(useStructureStore.getState().solveErrors).toEqual([]);
    expect(hasResults()).toBe(true);
  });
});

describe("stale-results invalidation (AD-3)", () => {
  beforeEach(() => useStructureStore.getState().clearAll());

  it("clears results when a Node is added", () => {
    solvableBeam();
    useStructureStore.getState().addNode({ id: "x", x: 9, y: 9, support: "FREE" });
    expect(hasResults()).toBe(false);
  });

  it("clears results when a Node is moved", () => {
    solvableBeam();
    useStructureStore.getState().updateNode("s2", { x: 5 });
    expect(hasResults()).toBe(false);
  });

  it("clears results when a Node is deleted", () => {
    solvableBeam();
    useStructureStore.getState().deleteNode("s2");
    expect(hasResults()).toBe(false);
  });

  it("clears results when an Element is added", () => {
    solvableBeam();
    useStructureStore.getState().addElement(createElement("x", "s1", "s2"));
    expect(hasResults()).toBe(false);
  });

  it("clears results when an Element is changed", () => {
    solvableBeam();
    useStructureStore.getState().updateElement("se1", { area: 0.02 });
    expect(hasResults()).toBe(false);
  });

  it("clears results when an Element is deleted", () => {
    solvableBeam();
    useStructureStore.getState().deleteElement("se1");
    expect(hasResults()).toBe(false);
  });

  it("clears results when a Load is added", () => {
    solvableBeam();
    useStructureStore
      .getState()
      .addLoad(createLoad("x", "concentrated", nodeTarget("s2"), 1000, AXIS_DIRECTIONS["-y"]));
    expect(hasResults()).toBe(false);
  });

  it("clears results when a Load is changed", () => {
    solvableBeam();
    useStructureStore.getState().updateLoad("sl1", { magnitude: 9000 });
    expect(hasResults()).toBe(false);
  });

  it("clears results when a Load is deleted", () => {
    solvableBeam();
    useStructureStore.getState().deleteLoad("sl1");
    expect(hasResults()).toBe(false);
  });

  it("clears Show Steps alongside the results", () => {
    solvableBeam();
    useStructureStore.getState().setShowSteps(true);
    useStructureStore.getState().updateNode("s2", { x: 5 });
    expect(useStructureStore.getState().showSteps).toBe(false);
  });

  it("clears a standing refusal too, since the complaint may no longer be true", () => {
    useStructureStore.getState().solve();
    expect(useStructureStore.getState().solveErrors.length).toBeGreaterThan(0);
    useStructureStore.getState().addNode({ id: "x", x: 0, y: 0, support: "FREE" });
    expect(useStructureStore.getState().solveErrors).toEqual([]);
  });

  it("keeps results when a Load write is rejected -- nothing changed", () => {
    solvableBeam();
    // A rejected write is not an edit: the structure is untouched, so the
    // result is still true of it.
    const accepted = useStructureStore.getState().updateLoad("sl1", { magnitude: -5 });
    expect(accepted).toBe(false);
    expect(hasResults()).toBe(true);
  });

  it("keeps results when an addLoad is rejected", () => {
    solvableBeam();
    const accepted = useStructureStore
      .getState()
      .addLoad(createLoad("x", "concentrated", nodeTarget("nope"), 1000, AXIS_DIRECTIONS["-y"]));
    expect(accepted).toBe(false);
    expect(hasResults()).toBe(true);
  });

  it("clears everything on clearAll", () => {
    solvableBeam();
    useStructureStore.getState().setShowSteps(true);
    useStructureStore.getState().clearAll();
    const state = useStructureStore.getState();
    expect(state.results).toBeNull();
    expect(state.solveErrors).toEqual([]);
    expect(state.showSteps).toBe(false);
  });
});

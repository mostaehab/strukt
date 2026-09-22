// @vitest-environment jsdom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import PropertiesPanel from "./PropertiesPanel";
import useStructureStore from "@/store/useStructureStore";
import { createElement } from "@/engine/element";
import { createLoad, nodeTarget } from "@/engine/load";

const ELEMENT_ID = "el-1";
const NODE_ID = "n1";

function seedElement() {
  useStructureStore.getState().addElement(createElement(ELEMENT_ID, "n1", "n2"));
}

function seedNode() {
  useStructureStore
    .getState()
    .addNode({ id: NODE_ID, x: 0, y: 0, support: "FREE" });
}

function renderPanelForNode(selectedNodeId: string | null = NODE_ID) {
  return render(
    <PropertiesPanel
      preset="FRAME"
      onPresetChange={() => {}}
      selectedNodeId={selectedNodeId}
      onDeleteSelectedNode={() => {}}
      selectedElementId={null}
    />,
  );
}

function storedLoads() {
  return useStructureStore.getState().loads;
}

function stationInput() {
  return screen.getByLabelText("Distance from start (m)") as HTMLInputElement;
}

function pickKind(value: string) {
  fireEvent.change(screen.getByLabelText("Type"), { target: { value } });
}

function magnitudeInput(unit = "kN") {
  return screen.getByLabelText(`Magnitude (${unit})`) as HTMLInputElement;
}

function pickDirection(value: string) {
  fireEvent.change(screen.getByLabelText("Direction"), { target: { value } });
}

/**
 * Enters a magnitude and applies it. Applying is an explicit submit, so
 * leaving the field is not enough -- which is the point of the control.
 */
function applyLoad(value: string, unit = "kN") {
  enter(magnitudeInput(unit), value);
  fireEvent.click(screen.getByText("Apply Load"));
}

let confirmSpy: MockInstance<typeof window.confirm>;
let alertSpy: MockInstance<typeof window.alert>;

function renderPanel(selectedElementId: string | null = ELEMENT_ID) {
  return render(
    <PropertiesPanel
      preset="FRAME"
      onPresetChange={() => {}}
      selectedNodeId={null}
      onDeleteSelectedNode={() => {}}
      selectedElementId={selectedElementId}
    />,
  );
}

function storedElement() {
  const element = useStructureStore
    .getState()
    .elements.find((e) => e.id === ELEMENT_ID);
  if (!element) throw new Error("seeded Element missing from the store");
  return element;
}

function areaInput() {
  return screen.getByLabelText("Area (m²)") as HTMLInputElement;
}

function inertiaInput() {
  return screen.getByLabelText("Inertia (m⁴)") as HTMLInputElement;
}

/**
 * The fields commit on blur, not per keystroke, so every entry here types and
 * then leaves the field the way a user does.
 */
function enter(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

function pickMaterial(value: string) {
  fireEvent.change(screen.getByLabelText("Material"), { target: { value } });
}

function pickSection(value: string) {
  fireEvent.change(screen.getByLabelText("Cross-Section"), {
    target: { value },
  });
}

beforeEach(() => {
  useStructureStore.getState().clearAll();
  // jsdom leaves these unimplemented, and a Load delete now confirms.
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PropertiesPanel Element section", () => {
  it("names the selected Element in the panel heading", () => {
    seedElement();
    renderPanel();
    screen.getByText("Element E1 — Properties");
  });

  it("collapses to a hint when no Element is selected", () => {
    seedElement();
    renderPanel(null);
    screen.getByText("Select an Element to view its properties.");
    expect(screen.queryByLabelText("Area (m²)")).toBeNull();
    expect(screen.queryByText(/Element E0/)).toBeNull();
  });

  it("defaults the Material dropdown to (none assigned)", () => {
    seedElement();
    renderPanel();
    const select = screen.getByLabelText("Material") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(select.selectedOptions[0].textContent).toBe("(none assigned)");
  });

  it("offers no AISC W-shape for a Concrete Element", () => {
    seedElement();
    useStructureStore
      .getState()
      .updateElement(ELEMENT_ID, { material: "CONCRETE" });
    renderPanel();
    const options = Array.from(
      (screen.getByLabelText("Cross-Section") as HTMLSelectElement).options,
    ).map((o) => o.textContent ?? "");
    expect(options.some((label) => label.startsWith("W"))).toBe(false);
    expect(options.length).toBeGreaterThan(1);
  });

  // Matrix row: Truss hides inertia -- absent from the DOM, not disabled.
  it("omits the inertia field entirely for a Truss", () => {
    useStructureStore.setState({ type: "TRUSS" });
    seedElement();
    renderPanel();
    expect(areaInput().tagName).toBe("INPUT");
    expect(screen.queryByLabelText("Inertia (m⁴)")).toBeNull();
  });

  it("shows the inertia field for a Frame", () => {
    seedElement();
    renderPanel();
    expect(inertiaInput().tagName).toBe("INPUT");
  });

  // Matrix row: Non-positive override -- not committed to the store.
  it("refuses to commit a zero area, leaving the prior value intact", () => {
    seedElement();
    renderPanel();
    enter(areaInput(), "0.01");
    expect(storedElement().area).toBe(0.01);

    enter(areaInput(), "0");
    expect(storedElement().area).toBe(0.01);
  });

  it("refuses to commit a negative area, leaving the prior value intact", () => {
    seedElement();
    renderPanel();
    enter(areaInput(), "0.01");
    enter(areaInput(), "-5");
    expect(storedElement().area).toBe(0.01);
  });

  // P1: committing per keystroke rejected the "0", "0." and "0.0" on the way to
  // a legitimate value, and committed a bare "1" while "1e-3" was being typed.
  it("does not judge or commit an entry until it is complete", () => {
    seedElement();
    renderPanel();

    for (const keystroke of ["0", "0.", "0.0", "0.01"]) {
      fireEvent.change(areaInput(), { target: { value: keystroke } });
      expect(storedElement().area).toBeNull();
      expect(
        screen.queryByText(
          "Element E1 needs a positive area. Enter a value greater than zero.",
        ),
      ).toBeNull();
    }

    fireEvent.blur(areaInput());
    expect(storedElement().area).toBe(0.01);
  });

  it("commits scientific notation as one value, never the mantissa alone", () => {
    seedElement();
    renderPanel();

    for (const keystroke of ["1", "1e", "1e-", "1e-3"]) {
      fireEvent.change(areaInput(), { target: { value: keystroke } });
      expect(storedElement().area).toBeNull();
    }

    fireEvent.blur(areaInput());
    expect(storedElement().area).toBe(0.001);
  });

  it("commits on Enter as well as on blur", () => {
    seedElement();
    renderPanel();
    fireEvent.change(areaInput(), { target: { value: "0.02" } });
    fireEvent.keyDown(areaInput(), { key: "Enter" });
    expect(storedElement().area).toBe(0.02);
  });

  it("announces the rejection as text in an aria-live region, not by color", () => {
    seedElement();
    renderPanel();
    enter(areaInput(), "0");

    const message = screen.getByText(
      "Element E1 needs a positive area. Enter a value greater than zero.",
    );
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(areaInput().getAttribute("aria-invalid")).toBe("true");
    expect(areaInput().getAttribute("aria-describedby")).toBe(
      message.getAttribute("id"),
    );
  });

  it("names the inertia field in its own rejection message", () => {
    seedElement();
    renderPanel();
    enter(inertiaInput(), "0");
    screen.getByText(
      "Element E1 needs a positive inertia. Enter a value greater than zero.",
    );
  });

  it("returns the field to unassigned when cleared, never zero", () => {
    seedElement();
    renderPanel();
    enter(areaInput(), "0.01");
    expect(storedElement().area).toBe(0.01);

    enter(areaInput(), "");
    expect(storedElement().area).toBeNull();
    expect(storedElement().area).not.toBe(0);
  });

  // Matrix row: Unparseable override -- non-numeric text. The field is
  // type="text" precisely so this reaches the component instead of being
  // swallowed by the browser's number-input sanitisation.
  it("rejects non-numeric text without committing or wiping the stored value", () => {
    seedElement();
    renderPanel();
    enter(areaInput(), "0.01");

    enter(areaInput(), "abc");
    expect(storedElement().area).toBe(0.01);
    screen.getByText(
      "Element E1 needs a positive area. Enter a value greater than zero.",
    );
    expect(areaInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("rejects a half-typed exponent left in the field", () => {
    seedElement();
    renderPanel();
    enter(areaInput(), "1e-");
    expect(storedElement().area).toBeNull();
    expect(areaInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("clears the rejection while the entry is being corrected", () => {
    seedElement();
    renderPanel();
    enter(areaInput(), "0");
    expect(areaInput().getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(areaInput(), { target: { value: "0.5" } });
    expect(areaInput().getAttribute("aria-invalid")).toBe("false");
  });

  // P10: pins the rendered value, so the render-time resync and formatNumeral
  // can't silently stop working.
  it("auto-fills both fields with the catalog's SI values in engineering form", () => {
    seedElement();
    renderPanel();
    pickMaterial("STEEL");
    pickSection("W12X26");

    // Formatted, not raw: String(0.0049354740000000005) would end "...0001".
    expect(areaInput().value).toBe("0.004935474");
    expect(inertiaInput().value).toBe("0.0000849112108224");
  });

  it("empties both fields again when Material clears the catalog selection", () => {
    seedElement();
    renderPanel();
    pickMaterial("STEEL");
    pickSection("W12X26");
    expect(areaInput().value).not.toBe("");

    pickMaterial("CONCRETE");
    expect(areaInput().value).toBe("");
    expect(inertiaInput().value).toBe("");
  });

  it("replaces a manual override with the catalog's values when a section is picked", () => {
    seedElement();
    renderPanel();
    pickMaterial("STEEL");
    enter(areaInput(), "0.02");
    expect(storedElement().crossSectionId).toBeNull();

    pickSection("W14X30");
    expect(storedElement().crossSectionId).toBe("W14X30");
    expect(areaInput().value).toBe("0.005709666");
  });

  it("clears a catalog selection's derived values when Material changes", () => {
    seedElement();
    renderPanel();
    pickMaterial("STEEL");
    pickSection("W12X26");
    expect(storedElement().area).not.toBeNull();

    pickMaterial("CONCRETE");
    expect(storedElement().crossSectionId).toBeNull();
    expect(storedElement().area).toBeNull();
    expect(storedElement().inertia).toBeNull();
  });

  it("keeps a manual override across a Material change", () => {
    seedElement();
    renderPanel();
    pickMaterial("STEEL");
    enter(areaInput(), "0.02");

    pickMaterial("CONCRETE");
    expect(storedElement().area).toBe(0.02);
    expect(storedElement().crossSectionId).toBeNull();
    expect(areaInput().value).toBe("0.02");
  });

  it("explains the empty Cross-Section dropdown to a screen reader", () => {
    seedElement();
    renderPanel();
    const select = screen.getByLabelText("Cross-Section");
    const hint = screen.getByText("Assign a Material to choose a Cross-Section.");
    expect(select.getAttribute("aria-describedby")).toBe(hint.getAttribute("id"));

    pickMaterial("STEEL");
    expect(screen.getByLabelText("Cross-Section").getAttribute("aria-describedby")).toBeNull();
  });
});

describe("PropertiesPanel Node Load block", () => {
  it("labels the selected Node positionally, never by its stored UUID", () => {
    seedNode();
    renderPanelForNode();
    screen.getByText("Node N1");
    expect(screen.queryByText(`Node ${NODE_ID}`)).toBeNull();
  });

  // Matrix row: Concentrated Load on a Node -- stored in SI newtons against a
  // Node target, with a unit-vector direction.
  it("applies a concentrated Load in newtons to the selected Node", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");

    expect(storedLoads()).toHaveLength(1);
    const [load] = storedLoads();
    expect(load.kind).toBe("concentrated");
    expect(load.target).toEqual({ type: "node", nodeId: NODE_ID });
    // 5 kN typed, 5000 N stored: kN is display-only (AD-4).
    expect(load.magnitude).toBe(5000);
    expect(load.direction).toEqual([0, -1]);
  });

  // Matrix row: Direction picker -- the panel reads back with U+2212.
  it("defaults to downward and reads the direction back as an axis label", () => {
    seedNode();
    renderPanelForNode();
    expect((screen.getByLabelText("Direction") as HTMLSelectElement).value).toBe(
      "-y",
    );
    applyLoad("5");
    // U+2212 MINUS SIGN, not a hyphen.
    screen.getByText("L: 5.00 kN, \u2212y");
  });

  // Screen coordinates run the other way round; the picker says which is which.
  it("spells out which way each axis points", () => {
    seedNode();
    renderPanelForNode();
    const select = screen.getByLabelText("Direction") as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent ?? "");
    expect(labels).toContain("\u2212y (down)");
    expect(labels).toContain("+y (up)");
    const hint = screen.getByText("Global axes: +y is up, \u2212y is down.");
    expect(select.getAttribute("aria-describedby")).toBe(
      hint.getAttribute("id"),
    );
  });

  it("applies the direction the picker is showing", () => {
    seedNode();
    renderPanelForNode();
    pickDirection("+x");
    applyLoad("2");
    expect(storedLoads()[0].direction).toEqual([1, 0]);
    screen.getByText("L: 2.00 kN, +x");
  });

  // The magnitude field is blurred on the way *to* the direction picker, so a
  // blur must never apply: the picker controls a Load that has not happened
  // yet, and would otherwise always be one entry behind.
  it("does not apply on blur, so the direction can still be chosen", () => {
    seedNode();
    renderPanelForNode();

    enter(magnitudeInput(), "5");
    expect(storedLoads()).toEqual([]);

    pickDirection("+y");
    fireEvent.click(screen.getByText("Apply Load"));
    expect(storedLoads()).toHaveLength(1);
    expect(storedLoads()[0].direction).toEqual([0, 1]);
  });

  // Enter is a submit. Focus has to survive it, or a keyboard user re-finds
  // the field for every Load.
  it("applies on Enter and keeps focus in the magnitude field", () => {
    seedNode();
    renderPanelForNode();

    const input = magnitudeInput();
    input.focus();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(storedLoads()).toHaveLength(1);
    expect(document.activeElement).toBe(magnitudeInput());
    expect(magnitudeInput().value).toBe("");
  });

  // Matrix row: Loads on one target sum -- both persist as their own entries.
  it("keeps a second Load alongside the first rather than overwriting it", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");
    pickDirection("+y");
    applyLoad("5");

    expect(storedLoads()).toHaveLength(2);
    screen.getByText("L: 5.00 kN, \u2212y");
    screen.getByText("L: 5.00 kN, +y");
  });

  it("empties the magnitude field after applying, ready for the next Load", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");
    expect(magnitudeInput().value).toBe("");
  });

  // Applying a stale value the field no longer shows would be worse than
  // refusing: the user would get a Load they can no longer see the number for.
  it("never applies a value the field has since been edited away from", () => {
    seedNode();
    renderPanelForNode();
    enter(magnitudeInput(), "5");
    fireEvent.change(magnitudeInput(), { target: { value: "7" } });
    fireEvent.click(screen.getByText("Apply Load"));

    expect(storedLoads()).toEqual([]);
    screen.getByText(
      "Load on Node N1 needs a positive magnitude. Enter a value greater than zero.",
    );
  });

  // Matrix row: Delete one of two Loads -- the other survives.
  it("deletes one Load and leaves the other listed", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");
    pickDirection("+y");
    applyLoad("3");

    fireEvent.click(screen.getByLabelText("Delete Load 1 on Node N1"));
    expect(storedLoads()).toHaveLength(1);
    expect(screen.queryByText("L: 5.00 kN, \u2212y")).toBeNull();
    screen.getByText("L: 3.00 kN, +y");
  });

  it("confirms before deleting a Load, and keeps it when declined", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");

    confirmSpy.mockReturnValue(false);
    fireEvent.click(screen.getByLabelText("Delete Load 1 on Node N1"));
    expect(confirmSpy).toHaveBeenCalledWith("Delete this Load?");
    expect(storedLoads()).toHaveLength(1);
  });

  it("announces a deletion instead of just having it vanish", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");
    fireEvent.click(screen.getByLabelText("Delete Load 1 on Node N1"));

    const announcement = screen.getByText("Load 1 on Node N1 deleted.");
    expect(announcement.getAttribute("aria-live")).toBe("polite");
  });

  // The deleted button was the focused element; focus must not fall to <body>.
  it("moves focus to the next Load after deleting one", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");
    applyLoad("3");

    const first = screen.getByLabelText("Delete Load 1 on Node N1");
    first.focus();
    fireEvent.click(first);

    expect(document.activeElement).toBe(
      screen.getByLabelText("Delete Load 1 on Node N1"),
    );
    expect(storedLoads()).toHaveLength(1);
  });

  it("falls back to the magnitude field when the last Load is deleted", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");

    const only = screen.getByLabelText("Delete Load 1 on Node N1");
    only.focus();
    fireEvent.click(only);

    expect(document.activeElement).toBe(magnitudeInput());
  });

  // Matrix row: Nothing assigned -- no tag, not a zero-value placeholder.
  it("renders no Load tag until a Load exists", () => {
    seedNode();
    renderPanelForNode();
    expect(screen.queryByText(/^L:/)).toBeNull();
    expect(screen.queryByLabelText(/^Delete Load/)).toBeNull();
  });

  // Matrix row: Non-positive magnitude -- not committed, named in the message.
  it("refuses a zero or negative magnitude and says so in an aria-live region", () => {
    seedNode();
    renderPanelForNode();
    enter(magnitudeInput(), "0");
    expect(storedLoads()).toEqual([]);

    const message = screen.getByText(
      "Load on Node N1 needs a positive magnitude. Enter a value greater than zero.",
    );
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(magnitudeInput().getAttribute("aria-invalid")).toBe("true");
    expect(magnitudeInput().getAttribute("aria-describedby")).toBe(
      message.getAttribute("id"),
    );

    enter(magnitudeInput(), "-5");
    expect(storedLoads()).toEqual([]);
  });

  // The field accepts 1e306 kN, which is Infinity newtons by the time it
  // reaches the store. A refusal the panel cannot see would clear the field
  // and show nothing at all.
  it("surfaces a rejection the store made, rather than clearing silently", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("1e306");

    expect(storedLoads()).toEqual([]);
    const message = screen.getByText(
      "Load on Node N1 needs a positive magnitude. Enter a value greater than zero.",
    );
    expect(message.getAttribute("aria-live")).toBe("polite");
  });

  it("refuses an Apply with nothing entered", () => {
    seedNode();
    renderPanelForNode();
    fireEvent.click(screen.getByText("Apply Load"));
    expect(storedLoads()).toEqual([]);
    screen.getByText(
      "Load on Node N1 needs a positive magnitude. Enter a value greater than zero.",
    );
  });

  // Escape is the shell's cancel gesture, and the shell blurs the focused
  // control on its way out. That blur must not apply the Load being cancelled.
  it("discards the entry on Escape instead of applying it", () => {
    seedNode();
    renderPanelForNode();

    const input = magnitudeInput();
    input.focus();
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.keyDown(input, { key: "Escape" });
    // What the shell does next.
    fireEvent.blur(input);

    expect(storedLoads()).toEqual([]);
    expect(magnitudeInput().value).toBe("");
  });

  it("leaves an already-applied Load untouched when the next entry is rejected", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");
    enter(magnitudeInput(), "0");
    expect(storedLoads()).toHaveLength(1);
    expect(storedLoads()[0].magnitude).toBe(5000);
  });

  it("applies nothing when the magnitude field is left empty", () => {
    seedNode();
    renderPanelForNode();
    enter(magnitudeInput(), "");
    expect(storedLoads()).toEqual([]);
  });

  // Acceptance criterion: magnitude, direction and delete take focus in
  // reading order. Tab order follows DOM order, so that is what is asserted.
  it("orders the Load controls magnitude, direction, apply, delete", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");

    const controls = [
      magnitudeInput(),
      screen.getByLabelText("Direction"),
      screen.getByText("Apply Load"),
      screen.getByLabelText("Delete Load 1 on Node N1"),
    ];
    for (const [index, control] of controls.entries()) {
      // Every control is reachable: none is disabled or removed from the tab
      // sequence, so a keyboard user meets all of them.
      expect(control.hasAttribute("disabled")).toBe(false);
      expect(control.getAttribute("tabindex")).not.toBe("-1");
      if (index === 0) continue;
      const previous = controls[index - 1];
      // DOCUMENT_POSITION_FOLLOWING
      expect(previous.compareDocumentPosition(control) & 4).toBeGreaterThan(0);
    }
  });

  // Storage is more expressive than the picker, so a Load that arrived from
  // elsewhere can carry an off-axis vector. It is shown as its components --
  // trimmed, like every other numeral in the panel, not as two raw floats.
  it("shows an off-axis direction as trimmed components", () => {
    seedNode();
    useStructureStore
      .getState()
      .addLoad(
        createLoad("diag", "concentrated", nodeTarget(NODE_ID), 1000, [
          Math.SQRT1_2,
          -Math.SQRT1_2,
        ]),
      );
    renderPanelForNode();

    const tag = screen.getByText(/^L: 1\.00 kN, \[/);
    expect(tag.textContent).toBe("L: 1.00 kN, [0.707106781187, -0.707106781187]");
  });

  it("collapses the Load block when no Node is selected", () => {
    seedNode();
    renderPanelForNode(null);
    expect(screen.queryByLabelText("Magnitude (kN)")).toBeNull();
    expect(screen.queryByText("Load (concentrated)")).toBeNull();
  });

  // Nothing but the block's per-entity `key` resets the field between
  // selections, so a rejected entry and a message naming the wrong Node would
  // otherwise leak into the next one.
  it("starts clean when the selection moves to another Node", () => {
    seedNode();
    useStructureStore
      .getState()
      .addNode({ id: "n2", x: 1, y: 0, support: "FREE" });
    const { rerender } = renderPanelForNode();

    enter(magnitudeInput(), "0");
    screen.getByText(
      "Load on Node N1 needs a positive magnitude. Enter a value greater than zero.",
    );

    rerender(
      <PropertiesPanel
        preset="FRAME"
        onPresetChange={() => {}}
        selectedNodeId="n2"
        onDeleteSelectedNode={() => {}}
        selectedElementId={null}
      />,
    );

    screen.getByText("Node N2");
    expect(magnitudeInput().value).toBe("");
    expect(
      screen.queryByText(
        "Load on Node N1 needs a positive magnitude. Enter a value greater than zero.",
      ),
    ).toBeNull();
  });
});

describe("PropertiesPanel Element length", () => {
  /** An Element whose end Nodes actually exist, 3-4-5 so the length is exact. */
  function seedMeasuredElement() {
    const store = useStructureStore.getState();
    store.addNode({ id: "n1", x: 0, y: 0, support: "FREE" });
    store.addNode({ id: "n2", x: 3, y: 4, support: "FREE" });
    useStructureStore
      .getState()
      .addElement(createElement(ELEMENT_ID, "n1", "n2"));
  }

  it("reports the length of the selected Element", () => {
    seedMeasuredElement();
    renderPanel();
    screen.getByText("5.00 m");
  });

  it("follows the Nodes rather than being stored", () => {
    seedMeasuredElement();
    renderPanel();
    act(() => {
      // 3-4-5 becomes 6-8-10 by moving one end.
      useStructureStore.getState().updateNode("n2", { x: 6, y: 8 });
    });
    // Derived: no edit to the Element, and the panel still tracks it.
    screen.getByText("10.00 m");
  });

  it("shows no length while an end Node is missing", () => {
    // The seeded Element here references Nodes that were never added, which is
    // the shape a cascade leaves for the frame before the selection reconciles.
    seedElement();
    renderPanel();
    expect(screen.queryByText("Length")).toBeNull();
  });

  it("shows no length when nothing is selected", () => {
    seedMeasuredElement();
    renderPanel(null);
    expect(screen.queryByText("Length")).toBeNull();
  });
});

describe("PropertiesPanel Element Load block", () => {
  // Matrix row: UDL on an Element -- newtons per metre, Element target.
  it("applies a UDL in newtons per metre to the selected Element", () => {
    seedElement();
    renderPanel();
    applyLoad("2", "kN/m");

    expect(storedLoads()).toHaveLength(1);
    const [load] = storedLoads();
    expect(load.kind).toBe("udl");
    expect(load.target).toEqual({ type: "element", elementId: ELEMENT_ID });
    expect(load.magnitude).toBe(2000);
    expect(load.direction).toEqual([0, -1]);
  });

  it("tags a UDL with its own unit, never the concentrated one", () => {
    seedElement();
    renderPanel();
    applyLoad("2", "kN/m");
    screen.getByText("L: 2.00 kN/m, \u2212y");
    expect(screen.queryByLabelText("Magnitude (kN)")).toBeNull();
  });

  it("names the Element in a rejected UDL magnitude", () => {
    seedElement();
    renderPanel();
    enter(magnitudeInput("kN/m"), "0");
    screen.getByText(
      "Load on Element E1 needs a positive magnitude. Enter a value greater than zero.",
    );
    expect(storedLoads()).toEqual([]);
  });

  it("sums two UDLs on one Element as two separate entries", () => {
    seedElement();
    renderPanel();
    applyLoad("2", "kN/m");
    applyLoad("0.5", "kN/m");
    expect(storedLoads().map((load) => load.magnitude)).toEqual([2000, 500]);
  });

  it("deletes a UDL from its own delete control", () => {
    seedElement();
    renderPanel();
    applyLoad("2", "kN/m");
    fireEvent.click(screen.getByLabelText("Delete Load 1 on Element E1"));
    expect(storedLoads()).toEqual([]);
  });

  it("applies a point Load at the station entered", () => {
    seedElement();
    renderPanel();
    pickKind("point");
    enter(magnitudeInput(), "12");
    enter(stationInput(), "2");
    fireEvent.click(screen.getByText("Apply Load"));

    expect(storedLoads()).toHaveLength(1);
    const [load] = storedLoads();
    expect(load.kind).toBe("point");
    expect(load.magnitude).toBe(12000);
    expect(load.kind === "point" && load.position).toBe(2);
  });

  it("refuses a point Load with no station rather than placing it at the start", () => {
    seedElement();
    renderPanel();
    pickKind("point");
    enter(magnitudeInput(), "12");
    fireEvent.click(screen.getByText("Apply Load"));

    // A Load acting at the start Node is a concentrated Node Load and is
    // entered as one; defaulting to it here would place a Load somewhere
    // plausible that the user never asked for.
    screen.getByText(
      "Load on Element E1 needs a distance from the start of the member. Enter how far along it the Load acts.",
    );
    expect(storedLoads()).toEqual([]);
  });

  it("does not carry one Load's station into the next", () => {
    // The field empties after each Apply, so a station surviving that would
    // place the second Load where the first went while showing nothing.
    seedElement();
    renderPanel();
    pickKind("point");
    enter(magnitudeInput(), "12");
    enter(stationInput(), "2");
    fireEvent.click(screen.getByText("Apply Load"));

    enter(magnitudeInput(), "5");
    fireEvent.click(screen.getByText("Apply Load"));
    expect(storedLoads()).toHaveLength(1);
    screen.getByText(
      "Load on Element E1 needs a distance from the start of the member. Enter how far along it the Load acts.",
    );
  });

  it("treats a retyped station as stale until it is completed again", () => {
    seedElement();
    renderPanel();
    pickKind("point");
    enter(magnitudeInput(), "12");
    enter(stationInput(), "2");
    // Typing again invalidates the committed station, the same rule the
    // magnitude draft follows.
    fireEvent.change(stationInput(), { target: { value: "3" } });
    fireEvent.click(screen.getByText("Apply Load"));
    expect(storedLoads()).toEqual([]);
  });

  it("offers no station field for a UDL, which has no single station", () => {
    seedElement();
    renderPanel();
    expect(screen.queryByLabelText("Distance from start (m)")).toBeNull();
    pickKind("point");
    expect(screen.getByLabelText("Distance from start (m)")).toBeDefined();
  });

  it("shows a UDL block for a Truss Element too, inertia field or not", () => {
    useStructureStore.setState({ type: "TRUSS" });
    seedElement();
    renderPanel();
    expect(screen.queryByLabelText("Inertia (m⁴)")).toBeNull();
    expect(magnitudeInput("kN/m").tagName).toBe("INPUT");
  });
});

describe("PropertiesPanel Structure Type guard", () => {
  // The store blocks the switch on Loads as well as Nodes and Elements, so the
  // warning has to name them -- a Project held by a Load was previously told
  // two absent things were the cause.
  it("names Loads in the warning when a switch is blocked", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");

    fireEvent.change(screen.getByLabelText("Structure Type"), {
      target: { value: "TRUSS" },
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Structure Type can't be changed while the Project has Elements, Supports or Loads. Clear the canvas first.",
    );
    expect(useStructureStore.getState().type).toBe("FRAME");
  });

  it("snaps the select back to the current preset when blocked", () => {
    seedNode();
    renderPanelForNode();
    applyLoad("5");

    const select = screen.getByLabelText("Structure Type") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "TRUSS" } });
    expect(select.value).toBe("FRAME");
  });
});

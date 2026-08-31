// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PropertiesPanel from "./PropertiesPanel";
import useStructureStore from "@/store/useStructureStore";
import { createElement } from "@/engine/element";

const ELEMENT_ID = "el-1";

function seedElement() {
  useStructureStore.getState().addElement(createElement(ELEMENT_ID, "n1", "n2"));
}

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
});

afterEach(cleanup);

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

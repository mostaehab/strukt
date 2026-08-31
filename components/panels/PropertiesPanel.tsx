"use client";

import { useState, type ChangeEvent } from "react";
import useStructureStore from "@/store/useStructureStore";
import type { Material, StructureType, Support } from "@/engine/types";
import { sectionsFor } from "@/engine/catalog/crossSections";

export type StructurePreset = "TRUSS" | "FRAME" | "BEAM";

interface PropertiesPanelProps {
  preset: StructurePreset;
  onPresetChange: (preset: StructurePreset) => void;
  selectedNodeId: string | null;
  onDeleteSelectedNode: () => void;
  selectedElementId: string | null;
}

const SUPPORT_OPTIONS: { value: Support; label: string }[] = [
  { value: "FIXED", label: "Fixed" },
  { value: "HINGE", label: "Hinged" },
  { value: "ROLLER", label: "Roller" },
  { value: "FREE", label: "Free" },
];

// Record<Material, ...> rather than an array of pairs: adding a third Material
// to the union then fails to compile here instead of silently dropping out of
// the dropdown.
const MATERIAL_LABELS: Record<Material, string> = {
  STEEL: "Steel",
  CONCRETE: "Concrete",
};

const MATERIAL_OPTIONS = Object.entries(MATERIAL_LABELS) as [
  Material,
  string,
][];

const UNASSIGNED = "";
const UNASSIGNED_LABEL = "(none assigned)";
const CROSS_SECTION_HINT_ID = "cross-section-hint";

/**
 * Trims binary-float noise off a catalog value (0.004935474000000001 ->
 * 0.004935474) without meaningfully reducing precision, so an auto-filled
 * field reads like an engineering number.
 */
function formatNumeral(value: number): string {
  return String(Number.parseFloat(value.toPrecision(12)));
}

interface NumericFieldProps {
  id: string;
  label: string;
  /** "area" | "inertia" -- used verbatim in the rejection message. */
  fieldName: string;
  elementLabel: string;
  value: number | null;
  onCommit: (value: number | null) => void;
}

/**
 * A positive-number field for a manual area/inertia override.
 *
 * The entry is validated and committed when it is *complete* -- on blur, or on
 * Enter -- never per keystroke. Committing per keystroke would reject the "0",
 * "0." and "0.0" on the way to a legitimate 0.01, and would commit a bare "1"
 * (one square metre) while the user was still typing "1e-3", which is the
 * normal way to enter a value in the 1e-3..1e-9 range these fields live in.
 *
 * Rejection is field-level: neither an unparseable nor a non-positive entry is
 * written to the store, and neither wipes a value already stored. The reason is
 * announced as text (never color alone) through an always-present aria-live
 * region. Clearing the field commits null -- unassigned is a legitimate state.
 */
function NumericField({
  id,
  label,
  fieldName,
  elementLabel,
  value,
  onCommit,
}: NumericFieldProps) {
  const [text, setText] = useState(value === null ? "" : formatNumeral(value));
  const [error, setError] = useState("");

  const rejection = `Element ${elementLabel} needs a positive ${fieldName}. Enter a value greater than zero.`;

  // Re-sync when the store value changes underneath the field -- e.g. a catalog
  // pick auto-filling area/inertia. Adjusted during render (React's "resetting
  // state when a prop changes" pattern, as in CanvasWorkspace) rather than in
  // an effect. Because nothing commits while the user types, the stored value
  // can only change here from an *external* edit, so this can never wipe an
  // error the user just triggered -- and when it does fire, the field is
  // showing a new number, for which the old error is meaningless.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value === null ? "" : formatNumeral(value));
    setError("");
  }

  const commit = (raw: string) => {
    if (raw.trim() === "") {
      // Cleared, not zeroed -- unassigned is a legitimate state.
      setError("");
      onCommit(null);
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      // Nothing is committed: the previously stored value stands untouched.
      setError(rejection);
      return;
    }
    setError("");
    onCommit(parsed);
  };

  const errorId = `${id}-error`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="val"
        // Not type="number": the browser silently swallows non-numeric text,
        // and this field has to be able to reject it by name. inputMode still
        // brings up the numeric keypad on touch.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setText(event.target.value);
          // The entry is incomplete again; re-stating the old rejection while
          // the user corrects it would just be noise in the live region.
          if (error !== "") setError("");
        }}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(event.currentTarget.value);
          }
        }}
        aria-invalid={error !== ""}
        aria-describedby={errorId}
      />
      <p className="field-error" id={errorId} aria-live="polite">
        {error}
      </p>
    </div>
  );
}

/**
 * Structure Type selector (Truss/Frame/Beam preset), per-Node Support
 * dropdown, and per-Element Material / Cross-Section / area / inertia.
 * Plain <select>/<input> elements, styled via tokens.css.
 */
export default function PropertiesPanel({
  preset,
  onPresetChange,
  selectedNodeId,
  onDeleteSelectedNode,
  selectedElementId,
}: PropertiesPanelProps) {
  const nodes = useStructureStore((s) => s.nodes);
  const elements = useStructureStore((s) => s.elements);
  const structureType = useStructureStore((s) => s.type);
  const updateNode = useStructureStore((s) => s.updateNode);
  const updateElement = useStructureStore((s) => s.updateElement);
  const setStructureType = useStructureStore((s) => s.setStructureType);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedElementIndex = elements.findIndex(
    (e) => e.id === selectedElementId,
  );
  const selectedElement =
    selectedElementIndex === -1 ? null : elements[selectedElementIndex];
  // Elements are labelled by draw order (E1, E2, ...) -- the stored id is a
  // UUID, which is not what a student reads back off the canvas. Empty when
  // nothing is selected, so a stray render can't produce an "E0".
  const elementLabel = selectedElement
    ? `E${selectedElementIndex + 1}`
    : "";
  const hasContent = nodes.length > 0 || elements.length > 0;

  const handlePresetChange = (
    value: StructurePreset,
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    // Beam is a drawing-time preset; it's stored as "FRAME" like any other Frame.
    const targetType: StructureType = value === "BEAM" ? "FRAME" : value;
    const ok = setStructureType(targetType);
    if (!ok) {
      window.alert(
        "Structure Type can't be changed while the Project has Elements or Supports. Clear the canvas first.",
      );
      // Force the native <select> to visually snap back to the current
      // preset immediately, rather than potentially showing the rejected
      // option until an unrelated re-render.
      event.target.value = preset;
      return;
    }
    onPresetChange(value);
  };

  const availableSections = selectedElement?.material
    ? sectionsFor(selectedElement.material)
    : [];

  return (
    <aside className="properties-panel" aria-label="Properties">
      <section>
        <h2>Structure Type</h2>
        <select
          aria-label="Structure Type"
          value={preset}
          onChange={(event) =>
            handlePresetChange(event.target.value as StructurePreset, event)
          }
        >
          <option value="TRUSS">Truss</option>
          <option value="FRAME">Frame</option>
          <option value="BEAM">Beam</option>
        </select>
        {hasContent && (
          <p className="hint">Clear the canvas to change Structure Type.</p>
        )}
      </section>

      <section>
        <h2>Node</h2>
        {selectedNode ? (
          <>
            <p className="node-id">Node {selectedNode.id}</p>
            <label htmlFor="support-select">Support</label>
            <select
              id="support-select"
              value={selectedNode.support}
              onChange={(event) =>
                updateNode(selectedNode.id, {
                  support: event.target.value as Support,
                })
              }
            >
              {SUPPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={onDeleteSelectedNode}>
              Delete Node
            </button>
          </>
        ) : (
          <p className="hint">Select a Node to view its properties.</p>
        )}
      </section>

      <section>
        <h2>Element</h2>
        {selectedElement ? (
          <>
            <p className="element-id">Element {elementLabel} — Properties</p>

            <div className="field">
              <label htmlFor="material-select">Material</label>
              <select
                id="material-select"
                value={selectedElement.material ?? UNASSIGNED}
                onChange={(event) =>
                  updateElement(selectedElement.id, {
                    material:
                      event.target.value === UNASSIGNED
                        ? null
                        : (event.target.value as Material),
                  })
                }
              >
                <option value={UNASSIGNED}>{UNASSIGNED_LABEL}</option>
                {MATERIAL_OPTIONS.map(([material, label]) => (
                  <option key={material} value={material}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cross-section-select">Cross-Section</label>
              <select
                id="cross-section-select"
                value={selectedElement.crossSectionId ?? UNASSIGNED}
                onChange={(event) =>
                  updateElement(selectedElement.id, {
                    crossSectionId:
                      event.target.value === UNASSIGNED
                        ? null
                        : event.target.value,
                  })
                }
                // Associated, not merely adjacent: otherwise a screen-reader
                // user meets an empty dropdown with no explanation.
                aria-describedby={
                  selectedElement.material ? undefined : CROSS_SECTION_HINT_ID
                }
              >
                <option value={UNASSIGNED}>{UNASSIGNED_LABEL}</option>
                {availableSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
              {!selectedElement.material && (
                <p className="hint" id={CROSS_SECTION_HINT_ID}>
                  Assign a Material to choose a Cross-Section.
                </p>
              )}
            </div>

            <NumericField
              key={`${selectedElement.id}-area`}
              id="element-area"
              label="Area (m²)"
              fieldName="area"
              elementLabel={elementLabel}
              value={selectedElement.area}
              onCommit={(value) =>
                updateElement(selectedElement.id, { area: value })
              }
            />

            {/* Truss Elements are axial-only: the solver never uses inertia,
                so the field is omitted rather than shown-and-ignored (FR-2). */}
            {structureType !== "TRUSS" && (
              <NumericField
                key={`${selectedElement.id}-inertia`}
                id="element-inertia"
                label="Inertia (m⁴)"
                fieldName="inertia"
                elementLabel={elementLabel}
                value={selectedElement.inertia}
                onCommit={(value) =>
                  updateElement(selectedElement.id, { inertia: value })
                }
              />
            )}
          </>
        ) : (
          <p className="hint">Select an Element to view its properties.</p>
        )}
      </section>
    </aside>
  );
}

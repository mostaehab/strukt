"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import useStructureStore from "@/store/useStructureStore";
import useUnitStore from "@/store/useUnitStore";
import type {
  Load,
  LoadKind,
  Material,
  StructureType,
  Support,
} from "@/engine/types";
import { sectionsFor } from "@/engine/catalog/crossSections";
import {
  AXIS_DIRECTIONS,
  createLoad,
  elementTarget,
  nodeTarget,
  type AxisDirection,
} from "@/engine/load";
import {
  areaToDisplay,
  areaToStore,
  areaUnit,
  forceToStore,
  formatForce,
  inertiaToDisplay,
  inertiaToStore,
  inertiaUnit,
  formatLength,
  lengthToStore,
  lengthUnit,
  loadUnitLabel,
} from "@/utils/units";
import { elementLabel as labelForElement, nodeLabel } from "@/utils/labels";

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

/** What each Load kind is called in the picker. */
const LOAD_KIND_LABELS: Record<LoadKind, string> = {
  concentrated: "Point load",
  udl: "Distributed (UDL)",
  point: "Point load along member",
};

// The four directions a Load can be entered in, labelled with U+2212 MINUS
// SIGN rather than a hyphen: these read as signed axes, not as hyphenated
// words. The keys are the ASCII `AXIS_DIRECTIONS` keys, so the <option> values
// stay plain.
const AXIS_LABELS: Record<AxisDirection, string> = {
  "+x": "+x",
  "-x": "−x",
  "+y": "+y",
  "-y": "−y",
};

// The picker spells the axis out. A student's mental model comes from screen
// coordinates, where +y is *down* -- the opposite of the global convention
// every stored Load is read against, so the token alone is a trap.
const AXIS_OPTION_LABELS: Record<AxisDirection, string> = {
  "+x": "+x (right)",
  "-x": "−x (left)",
  "+y": "+y (up)",
  "-y": "−y (down)",
};

const AXIS_OPTIONS = Object.entries(AXIS_OPTION_LABELS) as [
  AxisDirection,
  string,
][];

const AXIS_TAG_LABELS = Object.entries(AXIS_LABELS) as [
  AxisDirection,
  string,
][];

/** Gravity is the overwhelmingly common case, so downward is the default. */
const DEFAULT_LOAD_AXIS: AxisDirection = "-y";

/**
 * Reverse-maps a stored direction vector to its picker label. Storage is
 * deliberately more expressive than the picker (AD-10), so an off-axis vector
 * that arrived from somewhere else is shown as its components rather than
 * being silently rounded to the nearest axis.
 */
function axisLabelFor(direction: readonly [number, number]): string {
  const axis = AXIS_TAG_LABELS.find(
    ([key]) =>
      AXIS_DIRECTIONS[key][0] === direction[0] &&
      AXIS_DIRECTIONS[key][1] === direction[1],
  );
  if (axis) return axis[1];
  // Trimmed like every other numeral in the panel: a raw float pair would run
  // seventeen digits per component through a fixed-width tag.
  return `[${formatNumeral(direction[0])}, ${formatNumeral(direction[1])}]`;
}

/**
 * Trims binary-float noise off a catalog value (0.004935474000000001 ->
 * 0.004935474) without meaningfully reducing precision, so an auto-filled
 * field reads like an engineering number.
 */
function formatNumeral(value: number): string {
  return String(Number.parseFloat(value.toPrecision(12)));
}

/** How a field's entry was completed. Applying a Load is a submit, so it may
 *  only happen on Enter or on the Apply control -- never on a blur, which is
 *  just the user moving to the next control. */
type CommitSource = "blur" | "enter";

interface NumericFieldProps {
  id: string;
  label: string;
  /** "area" | "inertia" | "magnitude" -- used verbatim in the rejection. */
  fieldName: string;
  /**
   * The thing being rejected, named as the message names it: `Element E1`, or
   * `Load on Node N1`. Not Element-specific -- Nodes reuse this field for a
   * Load magnitude, and the message has to name whichever entity it is about.
   */
  entityLabel: string;
  value: number | null;
  onCommit: (value: number | null, source: CommitSource) => void;
  /**
   * Fired on every keystroke and on Escape: any previously committed value is
   * stale from here until the next commit.
   */
  onEntryChange?: () => void;
  /**
   * Bumped by the owner to empty the field in place. Emptying it by changing
   * its `key` would unmount the focused <input> and drop focus to <body>,
   * making a keyboard user re-find the field after every entry.
   */
  resetSignal?: number;
}

/**
 * The one positive-number rejection, so a field and its owner can never word
 * it differently.
 */
function positiveRejection(entityLabel: string, fieldName: string): string {
  return (
    `${entityLabel} needs a positive ${fieldName}. ` +
    "Enter a value greater than zero."
  );
}

/**
 * The one missing-station rejection. A station of zero is not the answer here:
 * a Load acting at the start Node *is* a concentrated Node Load and is entered
 * as one, so this field wants a distance along the member.
 */
function missingStationRejection(entityLabel: string): string {
  return (
    `${entityLabel} needs a distance from the start of the member. ` +
    "Enter how far along it the Load acts."
  );
}

/**
 * A positive-number field: a manual area/inertia override, or a Load
 * magnitude.
 *
 * The entry is validated and committed when it is *complete* -- on blur, or on
 * Enter -- never per keystroke. Committing per keystroke would reject the "0",
 * "0." and "0.0" on the way to a legitimate 0.01, and would commit a bare "1"
 * (one square metre) while the user was still typing "1e-3", which is the
 * normal way to enter a value in the 1e-3..1e-9 range these fields live in.
 *
 * Escape discards the entry outright rather than committing it. The app shell
 * blurs the focused control before collapsing the panel, so without this the
 * cancel gesture would commit on its way out -- and for a Load magnitude that
 * means silently applying the Load the user just cancelled, behind a panel
 * that has already closed.
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
  entityLabel,
  value,
  onCommit,
  onEntryChange,
  resetSignal = 0,
}: NumericFieldProps) {
  const [text, setText] = useState(value === null ? "" : formatNumeral(value));
  const [error, setError] = useState("");
  // A ref, not state: it is set during the keydown that precedes the blur in
  // the same gesture, and has to be readable by that blur without a re-render.
  const discardRef = useRef(false);

  const rejection = positiveRejection(entityLabel, fieldName);

  const reset = () => {
    setText(value === null ? "" : formatNumeral(value));
    setError("");
  };

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
    reset();
  }

  // The same pattern for an owner-requested reset: emptying the field after an
  // applied Load without unmounting the input the user is still typing in.
  const [prevReset, setPrevReset] = useState(resetSignal);
  if (resetSignal !== prevReset) {
    setPrevReset(resetSignal);
    reset();
  }

  const commit = (raw: string, source: CommitSource) => {
    if (raw.trim() === "") {
      // Cleared, not zeroed -- unassigned is a legitimate state.
      setError("");
      onCommit(null, source);
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      // Nothing is committed: the previously stored value stands untouched.
      setError(rejection);
      return;
    }
    setError("");
    onCommit(parsed, source);
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
          onEntryChange?.();
        }}
        onBlur={(event) => {
          if (discardRef.current) {
            discardRef.current = false;
            return;
          }
          commit(event.target.value, "blur");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(event.currentTarget.value, "enter");
            return;
          }
          if (event.key === "Escape") {
            // Neither stopped nor prevented: Escape is still the shell's
            // global "close the panel". Only the commit it would otherwise
            // trigger on the way out is cancelled.
            discardRef.current = true;
            reset();
            onEntryChange?.();
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

interface LoadBlockProps {
  /** Field label, e.g. `Load (concentrated)` -- the mockup's caption. */
  legend: string;
  /**
   * The kinds this entity can take. One means no picker; an Element takes
   * both a distributed load and a point load along its length, so it gets a
   * choice.
   */
  kinds: LoadKind[];
  /**
   * Builds the Load to apply. Supplied by the section rather than assembled
   * here out of a kind and a target, so the one legal pairing of the two is
   * checked at the call site where both are known.
   */
  newLoad: (
    id: string,
    magnitude: number,
    direction: readonly [number, number],
    kind: LoadKind,
    position: number,
  ) => Load;
  /** `Node N1` / `Element E1` -- what the rejection and delete controls name. */
  entityLabel: string;
  /** The Loads already on this entity, in the order they were applied. */
  loads: Load[];
  /** DOM id prefix, so the Node and Element blocks never collide. */
  idPrefix: string;
}

/**
 * Applies Loads to one selected entity, and lists the ones already on it.
 *
 * Applying is an explicit submit -- the Apply control, or Enter in the
 * magnitude field -- never a blur. Blurring the magnitude field is how a
 * keyboard user *reaches* the direction picker, so applying there would commit
 * every Load with whatever direction happened to be selected before the user
 * got to choose one. The tab order is magnitude, direction, Apply, then the
 * delete control of each Load already applied.
 *
 * Each entry becomes its own Load rather than editing the last one, which is
 * what makes two Loads on one Node possible at all (AD-10); an applied Load is
 * changed by deleting it and entering it again.
 *
 * The magnitude field is in kN and the store is in newtons -- the conversion
 * is `utils/units`, the single read/write-through boundary (AD-4).
 */
function LoadBlock({
  legend,
  kinds,
  newLoad,
  entityLabel,
  loads,
  idPrefix,
}: LoadBlockProps) {
  const addLoad = useStructureStore((s) => s.addLoad);
  const deleteLoad = useStructureStore((s) => s.deleteLoad);
  const [axis, setAxis] = useState<AxisDirection>(DEFAULT_LOAD_AXIS);
  const [kind, setKind] = useState<LoadKind>(kinds[0]);
  const [applyError, setApplyError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  // The last *completed* entry. Null again from the first keystroke after it,
  // so Apply can never apply a value the field no longer shows.
  const draftRef = useRef<number | null>(null);
  // Null until a station is entered, and null again from the first keystroke
  // after -- the same staleness rule as the magnitude draft. Deliberately not
  // defaulted to 0: the field resets after each Apply, so a default would place
  // the next Load at the start Node while the field showed nothing, and a
  // station is exactly the field a student adjusts between two Loads.
  const positionRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  // A ref rather than state: this is a one-shot instruction consumed by the
  // very next commit, and storing it in state would mean setting state from
  // inside the effect that reads it.
  const focusAfterDeleteRef = useRef<number | null>(null);

  const unitSystem = useUnitStore((s) => s.system);
  const unit = loadUnitLabel(kind, unitSystem);
  const rejection = positiveRejection(`Load on ${entityLabel}`, "magnitude");

  // Deleting the focused control would otherwise drop focus to <body>, leaving
  // a keyboard user nowhere. Focus moves to the Load that took its place, or
  // to the last one, or back to the magnitude field when none are left.
  useEffect(() => {
    const index = focusAfterDeleteRef.current;
    if (index === null) return;
    focusAfterDeleteRef.current = null;

    const buttons = listRef.current
      ? Array.from(listRef.current.querySelectorAll("button"))
      : [];
    const next = buttons[Math.min(index, buttons.length - 1)];
    if (next) {
      next.focus();
      return;
    }
    document.getElementById(`${idPrefix}-magnitude`)?.focus();
    // Runs after the list has re-rendered without the deleted row, which is
    // exactly when the replacement control exists to receive focus.
  }, [loads, idPrefix]);

  const apply = () => {
    const kilonewtons = draftRef.current;
    // A point Load with no station has nowhere to act, so it is refused here
    // rather than being placed somewhere plausible.
    if (kind === "point" && positionRef.current === null) {
      setApplyError(missingStationRejection(`Load on ${entityLabel}`));
      setAnnouncement("");
      return;
    }
    if (
      kilonewtons === null ||
      !addLoad(
        newLoad(
          crypto.randomUUID(),
          forceToStore(kilonewtons, unitSystem),
          AXIS_DIRECTIONS[axis],
          kind,
          lengthToStore(positionRef.current ?? 0, unitSystem),
        ),
      )
    ) {
      // The store refuses anything non-finite or non-positive, and anything
      // pointing at an entity that is gone. Staying silent here would clear
      // the field and show nothing at all.
      setApplyError(rejection);
      setAnnouncement("");
      return;
    }
    draftRef.current = null;
    // Cleared with the draft, not left standing: the field below resets to
    // empty on the same signal, and a ref surviving that would apply the next
    // Load at the last station while the field showed none.
    positionRef.current = null;
    setApplyError("");
    setAnnouncement(`Load applied to ${entityLabel}.`);
    setResetSignal((signal) => signal + 1);
  };

  const handleCommit = (kilonewtons: number | null, source: CommitSource) => {
    draftRef.current = kilonewtons;
    if (applyError !== "") setApplyError("");
    // Enter is a submit; a blur is just the user moving on.
    if (source === "enter") apply();
  };

  const handleDelete = (load: Load, index: number) => {
    // Confirmed like every other destructive control in the panel.
    if (!window.confirm("Delete this Load?")) return;
    deleteLoad(load.id);
    setApplyError("");
    setAnnouncement(`Load ${index + 1} on ${entityLabel} deleted.`);
    focusAfterDeleteRef.current = index;
  };

  const applyErrorId = `${idPrefix}-apply-error`;

  return (
    <fieldset className="load-block">
      <legend>{legend}</legend>

      {kinds.length > 1 && (
        <div className="field">
          <label htmlFor={`${idPrefix}-kind`}>Type</label>
          <select
            id={`${idPrefix}-kind`}
            value={kind}
            onChange={(event) => setKind(event.target.value as LoadKind)}
          >
            {kinds.map((option) => (
              <option key={option} value={option}>
                {LOAD_KIND_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      )}

      <NumericField
        id={`${idPrefix}-magnitude`}
        label={`Magnitude (${unit})`}
        fieldName="magnitude"
        entityLabel={`Load on ${entityLabel}`}
        value={null}
        onCommit={handleCommit}
        onEntryChange={() => {
          draftRef.current = null;
        }}
        resetSignal={resetSignal}
      />

      <div className="field">
        <label htmlFor={`${idPrefix}-direction`}>Direction</label>
        <select
          id={`${idPrefix}-direction`}
          value={axis}
          onChange={(event) => setAxis(event.target.value as AxisDirection)}
          aria-describedby={`${idPrefix}-direction-hint`}
        >
          {AXIS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {/* Screen coordinates run the other way, so the global convention is
            worth stating rather than leaving a student to infer it. */}
        <p className="hint" id={`${idPrefix}-direction-hint`}>
          Global axes: +y is up, −y is down.
        </p>
      </div>

      {/* A point Load needs to say where along the member it acts. On a Truss
          this is the only way to express one at all: adding a Node under the
          load would put a pin mid-member and turn the chord into a mechanism. */}
      {kind === "point" && (
        <NumericField
          key={`${idPrefix}-position-field`}
          id={`${idPrefix}-position`}
          label={`Distance from start (${lengthUnit(unitSystem)})`}
          fieldName="distance"
          entityLabel={`Load on ${entityLabel}`}
          value={null}
          onCommit={(value) => {
            positionRef.current = value;
          }}
          onEntryChange={() => {
            positionRef.current = null;
          }}
          resetSignal={resetSignal}
        />
      )}

      <button
        type="button"
        className="load-apply"
        onClick={apply}
        aria-describedby={applyErrorId}
      >
        Apply Load
      </button>
      <p className="field-error" id={applyErrorId} aria-live="polite">
        {applyError}
      </p>

      {/* Rendered only once a Load exists -- never as a zero-value placeholder
          claiming a Load that was never applied. */}
      {loads.length > 0 && (
        <ul className="load-list" ref={listRef}>
          {loads.map((load, index) => (
            <li key={load.id} className="load-row">
              <span className="load-tag">
                L: {formatForce(load.magnitude, unitSystem, 2)} {unit},{" "}
                {axisLabelFor(load.direction)}
              </span>
              <button
                type="button"
                className="load-delete"
                // Named, not just "Delete": several of these can be on screen
                // at once and a screen reader would otherwise hear the same
                // button repeated with no way to tell them apart.
                aria-label={`Delete Load ${index + 1} on ${entityLabel}`}
                onClick={() => handleDelete(load, index)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="hint" role="status" aria-live="polite">
        {announcement}
      </p>
    </fieldset>
  );
}

/**
 * Structure Type selector (Truss/Frame/Beam preset), per-Node Support and
 * concentrated Loads, and per-Element Material / Cross-Section / area /
 * inertia / UDLs. Plain <select>/<input> elements, styled via tokens.css.
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
  const loads = useStructureStore((s) => s.loads);
  const structureType = useStructureStore((s) => s.type);
  const unitSystem = useUnitStore((s) => s.system);
  const updateNode = useStructureStore((s) => s.updateNode);
  const updateElement = useStructureStore((s) => s.updateElement);
  const setStructureType = useStructureStore((s) => s.setStructureType);

  const selectedNodeIndex = nodes.findIndex((n) => n.id === selectedNodeId);
  const selectedNode =
    selectedNodeIndex === -1 ? null : nodes[selectedNodeIndex];
  const selectedElementIndex = elements.findIndex(
    (e) => e.id === selectedElementId,
  );
  const selectedElement =
    selectedElementIndex === -1 ? null : elements[selectedElementIndex];

  // Null when either end Node is missing -- an Element can briefly outlive one
  // between a cascade and the render that reconciles the selection, and a
  // length of NaN on screen is worse than no length.
  const selectedElementLength = (() => {
    if (!selectedElement) return null;
    const start = nodes.find((n) => n.id === selectedElement.startNode);
    const end = nodes.find((n) => n.id === selectedElement.endNode);
    if (!start || !end) return null;
    return Math.hypot(end.x - start.x, end.y - start.y);
  })();
  // Nodes and Elements are both labelled by draw order (N1, N2 / E1, E2) --
  // the stored id is a UUID, which is not what a student reads back off the
  // canvas, and is certainly not what a rejection message should quote. Empty
  // when nothing is selected, so a stray render can't produce an "N0"/"E0".
  const selectedNodeLabel = nodeLabel(nodes, selectedNode?.id ?? null);
  const elementLabel = labelForElement(elements, selectedElement?.id ?? null);
  // Mirrors the store's Structure Type guard exactly, Loads included, so the
  // hint can never say the switch is available while the guard blocks it.
  const hasContent =
    nodes.length > 0 || elements.length > 0 || loads.length > 0;

  // Filtered by target, not by kind: a Load belongs to the entity it points
  // at. Order is application order, which is what the delete controls number.
  const nodeLoads = loads.filter(
    (load) =>
      load.target.type === "node" && load.target.nodeId === selectedNodeId,
  );
  const elementLoads = loads.filter(
    (load) =>
      load.target.type === "element" &&
      load.target.elementId === selectedElementId,
  );

  const handlePresetChange = (
    value: StructurePreset,
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    // Beam is a drawing-time preset; it's stored as "FRAME" like any other Frame.
    const targetType: StructureType = value === "BEAM" ? "FRAME" : value;
    const ok = setStructureType(targetType);
    if (!ok) {
      window.alert(
        "Structure Type can't be changed while the Project has Elements, Supports or Loads. Clear the canvas first.",
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
            <p className="node-id">Node {selectedNodeLabel}</p>
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

            {/* Keyed on the Node: selecting a different one starts a fresh
                entry rather than carrying a half-typed magnitude across. */}
            <LoadBlock
              key={`node-load-${selectedNode.id}`}
              legend="Load (concentrated)"
              kinds={["concentrated"]}
              newLoad={(id, magnitude, direction) =>
                createLoad(
                  id,
                  "concentrated",
                  nodeTarget(selectedNode.id),
                  magnitude,
                  direction,
                )
              }
              entityLabel={`Node ${selectedNodeLabel}`}
              loads={nodeLoads}
              idPrefix="node-load"
            />

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

            {/* Derived, never stored: the length is the distance between the
                two Nodes and changes the moment either is dragged. Read-only
                for the same reason -- it is edited by moving a Node. */}
            {selectedElementLength !== null && (
              <p className="element-derived">
                <span>Length</span>
                <span className="val-readonly">
                  {formatLength(selectedElementLength, unitSystem)}{" "}
                  {lengthUnit(unitSystem)}
                </span>
              </p>
            )}

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
              label={`Area (${areaUnit(unitSystem)})`}
              fieldName="area"
              entityLabel={`Element ${elementLabel}`}
              value={
                selectedElement.area === null
                  ? null
                  : areaToDisplay(selectedElement.area, unitSystem)
              }
              onCommit={(value) =>
                updateElement(selectedElement.id, {
                  area: value === null ? null : areaToStore(value, unitSystem),
                })
              }
            />

            {/* Truss Elements are axial-only: the solver never uses inertia,
                so the field is omitted rather than shown-and-ignored (FR-2). */}
            {structureType !== "TRUSS" && (
              <NumericField
                key={`${selectedElement.id}-inertia`}
                id="element-inertia"
                label={`Inertia (${inertiaUnit(unitSystem)})`}
                fieldName="inertia"
                entityLabel={`Element ${elementLabel}`}
                value={
                  selectedElement.inertia === null
                    ? null
                    : inertiaToDisplay(selectedElement.inertia, unitSystem)
                }
                onCommit={(value) =>
                  updateElement(selectedElement.id, {
                    inertia:
                      value === null ? null : inertiaToStore(value, unitSystem),
                  })
                }
              />
            )}

            <LoadBlock
              key={`element-load-${selectedElement.id}`}
              legend="Load (UDL)"
              kinds={["udl", "point"]}
              newLoad={(id, magnitude, direction, loadKind, position) =>
                loadKind === "point"
                  ? createLoad(
                      id,
                      "point",
                      elementTarget(selectedElement.id),
                      magnitude,
                      direction,
                      position,
                    )
                  : createLoad(
                      id,
                      "udl",
                      elementTarget(selectedElement.id),
                      magnitude,
                      direction,
                    )
              }
              entityLabel={`Element ${elementLabel}`}
              loads={elementLoads}
              idPrefix="element-load"
            />
          </>
        ) : (
          <p className="hint">Select an Element to view its properties.</p>
        )}
      </section>
    </aside>
  );
}

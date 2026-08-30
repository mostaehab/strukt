# Epic 1 Context: Structural Modeling & Analysis

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Let a civil engineering student draw a 2D structure (Truss, Frame, or a Beam preset of Frame), configure Supports, Materials, Cross-Sections, and Loads, pick a unit system, and click Solve to get an instant, correct Bending Moment/Shear Force/Normal Force Diagram plus Reactions — with a clear, specific error if the structure is unstable. This epic also carries the brownfield foundation work: reconciling naming drift in the existing `engine/` code and establishing the solver's output contract before any UI is built on it.

## Stories

- Story 1.1: Draw and Edit a Structure on the Canvas
- Story 1.2: Assign Supports to Nodes
- Story 1.3: Assign Materials and Cross-Sections to Elements
- Story 1.4: Apply Loads to the Structure
- Story 1.5: Solve the Structure
- Story 1.6: View Analysis Results
- Story 1.7: Select Unit System

## Requirements & Constraints

- Nodes snap to grid; an Element always connects two distinct, non-coincident Nodes — no zero-length or self-referencing Elements, blocked/merged at draw time.
- Structure Type is Truss or Frame; Beam is a drawing-time preset constraining new Nodes to one horizontal line but stored as Frame. Changing Structure Type once any Element/Support/Load exists is blocked with a warning. Truss Elements hide the moment-of-inertia field.
- Deleting a Node cascades to delete its attached Elements, behind a confirmation prompt.
- Every Node defaults to Free until a Support (Fixed/Hinged/Roller/Free) is explicitly assigned; UI label is "Hinged," never "Pinned."
- An Element needs a Material (Steel/Concrete) or Solve blocks with a validation error naming the Element; changing Material clears any chosen catalog Cross-Section. Cross-Section catalog (AISC W-shapes for Steel; basic rectangular/circular for Concrete) auto-fills area and inertia; manual override must be positive or Solve blocks; picking a new catalog shape replaces an override outright.
- Loads: Concentrated Loads on Nodes and UDLs on Elements, in a global coordinate system (positive x = right, positive y = up). Multiple Loads on the same target sum rather than overwrite.
- Solve (Direct Stiffness Method) must complete under 1 second for classroom-scale structures (~50 Nodes/Elements); beyond that it's not blocked but has no performance/accuracy guarantee, and must degrade visibly, never silently.
- Any structural edit after a Solve invalidates displayed results and Show Steps in that same action.
- Unstable configurations (insufficient restraint, disconnected unstable sub-structures, zero-Element projects) are detected at/before solve time and blocked with a specific error naming the responsible Node/region; zero-Element gets distinct "nothing to analyze yet" wording, not instability wording.
- BMD/SFD label peak positive/negative values with location; NFD distinguishes tension/compression by sign in label text only, never by color. Reactions render at every supported Node and satisfy global equilibrium within the correctness tolerance.
- Unit system (SI/Imperial) is per-project, switchable anytime; conversion is display-only — canonical stored value never drifts, and toggling units never triggers stale-results invalidation.
- Solver correctness is gated in CI against a benchmark suite of textbook problems within ≤0.1% relative error; an unstable structure must never crash or return an invalid result silently; solver runs entirely client-side.

## Technical Decisions

- Strict one-way dependency: UI → store/ (+ Server Actions) → engine/. `engine/` imports only `mathjs` — never react/next/zustand/lib/db.
- Naming reconciliation: `engine/types.ts` is the single source of truth — `Support` is `"FIXED"|"HINGE"|"ROLLER"|"FREE"` (HINGE not PINNED), `StructureType` is `"TRUSS"|"FRAME"` (delete `constants.ts`'s duplicate redeclaration), `Material` is `"STEEL"|"CONCRETE"` (retire `MaterialType`). Store's `analysisResults` field is renamed `results`, plus a new `showSteps` field.
- `Load` is a first-class entity: `{id, kind: "concentrated"|"udl", target: {type:"node",nodeId}|{type:"element",elementId}, magnitude, direction}`, replacing `StructuralNode.fx/fy/mz`; `mz` is removed entirely.
- Solve contract: one `solve()` returns a single `SolveResult` keyed by entity id (never array index) — `displacements`, `reactions`, `elementForces`, plus intermediate data Epic 2 needs (`localStiffness`, `dofMap`, `reducedSystem` with `freeDofs`). Only plain `number`/`number[]`/`number[][]` cross the boundary — no mathjs `Matrix`. Runs client-side, synchronous, never persisted.
- Units: `engine/`/`store/`'s canonical structure is always SI, no exception; conversion happens only at the input/output boundary; `unitSystem` is a UI flag, never a stored entity field.
- Cross-Section catalog is a static data module under `engine/catalog/`, pre-converted to SI at authoring time — not a database table.
- A Vitest benchmark suite runs against `engine/` and gates CI merge.
- Canvas rendering is assumed to use react-three-fiber + drei with an orthographic camera (not SVG/Canvas2D) — unverified assumption.
- A blocked-Solve/validation error always has the shape `{code, message, nodeId?, elementId?}`.

## UX & Interaction Patterns

- Visual register is "Precise & Clinical" (Blueprint Classic palette): hairline strokes, zero corner-radius except canvas node glyphs, monospace numerals for engineering values, one interactive accent color for actions/loads/selection.
- Core components: Button-Solve (+ blocked variant, never silently disabled), Toolbar-tool (Node/Element/Support/Load/Select), Support/Material dropdowns, Cross-Section picker, Load input fields, Tag-outline (Reaction "R:" / Load "L:" prefixed, never color-only), Type-badge, Canvas-element-stroke (dashed Truss / solid Frame), Diagram-card, Error-banner, Units-toggle, Canvas-grid, Focus-ring.
- Canvas Workspace states: cold load, unsolved, solved, instability blocked, zero-Element, validation blocked, multiple-disconnected-sub-structures, Structure-Type-switch blocked, large/unsupported-scale.
- Interaction primitives: tap/click to place and select, drag to move, canvas pan/zoom (unverified gesture convention), delete with cascade confirmation, Escape to deselect — full touch/mouse parity, no hover-only affordances anywhere.
- Progressive disclosure: canvas minimal until something is selected; results render immediately, unprompted, after Solve (Show Steps' own gating belongs to Epic 2).
- Accessibility floor: WCAG 2.2 AA, full keyboard operability (Solve never mouse-only), visible focus ring, text-based (never color-only) errors announced via aria-live, reading-order focus, prefers-reduced-motion fallback.
- Voice: errors name the specific Node/field (e.g. "Node N5 is unrestrained. Assign a Support..."); "Hinged" never "Pinned"; a distinct empty-results message rather than a generic error tone.

## Cross-Story Dependencies

- Story 1.1 is first to touch `StructureType` (fixes `constants.ts`'s duplicate declaration); 1.2 first to touch `Support`; 1.3 first to touch `Material` and builds the Cross-Section catalog; 1.4 introduces the `Load` entity and removes `mz`. Stories 1.5–1.7 depend on this geometry/Support/Material/Load model.
- Story 1.5 establishes the Vitest benchmark suite; Story 1.6 depends on 1.5's `SolveResult` shape.
- Story 1.7 (units) touches the input/output boundary across every other story's fields but must never trigger stale-results invalidation.
- Epic 2 (Show Steps) depends entirely on this epic's `SolveResult` shape already exposing `localStiffness`/`dofMap`/`reducedSystem` — no new solver logic there.
- Epic 3 (Accounts & Projects) depends on this epic's entity shapes being stable before the persisted Project JSONB document can be finalized.

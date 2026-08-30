---
title: 'Story 1.1 + 1.2 — Draw/Edit Structure on Canvas + Assign Supports'
type: 'feature'
created: '2026-08-30'
status: 'done'
context: []
baseline_commit: '1228fbb1b22a8aa3eb01b9600b96477e832cca2b'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The canvas is empty (`components/canvas`, `components/panels`, `components/ui` have zero files; `app/page.tsx` is the unedited create-next-app scaffold), and `engine/types.ts`/`constants.ts` have naming drift (`PINNED` vs `HINGE`, `StructureType` declared twice) that must be fixed before any UI builds on it.

**Approach:** Reconcile the two type declarations per Architecture AD-2, then build a snap-to-grid canvas (react-three-fiber + drei, orthographic camera) where a student places/edits/deletes Nodes and Elements, picks a Structure Type (Truss/Frame/Beam preset), and assigns a Support to any Node via a properties-panel dropdown.

## Boundaries & Constraints

**Always:**
- `engine/` stays framework-free (AD-1) — the type fixes touch only `types.ts`/`constants.ts`, no react/zustand import enters `engine/`.
- `Support` is `"FIXED"|"HINGE"|"ROLLER"|"FREE"` (not `PINNED`); `StructureType` has exactly one declaration (delete `constants.ts`'s `export type StructureType = keyof typeof STRUCTURE_TYPES`).
- Every canvas interaction (place, select, move, delete) has a working touch equivalent — no hover-only affordance.
- Deleting a Node cascades to its attached Elements, behind a confirmation prompt.
- `store/useStructureStore.ts` keeps its existing zustand shape/action names (`addNode`, `updateNode`, etc.) except where this spec's tasks say otherwise — don't rename unrelated fields.

**Ask First:**
- Whether to introduce Tailwind v4 theme tokens vs. plain CSS custom properties for the handful of DESIGN.md tokens this story actually needs (colors, spacing, zero-radius) — not the full token system, just what Stories 1.1/1.2 touch.
- If react-three-fiber proves genuinely awkward for crisp hairline strokes or the dashed/solid element distinction (a risk the architecture spine already flagged), stop and ask before switching to SVG.

**Never:**
- No Materials, Cross-Sections, Loads, Solve, results, Show Steps, units, or accounts/auth — those are later stories/epics. Build the canvas as a standalone page at `app/page.tsx` for now, not behind auth.
- No full dark-mode toggle UI — keep colors as CSS variables (theme-able later), don't wire a switch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Place a Node | Click/tap on canvas with Node tool active | Node snaps to nearest grid point, added to store | N/A |
| Connect two distinct Nodes | Draw an Element between Node A and Node B | Element added, referencing both node ids | N/A |
| Coincident/self-connect attempt | Draw an Element to the same Node, or to another Node at identical coords | Placement blocked or merged — no zero-length Element created | Inline cursor/tool feedback, no silent Element |
| Choose Beam preset | Select "Beam" as Structure Type on an empty Project | New Nodes constrained to one horizontal line; `type` stored as `"FRAME"` | N/A |
| Switch Structure Type with content present | Any Element/Support exists, user picks a different Structure Type | Change blocked, warning shown | N/A |
| Delete a Node with attached Elements | Select Node, press Delete | Confirmation prompt; on confirm, Node and its Elements removed together | Cancel leaves state untouched |
| Assign a Support | Select a Node, open Support dropdown | Options read Fixed/Hinged/Roller/Free ("Hinged", never "Pinned"); unset Nodes default to Free | N/A |
| Touch-only interaction | Same actions above via tap/drag on a touch device | Identical outcome to mouse — no action is mouse-only | N/A |

</frozen-after-approval>

## Code Map

- `engine/types.ts` -- rename `StructuralSupport` to `Support`, fix `PINNED`->`HINGE` (AD-2)
- `engine/constants.ts` -- delete duplicate `StructureType` redeclaration (AD-2)
- `engine/geometry.ts` (new) -- pure helper `canConnect(nodes, startId, endId)` for coincident/self-connect check, kept framework-free and unit-testable
- `store/useStructureStore.ts` -- update `Support` import; cascade-delete in `deleteNode`; structure-type-switch guard
- `components/ui/tokens.css` (new) -- the DESIGN.md tokens this story needs (colors, spacing, radius=0)
- `components/canvas/CanvasWorkspace.tsx` (new) -- r3f `<Canvas>` with orthographic camera, snap-to-grid, tool-driven placement
- `components/canvas/NodeGlyph.tsx`, `ElementLine.tsx` (new) -- render primitives
- `components/panels/Toolbar.tsx` (new) -- Node/Element/Select tool switcher
- `components/panels/PropertiesPanel.tsx` (new) -- Structure Type selector + per-Node Support dropdown
- `app/page.tsx` -- replace create-next-app scaffold with Toolbar + CanvasWorkspace + PropertiesPanel

## Tasks & Acceptance

**Execution:**
- [x] `engine/types.ts` -- rename `StructuralSupport`->`Support`, `PINNED`->`HINGE` -- AD-2, matches UX-settled "Hinged" label
- [x] `engine/constants.ts` -- delete the duplicate `StructureType` export -- AD-2
- [x] `engine/geometry.ts` -- add `canConnect()` pure helper + unit tests for coincident/self-connect cases
- [x] `store/useStructureStore.ts` -- cascade-delete Elements in `deleteNode`; add a `setStructureType` guard that no-ops+returns false once any Element/Support exists
- [x] `components/ui/tokens.css` -- background/surface/ink/accent/border-hairline colors, spacing scale, radius=0
- [x] `components/canvas/CanvasWorkspace.tsx` -- grid rendering, Node/Element placement and selection, touch+mouse pointer handling
- [x] `components/panels/Toolbar.tsx` + `PropertiesPanel.tsx` -- tool switching; Structure Type (Truss/Frame/Beam) and Support dropdown UI
- [x] `app/page.tsx` -- assemble the three components into the Canvas Workspace layout

**Acceptance Criteria:**
- Given the Canvas Workspace is open, when I place two Nodes and connect them, then an Element referencing both ids exists in the store
- Given I attempt to connect a Node to itself or to a coincident Node, when I complete the drag, then no Element is created
- Given any Element/Support exists, when I try to change Structure Type, then the store rejects the change and the UI shows a warning
- Given a Node with attached Elements, when I delete it and confirm, then the Node and its Elements are all removed together
- Given a Node with no Support assigned, when I view its properties, then the Support dropdown shows "Free" as the default and lists Fixed/Hinged/Roller/Free

## Design Notes

`canConnect()` lives in `engine/` (not a component) so it stays testable without React and reusable if a future non-canvas entry point (e.g. import/paste) needs the same check. The orthographic r3f camera gives 1:1 world-to-grid coordinates, so "snap to nearest grid point" is a plain `Math.round(x / gridSize) * gridSize` in world space, no screen-to-world projection math needed beyond r3f's built-in raycasting for pointer events.

## Verification

**Commands:**
- `npm run lint` -- expect no new errors
- `npx tsc --noEmit` -- expect no new type errors
- `npx vitest run engine/geometry.test.ts` -- expect `canConnect()` edge cases pass

**Manual checks (if no CLI):**
- Open the app, draw a small Truss and a Beam-preset Frame, confirm snap-to-grid, confirm switching Structure Type after adding an Element is blocked, confirm deleting a connected Node prompts and cascades, confirm Support dropdown defaults to Free and labels read "Hinged."
- Repeat the same flow with touch emulation (browser devtools) to confirm parity.

## Suggested Review Order

**Data model reconciliation (AD-2 foundation)**

- Support enum fixed to HINGE (not PINNED), single source of truth for every shared type
  [`types.ts:3`](../../engine/types.ts#L3)

- Duplicate StructureType declaration deleted from constants.ts
  [`constants.ts:49`](../../engine/constants.ts#L49)

**Coincidence & id-safety (pure domain logic)**

- Framework-free helper blocking self/coincident Element connections — the one new `engine/` function
  [`geometry.ts:14`](../../engine/geometry.ts#L14)

**Store: cascade-delete & structure-type guard**

- Deleting a Node cascades to its attached Elements
  [`useStructureStore.ts:18`](../../store/useStructureStore.ts#L18)

- Structure Type change blocked once any Node/Element exists
  [`useStructureStore.ts:39`](../../store/useStructureStore.ts#L39)

**Canvas interaction (the core of this story)**

- Node placement: snap-to-grid + coincidence guard (existing Node reused instead of stacking a duplicate)
  [`CanvasWorkspace.tsx:137`](../../components/canvas/CanvasWorkspace.tsx#L137)

- Element connection: tap-tap flow, self/coincident rejection
  [`CanvasWorkspace.tsx:180`](../../components/canvas/CanvasWorkspace.tsx#L180)

- Pending-connection staleness cleared during render when its Node is deleted mid-connection
  [`CanvasWorkspace.tsx:85`](../../components/canvas/CanvasWorkspace.tsx#L85)

- Drag: coincidence guard prevents dragging one Node onto another's exact cell
  [`CanvasWorkspace.tsx:166`](../../components/canvas/CanvasWorkspace.tsx#L166)

- Escape cancels an in-progress Element connection
  [`CanvasWorkspace.tsx:111`](../../components/canvas/CanvasWorkspace.tsx#L111)

**UI panels**

- Structure Type selector rejects mid-content changes; native `<select>` snaps back on rejection
  [`PropertiesPanel.tsx:41`](../../components/panels/PropertiesPanel.tsx#L41)

- Support dropdown, defaults to Free, labels read "Hinged"
  [`PropertiesPanel.tsx:16`](../../components/panels/PropertiesPanel.tsx#L16)

- Node/Element/Select tool switcher
  [`Toolbar.tsx:1`](../../components/panels/Toolbar.tsx#L1)

**Page assembly**

- Toolbar + CanvasWorkspace + PropertiesPanel wired together; Delete/Backspace + Escape keyboard supplement
  [`page.tsx:1`](../../app/page.tsx#L1)

**Styling & design tokens**

- Minimal `--strukt-*` prefixed token set, incl. restored automatic dark mode
  [`tokens.css:1`](../../components/ui/tokens.css#L1)

- Canvas Workspace layout CSS
  [`globals.css:35`](../../app/globals.css#L35)

**Peripherals**

- `canConnect()` unit tests (self-connect, coincident, valid, missing-node cases)
  [`geometry.test.ts:1`](../../engine/geometry.test.ts#L1)

- Vitest config + `test` script
  [`vitest.config.mts:1`](../../vitest.config.mts#L1)

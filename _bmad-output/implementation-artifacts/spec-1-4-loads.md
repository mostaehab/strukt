---
title: 'Story 1.4 — Apply Loads to the Structure'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '98c0e5bc9772eeba481d8c98931291aef4ac2c69'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no way to apply a force. `StructuralNode` carries scalar `fx`/`fy`/`mz` that nothing writes, that cannot express two loads on one Node, and whose `mz` has no referent at all. A structure with Materials and Cross-Sections still has nothing to solve for.

**Approach:** Introduce the first-class `Load` entity per AD-10 and delete the scalar fields outright. Concentrated Loads apply to a selected Node and UDLs to a selected Element, both from the properties panel; loads draw as accent arrows on the canvas; pure `engine/` helpers sum the Loads targeting one entity so Story 1.5 consumes a resolved vector rather than re-deriving one.

## Boundaries & Constraints

**Always:**
- `Load` matches AD-10 exactly: `{ id, kind: "concentrated" | "udl", target: { type: "node", nodeId } | { type: "element", elementId }, magnitude: number, direction: [number, number] }`.
- Global convention is +x rightward, +y upward. `direction` is a unit vector; the panel exposes ±X/±Y only, so storage stays deliberately more expressive than the input.
- SI base units, no exceptions (AD-4): newtons for concentrated, newtons per metre for UDL. kN is display-only; neither `engine/` nor `store/` holds a converted value.
- Each Load is its own list entry, never accumulated into a field (AD-10). Summing lives in a pure `engine/` helper.
- Deleting a Node removes Loads targeting it **and** Loads targeting every Element the cascade removes with it.
- Structure Type switching is blocked once any Load exists, alongside the existing Node/Element check.
- `NodeResult.rmz` is untouched — the output reaction moment, not the input `mz` being removed.
- A Load tag renders only once a Load exists, never as a zero-value placeholder. `L:` prefixes the panel tag; canvas labels carry no prefix.

**Ask First:**
- If summing must live outside a pure `engine/` helper — AD-10 binds `engine/stiffness.ts` but never names the layer, so this is inference.
- If rejecting a non-positive magnitude at the field is wrong; no artifact authored the rule.

**Never:**
- No moment or `mz` loads — an unconditional FR-9 non-goal in three artifacts; `mz` is removed, not reserved.
- No Load toolbar tool and no "Loads menu" — panel-only, decided 2026-08-31. The rail stays Node/Element/Select.
- No off-axis direction entry, trapezoidal loads, or support settlements.
- No `engine/constants.ts` edits — still the separate deferred spec, concrete `E` bug included.
- No `analysisResults`→`results` rename or stale-results invalidation — Story 1.5, which must now also cover `addLoad`/`updateLoad`/`deleteLoad`.
- No Solve, validation module, diagrams, or SI/Imperial toggle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Concentrated Load on a Node | Magnitude + direction on a selected Node | Stored `kind: "concentrated"` with `target.nodeId` and a unit-vector direction | N/A |
| UDL on an Element | Magnitude + direction on a selected Element | Stored `kind: "udl"` with `target.elementId` | N/A |
| Loads on one target sum | Two Loads target the same Node (or Element) | Both persist as separate entries; resolved force is their vector sum | N/A |
| Opposing Loads cancel | 5 N up and 5 N down on one Node | Resolved force is zero, not 5 | N/A |
| Direction picker | Choose −Y (down) | `direction` is `[0, -1]`; panel reads `−y` using U+2212 | N/A |
| Non-positive magnitude | Enter `0` or negative | Not committed; prior value stands | Text error, `aria-live`, never color-only |
| Delete one of two Loads | Two Loads on a Node, one removed | The other survives; resolved sum drops to it alone | N/A |
| Node delete, two-level cascade | Node has Loads and an Element carrying UDLs | Node, its Elements, its Loads and those Elements' UDLs all go together | No orphaned Load survives |
| Element delete | Element carries UDLs | Those UDLs go; Loads on its end Nodes untouched | N/A |
| Structure Type switch with a Load | Any Load exists | Blocked with the existing warning | Select snaps back |
| Nothing assigned | Node or Element with no Load | No panel tag, no canvas arrow | N/A |
| Canvas arrow orientation | `direction: [0, -1]` | Drawn along −y, head at the target, label at the tail | N/A |
| Load on an isolated Node | Loaded Node with no Element | Stored and drawn; nothing blocks it here | Story 1.5's instability check |

</frozen-after-approval>

## Code Map

- `engine/types.ts` -- remove `fx`/`fy`/`mz` from `StructuralNode` (L7-15); add `LoadKind`, `LoadTarget`, `Load`; extend `StructureState` (L58) with `loads` + `addLoad`/`updateLoad`/`deleteLoad`, and `EnginePayload` (L68) with `loads`. Leave `NodeResult.rmz` (L41) alone.
- `engine/load.ts` (new) -- `createLoad()` and `AXIS_DIRECTIONS` (four unit vectors). Follow `engine/element.ts`: type-only relative import, JSDoc citing AD-10, no throws.
- `engine/loadResolution.ts` (new) -- pure `resolveNodeLoad(loads, nodeId)` / `resolveElementLoad(loads, elementId)` returning summed `{ x, y }`. This is the derived replacement for the deleted `fx`/`fy`; Story 1.5 consumes it.
- `engine/load.test.ts`, `engine/loadResolution.test.ts` (new) -- mirror `engine/element.test.ts`'s structure. Cover every engine-side matrix row, sums especially.
- `store/useStructureStore.ts` -- add `loads` and the three actions. `deleteNode` (L120) cascades to Elements only today; it must also drop Loads on the Node and on the cascaded Elements — compute the removed Element ids once, filter Loads against both. `deleteElement` (L137) drops that Element's Loads. `setStructureType` (L140) gains `loads.length > 0`. `clearAll` (L154) resets `loads`.
- `components/canvas/loadGlyphGeometry.ts` (new) -- pure shaft/head geometry from target point + direction, shaped like `components/canvas/pickProxy.ts` (framework-free, node-testable, exported z constant). Named `loadGlyphGeometry`, not `loadGlyph`: `LoadGlyph.tsx` alongside it would differ only in casing, which TypeScript rejects on a case-insensitive filesystem.
- `components/canvas/LoadGlyph.tsx` (new) -- shaft, filled triangular head, label, all in accent. `mockups/key-canvas.html:252-260` is the only geometry ground truth: 60px shaft, 12×12 head at the target end, mono 11px label at the tail.
- `components/canvas/CanvasWorkspace.tsx` -- drop `fx`/`fy`/`mz` from node creation (L164-172); render a `LoadGlyph` per Load; `COLORS.accent` (L28) is the load color.
- `components/panels/PropertiesPanel.tsx` -- generalise `NumericField`'s `elementLabel` prop to an entity label so Nodes reuse it. Add a Load block to both the Node section (concentrated) and Element section (UDL): magnitude field, direction select, `L:` tag, delete control. Field label `Load (concentrated)` per the mockup.
- `app/globals.css` -- add `.load-tag` from `key-canvas.html:160-163`, using the existing numeral and accent tokens rather than the mockup's hardcoded values.
- `engine/geometry.test.ts:6`, `app/page.test.tsx:45`, `components/canvas/CanvasWorkspace.test.tsx:62` -- three `makeNode` helpers build `fx`/`fy`/`mz`; all must drop them.

## Tasks & Acceptance

**Execution:**
- [x] `engine/types.ts` -- `Load`/`LoadKind`/`LoadTarget`, remove the scalar fields, extend `StructureState` and `EnginePayload` -- AD-10
- [x] `engine/load.ts` -- `createLoad()` and the four axis unit vectors
- [x] `engine/loadResolution.ts` -- pure summing helpers, the derived replacement for the removed per-Node force scalars
- [x] `engine/load.test.ts` + `engine/loadResolution.test.ts` -- engine-side matrix rows, sums included
- [x] `store/useStructureStore.ts` -- `loads`, three actions, two-level `deleteNode` cascade, `deleteElement` cascade, Structure Type guard, `clearAll`
- [x] `store/useStructureStore.test.ts` -- cascade and guard rows, including no-orphaned-Load
- [x] `components/canvas/loadGlyphGeometry.ts` + test -- pure arrow geometry
- [x] `components/canvas/LoadGlyph.tsx` + `CanvasWorkspace.tsx` -- render arrows, drop the scalar fields from node creation
- [x] `components/panels/PropertiesPanel.tsx` + `app/globals.css` -- Load blocks, direction picker, `L:` tag, `.load-tag` styling (plus `utils/units.ts`, the one kN/N conversion helper the Design Notes call for)
- [x] Update the three `makeNode` test helpers -- the type change surfaces them

**Acceptance Criteria:**
- Given a `grep` for `fx`/`fy`/`mz` across `app`, `components`, `engine`, `store`, when it runs, then only `rmz` matches
- Given a Node carrying a Load and an Element that also carries one, when that Node is deleted, then no Load referencing either removed entity remains
- Given a keyboard user tabbing the Load fields, when they traverse, then magnitude, direction, and delete each take focus with a visible ring in reading order
- Given `npm test`, when it runs, then every engine-side matrix row is covered and passes

## Design Notes

**Why the summing helpers exist.** Deleting `fx`/`fy` removes the only place a Node's total force lived, and AD-10 forbids re-accumulating it into a field — so the total is derived on read. Putting that in `engine/` now means Story 1.5 assembles its force vector from a unit-tested function instead of re-summing inline.

**Zero-magnitude Loads.** No artifact authored this rule; the PRD's edge-case review raised it and it was never absorbed. Rejecting at the field matches Story 1.3's positive-area rule and reuses the same `NumericField`, keeping panel behavior consistent. Note a UDL on a zero-length Element — the review's sibling concern — is already unreachable, since `canConnect` blocks coincident Nodes.

**Node labels pulled forward.** Rejection messages must name the entity, and Nodes currently render raw UUIDs, so the message would embed one. This story gives Nodes the positional labelling Elements already have (`N1`, `N2`), closing the Node half of the deferred label-consistency entry. The renumbering instability stays deferred — it affects both entity types and needs a stable-ordinal decision.

**Approved microcopy**, following Story 1.3's accepted pattern and the `key-canvas.html:356` exemplar:

- `Load on Node N1 needs a positive magnitude. Enter a value greater than zero.`

Panel tag reads `L: 5.00 kN, −y` (U+2212, not a hyphen); canvas labels read `5 kN`, unprefixed, per `tag-outline`'s panel-only scope.

**Units.** Store and engine hold newtons; the panel divides by 1000 to display kN and multiplies on the way in. Keep that in one helper — it is the same read/write-through boundary Story 1.7 generalises for SI/Imperial, and scattered literals would give it nothing to hook.

## Verification

**Commands:**
- `npm run lint` -- expect no new errors
- `npx tsc --noEmit` -- expect no new type errors. Removing the scalar fields surfaces every construction site; fix them, never cast around them
- `npm test` -- expect the new load suites to pass alongside the existing seven files

**Manual checks (if no CLI):**
- Add a 5 kN downward Load to a Node; confirm the tag reads `L: 5.00 kN, −y` and an accent arrow points down into the Node, labelled `5 kN` at its tail.
- Add a second, upward Load on that Node; confirm both tags list and both arrows draw.
- Put a UDL on an Element, then delete one of its end Nodes; confirm Element, UDL and Node Loads all vanish together.
- With a Load present, try switching Structure Type; confirm it blocks and the select snaps back.
- Repeat the magnitude and direction flow with touch emulation and keyboard only.

## Suggested Review Order

**The entity AD-10 asked for — start here**

- `Load` is a union, so a UDL on a Node is unrepresentable rather than merely unproduced
  [`types.ts:82`](../../engine/types.ts#L82)

- Overloaded factory branches on the target, so the union needs no cast or unreachable fallback
  [`load.ts:57`](../../engine/load.ts#L57)

- Direction is normalised on write; a non-unit vector would otherwise silently scale magnitude
  [`load.ts:109`](../../engine/load.ts#L109)

- `LoadPatch` excludes id, kind and target, so an update cannot retarget or duplicate a Load
  [`types.ts:90`](../../engine/types.ts#L90)

**Summing — the derived replacement for the deleted force scalars**

- Vector sum over every Load targeting one Node; Story 1.5 assembles from this, not inline
  [`loadResolution.ts:45`](../../engine/loadResolution.ts#L45)

- Same for UDL intensity on an Element
  [`loadResolution.ts:57`](../../engine/loadResolution.ts#L57)

**Store: validation and the two-level cascade**

- `addLoad` validates magnitude, direction and that the target exists — an orphan would block Structure Type forever
  [`useStructureStore.ts:220`](../../store/useStructureStore.ts#L220)

- Patch applied field-by-field, so even an untyped caller cannot rewrite the immutable fields
  [`useStructureStore.ts:63`](../../store/useStructureStore.ts#L63)

- Deleting a Node drops its Loads *and* the UDLs of every Element the cascade removes
  [`useStructureStore.ts:181`](../../store/useStructureStore.ts#L181)

- Structure Type now blocks on Loads too, as four artifacts require
  [`useStructureStore.ts:251`](../../store/useStructureStore.ts#L251)

- The cascade's own helpers, reused by the delete confirmations so copy and behaviour cannot diverge
  [`load.ts:143`](../../engine/load.ts#L143)

**Canvas: UDL notation is the interesting part**

- A UDL spans the member with a row of arrows on a spine — not a midpoint arrow, which reads as a point load
  [`loadGlyphGeometry.ts:203`](../../components/canvas/loadGlyphGeometry.ts#L203)

- Roughly one arrow per grid square, clamped so short members stay legible and long ones avoid a comb
  [`loadGlyphGeometry.ts:148`](../../components/canvas/loadGlyphGeometry.ts#L148)

- Concentrated arrow geometry: head on the target, label at the tail, stack offset for coincident Loads
  [`loadGlyphGeometry.ts:162`](../../components/canvas/loadGlyphGeometry.ts#L162)

- Shared canvas constants; the camera no longer depends on an arrow-drawing helper
  [`canvasConstants.ts:12`](../../components/canvas/canvasConstants.ts#L12)

- Static vertices behind a declarative `<bufferGeometry>`, so r3f disposes the GPU buffer
  [`LoadGlyph.tsx:52`](../../components/canvas/LoadGlyph.tsx#L52)

- Each Load's position among those sharing its target, so two same-direction Loads never coincide
  [`CanvasWorkspace.tsx:54`](../../components/canvas/CanvasWorkspace.tsx#L54)

**Panel: applying a Load**

- Explicit Apply — a blur only records the draft, so the direction picker is reachable before the commit it controls
  [`PropertiesPanel.tsx:474`](../../components/panels/PropertiesPanel.tsx#L474)

- Escape discards the pending entry instead of committing it on the way out
  [`PropertiesPanel.tsx:286`](../../components/panels/PropertiesPanel.tsx#L286)

- The sign convention stated where the user actually is, not only in module docs
  [`PropertiesPanel.tsx:464`](../../components/panels/PropertiesPanel.tsx#L464)

**Shell**

- Delete confirmations name the Loads the cascade destroys, computed by the store's own helpers
  [`page.tsx:83`](../../app/page.tsx#L83)

- `BUTTON` in the key guard, so Delete on a Load's control no longer deletes the whole Node
  [`page.tsx:122`](../../app/page.tsx#L122)

**Units and labels**

- The single kN⇄N boundary; `loadUnitLabel` marks where Story 1.7's toggle hooks
  [`units.ts:62`](../../utils/units.ts#L62)

- Positional labels shared by panel and canvas, so `N1` means `N1` everywhere
  [`labels.ts:26`](../../utils/labels.ts#L26)

**Peripherals**

- UDL notation: span, count rule, spacing, diagonals, and distinguishability from a point load
  [`loadGlyphGeometry.test.ts:1`](../../components/canvas/loadGlyphGeometry.test.ts#L1)

- Sums, cancellation, cross-target isolation — the behaviour FR-8/FR-9 actually name
  [`loadResolution.test.ts:1`](../../engine/loadResolution.test.ts#L1)

- Cascades, referential integrity, direction normalisation, immutable-field rejection
  [`useStructureStore.test.ts:1`](../../store/useStructureStore.test.ts#L1)

- Apply/Escape/rejection/focus behaviour, and the rerender test that pins the entity reset
  [`PropertiesPanel.test.tsx:1`](../../components/panels/PropertiesPanel.test.tsx#L1)

- Geometry-to-three wiring, mutation-checked: swapping position and rotation fails it
  [`LoadGlyph.test.tsx:1`](../../components/canvas/LoadGlyph.test.tsx#L1)

- Formatting edges — no stored Load ever renders as `0.00 kN`
  [`units.test.ts:1`](../../utils/units.test.ts#L1)

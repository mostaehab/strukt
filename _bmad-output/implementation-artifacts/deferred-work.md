# Deferred Work

Items surfaced during Reviewer Gate review that are real but not this story's problem to fix now.

## From Story 1.1 + 1.2 (spec-1-1-1-2-canvas-drawing-supports.md) Reviewer Gate — 2026-08-30

- **`engine/stiffness.ts`'s unused imports (`MATERIALS`, `SUPPORTS`, `STRUCTURE_TYPES`) and empty stub functions.** Pre-existing (predates this story), not caused by this change. Story 1.5 (Solve the Structure) replaces this file's contents entirely — will resolve naturally then.
- **Keyboard form-guard doesn't check `target.isContentEditable`**, only `tagName` against INPUT/TEXTAREA/SELECT (`app/page.tsx`'s keydown handler). Not currently exploitable — no contentEditable element exists anywhere in the app yet. Revisit if one is ever added.
- **`CanvasWorkspace.tsx`'s hardcoded `COLORS` constant duplicates hex values already in `components/ui/tokens.css`.** Accepted for now since this story deliberately used a minimal CSS-custom-property subset, not a full token pipeline (per spec's own scope boundary). Revisit when a fuller design-token system is built (r3f can't consume CSS custom properties directly without a JS bridge — worth solving properly once more of the canvas's visual system exists, not for two components' worth of colors).

## From Story 1.3 (spec-1-3-materials-cross-sections.md) scope split — 2026-08-31

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: Fix `engine/constants.ts` — delete the zero-consumer `MaterialType` (L12) and `SupportType` (L42) AD-2 redeclarations, correct `MATERIALS.CONCRETE.E` from `25e6` to `25e9` Pa, and drop the redundant lowercase `id` fields that don't map to the uppercase `Material`/`Support` unions.
  evidence: Split from Story 1.3 at the step-02 token gate (spec was ~3570 tokens against a 1600 ceiling). Independently shippable — a pure defect fix with zero UI coupling that merges as its own PR without touching the story's user-facing goal. Carries its own urgency: at `25e6` the concrete modulus reads as 25 MPa rather than the intended ~25 GPa, a 1000x error that would silently corrupt every Story 1.5 solver result regardless of whether Story 1.3 ever ships. `SupportType` is a leftover from Story 1.2, which retired `PINNED` but not the redeclaration.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: Build `engine/validation.ts` (pure `validateElements()` returning `{code, message, nodeId?, elementId?}`) plus `engine/validation.test.ts`, and wire it to the Solve gate — moved into Story 1.5.
  evidence: Split from Story 1.3 at the step-02 token gate. Independently shippable — engine-only, no UI coupling. Story 1.3's ACs phrase FR5/FR7 as "Solve is blocked," but no Solve button exists until Story 1.5, so the gate it serves lives there; Story 1.3 retains only field-level rejection of a non-positive number, which is input validation rather than a Solve gate. Two error strings were reviewed and approved as canonical microcopy on 2026-08-31 and must be used verbatim, not re-derived: `Can't solve: Element E1 has no Material assigned. Choose Steel or Concrete to continue.` and `Can't solve: Element E1 has no Cross-Section. Pick one from the catalog or enter area and inertia directly to continue.` (pattern source: `mockups/key-canvas.html:356`).

## From Story 1.3 Matrix Test Audit — 2026-08-31

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: Elements have no touch-reachable delete control. `PropertiesPanel.tsx:227` renders a "Delete Node" button, but `handleDeleteSelectedElement` (`app/page.tsx:66`) is only reachable from the global keydown handler — so on a touch-only tablet an Element can be created and selected but never deleted. Fix by passing the handler into `PropertiesPanel` and rendering a "Delete Element" button mirroring the Node one.
  evidence: Surfaced by the implementing agent and confirmed at the step-03 audit; human chose to defer rather than fix in this pass. Story 1.3's matrix row only specified the keyboard path (`Delete selected Element | Press Delete | ...`), so the implementation met the spec as written — the gap is against the epic-level requirement instead: `epic-1-context.md` mandates "full touch/mouse parity, no hover-only affordances anywhere," and Story 1.1's frozen spec required "every canvas interaction (place, select, move, delete) has a working touch equivalent." Elements are new in 1.3, so 1.3 introduced the gap. Roughly a 4-line change.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: Nodes display raw UUIDs (`PropertiesPanel.tsx:210`, `Node {selectedNode.id}`) while Elements use draw-order labels (`E1`), so the two entities read inconsistently in the same panel. Give Nodes the same draw-order labelling (`N1`, `N2`, ...).
  evidence: Surfaced by the implementing agent. The UX artifacts assume short human-readable ids throughout — `mockups/key-canvas.html` renders `Node N2 — Properties`, and the approved error microcopy names `Node N5`. Story 1.3 introduced the `E1` convention for Elements but touching Node labelling was outside its scope. Story 1.5's instability errors will need `N`-style labels to match the approved wording, so this is a prerequisite for that story's microcopy rather than cosmetic.

## From Story 1.3 Reviewer Gate — 2026-08-31

Findings from three adversarial review layers (blind-hunter, edge-case-hunter, verification-gap) triaged as `defer` — real, but not this story's problem to fix now.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: Element labels are positional (`E${index + 1}` at `PropertiesPanel.tsx:152-159`), so deleting an earlier Element renumbers every later one — the Element a student was calling E2 silently becomes E1, including inside the rejection messages that embed the label. Needs a stable per-Element ordinal assigned at creation.
  evidence: Reachable through the UI today (delete E1 while E2 is selected) and confirmed by two independent review layers. Deferred rather than patched because the fix is a design decision about where a stable ordinal lives — on the Element, in the store, or derived from an insertion counter — not a mechanical correction. Compounds the sibling entry above about Node UUID vs `E1` inconsistency; both should be settled together, and before Story 1.5's error messages start naming entities.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: The Element pick target is roughly half the documented touch floor. `ELEMENT_HIT_WIDTH = NODE_RADIUS * 2` = 0.44 world units, which at the fixed `CAMERA_ZOOM = 48` is about 21px, against the 44pt/48dp floor recorded in `EXPERIENCE.md:134`. Node glyphs sit at the same size, so the gap predates Elements.
  evidence: The pick proxy achieves parity with the existing Node glyph, which is what the story asked for — but both are under the floor, and with canvas pan/zoom not yet implemented the user cannot compensate by zooming in. Deferred because raising it correctly means deciding the Node glyph size too (a visual-design change touching Story 1.1's work), and because `EXPERIENCE.md:134` itself flags the 44pt figure as an unconfirmed assumption pending explicit UX confirmation.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: There is no keyboard path to select anything on the canvas. The r3f `<Canvas>` has no `tabIndex`, no `role`, and no key handling, and the new `:focus-visible` rule at `app/globals.css:181` deliberately omits `canvas` — so Nodes and Elements can only be selected by pointer or touch.
  evidence: A direct gap against NFR9 / UX-DR7 ("every interactive element is reachable and operable via keyboard, not mouse/touch-only") and WCAG 2.2 AA. Not introduced by Story 1.3 — Story 1.1 shipped Node selection with the same limitation — but 1.3 doubled the surface by making Elements selectable, and neither story's spec acknowledged it as deferred. Deferred here because a canvas keyboard-navigation model (entity traversal order, focus indication inside a WebGL scene, announcement) is its own design problem, not a patch.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: Selection changes are never announced to assistive technology. Selecting an Element swaps the entire properties panel with no focus move and no live region; the existing `canvas-status` live region carries only Node placement and draw messages.
  evidence: Story 1.3's acceptance criteria cover keyboard focus rings and reading order but not announcement, so this is outside what was accepted — yet the Accessibility Floor requires state changes to be perceivable, and a silent full-panel swap is not. Deferred because the right fix spans both Node and Element selection and should be designed once alongside the canvas keyboard model above.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: Elements cannot be repositioned by drag, only Nodes can. `EXPERIENCE.md:117` specifies that "an unselected-then-selected Node **or Element** can be repositioned by drag or touch-drag"; `CanvasWorkspace.tsx:176-188` implements Node dragging only.
  evidence: Now that Elements are selectable, this becomes a live parity gap rather than a hypothetical one, and neither the spec's Boundaries nor any deferral note acknowledged it. Deferred because Element dragging raises a modelling question the UX spine does not answer — whether dragging an Element translates both endpoint Nodes, and how that interacts with snap-to-grid and the coincidence guard.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: The repository has no CI configuration at all — no `.github` directory, and the only YAML present is BMad tooling — so `npm test` runs only when someone runs it locally.
  evidence: Pre-existing and not caused by this story, but it is the whole verification path for every test this story added, and Architecture AD-9 explicitly requires the Vitest benchmark suite to "run against `engine/` in CI and gate merge". Story 1.5 owns that benchmark suite and therefore inherits this as a hard prerequisite: without CI there is nothing for AD-9's gate to attach to, and NFR1's 0.1%-tolerance guarantee is unenforced.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-materials-cross-sections.md`
  summary: Supplements the earlier touch-delete entry with stronger evidence than was available when that deferral was decided — `EXPERIENCE.md:120` requires "a Delete/Backspace key (mouse+keyboard) **or** an explicit on-canvas delete affordance (touch)", and this change deleted an `app/page.tsx` comment that had recorded the keyboard path as "a supplement to the touch-friendly button in PropertiesPanel, not a replacement for it".
  evidence: Raises the earlier entry from an epic-level parity concern to a named requirement violation with a removed in-code acknowledgement. The human deferred it on 2026-08-31 having been told only that it was a ~4-line change against general touch-parity guidance; recorded here so whoever picks it up sees the actual requirement citation rather than re-deriving it.

## From Story 1.4 Reviewer Gate — 2026-08-31

Findings from three adversarial review layers (blind-hunter, edge-case-hunter, verification-gap) triaged as `defer`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-loads.md`
  summary: Removing `StructuralNode.fx`/`fy`/`mz` is a breaking change to the persisted structure shape, and nothing in the codebase carries a schema version — neither `StructureState` nor `EnginePayload`, which itself still has no consumer anywhere.
  evidence: Architecture AD-5 mandates that the persisted `structure` JSONB have "a mandatory `schemaVersion: number` field". No Project has ever been saved (persistence arrives in Epic 3), so nothing is broken today — but Epic 3's load path inherits a shape that has already changed once with no way to recognise or convert an older document. Story 1.3's `crossSectionId` addition and Story 1.4's field removal are both silent shape changes against a format with no version marker. Establish `schemaVersion` before the first Project is persisted, not after.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-loads.md`
  summary: `resolveNodeLoad` and `resolveElementLoad` have no production caller — only tests reference them — so the resultant of multiple Loads is never shown to the user. A student with 5 kN down and 3 kN up on one Node sees two tags and two arrows, never `2 kN ↓`.
  evidence: Spec-compliant by construction: Story 1.4's spec explicitly built these helpers for Story 1.5 to consume, and the frozen matrix requires only that Loads persist as separate entries whose resolved force is their vector sum — which the store and helpers satisfy and tests verify. But it leaves FR-8/FR-9's "sum, don't overwrite" invisible in the UI. Surfacing the resultant in the Load block would close the user-visible half and give the module its first consumer; Story 1.5 will consume it regardless, so decide then whether the panel should show it too.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-loads.md`
  summary: `updateLoad` is implemented and tested but has no UI path — an applied Load can only be deleted and re-entered, never edited. Either wire an edit affordance or drop the action.
  evidence: The panel's Load block applies on commit and offers only delete. Story 1.5 needs `updateLoad` for AD-3's stale-results invalidation regardless, so the action should stay; the gap is the missing edit affordance. Deferred because the fix interacts with the Apply-button change made during this story's patch pass, and the right edit model (inline per-tag editing vs. re-populating the entry fields) is a UX decision no artifact covers.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-loads.md`
  summary: Positional labels remain index-derived and now extend to control names — `N${index + 1}`, `E${index + 1}` and `Delete Load ${index + 1} on ${entityLabel}` all key off array position, so deleting an earlier entity or Load silently renames unrelated siblings, including the accessible name of a focused control.
  evidence: Third recurrence of the stable-ordinal gap first recorded for Story 1.3, now widened from display text to interactive control names — a screen-reader user can have a button's announced name change under them because an unrelated sibling was removed. Story 1.4 pulled Node labels forward to make Load microcopy coherent, which increased the surface rather than closing it. Still deferred because the fix is one decision — assign a stable ordinal at creation and store it — that should be made once for Nodes, Elements and Loads together.

## From Story 1.5 scope split — 2026-08-31

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-solve.md`
  summary: Story 1.5b — wire Solve into the app: rename `store.analysisResults` to `results` and add `showSteps` (AD-2), clear both inline at all nine mutation sites (AD-3's same-action rule), add a `solve` store action, and build the Solve button with its blocked variant plus the `aria-live` error banner above the canvas.
  evidence: Split from Story 1.5 at the step-02 token gate (spec was ~3230 tokens against a 1600 ceiling). The solver engine merges alone — nothing imports it yet — whereas this half depends on it, so the two are sequential rather than independent; the split is about dispatch size, not shippability. Story 1.5's acceptance criteria are all phrased around clicking Solve, so they are only fully satisfied once this lands: until then the solver is correct and benchmark-gated but unreachable from the UI. Carries the third deferral of AD-2's `analysisResults` → `results` rename, whose mutation-site count has now grown from one (Story 1.3) to nine as Elements and Loads landed — the retrofit gets more expensive each story it waits.

## From the diagram and Truss-load work (unstoried) — 2026-09-21

These four commits were requested directly rather than run through a story, so
they carry no spec and had no Reviewer Gate. That is itself the first entry.

- source_spec: none — `2f80760`, `236dc5e`, `5b6fc83`, `5058343`
  summary: The diagram rewrite, the Truss member-load work and the `point` Load kind shipped without a story, acceptance criteria, or a Reviewer Gate. Roughly 1,900 lines across `engine/diagramGeometry.ts`, `engine/diagrams.ts`, `engine/stiffness.ts`, `engine/validation.ts`, `utils/labelLayout.ts`, four new panel components, the canvas glyph, the store and the properties panel.
  evidence: The architecture and PRD have since been amended to describe what was built (AD-10 amended, AD-11 and AD-12 added, FR-9 and FR-12 extended), so the specs are no longer stale — but they were written *after* the code, which inverts the gate they exist to be. Fold this scope into the pending reviewer pass rather than treating `pending-review/` as covering only 1.5a–2.1.

- source_spec: none — `5058343`
  summary: The Frame diagram defect that started this work was live for three commits with a fully green suite. `ResultsArea` laid every member end to end on one horizontal strip in array order, so a portal frame rendered as a fictional 14 m beam and a symmetric frame drew antisymmetrically. Caught by the human looking at the screen.
  evidence: Second confirmed instance of the class the Reviewer Gate exists to catch, after `StiffnessMatrix` rendering raw LaTeX for several commits. Both passed every test. The replacement carries a real property test (portal-frame symmetry, `engine/diagramGeometry.test.ts`), but the other rendering tests are still the same shape that missed it — "a path exists and contains no NaN" proves a curve was drawn, not that it was drawn correctly. Worth naming as a standing weakness in how this repo tests rendering, not just as one fixed bug.

- source_spec: none — `5b6fc83`
  summary: A point Load cannot be edited after it is applied, including its station. `updateLoad` accepts a `position` patch and the store validates it, but no UI path reaches it -- the Load block still applies-and-lists with delete as the only mutation.
  evidence: Widens the Story 1.4 deferral ("`updateLoad` is implemented and tested but has no UI path") rather than being new. It bites harder here: a magnitude typed wrongly is re-entered in two fields, but a station is the field most likely to be adjusted while working a problem, and re-entering means deleting and re-applying the whole Load.

- source_spec: none — `2f80760`
  summary: Positional labels now extend to the diagram drawings. `DiagramView` prints `E1`/`E2`/`E3` on the geometry itself, so deleting an Element renumbers members in the diagram as well as in the panel, the Solve errors and the screen-reader control names.
  evidence: Fifth recurrence of the stable-ordinal gap first recorded for Story 1.3. Still one decision -- assign an ordinal at creation and store it -- made once for Nodes, Elements and Loads together. Each deferral has added a surface; this one adds the surface a student photographs for their working.

- source_spec: none — `b9bf194`
  summary: A diagram peak that does not fall on a member end is no longer labelled on the drawing at all. A simply supported beam's midspan `wL^2/8` appears only in the results table.
  evidence: Deliberate, and requested: the peak marker was removed because a peak at a member end landed exactly on that end's value label. The narrower fix -- draw the peak label only where it does *not* coincide with a member end -- was identified at the time and not taken, because the collision was the reported problem and the value is still reported in full (value and location) in the Peak values table. Revisit if a Beam's midspan peak proves to be the number students look for on the drawing.

- source_spec: none — `236dc5e`
  summary: `loadUnitLabel` distinguishes only `udl` from everything else, so the new `point` kind falls through to the force branch and reads correctly by accident rather than by decision.
  evidence: Correct today -- a point Load *is* newtons -- but it is a two-branch function now serving three kinds, and the next kind added inherits whichever branch it happens to land in. Worth making the mapping exhaustive over `LoadKind` so a new kind fails to compile rather than picking a unit silently.

## From the self-run review pass — 2026-09-22

One of the three layers was run here, by the same model that wrote the code.
That is the weakest of the three ways it could have been run and is not a
substitute for the independent pass; `pending-review/` still stands. Recorded
so nobody reads "reviewed" and assumes the gate closed.

**Fixed in this pass**, so not deferred — listed because they say where to look:

- `engine/diagrams.ts`'s shear-zero search carried a running total of passed
  point Loads across segments. Two Loads sharing one station were added twice,
  a Load at exactly `x = 0` never at all — so the analytic crossing landed in
  the wrong segment, was discarded, and the reported peak fell back to the
  nearest grid sample. Proven on a 10 m span (4.5 m reported against a true
  4.6 m) before the fix. The symptom was never a crash or a visibly wrong
  curve: the peak *value* was out by 0.03%, the *location* by a whole sample
  spacing, and only the location is what a student checks a hand calculation
  against. Both cases are now regression-tested.

**Still open:**

- source_spec: none — `engine/diagrams.ts`
  summary: `sampleElement` still takes `structureType` but no longer branches on it -- the Truss short-circuit that used to zero the bending arrays was removed by AD-12. The parameter is threaded from `structureDiagrams` through every caller and does nothing.
  evidence: Harmless today, but it is a live signal that a Truss is handled differently in here, which is exactly what AD-12 says is no longer true. Remove it, or the next reader will look for the branch.

- source_spec: none — `app/canvas/page.tsx`, `components/panels/ResultsArea.tsx`
  summary: `hasBending` is computed as "any Load targets an Element", which is a proxy for "a member bends", not the thing itself. A UDL applied along a member's own axis is pure axial and produces no bending, but still offers a BMD and an SFD -- the empty-diagram case AD-12's own consequence rule says to avoid.
  evidence: Confirmed by test: a horizontal member under a `+x` UDL reports `momentPeaks.max === null` while the shell still offers both views. The honest signal is already computed one layer down -- `structureDiagrams(...).momentPeaks` -- but the shell has no diagrams at that point. Either lift the check, or accept the proxy and say so in the comment, which currently claims more than it checks. Two duplicated expressions either way, which is its own smell.

- source_spec: none — `utils/labelLayout.ts`
  summary: A value label that cannot be placed is dropped, and unlike a peak it appears nowhere else -- the Peak values table carries the structure-wide extremes, not every member end value. So a crowded drawing can silently lose a number with no other route to it.
  evidence: Not reachable on any realistic structure -- a six-member panel point places all six (tested), and the priority ordering spends every member name before any value (tested, 0/15 names kept against 13/15 values under synthetic pressure). Recorded because the failure is silent and the module's own comment justifies the drop with "the value is in the results table either way", which is true of peaks and not of member end values.

## Resolved — 2026-08-31

- source_spec: `.github/workflows/ci.yml`
  summary: **CLOSED.** AD-9's CI gate now exists: lint, typecheck, test and build run on every push and pull request to `main` and `dev`, so the benchmark suite actually blocks merge rather than running only when someone types `npm test`.
  evidence: Recorded as deferred at Story 1.3's reviewer gate and reinforced at 1.4's, since AD-9 states the suite "runs against `engine/` in CI and gates merge -- it is not a UI-facing feature and not optional tooling", and NFR1's ≤0.1% tolerance had no enforcement mechanism without it. Node pinned to 24 to match the development environment; `npm ci` rather than `npm install` so a drifted lockfile fails rather than silently resolving. A `typecheck` script was added so the CI step and the local command are the same thing.

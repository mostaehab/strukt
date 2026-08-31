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

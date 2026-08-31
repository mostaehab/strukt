---
title: 'Story 1.3 — Assign Materials and Cross-Sections to Elements'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'f275b7363d878e1928d387ce34e2e4e774254bb8'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Elements carry no usable physical properties. `material` is non-nullable and `CanvasWorkspace.tsx:200-207` hardcodes new Elements to `"STEEL"`/`0`/`0`, so "no Material assigned" is unrepresentable. There is no Cross-Section catalog, and Elements cannot be selected on the canvas at all — only Nodes can.

**Approach:** Make Element material and section properties unassigned-by-default, add a versioned SI Cross-Section catalog under `engine/catalog/`, make Elements selectable, and give the properties panel an Element section with a Material dropdown, a catalog picker, and a manual area/inertia override.

## Boundaries & Constraints

**Always:**
- `engine/` stays framework-free (AD-1); catalog values are SI at authoring time in a versioned static module (AD-8) — never a DB table, never converted at runtime.
- `engine/types.ts` is the single source of truth (AD-2). Area/inertia live on the Element (AD-5), with a separate pointer to the catalog entry that produced them.
- Changing Material clears a *catalog* section and its derived area/inertia. Choosing a catalog section replaces a manual override outright — the two never coexist.
- A manual override is not material-specific and survives a Material change.
- Every control is keyboard-operable with the 2px/2px-offset accent focus ring; numeric engineering values use the monospace numeral token; zero corner-radius on all chrome.
- Element and Node selection are mutually exclusive; Escape clears both and collapses the panel.

**Ask First:**
- If the AISC subset must exceed the six shapes listed, or a specific edition must be cited.
- If r3f makes Element raycast-picking unreliable at hairline widths — ask rather than inflating stroke width to fix hit-testing.

**Never:**
- No `engine/constants.ts` edits — its AD-2 cleanup and concrete-modulus fix are a separate deferred spec (`deferred-work.md`, 2026-08-31). Leave that file alone even though `MATERIALS.CONCRETE.E` is visibly wrong.
- No `validateElements()`, Solve button, Solve gating, Error-banner, results invalidation, or `analysisResults`→`results` rename — Story 1.5.
- No Loads, `mz` removal, or `Load` entity — Story 1.4 (AD-10).
- No unit conversion or SI/Imperial toggle — Story 1.7. SI-only here.
- No animation on the Truss inertia show/hide.
- ~~No jsdom/RTL added.~~ **Renegotiated by the human 2026-08-31** at the step-03 Matrix Test Audit: 6 of 12 matrix rows are DOM-dependent and were uncoverable under this clause. jsdom + @testing-library/react are now permitted for component tests. `engine/` tests stay on the `node` environment (AD-1); component tests opt in per file via a `// @vitest-environment jsdom` docblock.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Select an Element | Click/tap an Element, Select tool | Highlights; panel shows `Element E1 — Properties`; selected Node deselects | N/A |
| New Element defaults | Draw an Element | `material`, `crossSectionId`, `area`, `inertia` all null | N/A |
| Assign Material | Choose Steel or Concrete | Material set; picker offers only that material's sections | N/A |
| Catalog pick | Choose a catalog section | `crossSectionId` set; area/inertia auto-filled from SI catalog | N/A |
| Material change, catalog set | Element has a catalog section | `crossSectionId`, `area`, `inertia` all cleared | N/A |
| Material change, override set | Element has a manual override | Override preserved, `crossSectionId` stays null | N/A |
| Catalog replaces override | Override set, catalog section chosen | Catalog values overwrite it; override never persists alongside the shape name | N/A |
| Non-positive override | Enter `0` or negative | Not committed to the store | Text error naming Element + field, `aria-live`, never color-only |
| Unparseable override | Empty or non-numeric text | Field returns to null, not `0` | Same field-level treatment |
| Truss hides inertia | Structure Type TRUSS | Inertia field absent from the DOM, not disabled | N/A |
| Delete selected Element | Press Delete | Element removed, selection cleared | No cascade — Elements own no children |
| Cascade kills selection | Deleting a Node removes the selected Element | Selection clears rather than pointing at a dead id | Panel collapses |

</frozen-after-approval>

## Code Map

- `engine/types.ts` -- `StructuralElement` (L17-24): `material: Material | null`, `crossSectionId: string | null`, `area: number | null`, `inertia: number | null`. Rename `crossSectionArea`→`area`. `Material` (L5) is already correct; do not redeclare.
- `engine/catalog/crossSections.ts` (new) -- `CATALOG_VERSION`, `CrossSection {id, label, material, area, inertia}`, `CROSS_SECTIONS`, `sectionsFor(material)`. Follow `engine/geometry.ts` style: type-only relative import, JSDoc citing AD-8, no throws.
- `engine/catalog/crossSections.test.ts` (new) -- follow `engine/geometry.test.ts`: explicit `vitest` imports (no globals), one `describe` + flat `it` cases.
- `store/useStructureStore.ts` -- `updateElement` (L29-34) is a blind shallow spread; the clearing rules go here so no call site bypasses them. Keep the signature. `deleteNode` (L18-25) already cascades; its selection consequence belongs to `app/page.tsx`.
- `components/canvas/ElementLine.tsx` -- props (L5-10) have no pointer handlers; elements aren't raycast-interactive today. Add select handling + selected color, as `NodeGlyph` already does.
- `components/canvas/CanvasWorkspace.tsx` -- creation defaults (L200-207) become null. Add `selectedElementId`/`onSelectElement` beside the node pair (L38-43); background click (L139-142) clears both. Mirror the highlight pattern at L273-277.
- `app/page.tsx` -- lift `selectedElementId` beside `selectedNodeId` (L14); enforce exclusivity; extend the keydown effect (L38-54) for Delete/Escape. Keep the `INPUT/TEXTAREA/SELECT` tagName guard — the new numeric inputs depend on it.
- `components/panels/PropertiesPanel.tsx` -- add an Element `<section>` + `<h2>` mirroring the Node section; module-level options const and `<label htmlFor>` + `<select id>` as at L86-101; resolve the Element by id as L38 does. Props (L9-14) gain the selected-element id.
- `components/ui/tokens.css` -- only 6 colors, 6 spacings, `--strukt-radius-none` exist; no typography tokens at all. Add numeral (monospace) + uppercase-label tokens and `--strukt-color-accent-danger` (`#B3261E`) with a dark-mode pair.
- `app/globals.css` -- panel styles at L85-132; no `input[type=number]` rule exists. Add the `.field` / `.field label` / `.field .val` pattern from `mockups/key-canvas.html:144-163`.

## Tasks & Acceptance

**Execution:**
- [x] `engine/types.ts` -- nullable `material`/`area`/`inertia`, add `crossSectionId`, rename `crossSectionArea`→`area` -- makes "unassigned" representable
- [x] `engine/catalog/crossSections.ts` -- versioned SI catalog, six AISC W-shapes + rect/circular concrete, `sectionsFor()` -- AD-8
- [x] `engine/catalog/crossSections.test.ts` -- assert SI provenance and that `sectionsFor` never mixes materials
- [x] `store/useStructureStore.ts` -- Material-change and catalog-replaces-override rules inside `updateElement`
- [x] `components/canvas/ElementLine.tsx` -- pointer/select handling and selected styling
- [x] `components/canvas/CanvasWorkspace.tsx` -- selection wiring, background-click clearing, null creation defaults
- [x] `app/page.tsx` -- lift `selectedElementId`, exclusivity, Delete/Escape, clear selection on cascade delete
- [x] `components/panels/PropertiesPanel.tsx` -- Material dropdown, catalog picker, override with field-level rejection, Truss hides inertia
- [x] `components/ui/tokens.css` + `app/globals.css` -- numeral/label/danger tokens, `.field` numeric-input styling
- [x] `engine/element.ts` + `engine/element.test.ts` -- added at the Matrix Test Audit: extract the unassigned-Element factory out of `CanvasWorkspace` so the "new Element defaults" matrix row is covered in `node`, single-sourcing the defaults
- [x] `vitest.config.mts` + `components/panels/PropertiesPanel.test.tsx` + `app/page.test.tsx` -- added after the human renegotiated the jsdom/RTL clause: jsdom + RTL component tests covering the 6 DOM-dependent matrix rows. `resolve.tsconfigPaths: true` supersedes the `vite-tsconfig-paths` plugin the Next.js guide recommends (Vite now resolves the `@/*` alias natively)

**Acceptance Criteria:**
- Given a newly drawn Element, when I inspect the store, then `material`, `crossSectionId`, `area`, and `inertia` are all null
- Given a Concrete Element, when I open the Cross-Section picker, then no AISC W-shape is offered
- Given any Element, when I tab through its properties, then every control shows a visible focus ring in reading order
- Given a selected Node, when I select an Element, then the Node deselects and the panel shows only Element properties
- Given `npm test`, when it runs, then the catalog suite passes alongside the existing `geometry` suite

## Design Notes

**Catalog provenance.** Store SI values as literals with the imperial source in a comment, and let the test assert the derivation so numbers can't silently rot. Concrete is exactly derivable (`A = b·h`, `I = b·h³/12`; circular `A = πd²/4`, `I = πd⁴/64`) — assert to full precision. AISC shapes convert with `1 in² = 6.4516e-4 m²` and `1 in⁴ = 4.162314e-7 m⁴` — assert within a small relative tolerance. Six shapes (W12X26, W14X30, W16X40, W18X50, W21X62, W24X76) is a deliberate starter set; `epics.md:75` defers catalog sourcing depth.

**Catalog vs override.** `crossSectionId != null` means area/inertia came from the catalog; null with non-null area/inertia means a manual override. `EXPERIENCE.md` specifies this behaviorally only — no mode-switch component (tabs/radio/segmented) is specified anywhere, so don't invent one.

**Field-level error wording** (approved 2026-08-31, use verbatim; `DESIGN.md` has no Component Pattern for either control — documented gap, `reconcile-prd.md` "Gap A"):

- `Element E1 needs a positive area. Enter a value greater than zero.` (same shape for inertia)

Story 1.5's Solve gate prefixes `Can't solve: ` to this body, matching `mockups/key-canvas.html:356`. The prefix stays out of the field-level message deliberately — nothing is being solved when a field rejects a value. Unassigned dropdown wording reuses the mockup's `(none assigned)` convention.

**Panel order.** No Element grouping spec exists; mirror the Node panel's rendered order: Material → Cross-Section → area → inertia.

## Verification

**Commands:**
- `npm run lint` -- expect no new errors
- `npx tsc --noEmit` -- expect no new type errors. The `crossSectionArea`→`area` rename and nullable fields surface every stale reference; resolve them, never cast them away
- `npm test` -- expect the catalog suite to pass alongside `geometry`

**Manual checks (if no CLI):**
- Draw a Frame, select an Element, assign Steel, pick `W12X26`, confirm area/inertia auto-fill in monospace; type a manual area, confirm `W14X30` replaces it; switch to Concrete, confirm the W-shape clears but a manual override survives.
- On a Truss, confirm no inertia field is in the DOM (inspect, don't just look).
- Select a Node then an Element (Node deselects); Escape collapses the panel; deleting a selected Element's end Node collapses it rather than referencing a dead id.
- Repeat the picker/override flow with touch emulation and keyboard-only.

## Suggested Review Order

**Invariant chokepoint — start here**

- Every Material/Cross-Section rule lives in one pure function; no call site can bypass it
  [`useStructureStore.ts:54`](../../store/useStructureStore.ts#L54)

- Treats a section whose Material differs from the Element's as no section at all
  [`useStructureStore.ts:24`](../../store/useStructureStore.ts#L24)

- Unconditional post-check on the resulting pair, so a combined patch can't skip clearing
  [`useStructureStore.ts:96`](../../store/useStructureStore.ts#L96)

- Positivity enforced at the store, not just the field — Epic 3 will load Elements from JSONB
  [`useStructureStore.ts:15`](../../store/useStructureStore.ts#L15)

**Cross-Section catalog (AD-8)**

- Static versioned module, SI at authoring time, Imperial source in a comment per entry
  [`crossSections.ts:45`](../../engine/catalog/crossSections.ts#L45)

- Both conversion factors stated as exact powers of 0.0254, not rounded
  [`crossSections.ts:13`](../../engine/catalog/crossSections.ts#L13)

- Material-filtered lookup — this is what keeps a W-shape out of a Concrete picker
  [`crossSections.ts:145`](../../engine/catalog/crossSections.ts#L145)

**Element data model**

- Nullable Material/area/inertia plus a catalog pointer: "unassigned" becomes representable
  [`types.ts:17`](../../engine/types.ts#L17)

- Single-sources the all-null defaults so no call site invents its own
  [`element.ts:14`](../../engine/element.ts#L14)

**Numeric input semantics**

- Commits on blur and Enter, so a half-typed `1e-3` never reaches the store as `1`
  [`PropertiesPanel.tsx:102`](../../components/panels/PropertiesPanel.tsx#L102)

- Approved rejection wording, used verbatim for both area and inertia
  [`PropertiesPanel.tsx:86`](../../components/panels/PropertiesPanel.tsx#L86)

**Canvas pick target and selection**

- Proxy geometry extracted as pure arithmetic so midpoint/rotation/length are testable
  [`pickProxy.ts:30`](../../components/canvas/pickProxy.ts#L30)

- Shared z constants: Elements sit behind Node glyphs, so shared endpoints resolve to the Node
  [`pickProxy.ts:16`](../../components/canvas/pickProxy.ts#L16)

- Invisible pick plane widens hit-testing without thickening the hairline stroke
  [`ElementLine.tsx:56`](../../components/canvas/ElementLine.tsx#L56)

- Handler passed only under the SELECT tool, so Element-tool clicks can't hijack the draw flow
  [`CanvasWorkspace.tsx:272`](../../components/canvas/CanvasWorkspace.tsx#L272)

- Background click clears both selections rather than leaving a stale highlight
  [`CanvasWorkspace.tsx:151`](../../components/canvas/CanvasWorkspace.tsx#L151)

**Selection shell**

- Escape handled before the form-control guard — one key, one behavior regardless of focus
  [`page.tsx:100`](../../app/page.tsx#L100)

- Symmetric stale-selection reconcile; a dangling Node id no longer shadows Element deletes
  [`page.tsx:49`](../../app/page.tsx#L49)

- Primitive selector for the existence check, so node drags don't re-render the shell
  [`page.tsx:23`](../../app/page.tsx#L23)

**Panel UI**

- Element identity line mirrors the mockup's `Node N2 — Properties` header format
  [`PropertiesPanel.tsx:269`](../../components/panels/PropertiesPanel.tsx#L269)

- Truss omits inertia from the DOM entirely rather than showing a dead input
  [`PropertiesPanel.tsx:341`](../../components/panels/PropertiesPanel.tsx#L341)

- `Record<Material, string>` makes a future third Material a compile error, not a silent omission
  [`PropertiesPanel.tsx:28`](../../components/panels/PropertiesPanel.tsx#L28)

**Styling and tokens**

- Typography and danger tokens taken from the DESIGN.md spine, not the mockup's drifted values
  [`tokens.css:19`](../../components/ui/tokens.css#L19)

- Error line reserves height so the inertia field below doesn't jump on rejection
  [`globals.css:164`](../../app/globals.css#L164)

- Site-wide 2px/2px-offset accent focus ring, which did not exist before this story
  [`globals.css:186`](../../app/globals.css#L186)

**Peripherals**

- Store invariants incl. Steel-on-Concrete rejection and catalog-derived sibling retention
  [`useStructureStore.test.ts:1`](../../store/useStructureStore.test.ts#L1)

- Field behavior: per-keystroke silence, scientific notation, rejection, rendered auto-fill values
  [`PropertiesPanel.test.tsx:1`](../../components/panels/PropertiesPanel.test.tsx#L1)

- Canvas wiring: SELECT gate, accent highlight, hitWidth passthrough, background clear
  [`CanvasWorkspace.test.tsx:1`](../../components/canvas/CanvasWorkspace.test.tsx#L1)

- Proxy geometry incl. a 1:2 slope case distinguishing `atan2(dy,dx)` from `atan2(dx,dy)`
  [`pickProxy.test.ts:1`](../../components/canvas/pickProxy.test.ts#L1)

- Shell selection, Escape-from-field, delete paths, cascade reconcile
  [`page.test.tsx:1`](../../app/page.test.tsx#L1)

- Catalog SI provenance derived independently from the definition of the inch
  [`crossSections.test.ts:1`](../../engine/catalog/crossSections.test.ts#L1)

- `node` stays the default environment; component tests opt in per file via docblock
  [`vitest.config.mts:1`](../../vitest.config.mts#L1)

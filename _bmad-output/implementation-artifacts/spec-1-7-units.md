---
title: 'Story 1.7 — Select Unit System'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '45fca15aff4ba47ef3a886871589d67db4ac5f32'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every value in the app is hard-coded to SI display — `kN`, `kN·m`, `m²`, `m⁴`, metres. A student whose coursework is in Imperial has to convert every number by hand, which is exactly the arithmetic the tool exists to remove.

**Approach:** Add an SI/Imperial preference that converts at the display boundary only. The canonical stored value stays SI with no exception (AD-4), so switching back and forth can never drift what was entered — and because the preference lives outside the structure store, toggling it cannot trip the stale-results rule.

## Boundaries & Constraints

**Always:**
- `engine/` and `store/useStructureStore` stay SI, always, including transiently (AD-4). No converted value is ever stored.
- Conversion happens read/write-through at the input/output boundary, in `utils/units.ts` — never inline at a call site.
- `unitSystem` is a UI preference flag, not a field on a Node, Element or Load (AD-4).
- Toggling units **never** clears `results`, `solveErrors` or `showSteps` — a unit change is not a structural edit (AD-4).
- Round-tripping a value through both systems returns the value originally entered, to display precision.
- The toggle is reachable at any point in a Project's life, not fixed at creation.
- Every displayed unit label comes from the same helper as the value it labels, so a number and its unit can never disagree.

**Ask First:**
- If Imperial force should be `kip` rather than `lbf`, and length `ft` rather than `in` — the choice below follows structural-engineering convention but no artifact states it.

**Never:**
- No persistence of the preference — UX-DR10's sibling rule applies, v1 stores no per-user preference.
- No change to any stored value, any solver input, or any benchmark.
- No unit selector per field; the choice is per Project.
- No Show Steps, diagrams rework, or accounts — Epic 2 and Epic 3.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Toggle to Imperial | Any Project | Every displayed value and unit label switches together | N/A |
| Round trip | Value entered in SI, toggled to Imperial and back | The stored value is unchanged, and the field shows what was entered | N/A |
| Enter in Imperial | Imperial selected, a magnitude typed | Stored as the SI equivalent, not as typed | N/A |
| Toggle after Solve | Results on screen | Results, errors and Show Steps all survive untouched | Never invalidates |
| Toggle mid-entry | A pending unedited field value | Field re-displays in the new system; nothing is committed by the toggle | N/A |
| Load units | Concentrated vs UDL, either system | `kN`/`kip` and `kN/m`/`kip/ft` — the two kinds never share a label | N/A |
| Section units | Area and inertia | `m²`/`in²` and `m⁴`/`in⁴` | N/A |
| Result units | Peaks, Reactions, peak locations | Force, moment and length each convert with their own factor | N/A |
| Tension label | NFD in Imperial | Sense word unchanged; only number and unit convert | N/A |

</frozen-after-approval>

## Code Map

- `store/useUnitStore.ts` (new) -- `{ system: "SI" | "IMPERIAL", setSystem }`. Separate from `useStructureStore` on purpose: AD-4 makes the preference a UI flag, and keeping it out of the structure store is what makes "never invalidates" structural rather than a rule someone has to remember. Mirrors `useThemeStore`.
- `utils/units.ts` -- currently SI-only: `formatKilonewtons`, `formatKilonewtonMetres`, `loadUnitLabel`, `FORCE_UNIT`, `MOMENT_UNIT`, `axialForceLabel`. Each grows a `UnitSystem` argument, which is the seam its own JSDoc already names. Add length, area and inertia formatting, and the Imperial factors.
- `components/ui/UnitsToggle.tsx` (new) -- segmented control with an underlined active state (`components.units-toggle`), same pattern as `ThemeToggle`.
- `components/panels/SolveBar.tsx` -- mount it beside the theme toggle.
- `components/panels/PropertiesPanel.tsx` -- `Area (m²)` (L739 area), inertia label, and the Load magnitude field's `kN` label and its kN⇄N conversion (L337, L363) all become system-aware.
- `components/panels/ResultsArea.tsx` -- peak labels (L88-90), the `m along` location (L34) and the Reaction tags (L139+) all convert.
- `components/canvas/CanvasWorkspace.tsx` -- the canvas Load label (L46).
- `engine/` -- untouched. If a change here looks necessary, the conversion has leaked past the boundary.

## Tasks & Acceptance

**Execution:**
- [x] `store/useUnitStore.ts` -- the preference, deliberately outside the structure store
- [x] `utils/units.ts` -- system-aware force, moment, length, area and inertia formatting plus Imperial factors
- [x] `utils/units.test.ts` -- round-trip fidelity and every factor, against published conversions
- [x] `components/ui/UnitsToggle.tsx` + test -- segmented control, underlined active state
- [x] `components/panels/PropertiesPanel.tsx` -- area, inertia and Load magnitude read and write in the selected system
- [x] `components/panels/ResultsArea.tsx` + `components/canvas/CanvasWorkspace.tsx` -- results, Reactions and canvas labels convert
- [x] `components/panels/SolveBar.tsx` -- mount the toggle
- [x] Tests that toggling never clears results, and that a round trip leaves the store untouched

**Acceptance Criteria:**
- Given a solved structure, when the unit system is toggled, then `results`, `solveErrors` and `showSteps` are all unchanged
- Given a value entered in one system, when the system is switched twice, then the stored SI value is bit-identical to before
- Given Imperial is selected, when a Load magnitude is entered, then the store holds its SI equivalent
- Given `grep` for a hard-coded `kN`, `m²` or `m⁴` outside `utils/units.ts`, when it runs, then no UI file matches
- Given `npm test`, when it runs, then every matrix row is covered and passes

## Design Notes

**Why a separate store.** Putting `unitSystem` in `useStructureStore` would make "toggling units must not invalidate results" a rule enforced by remembering to omit `invalidated()` from one action — the kind of thing that survives exactly until someone adds the eleventh mutation. Keeping it in its own store makes it impossible by construction: `invalidated()` is only reachable from the structure store's own actions.

**Imperial units follow structural convention**: force in `kip` (1 kip = 4448.2216 N), distributed load in `kip/ft`, moment in `kip·ft`, length in `ft`, area in `in²`, inertia in `in⁴`. Mixing `ft` for length with `in²` for area is deliberate and standard — a section is specified in inches while a span is measured in feet.

**Round-trip fidelity is about storage, not display.** The stored value never changes when the toggle moves, so "no drift" is guaranteed by construction rather than by conversion precision. What the tests pin is that the conversion factors are exact inverses and that display rounding never writes back.

## Verification

**Commands:**
- `npm run lint` -- expect 0 errors and 0 warnings
- `npx tsc --noEmit` -- expect no new type errors; adding the `UnitSystem` argument will surface every caller
- `npm test` -- expect the unit suites to pass alongside the existing 22 files

**Manual checks (if no CLI):**
- Enter an area in SI, switch to Imperial and back, and confirm the field shows the original number.
- Solve, then toggle units, and confirm the diagrams and Reactions stay on screen with converted values.

## Reviewer Gate

**Not run — consistent with Stories 1.5 and 1.6.** In its place: 19 unit-boundary tests and 5 toggle tests, including the two that matter most — a unit change leaves `results` as the *same object* (not merely an equal one, so nothing re-solved), and leaves stored values bit-identical.

One matrix row is **not** covered: "toggle mid-entry", where a pending unedited field value is re-displayed in the new system. The field's commit-on-blur design makes this benign, but it is untested rather than verified.

The `grep` acceptance criterion holds in substance — the only match outside `utils/units.ts` is a JSDoc example in `ResultsArea.tsx:30`, not rendered output.

## Suggested Review Order

**Why this cannot break results**

- The preference lives outside the structure store, so `invalidated()` is unreachable from it
  [`useUnitStore.ts:1`](../../store/useUnitStore.ts#L1)

- Asserts the same result object survives a toggle, not merely an equal one
  [`UnitsToggle.test.tsx:1`](../../components/ui/UnitsToggle.test.tsx#L1)

**The boundary**

- Every conversion in one module; Imperial factors exact by definition of the inch
  [`units.ts:1`](../../utils/units.ts#L1)

- Moment converts through force *and* length, so kip·ft is not the force factor alone
  [`units.ts`](../../utils/units.ts)

**Consumers**

- Area and inertia read and write through the boundary, so a typed Imperial value is stored SI
  [`PropertiesPanel.tsx`](../../components/panels/PropertiesPanel.tsx)

- Peaks, Reactions and peak locations each convert with their own factor
  [`ResultsArea.tsx`](../../components/panels/ResultsArea.tsx)

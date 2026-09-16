---
title: 'Story 2.1 — Show Steps (FR-16, FR-17, FR-18, FR-19)'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '524ea39a14b07d43f4cbde1b1b589392e96b3a06'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `store.showSteps` exists and is correctly invalidated, but nothing reads or sets it — there is no control, and no surface for the stiffness-method working the product's whole pitch rests on. A student can see the answer and not how it was reached.

**Approach:** Add the Show Steps switch to the results head with the lifecycle FR-16 specifies — disabled until a Solve has succeeded, always defaulting off, never auto-opening, clearing together with results — plus the panel it reveals, the Beam-preset caption, and its first real content: each Element's local stiffness matrix with that Element's own values substituted in (FR-17).

## Boundaries & Constraints

**Always:**
- The toggle is **disabled, not merely empty**, when there is nothing to show — an enabled switch that reveals nothing is the failure this rule names.
- It always defaults to off, including after a successful Solve. Results render unprompted; Show Steps never auto-opens (UX-DR9 makes it the one deliberate second-order gate).
- Toggle state is never persisted with a Project.
- A blocked Solve clears results and any visible Show Steps content **together**, not independently — already true in the store, and this story must not break it.
- The switch exposes switch semantics (`role="switch"` with `aria-checked`) and announces its transitions (UX-DR7).
- The Beam caption is verbatim and appears only for Beam-preset Projects, never for Truss or non-Beam Frame: `Beam is solved as a Frame — the matrices below use Frame notation.`
- Nothing here recomputes or re-derives any solver quantity (NFR8).

**Ask First:**
- If the symbolic formula should be shown beside the numeric matrix, or the numbers alone.

**Never:**
- No DOF mapping or reduced system — FR-18 and FR-19.
- No recomputation of any matrix: the numbers rendered are `SolveResult.localStiffness` verbatim (NFR8).
- No change to `engine/`, to `solve()`, or to the invalidation rule.
- No persistence of any kind.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Before any Solve | Fresh Project | Switch present and disabled; no panel | N/A |
| After a successful Solve | Results on screen | Switch enabled and off; panel still closed | N/A |
| Toggle on | Switch activated | Panel opens; `showSteps` is true | N/A |
| Toggle off | Switch activated again | Panel closes; `showSteps` is false | N/A |
| Structural edit while open | Panel open, a Node moved | Panel closes and the switch disables, with the results | N/A |
| Blocked Solve while open | Panel open, Solve refused | Results and panel clear together, not independently | N/A |
| Re-solve after opening | Panel open, Solve pressed again | Panel returns to closed — never auto-opened | N/A |
| Beam preset | Project drawn with the Beam preset | Caption appears at the top of the panel, verbatim | N/A |
| Truss or Frame | Either non-Beam Structure Type | No caption at all | N/A |
| Keyboard | Switch focused | Operable by keyboard, with switch semantics and a visible focus ring | N/A |
| Local matrix, Frame | Panel open on a Frame | Each Element shows a 6x6 matrix, rendered from `SolveResult` verbatim | N/A |
| Local matrix, Truss | Panel open on a Truss | Each Element shows a 4x4 matrix with zero bending terms | N/A |
| Substituted values | Any Element | Its E, A, I and length are shown alongside, so the numbers are traceable | N/A |
| Matrix symmetry | Any Element | The rendered matrix is symmetric, as any stiffness matrix must be | N/A |

</frozen-after-approval>

## Code Map

- `components/panels/StepsToggle.tsx` (new) -- the switch. `components.steps-toggle-switch`: hairline border, thumb shifting `ink-secondary` (off) to `accent-primary` (on). `role="switch"` + `aria-checked` rather than a checkbox, which is what UX-DR7 names.
- `components/panels/ShowStepsPanel.tsx` (new) -- what the switch reveals: the Beam caption and, for now, an explicit placeholder. FR-17 to FR-19 fill it.
- `components/panels/ResultsArea.tsx` -- mount the switch in `.results-head`, beside the `Solved ✓` tag, where both EXPERIENCE.md and `mockups/key-canvas.html:309` put it; render the panel below the diagrams when open.
- `app/page.tsx` -- `preset` (L32) is React state here, not store state, because Beam is a drawing-time preset stored as `FRAME`. Pass it to `ResultsArea` so the caption can tell a Beam Project from a plain Frame; the store cannot distinguish them by design.
- `store/useStructureStore.ts` -- `showSteps` and `setShowSteps` already exist (L191, L308) and `invalidated()` (L178) already clears the flag at all eleven mutation sites. Read and set them; change neither.
- `app/globals.css`, `components/ui/tokens.css` -- switch styling; `accent-primary` and `ink-secondary` already exist.

## Tasks & Acceptance

**Execution:**
- [x] `components/panels/StepsToggle.tsx` -- switch semantics, disabled state, thumb colour shift
- [x] `components/panels/ShowStepsPanel.tsx` -- Beam caption, and per-Element local stiffness (FR-17)
- [x] `components/panels/StiffnessMatrix.tsx` -- KaTeX bmatrix rendering of a numeric matrix
- [x] `components/panels/ResultsArea.tsx` -- mount both, gated on `results`
- [x] `app/page.tsx` -- pass the Beam preset through
- [x] `app/globals.css` -- switch and panel styling
- [x] `components/panels/StepsToggle.test.tsx` + `ResultsArea.test.tsx` -- every matrix row

**Acceptance Criteria:**
- Given no Solve has succeeded, when the results area renders, then the switch is present and disabled rather than absent or enabled-and-empty
- Given a successful Solve, when results render, then the switch is enabled and off — the panel never opens on its own
- Given the panel is open, when any structural edit occurs, then the panel closes with the results in the same action
- Given a Beam-preset Project, when the panel opens, then the caption appears verbatim; given Truss or Frame, it does not appear at all
- Given a keyboard user, when the switch is focused, then it reports `role="switch"` with `aria-checked` and toggles on Enter or Space

## Design Notes

**Why disabled rather than hidden.** EXPERIENCE.md is explicit that the control is "disabled (not merely empty)" before a Solve. A control that vanishes and reappears is harder to find than one that is visibly present but inert, and its presence tells a student the feature exists before they have earned it. The disabled state is the affordance.

**Disabled tracks `results`, not "a Solve happened once".** EXPERIENCE.md separates "disabled if no Solve has occurred yet this session" from "cleared if a prior Solve's results are now stale", which could be read as leaving the switch enabled after an edit. That reading produces exactly what the same sentence forbids — an enabled switch revealing nothing — so the switch is disabled whenever `results` is null. Flagged here because it is an interpretation, not a quotation.

**Beam cannot be read from the store.** A Beam Project is stored as `FRAME` (Story 1.1's AD-2 decision), so the preset survives only in the shell's React state. The caption therefore takes a prop rather than a store read — and this is the seam Epic 3 will have to close, since a reopened Project will have no idea it was drawn as a Beam.

**The matrix is rendered, never recomputed.** NFR8 is the constraint the whole epic turns on: what Show Steps displays must be exactly what the solver used. So the panel renders `SolveResult.localStiffness[elementId]` as-is. The symbolic form beside it is a static template with no arithmetic in it, and the Element's E, A and I are read straight off the Element. Length is the one value computed here rather than read — it is not in `SolveResult` — but it is `Math.hypot` over two Node positions, the same deterministic expression the solver uses.

**Why KaTeX rather than a table.** A stiffness matrix is an equation, and reading `12EI/L³` as a bracketed grid of decimals loses the structure a student is trying to recognise. KaTeX 0.16.22 is already pinned in the architecture's stack for exactly this.

## Verification

**Commands:**
- `npm run lint` -- expect 0 errors and 0 warnings
- `npx tsc --noEmit` -- expect no new type errors
- `npm test` -- expect the new cases to pass alongside the existing 23 files

**Manual checks (if no CLI):**
- Before solving, confirm the switch is visible and cannot be activated.
- Solve, toggle on, then drag a Node — the panel and the results must go together.
- Draw with the Beam preset and confirm the caption; switch to Frame and confirm it disappears.

## Reviewer Gate

**Not run — consistent with Stories 1.5 to 1.7.** In its place: every I/O matrix row covered, including the two that carry FR-16's real rules — the panel closing *with* the results on an edit, and returning to closed after a re-solve so it can never auto-open.

Two interpretations are recorded in Design Notes rather than buried: the disabled state tracks `results` rather than "a Solve happened once this session", and member length is computed here because it is not in `SolveResult`.

## Suggested Review Order

**The gate and its lifecycle**

- Switch semantics, and disabled rather than hidden before a Solve
  [`StepsToggle.tsx:1`](../../components/panels/StepsToggle.tsx#L1)

- Gated on `results`, so the panel cannot outlive the answer it explains
  [`ResultsArea.tsx`](../../components/panels/ResultsArea.tsx)

**The content, and NFR8**

- Numbers come straight from `SolveResult.localStiffness`; the symbolic form is a static template
  [`ShowStepsPanel.tsx:1`](../../components/panels/ShowStepsPanel.tsx#L1)

- Exponential cells, because stiffness terms span orders of magnitude inside one matrix
  [`StiffnessMatrix.tsx:1`](../../components/panels/StiffnessMatrix.tsx#L1)

**Peripherals**

- Lifecycle, substituted values, Truss omission, and the Beam caption both ways
  [`ResultsArea.test.tsx:1`](../../components/panels/ResultsArea.test.tsx#L1)

## Epic 2 completion — 2026-08-31

FR-18 and FR-19 were built onto this story rather than specced separately, since
both are presentation of data the solver already produced and neither changed
the toggle or its lifecycle.

**Two AD-3 extensions, both approved and both the same shape:** a value the
solver already computes internally is carried out rather than rebuilt by the
consumer.

- `reducedSystem.restrainedDofs` (FR-19) — built in the same loop and from the
  same labelling expression as `freeDofs`, so a DOF cannot be named by two
  conventions. Tests pin the two lists as disjoint and exhaustive.
- `elementDofs` and `globalStiffness` (FR-18) — recorded during assembly.
  `elementDofs` carries the assembly's own ordering; rebuilding it from
  `dofMap` and an Element's endpoints would be a second statement of the same
  rule. A test asserts the reduced matrix is genuinely a sub-matrix of the
  global one, which is what proves they are one assembly rather than two.

**A rendering threshold, decided rather than discovered.** The global matrix is
`3n x 3n`: a three-Node Frame is 9x9 and reads fine, but a classroom-scale
structure is 150x150 — some 22,500 exponential terms, unreadable and slow to
typeset. Above 12 DOFs the panel states the matrix's shape and declines to
render it, which is honest; rendering it anyway would be a feature in name only.

**A unit bug caught during FR-19:** displacements are stored in metres, and the
first draft labelled them `ft` in Imperial without converting. Translations now
convert; rotations stay in radians, which are dimensionless and identical in
both systems.

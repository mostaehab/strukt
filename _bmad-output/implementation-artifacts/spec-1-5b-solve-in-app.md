---
title: 'Story 1.5b — Solve in the App'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '300beca54350d3bf13515426f514233730fe2911'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.5a's solver is correct and benchmark-gated but unreachable. Nothing calls `solve()`, the store still carries the pre-AD-3 `analysisResults` field that no longer matches anything the engine produces, and a student has no way to run an analysis or learn why one was refused.

**Approach:** Give the store the AD-2 result fields and a `solve` action, clear those fields inline at every mutation so a stale answer can never survive an edit (AD-3), and put a Solve control above the canvas with the error banner that explains a blocked attempt.

## Boundaries & Constraints

**Always:**
- `store.results` holds a `SolveResult | null` and `store.showSteps` a boolean, replacing `analysisResults` (AD-2).
- Every mutation of Nodes, Elements, Supports, Loads, Materials or Cross-Sections clears `results`, `solveErrors` and `showSteps` **in the same action** (AD-3) — never in a `useEffect`, never after the fact.
- A blocked Solve clears results and `showSteps` too, so no stale answer outlives a refusal (FR-16).
- The Solve button is never disabled-and-silent: it stays operable and reports why it could not solve.
- The error banner sits above the canvas and below the toolbar, in the same place every time, and announces itself via `aria-live`.
- Errors are communicated as text, never by colour alone.
- `solve()` is called exactly once per Solve; nothing recomputes any part of its result.

**Ask First:**
- If the Solve button should reflect solvability continuously rather than after an attempt — see Design Notes for why it does not.

**Never:**
- No Show Steps UI — Epic 2 owns that; this story only adds the `showSteps` field AD-2 requires and keeps it correctly invalidated.
- No diagrams, no Reaction rendering — Story 1.6. Solve stores the numbers; drawing them is not this story.
- No unit toggle — Story 1.7. A unit change must never trigger the stale-results rule (AD-4), which is that story's problem to honour.
- No changes to `engine/` beyond deleting the superseded result types.
- No persistence of `SolveResult`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Solve a valid structure | Complete, stable structure | `results` populated from one `solve()` call; no errors shown | N/A |
| Solve a blocked structure | Missing Material, unstable, or empty | `results` stays null; every error listed in the banner | Text, `aria-live`, never colour alone |
| Edit after a successful Solve | Any of the nine mutations with results present | `results`, `solveErrors` and `showSteps` all cleared by that same action | N/A |
| Edit after a blocked Solve | Any mutation with errors showing | Banner clears too — the old complaint may no longer be true | N/A |
| Solve twice unchanged | Solve, then Solve again | Second result replaces the first; no accumulation of errors | N/A |
| Blocked after success | Solve successfully, break the structure, Solve again | Previous results gone, not left beside the new error | N/A |
| Button state | After a blocked attempt | Label reads `Solve — blocked`; button stays operable | Never silently disabled |
| Keyboard only | Tab to the Solve control and activate it | Solves, with a visible focus ring | N/A |
| `clearAll` | Canvas cleared | Results, errors and `showSteps` all reset | N/A |

</frozen-after-approval>

## Code Map

- `engine/types.ts` -- `StructureState` (L~141): replace `analysisResults?: AnalysisResults` with `results: SolveResult | null`, `solveErrors: SolveError[]`, `showSteps: boolean`; replace `setAnalysisResults` with `solve: () => void` and `setShowSteps: (value: boolean) => void`. Delete `AnalysisResults`, `NodeResult` and `ElementResult` (L114-137), now superseded and unreferenced — 1.5a marked them deprecated but left them because the store still pointed at them.
- `store/useStructureStore.ts` -- nine mutations need inline invalidation: `addNode` (L174), `updateNode` (L175), `deleteNode` (L181), `addElement` (L199), `updateElement` (L202), `deleteElement` (L208), `addLoad` (L220), `updateLoad` (L238), `deleteLoad` (L247). `addLoad`/`updateLoad` return booleans and must not invalidate on a rejected write — nothing changed, so nothing is stale. `setStructureType` (L251) only succeeds on an empty Project, so it cannot have results to clear, but resets them for symmetry. `setAnalysisResults` (L263) becomes `solve`, which reads state via `get()` and calls the engine. `clearAll` (L264) resets the three new fields.
- `components/panels/SolveBar.tsx` (new) -- the Solve button, its blocked label, and the error banner. One `aria-live` region; each error rendered as its own line so a student fixing three Elements sees three.
- `app/page.tsx` -- mount `SolveBar` between `<Toolbar>` and `.workspace-body`, which is exactly "above the canvas, below the topbar".
- `app/globals.css` -- `.solve-bar` and `.error-banner`. `components.error-banner` specifies `#FCEBEA` fill with `accent-danger` text and border, zero radius, monospace; `--strukt-color-accent-danger` already exists from Story 1.3 and the numeral token from 1.4.
- `store/useStructureStore.test.ts` -- existing suite covers the mutations; extend rather than replace.

## Tasks & Acceptance

**Execution:**
- [x] `engine/types.ts` -- new `StructureState` result fields and actions; delete the three superseded result types
- [x] `store/useStructureStore.ts` -- `solve` action, `setShowSteps`, and inline invalidation at all nine mutation sites (plus `setStructureType` and `clearAll` for symmetry, eleven call sites in all)
- [x] `store/useStructureStore.test.ts` -- a case per mutation proving it invalidates, plus both rejected-write exceptions
- [x] `components/panels/SolveBar.tsx` -- Solve button, blocked label, `aria-live` error banner
- [x] `components/panels/SolveBar.test.tsx` -- success, blocked, multi-error, and keyboard operation
- [x] `app/page.tsx` + `app/globals.css` + `components/ui/tokens.css` -- mount the bar, add the `error-banner-fill` token with its dark pair, and style per `components.error-banner`

**Acceptance Criteria:**
- Given a successful Solve, when any of the nine mutations runs, then `results` and `showSteps` are both cleared by that same action, with no effect involved
- Given a rejected `addLoad`, when it returns false, then existing results are untouched — nothing changed, so nothing is stale
- Given a blocked Solve, when the banner renders, then every error appears as text inside one `aria-live` region
- Given a keyboard user, when they reach the Solve control, then it is operable and shows a visible focus ring
- Given `npm test`, when it runs, then the invalidation cases and the banner cases pass alongside the existing 17 files

## Design Notes

**Why the button reports blocked *after* an attempt, not before.** Continuously evaluating solvability would mean running validation on every keystroke and showing `Solve — blocked` over an empty canvas a student has not begun drawing on — which reads as broken rather than helpful. So the control says `Solve` until an attempt is refused, then reports the refusal and keeps the banner until the next edit clears it. `EXPERIENCE.md`'s requirement is that the button is never *disabled-and-silent*, which this satisfies: it stays operable, and pressing it always produces an explanation.

**Invalidation belongs in the action, not around it.** AD-3 is explicit that the stale-results rule is enforced at the mutation site. A `useEffect` watching the structure would repaint one frame with a stale answer before clearing it, which is exactly the trust-breaking drift the rule exists to prevent. Every mutation already funnels through `set`, so each adds the same three fields to what it returns.

**Rejected writes are not edits.** `addLoad` and `updateLoad` return false when the store refuses a value. Invalidating there would throw away a valid result because a student typed a bad number and got rejected — the structure never changed, so the result is still true of it.

## Verification

**Commands:**
- `npm run lint` -- expect 0 errors and 0 warnings, as of `300beca`
- `npx tsc --noEmit` -- expect no new type errors. Deleting `AnalysisResults` will surface any stale reference
- `npm test` -- expect the new cases to pass alongside the existing 17 files

**Manual checks (if no CLI):**
- Build a valid beam, Solve, then drag a Node — results must vanish on the drag, not on the next render.
- Break the structure and Solve; confirm the banner names the problem and the button reads `Solve — blocked`.
- Reach Solve by keyboard alone and activate it.

## Reviewer Gate

**Not run — consistent with Story 1.5a's decision on 2026-08-31.** In its place: 9/9 I/O matrix rows covered, a dedicated invalidation case for each of the nine mutation sites, and both rejected-write exceptions asserted.

Three test bugs of mine surfaced and were fixed during the pass — a `toBeDisabled()` matcher from `@testing-library/jest-dom`, which this project has never installed, and two store mutations performed outside `act()` so React never re-rendered. All three were faults in the tests, not the component.

Unexamined, as in 1.5a: cross-story interactions and false-coverage gaps. Worth noting the surface this story adds is small and heavily asserted, but the invalidation rule now has eleven call sites and only a reviewer reading them together would catch one that spreads the wrong thing.

## Suggested Review Order

**The rule this story exists to enforce**

- One statement of what a structural edit resets, spread into each mutation rather than restated nine times
  [`useStructureStore.ts:176`](../../store/useStructureStore.ts#L176)

- Invalidation lives inside the action, so no frame ever paints a stale answer
  [`useStructureStore.ts:193`](../../store/useStructureStore.ts#L193)

- A refusal clears the previous result and closes Show Steps with it (FR-16)
  [`useStructureStore.ts:296`](../../store/useStructureStore.ts#L296)

**The store contract**

- `results` is null or a whole `SolveResult`; there is no partial state between them
  [`types.ts:229`](../../engine/types.ts#L229)

- `showSteps` lives here now so AD-3's rule can clear it, though Epic 2 renders it
  [`types.ts:237`](../../engine/types.ts#L237)

**The control**

- Blocked is a state the button reports, not a disabled attribute that silences it
  [`SolveBar.tsx:29`](../../components/panels/SolveBar.tsx#L29)

- The live region is in the DOM before it has anything to say, or it is not announced
  [`SolveBar.tsx:42`](../../components/panels/SolveBar.tsx#L42)

**Peripherals**

- One case per mutation site, plus the two rejected-write exceptions
  [`useStructureStore.test.ts:1`](../../store/useStructureStore.test.ts#L1)

- Banner content, blocked labelling, empty-canvas wording, and keyboard operation
  [`SolveBar.test.tsx:1`](../../components/panels/SolveBar.test.tsx#L1)

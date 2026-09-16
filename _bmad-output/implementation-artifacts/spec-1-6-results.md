---
title: 'Story 1.6 — View Analysis Results'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'c591f11849027d4c0662f8226c8c8b187b7436f4'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Solve produces a correct `SolveResult` and nothing shows it. A student clicks Solve, sees "Solved", and learns nothing — no diagrams, no Reactions, nothing to check a hand calculation against, which is the entire reason the product exists.

**Approach:** Derive the internal-force distributions along each member from the solver's end actions and its own distributed load, then render them as BMD, SFD and NFD cards with labelled peaks, plus a Reactions table, in a results area docked below the canvas.

## Boundaries & Constraints

**Always:**
- Diagram values are derived from `SolveResult.elementForces` and the Loads already in the store — never by re-running any part of the solve (AD-3).
- BMD and SFD each label their peak positive **and** peak negative value with its location; a peak is never left implied by the curve shape (FR-12/FR-13).
- The NFD distinguishes tension from compression by **sign in the label text alone** — `+12.0 kN (tension)` / `−8.0 kN (compression)` — never by an additional colour (FR-14).
- Every supported Node shows its Reaction; the set satisfies global equilibrium within the correctness tolerance (FR-15).
- Results render immediately and unprompted after a successful Solve — never behind a second gate.
- The results area is an inline bottom-docked expansion of the Canvas Workspace, never a separate route.
- A Reaction tag renders only once a Reaction exists, carries the `R:` text prefix, and is outline-only — no filled variant.
- Peak labels are the accessible representation of each diagram; EXPERIENCE.md records that a fuller curve description was considered and decided against.
- SI stays canonical; kN and kN·m are display conversions at the boundary only (AD-4).

**Ask First:**
- If the sampling resolution needs to be configurable rather than fixed.
- If a Truss should show a BMD and SFD card at all, given both are identically zero for every member.

**Never:**
- No Show Steps — Epic 2 owns the toggle and its content, including the slot it occupies in the results head.
- No unit toggle — Story 1.7. Display is kN/kN·m only for now.
- No changes to `engine/stiffness.ts`, and no second derivation of anything `SolveResult` already carries.
- No colour-only encoding of any value, anywhere in this story.
- No export, print, or download of diagrams.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Solved Frame | Successful Solve | BMD, SFD, NFD and Reactions all render, unprompted | N/A |
| Unsolved | No Solve yet, or results invalidated by an edit | Results area shows its empty note, no stale curves | N/A |
| Blocked Solve | Solve refused | Results area shows the empty note; the banner carries the reason | N/A |
| Peak labelling | Any solved structure | Both peak positive and peak negative are labelled with value and location | N/A |
| NFD sign | Member in tension, another in compression | `+N kN (tension)` and `−N kN (compression)` in the label text | Never colour alone |
| Reactions | Solved structure with Supports | One row per supported Node, each tag prefixed `R:` | N/A |
| Equilibrium | Any solved structure | Reactions and applied Loads sum to zero within tolerance | N/A |
| Simply supported UDL | Beam under a UDL | Peak moment is `wL²/8` at midspan, not at a Node | N/A |
| Cantilever UDL | Fixed-end beam under a UDL | Peak moment `wL²/2` at the fixed end; shear varies linearly | N/A |
| Truss | Solved Truss | NFD carries every member force; BMD and SFD are identically zero | N/A |
| Zero-load structure | Solved with no Loads | All three diagrams flat at zero, with no divide-by-zero in scaling | N/A |
| Uniform-value diagram | A constant non-zero axial force | Renders a flat line at the right offset rather than collapsing | N/A |

</frozen-after-approval>

## Code Map

- `engine/diagrams.ts` (new) -- pure sampling of `N(x)`, `V(x)` and `M(x)` along a member from its end actions plus its own distributed load, and peak extraction over the samples. Framework-free (AD-1), styled like `engine/loadResolution.ts`. Integration constants and signs are pinned by closed-form tests, not asserted from first principles — see Design Notes.
- `engine/diagrams.test.ts` (new) -- closed-form checks: `wL²/8` at midspan, `PL/4` under a central point load, `wL²/2` at a cantilever's fixed end, and linear shear under a UDL.
- `engine/stiffness.ts` -- `elementForces` (axial, shearStart/End, momentStart/End, local frame) and `equilibriumResidual` are the inputs; do not modify either.
- `engine/loadResolution.ts` -- `resolveElementLoad` gives a member's summed UDL intensity; the sampler needs it resolved into the member's local frame, as `udlEquivalentLoads` already does internally.
- `components/panels/DiagramCard.tsx` (new) -- one card: title, peak label in accent-primary monospace, and an inline SVG polyline over a hairline baseline. Mockup geometry at `mockups/key-canvas.html:312-323`.
- `components/panels/ResultsArea.tsx` (new) -- the bottom-docked area: head with title and the `Solved ✓` tag, then the three diagram cards and the Reactions table. Empty note verbatim: `No results to show — fix the structure above, then Solve again.`
- `components/panels/SolveBar.tsx` -- move its inline `Solved` indicator into the results head, where the mockup puts it, rather than showing the same state twice. Its test moves with it.
- `app/page.tsx` -- mount `ResultsArea` below `.workspace-body`.
- `components/ui/tokens.css` -- add `accent-success` (`#1E7F5C`, dark `#4FBE8D`) and the card shadow; every other token this story needs already exists.
- `app/globals.css` -- `.results-area`, `.results-head`, `.diagram-card`, `.react-table`, and the outline tag shared by Reaction and Solved tags.
- `utils/units.ts` -- kN already exists; add the moment unit so `kN·m` is not assembled ad hoc at call sites.

## Tasks & Acceptance

**Execution:**
- [x] `engine/diagrams.ts` -- sampling and peak extraction, pure and framework-free
- [x] `engine/diagrams.test.ts` -- closed-form midspan and support values, plus the flat and zero cases
- [x] `utils/units.ts` -- moment display unit alongside the existing force unit
- [x] `components/panels/DiagramCard.tsx` -- title, peak label, SVG polyline over a baseline
- [x] `components/panels/ResultsArea.tsx` -- head, three cards, Reactions table, empty note
- [x] `components/panels/SolveBar.tsx` -- move the solved indicator into the results head
- [x] `app/page.tsx` + `app/globals.css` + `components/ui/tokens.css` -- mount and style
- [x] `components/panels/ResultsArea.test.tsx` -- solved, unsolved, peaks labelled, NFD sign text, Reactions present

**Acceptance Criteria:**
- Given a simply supported beam under a UDL, when the BMD renders, then its peak is `wL²/8` at midspan and is labelled with both value and location
- Given a member in compression, when the NFD label renders, then it reads `(compression)` in text and no colour distinguishes it from a tension member
- Given a solved structure, when Reactions render, then every supported Node appears with an `R:`-prefixed tag
- Given results are invalidated by an edit, when the results area re-renders, then it shows the empty note and no stale curve
- Given `npm test`, when it runs, then every engine-side matrix row is covered and passes

## Design Notes

**Signs are pinned by tests, not asserted.** The solver reports member end actions in the local frame, and the relationship between those and the classroom `V(x)`/`M(x)` sign convention is exactly the kind of thing that is easy to get plausibly wrong — a flipped moment still draws a diagram, just an upside-down one. So the sampler is written against closed-form values that are unambiguous (`wL²/8` sagging at midspan of a simply supported beam, `wL²/2` hogging at a cantilever's fixed end) and the constants follow from making those pass. This is the same discipline the solver's benchmark suite used, for the same reason.

**A UDL makes the moment parabolic.** `V(x)` is linear under a uniform load and `M(x)` quadratic, so sampling at the member ends alone would draw a straight line between two correct endpoints and miss the midspan peak entirely — which is precisely the value a student is checking. Sample along the member, and find peaks from the samples plus the analytic stationary point where the shear crosses zero, so the reported peak is the true one rather than the nearest sample.

**Truss cards.** Every member of a Truss has zero shear and zero moment by construction. Rendering two flat cards labelled zero is honest and consistent, and avoids a layout that changes shape with Structure Type; the alternative — hiding them — is listed under Ask First rather than decided here.

**Scaling a flat diagram.** A diagram whose values are all equal (including all zero) has no range to scale against. Guard the divisor so a zero-load structure draws a flat line on its baseline instead of producing `NaN` coordinates that silently blank the card.

## Verification

**Commands:**
- `npm run lint` -- expect 0 errors and 0 warnings
- `npx tsc --noEmit` -- expect no new type errors
- `npm test` -- expect the diagram suite to pass alongside the existing 18 files

**Manual checks (if no CLI):**
- Build a simply supported beam under a UDL, Solve, and confirm the BMD peak reads `wL²/8` at midspan and curves rather than forming a straight line between supports.
- Solve a Truss and confirm the NFD labels tension and compression members by sign in text, with no colour difference between them.
- Edit a Node after solving and confirm the results area empties rather than showing a stale curve.

## Reviewer Gate

**Not run — consistent with Stories 1.5a and 1.5b.** In its place: every I/O matrix row covered, and the sampling math gated by closed-form values before any UI consumed it.

The signs came out wrong on the first run, exactly as the spec anticipated: shear was right but the moment was inverted *and* exactly 2× too large, which traced to a wrong sign on the `V₁·x` term. Working it back from moments about the cut gave `M(x) = −M₁ + V₁x + w x²/2`, which also makes `dM/dx = +V` hold — so the two diagrams can no longer disagree about where the moment turns over. All four closed-form cases passed after that correction.

This story is also the first consumer of `SolveResult.elementForces`, so it doubles as an independent check on Story 1.5a's end-action signs, which had no consumer when they were written.

Unexamined, as before: cross-story interactions and false-coverage gaps.

## Suggested Review Order

**The sampling, which is where a plausible-but-wrong diagram would come from**

- `V(x)` and `M(x)` from one integration, so the curves can never disagree about the turning point
  [`diagrams.ts:88`](../../engine/diagrams.ts#L88)

- Peaks taken over samples plus the analytic shear-zero crossing, not the nearest sample
  [`diagrams.ts:159`](../../engine/diagrams.ts#L159)

- Structure-wide assembly, skipping any Element whose forces are missing rather than throwing
  [`diagrams.ts:180`](../../engine/diagrams.ts#L180)

**Display**

- Tension and compression as words, never as a hue the palette does not have
  [`units.ts:118`](../../utils/units.ts#L118)

- Zero-range guard: a flat diagram draws on its baseline instead of emitting NaN coordinates
  [`DiagramCard.tsx:42`](../../components/panels/DiagramCard.tsx#L42)

- Members laid end to end so three curves read as one structure
  [`ResultsArea.tsx:37`](../../components/panels/ResultsArea.tsx#L37)

**Peripherals**

- The closed-form gate: wL²/8 sagging, wL²/2 hogging, PL/4, and the truss zero case
  [`diagrams.test.ts:1`](../../engine/diagrams.test.ts#L1)

- Cards, peak labelling, NFD sense text, Reaction prefixes, and the invalidation path
  [`ResultsArea.test.tsx:1`](../../components/panels/ResultsArea.test.tsx#L1)

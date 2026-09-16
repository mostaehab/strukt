---
title: 'Story 1.5a — Solver Engine'
type: 'feature'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '112bf50b375753797d11ebacf3f2508c92fafe82'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `engine/stiffness.ts` is two empty stubs. A student can draw a structure, restrain it, give it Materials, Cross-Sections and Loads — and nothing can be computed from any of it. There is no analysis, no way to learn a structure is unstable, and no enforcement of the ≤0.1% correctness guarantee the whole product rests on.

**Approach:** Implement the Direct Stiffness Method in `engine/`, exposing one `solve()` that returns either a `SolveResult` carrying both final answers and every intermediate Show Steps will need, or a specific `SolveError` naming what is wrong. Gate correctness with a Vitest benchmark suite of closed-form textbook problems. Engine only — wiring Solve into the app is Story 1.5b (`deferred-work.md`, 2026-08-31).

## Boundaries & Constraints

**Always:**
- `solve()` returns one `SolveResult` keyed by entity id, never array index (AD-3): `displacements`, `reactions`, `elementForces`, plus `localStiffness`, `dofMap`, and `reducedSystem { K, F, freeDofs }`.
- Only plain `number` / `number[]` / `number[][]` cross the `solve()` boundary — no mathjs `Matrix` ever escapes, so the result stays JSON-serialisable.
- `solve()` is synchronous and pure; `engine/` imports only mathjs (AD-1).
- `localStiffness` holds the **local** matrix — the one FR-17 shows with the Element's own values substituted, not the assembled global one.
- Every blocked Solve returns `{ code, message, nodeId?, elementId? }` whose `message` names the responsible entity and says what to do — never a generic string.
- A zero-Element structure gets its own "nothing to analyze yet" wording, never instability wording.
- SI throughout: newtons, metres, pascals. No unit conversion anywhere in `engine/`.
- Truss Nodes have 2 DOF and no rotational term; Frame Nodes have 3.

**Ask First:**
- If the benchmark suite needs more than the six problems in Design Notes, or a specific textbook cited for provenance.
- If a singular reduced system should ever return numbers rather than an error.

**Never:**
- No store changes, no `analysisResults` rename, no invalidation, no `solve` store action, no Solve button or error banner — all Story 1.5b.
- No Show Steps UI (Epic 2), no diagrams or Reaction rendering (Story 1.6), no unit toggle (Story 1.7).
- No persistence of `SolveResult`, and no Server Action path.
- No applied moment loads, trapezoidal loads, internal hinges, or support settlements.
- No second code path that recomputes anything `SolveResult` already carries.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stable Frame | Restrained Frame with Materials, Sections, Loads | `SolveResult` with all six fields populated, keyed by entity id | N/A |
| Stable Truss | Same, Structure Type TRUSS | Axial-only element forces; 2 DOF per Node | N/A |
| Element missing a Material | `material: null` | Blocked before assembly | `{code, message, elementId}` naming that Element |
| Element missing section properties | `area` null, or `inertia` null on a Frame | Blocked before assembly | Error names the Element and the missing field |
| UDL on a Truss Element | Distributed Load on a TRUSS member | Blocked — a truss member carries no bending | Error names the Element and offers the two ways out |
| Zero Elements | Nodes only, or nothing at all | Blocked | Distinct "nothing to analyze yet" wording, not instability |
| Insufficient restraint | Fewer independent restraints than rigid-body DOF | Blocked, no crash, no silent answer | Error names the responsible Node or region |
| Disconnected sub-structure | Two components, one unrestrained | Blocked | Error names the unrestrained component |
| Singular reduced system | Restraints countable but degenerate (e.g. all-parallel rollers) | Blocked rather than returning garbage | Instability error, never a thrown exception |
| UDL on a Frame Element | Element carries a UDL | Converted to equivalent nodal loads; element end forces include the fixed-end terms | N/A |
| Equilibrium holds | Any solved structure | Reactions plus applied Loads sum to zero within tolerance | N/A |
| Benchmark problems | Six closed-form textbook cases | Every value within 0.1% relative error | Suite fails the build otherwise |
| Result is serialisable | Any solved structure | `JSON.stringify` round-trips without loss | Proves no mathjs `Matrix` escaped |

</frozen-after-approval>

## Code Map

- `engine/types.ts` -- add `SolveResult`, `ElementForce`, `SolveError`, `SolveOutcome`. The existing `AnalysisResults`/`NodeResult`/`ElementResult` (L36-56) predate AD-3 and do not match it; leave them in place for now — `StructureState.analysisResults` still references them and the store is Story 1.5b's scope. Add a note that they are superseded.
- `engine/validation.ts` (new) -- per-Element completeness: Material assigned, positive `area`, positive `inertia` on a Frame, and no UDL on a Truss member. Returns `SolveError[]`. Pure, styled like `engine/geometry.ts`; uses the microcopy in Design Notes verbatim.
- `engine/stability.ts` (new) -- zero-Element case, connected components over Nodes via Elements, and restraint sufficiency per component. Pure; produces the `{code, message, nodeId?}` shapes FR-11 requires.
- `engine/stiffness.ts` -- replace the two stubs and their three unused imports (the standing lint warnings) entirely. Local stiffness per Element, transformation by direction cosines, global assembly, boundary-condition reduction, linear solve, reactions, and element end forces. `solve(payload)` is the single entry point per the Structural Seed.
- `engine/validation.test.ts`, `engine/stability.test.ts`, `engine/stiffness.test.ts` (new) -- per-module coverage in the established `engine/*.test.ts` style: explicit `vitest` imports, local factories, flat `it` cases.
- `engine/benchmark.test.ts` (new) -- AD-9's gate: the six problems in Design Notes, each asserted to ≤0.1% relative error.
- `engine/load.ts`, `engine/loadResolution.ts` -- `resolveNodeLoad` / `resolveElementLoad` already sum Loads per target and currently have no production caller; `solve()` is their first consumer. Do not re-sum inline.
- `engine/constants.ts` -- `MATERIALS[m].E` in pascals, `SUPPORTS[s]` restraint flags (`u_x`/`u_y`/`theta_z`), and `DOFS` (TRUSS 2, FRAME 3) are the inputs; all corrected and documented as of `112bf50`.
- `engine/element.ts`, `engine/types.ts` -- `StructuralElement.area`/`inertia` are `number | null`, so validation must run before assembly can assume numbers.

## Tasks & Acceptance

**Execution:**
- [x] `engine/types.ts` -- `SolveResult` exactly per AD-3, plus `ElementForce`, `SolveError`, `SolveOutcome`
- [x] `engine/validation.ts` + test -- completeness per Element including the Truss-UDL rule, microcopy verbatim
- [x] `engine/stability.ts` + test -- zero-Element, components, restraint sufficiency, FR-11 error shapes. Extended beyond the spec with a pin-jointed `m + r >= 2j` check: a two-bar truss on a Roller base satisfies the rigid-body restraint count but is still a mechanism, and was reaching the solver's singular-system backstop, which can name no entity
- [x] `engine/stiffness.ts` -- local matrices, transformation, assembly, reduction, solve, reactions, element end forces
- [x] `engine/stiffness.test.ts` -- per-stage coverage including the singular-system path and the UDL fixed-end terms
- [x] `engine/benchmark.test.ts` -- six closed-form problems at ≤0.1% (AD-9)

**Acceptance Criteria:**
- Given a solved structure, when the result is `JSON.stringify`-ed and parsed back, then it is unchanged — proving no mathjs `Matrix` escaped
- Given every benchmark problem, when the suite runs, then each value is within 0.1% relative error
- Given an unstable or incomplete structure, when `solve()` runs, then it returns a `SolveError` rather than throwing or returning numbers
- Given a solved Truss, when element forces are read, then every member reports axial force only
- Given `npm run lint`, when it runs, then the three long-standing `engine/stiffness.ts` warnings are gone

## Design Notes

**Local stiffness.** Truss members are axial-only: 4×4 local, 2 DOF per Node. Frame members add bending: 6×6 local with the standard `EA/L`, `12EI/L³`, `6EI/L²`, `4EI/L`, `2EI/L` terms. Build `T` from the member's direction cosines and assemble as `Tᵀ k T`. Store the *local* matrix in the result — the global one is an assembly detail Show Steps never names.

**UDL to nodal loads.** Resolve the UDL into components along and across the member. The perpendicular part becomes fixed-end shears `wL/2` and moments `±wL²/12`; the parallel part lumps to `wL/2` axial at each end. Element end forces must then add the fixed-end terms back, or a loaded member reports the forces of an unloaded one. This is the most error-prone part of the story, and the benchmark suite is what proves it.

**Instability, in two layers.** Cheap structural checks first, because they produce good messages: zero Elements, then connected components, then restraint sufficiency per component. A singular reduced system is the backstop for degenerate-but-countable cases such as three parallel rollers — detect it rather than letting a linear solve return garbage or throw. Always name the component or Node.

**Microcopy.** The first two were approved on 2026-08-31 (deferred from Story 1.3) and are used verbatim; the third was approved on 2026-08-31 with the Truss-UDL decision. All follow the exemplar at `mockups/key-canvas.html:356` — name the entity, say what to do:

- `Can't solve: Element E1 has no Material assigned. Choose Steel or Concrete to continue.`
- `Can't solve: Element E1 has no Cross-Section. Pick one from the catalog or enter area and inertia directly to continue.`
- `Can't solve: Element E1 is a Truss member and can't carry a distributed load. Apply the Load to its end Nodes instead, or switch the Project to Frame.`

Instability follows the same shape (`Can't solve: Node N5 is unrestrained. Assign a Support (Fixed, Hinged, or Roller) to continue.`). The zero-Element case takes its own wording and must not read as instability.

**Benchmark problems**, all closed-form and checkable by hand: simply supported beam under a central point load (`PL³/48EI`, `R = P/2`); cantilever with an end load (`PL³/3EI`, `M = PL`); cantilever under UDL (`wL⁴/8EI`, `M = wL²/2`); simply supported beam under UDL (`5wL⁴/384EI`, `M = wL²/8`); a two-bar truss with known member forces; and a portal frame checked for equilibrium and symmetry.

## Verification

**Commands:**
- `npm run lint` -- expect 0 errors and the three `engine/stiffness.ts` warnings to disappear with the stubs
- `npx tsc --noEmit` -- expect no new type errors
- `npm test` -- expect the benchmark suite to pass alongside the existing 13 files

**Manual checks (if no CLI):**
- Hand-check the simply supported beam benchmark: reactions must each be `P/2` and midspan deflection `PL³/48EI`.
- Confirm a Truss solve reports no bending moment on any member.

## Reviewer Gate

**Not run — skipped by human decision on 2026-08-31.** Stories 1.3 and 1.4 each went through the three adversarial layers (blind-hunter, edge-case-hunter, verification-gap), which produced 48 and 45 findings respectively. This story did not, so the usual triage and patch pass is absent from its history.

What stands in its place: 16 benchmark assertions against closed-form textbook solutions at ≤0.1% (AD-9), 116 engine tests, and 13/13 I/O matrix rows covered. Two defects were found and fixed during implementation — an incorrect test of mine that asserted a pin-jointed mechanism was solvable, and the `m + r >= 2j` gap it exposed, where a truss mechanism reached the singular-system backstop instead of a named error.

What that leaves unexamined is what the layers have historically been best at: cross-story interactions, verification gaps where a test looks like it covers something it does not, and edge cases in code paths the benchmarks do not exercise. Worth a review pass before Epic 2 builds Show Steps directly on `SolveResult`'s intermediate fields.

## Suggested Review Order

**The contract — start here**

- `SolveResult` carries final answers and every Show Steps intermediate, computed once
  [`types.ts:197`](../../engine/types.ts#L197)

- A blocked Solve names the responsible entity and carries its id alongside the prose
  [`types.ts:180`](../../engine/types.ts#L180)

- `NO_DOF` marks the rotational slot a Truss Node does not have
  [`types.ts:142`](../../engine/types.ts#L142)

**Refusing to solve, in the order the checks run**

- Zero Elements, connected components, restraint sufficiency — the checks that can name a Node
  [`stability.ts:94`](../../engine/stability.ts#L94)

- Union-find over Element adjacency; an isolated Node is its own component rather than dropped
  [`stability.ts:45`](../../engine/stability.ts#L45)

- Per-Element completeness, reporting every problem at once rather than one Solve at a time
  [`validation.ts:33`](../../engine/validation.ts#L33)

**The solver**

- Assembly, reduction, solve, reactions, element end forces — one pass, one result
  [`stiffness.ts:221`](../../engine/stiffness.ts#L221)

- The local matrix FR-17 displays: 4×4 axial-only for a Truss, 6×6 with bending for a Frame
  [`stiffness.ts:85`](../../engine/stiffness.ts#L85)

- UDL resolved along and across the member; end forces subtract it back out
  [`stiffness.ts:181`](../../engine/stiffness.ts#L181)

- Direction cosines into `T`, so a member's global stiffness is `Tᵀ k T`
  [`stiffness.ts:124`](../../engine/stiffness.ts#L124)

**Peripherals**

- Six closed-form problems, each expected value computed from its formula in the test itself
  [`benchmark.test.ts:1`](../../engine/benchmark.test.ts#L1)

- Contract guarantees: JSON round-trip, id keying, local-not-global, free-DOF labels
  [`stiffness.test.ts:1`](../../engine/stiffness.test.ts#L1)

- Components, restraint counts, and the pin-jointed mechanism case
  [`stability.test.ts:1`](../../engine/stability.test.ts#L1)

- Every rejection message asserted verbatim against the approved wording
  [`validation.test.ts:1`](../../engine/validation.test.ts#L1)

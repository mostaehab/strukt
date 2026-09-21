---
name: 'review-adversarial'
type: review
reviews: '_bmad-output/planning-artifacts/architecture/architecture-strukt-2026-08-30/ARCHITECTURE-SPINE.md'
lens: 'adversarial (reviewer gate)'
altitude: initiative
created: '2026-08-30'
verdict: FAIL-CLOSABLE
---

# Adversarial Review — strukt Architecture Spine

## Verdict

**FAIL, closable.** The spine's paradigm (layered, pure domain core) is sound and AD-1/AD-2/AD-6/AD-8 are tight enough to survive an adversarial reading. But five ADs — AD-3, AD-4, AD-5, AD-6 (the `user_id` type, specifically), AD-7 — contain load-bearing nouns ("a `SolveResult`", "one document", "the UI boundary", "Server Actions... calling Drizzle directly") that are precise about *intent* but not about *shape*. For each, I constructed two implementers who each satisfy the Rule's literal text and still produce incompatible artifacts. Three of the five are not hypothetical: I read the current repo (`engine/types.ts`, `engine/stiffness.ts`, `store/useStructureStore.ts`) and found the drift already present, pre-dating this spine — which is the strongest possible evidence that the ambiguity is real, not manufactured for this exercise.

Every finding below ends with a proposed AD tightening. None require new architecture — all are one to three sentences added to an existing Rule.

---

## Grounding: what the repo already shows (read before scoring the hypotheticals)

`engine/types.ts` (current, uncommitted diff pending) and `store/useStructureStore.ts` (new, untracked) predate the spine but are the actual substrate the spine's ADs bind. Three observations that upgrade several findings below from "plausible" to "already true":

1. **AD-2's exact flagged drift is live in the file the spine cites as the fix target.** `engine/types.ts:3` currently reads `export type StructuralSupport = "FIXED" | "PINNED" | "ROLLER" | "FREE"` — `PINNED`, not `HINGE`. AD-2 is marked `[ADOPTED]` and names this exact string as the thing to reconcile. Confirms AD-2 is solving a real, present bug, not a strawman — good sign for AD-2, bad sign for how much drift accumulates before an AD lands.
2. **AD-3's central artifact does not exist yet, under any name.** `engine/stiffness.ts` is two empty stubs (`getLocalStiffnessMatrix`, `getGlobalStiffnessMatrix`, both `() => {}`). There is no `solve()`, no `SolveResult` type, anywhere in the repo. The closest existing shape is `AnalysisResults` in `types.ts` (`nodeResults: Record<string, NodeResult>`, `elementResults: Record<string, ElementResult>`) — already a *different name* than the spine's `SolveResult`, and it contains none of AD-3's mandated intermediates (no local stiffness matrices, no DOF map, no reduced system). This is 100% open ground for two implementers to diverge on, today.
3. **The store already violates the Consistency Conventions' mutation rule, in the code as written.** `useStructureStore.ts`'s `updateNode`/`deleteNode`/`updateElement`/`deleteElement` mutate `nodes`/`elements` and never touch `analysisResults`. The Consistency Conventions table requires: "Any edit to Nodes/Elements/... after a Solve invalidates `store.results`... in the same action that made the edit." As written today, editing a Node after solving leaves stale `analysisResults` sitting in the store with no invalidation — exactly the silent-staleness bug AD-3 exists to prevent, now reachable through the mutation path AD-3 doesn't bind. (`store/` is bound by the Consistency Conventions row, not by AD-3 directly — AD-3's own text only says "no second code path ever recomputes," which is a different guarantee than "stale results get cleared.")
4. **No `unitSystem` field exists in `StructureState` at all**, despite the Design Paradigm's Application State bullet listing "unit system" as something `store/` owns, parenthetically alongside Nodes/Elements/Supports/Loads/Materials/Cross-Sections. AD-4 (below) shows why this omission is not innocent.
5. **Cross-Sections are not a referenced/cataloged entity in the type system at all.** `StructuralElement` carries raw `crossSectionArea: number` and `inertia: number` fields directly — no catalog id, no name like `"W10x22"`. AD-5 ("Cross-Section values are resolved and written into that JSONB at save time") and AD-8 ("catalog... imported directly") both presuppose a reference-then-resolve model that the current type doesn't have a slot for yet.

---

## Finding 1 — AD-3: `SolveResult` has a paragraph of intent and zero fields

**The Rule's words:** "carrying both final values (displacements, Reactions, per-Element forces) *and* every intermediate quantity Show Steps needs (per-Element local stiffness matrices, the local→global DOF mapping, the boundary-condition-reduced system)."

Every noun phrase here is a description of *what kind of thing*, never *what shape*. Construct two units:

- **Engineer A (solver-first)** ships `SolveResult` as `{ displacements: Record<NodeId, [number,number,number]>, reactions: Record<NodeId, [number,number,number]>, elementForces: Record<ElementId, ElementForce>, localStiffness: Record<ElementId, number[][]>, dofMap: Record<NodeId, [number,number,number]>, reducedSystem: { K: number[][], F: number[], freeDofs: number[] } }` — plain arrays, keyed by id, chosen so it's JSON-serializable without a mathjs dependency leaking past `engine/`.
- **Engineer B (Show-Steps-first, writing the panel against a mock before the solver lands)** assumes `SolveResult.elements[i].localK: Matrix` (mathjs `Matrix`, since `engine/` already depends on mathjs per AD-1 and there's no rule against a mathjs type appearing on the *output* of `solve()`), array-indexed to match `elements[]` order rather than keyed by id, and a single flat `dofMap: number[]` (global DOF index per local slot, no per-node grouping), and `reduced: { Kr: Matrix, Fr: Matrix }` with no `freeDofs` at all (B derives free DOFs implicitly from support flags at render time — a second, silent recomputation of exactly the boundary condition logic AD-3's own "no second code path" clause was written to forbid, and B can point to the text and say they never *recomputed the solve*, only *re-derived which DOFs are free*, which the Rule doesn't name).

Both satisfy every noun in AD-3. They are not merge-compatible: id-keyed vs index-keyed breaks the moment Elements are reordered or deleted (A's `elementForces["el-3"]` survives a delete-and-reinsert; B's `elements[2]` silently points at the wrong element after any array splice); mathjs `Matrix` vs plain array breaks serialization into AD-5's JSONB if solve results are ever persisted (see Finding 2b); and B's re-derivation of free-DOFs at display time is exactly the drift-from-solver AD-3 exists to prevent, executed through a loophole in what counts as "recomputing."

**Close it:** Pin the actual TypeScript interface for `SolveResult` in the spine (or in `engine/types.ts` before any story starts), specifying: keyed-by-entity-id (not array index) for every per-Node/per-Element field; plain `number[]`/`number[][]` (no mathjs `Matrix`) crossing the `solve()` return boundary; and an explicit `freeDofs: number[]` field so no consumer ever re-derives it from Supports independently.

## Finding 2a — AD-5: the JSONB document has no declared schema, and current types don't match its assumptions

**The Rule's words:** "`structure` holds the full Nodes/Elements/Supports/Loads/Materials/Cross-Sections/unit-system shape as one document."

Two implementers:

- **Engineer A** writes the Save action as `structure: JSON.stringify(pick(storeState, ['type','name','nodes','elements']))` — literally today's `StructureState` shape, flat, no wrapper, no version tag. "One document" read as: the document *is* the state.
- **Engineer B**, anticipating `engine/types.ts` will keep evolving (the repo's own git history — `types.ts` and `stiffness.ts` both show uncommitted changes right now — argues this is not paranoia but current fact), wraps it as `structure: { schemaVersion: 1, data: {...} }`. "One document" read as: the wrapper is still one document; the alternative (no version) is what AD-5's own **Prevents** clause calls out as the risk ("schema churn chasing `engine/types.ts` while it's still evolving").

Both are defensible from the text. They are incompatible at the database: a Load action written against A's flat shape throws or silently returns `undefined` fields when fed a B-shaped row, and vice versa — with no error surfaced anywhere near the mismatch (JSONB has no schema enforcement in Postgres by default).

Separately, **Cross-Section resolution has two valid readings** per the prompt's own framing:
- A: denormalize the full resolved catalog entry inline into every Element (`element.crossSection = { id, area, Ix, ... }`).
- B: keep a name/id per Element plus one deduplicated `resolvedCrossSections: Record<string, CrossSectionProps>` dictionary at the document root, to avoid repeating identical catalog data across many elements sharing one section.

Both satisfy "resolved and written into that JSONB at save time." They produce different document shapes with no shared reader.

**Close it:** Add to AD-5: the exact `structure` document shape (a fenced TS interface or JSON Schema), including a mandatory `schemaVersion: number` at the document root from day one (cheapest possible insurance, and the spine itself names this exact risk in its own Prevents clause without acting on it), and pick one of the two Cross-Section resolution shapes explicitly.

## Finding 2b — AD-5 × AD-3: are solve results persisted, and in what shape?

AD-5 lists what `structure` holds: Nodes/Elements/Supports/Loads/Materials/Cross-Sections/unit-system. It does not say whether `SolveResult` (AD-3) is part of the saved document. Two implementers:
- **A** treats solve results as session-only (matches "Application State... owns the *active, in-session*... solve results" — "in-session" read as "never persisted"), so reopening a saved Project always requires re-solving before Show Steps works.
- **B** reads AD-3's "Reactions" as user-facing data worth persisting (so a saved Project's dashboard preview/summary can show reactions without a solve pass) and adds `structure.lastSolveResult` to the JSONB.

If B's shape includes a mathjs `Matrix` (Finding 1) inside JSONB, `JSON.stringify` on a mathjs `Matrix` instance does not round-trip to a plain array cleanly (it serializes internal representation, not a plain nested array) — a persistence bug that only exists because AD-3 and AD-5 were each specified without reference to the other.

**Close it:** One sentence in AD-5: "`structure` never includes `SolveResult` — solve results are always recomputed client-side on load, never persisted" (or the opposite, explicitly — either resolves it, silence doesn't).

## Finding 3 — AD-7: "component" vs "Server Component" is exactly the loophole the prompt asked about

**The Rule's words:** "Save/Load/List/Delete are Next.js Server Actions calling Drizzle directly."

A Server Action in Next.js is specifically a `"use server"`-exported function invoked from an event/form. A React **Server Component** (e.g. `dashboard/page.tsx` itself) can `await db.select()...` directly in its own render body with zero Server Action involved — it never touches the client, never introduces React Query/SWR, and technically isn't "a component" importing Drizzle in the sense AD-7's **Prevents** clause worries about ("two sources of truth... client cache vs. server"), because an RSC read has no client cache to be a second source of truth.

- **Engineer A** implements the Dashboard's initial list render as a direct Drizzle query inside `dashboard/page.tsx` (an RSC), and routes only Save/Delete through `actions.ts`, arguing List-on-initial-render isn't "the List action," it's just the page doing what RSCs do.
- **Engineer B** routes List through an actual exported `listProjects()` Server Action in `actions.ts`, called from the page, matching the Structural Seed's own comment (`actions.ts # Server Actions: list/save/delete (AD-7)`) which explicitly puts "list" inside `actions.ts`.

Both satisfy "no React Query/SWR/client cache." Only B matches the Structural Seed's own inline comment — meaning the Structural Seed (informative) and AD-7's Rule text (normative) don't fully agree on whether List must be a named Server Action or may be an inline RSC query, and nothing stops a component (RSC or client) from importing `lib/db` directly since there's no lint rule (no `eslint-plugin-boundaries`/import-restriction mentioned anywhere in Stack) enforcing the Design Paradigm diagram's arrows at build time — it's a social convention today.

**Close it:** State explicitly that *all four* operations (including List/reads) must be named exported functions in `app/**/actions.ts`, never an inline query in a Server Component or elsewhere — and consider naming the enforcement mechanism (even a one-line "no `lib/db` import outside `app/**/actions.ts`" convention an eventual ESLint boundaries rule can check) so this isn't purely honor-system.

## Finding 4 — AD-4: the store already omits `unitSystem`, and "UI boundary" admits a store-mutation reading

**The Rule's words:** "Imperial exists only as a display/input conversion at the UI boundary; it never crosses into `engine/`." Meanwhile the Design Paradigm bullet lists "unit system" as something `store/` owns, in the same breath as Nodes/Elements/Loads.

- **Engineer A** reads "UI boundary" as: components/hooks convert on the way in/out; the store's Node/Load numeric fields are always SI, full stop; a `displayUnitSystem` flag plus a memoized selector layer handles rendering. Store never mutates canonical values for display.
- **Engineer B** reads "unit system" being store-owned (Design Paradigm's own words) as license to implement the unit toggle as a store action — `toggleUnits()` that multiplies every Node coordinate and Load value by a conversion factor in place, and converts back on toggle-off. This never touches `engine/` (satisfies AD-4's literal text — the conversion happens in `store/`, not `engine/`) but leaves the store's canonical structure in imperial values for as long as the toggle is on, violating AD-4's *other* clause ("store/'s canonical structure are always SI") — both clauses are in the same Rule and B's implementation satisfies one while violating the other.

Worse: B's approach, because it mutates tracked Node/Load fields, **triggers the Consistency Convention's own invalidation rule** ("any edit to Nodes/... after a Solve invalidates `store.results`... in the same action") — meaning every unit toggle would wipe current Show Steps results and force a re-solve, under a completely literal reading of an unrelated Rule. A's selector-based approach never mutates tracked fields, so it never triggers this. Two units, two very different behaviors for the single most-clicked control in the UI (per FR-20).

**Close it:** Make AD-4 explicit that conversion is *read/write-through at the input/output boundary only* — the store never holds converted values, not even transiently — and that `unitSystem`/`displayUnitSystem` is a UI preference flag, not a Node/Load field, so it's structurally excluded from the mutation-invalidation rule.

## Finding 5 — AD-6 × Consistency Conventions: a direct textual conflict, not just an ambiguity

**AD-6's words:** "A `projects` row's `user_id` is Clerk's user id." Clerk's `userId` (from `auth()`) is a string in Clerk's own format (`user_2abc...`), not an RFC 4122 UUID.

**Consistency Conventions' words (same document):** "Ids are `string` (UUID)."

These two Rules are in outright conflict, not merely ambiguously worded:
- **Engineer A** applies the global Ids convention literally to `user_id` (it is, after all, an id) and types the Drizzle column `uuid`. Clerk's actual id value cannot be inserted into a Postgres `uuid`-typed column (it isn't UUID-formatted) — this doesn't just create inconsistency, it fails at insert time, forcing A to invent a translation layer (a UUID generated per-user, mapped to the Clerk id) — i.e., forcing exactly the "separate `users` table" AD-6's own Rule says to avoid "unless a field genuinely can't live on the Clerk user object."
- **Engineer B** treats `user_id` as an exception to the Ids convention (a foreign identity, not a system-owned entity id) and types the column `text`, storing Clerk's string verbatim.

Only B's schema actually works at runtime; A's is a straightforward reading of the document that breaks on first insert. If two stories (e.g., "schema.ts" story vs. "auth wiring" story) are built by different agents in parallel against the spine as literally written, the one who reads the global Ids convention first and applies it uniformly (a completely reasonable order of reading) produces a migration that has to be reverted.

**Close it:** Add one clause to AD-6: "`user_id` is `text`, storing Clerk's `userId` string verbatim — it is explicitly exempt from the Ids-are-UUID convention, since it's a foreign identity, not a system-generated entity id."

## Finding 6 — Race condition the Rules don't prevent: concurrent Save with no conflict detection

Neither AD-5 nor AD-7 (nor AD-6) mentions optimistic concurrency. `projects` has `updated_at` but nothing says a Save action reads-then-compares it. Two tabs on the same Project (or an eventual autosave-on-solve firing concurrently with a manual Save button, both plausible FR-22–24 implementations) each call the Save Server Action independently; last-write-wins with Drizzle's default `UPDATE ... SET structure = $1`, silently discarding whichever tab's edits lost the race — no error, no merge, no warning. Nothing in AD-5/AD-7 as written prevents this, and nothing requires an implementer to even consider it, because Save is specified as a single fire-and-forget action with no described precondition.

**Close it:** Add a sentence to AD-7 (or AD-5): Save is a conditional update keyed on `updated_at` (or a `version` counter), and a losing writer gets a distinguishable error rather than a silent overwrite. Even a minimal "last-write-wins is accepted for MVP, explicitly" is better than silence, since silence is exactly what invites two different concurrency implementations (one that checks, one that doesn't) to coexist.

## Finding 7 — Where does `solve()` actually run? AD-1's throwaway clause creates a second fork

The Design Paradigm text (not an AD, but adjacent to AD-1/AD-3) says the domain core is "safe to run identically client-side or in a Server Action." This is presented as a nice-to-have property, but nothing says which one the MVP actually does — and the two choices have materially different failure modes:
- **Engineer A** wires the Solve button straight to a synchronous `solve()` call inside a store action — zero network hop, no async race possible, Show Steps always reflects the very last edit.
- **Engineer B**, taking "safe to run... in a Server Action" as an implicit recommendation (maybe for future heavy-structure performance, or to keep solver code off the client bundle), wires Solve through `app/canvas/[projectId]/actions.ts`, making it async. Rapid repeated edit-then-solve clicks can now resolve out of order (a slower in-flight solve for an earlier structure state completing after a faster one for a later state), overwriting newer `SolveResult` with a stale one — a real race, and neither AD-3 nor the Consistency Conventions' mutation rule says anything about sequencing or discarding out-of-order solve responses.

**Close it:** State explicitly (even one clause under AD-3 or the Deployment section) whether `solve()` is invoked client-side or via Server Action for v1, and if the latter, require a generation counter or request-cancellation so out-of-order responses can't clobber newer results.

---

## Summary table

| # | AD(s) | Two units, one sentence each | Confirmed already live in repo? |
|---|---|---|---|
| 1 | AD-3 | id-keyed+plain-array `SolveResult` vs index-keyed+mathjs-`Matrix` `SolveResult` | Ground truth: `SolveResult` doesn't exist yet at all |
| 2a | AD-5 | flat unversioned document vs `{schemaVersion, data}` wrapper; denormalized vs deduplicated Cross-Sections | Types don't yet model Cross-Sections as referenceable — confirmed gap |
| 2b | AD-5 × AD-3 | solve results persisted vs session-only | — |
| 3 | AD-7 | RSC-direct-Drizzle read vs named Server Action for List | Structural Seed comment itself only partially resolves this |
| 4 | AD-4 | pure-selector conversion vs store-mutating `toggleUnits()` | `unitSystem` field is *absent* from `StructureState` today — confirmed |
| 5 | AD-6 | `user_id` as `uuid` (conflicts w/ Consistency Conventions literally) vs `text` | Direct textual conflict in the doc, not hypothetical |
| 6 | AD-5/AD-7 | checked vs unchecked concurrent Save | Race condition, no mitigation specified anywhere |
| 7 | AD-1/AD-3 | client-side sync solve vs Server-Action async solve | Race condition, no mitigation specified anywhere |

Seven holes, seven one-to-three-sentence closures. None require restructuring the spine's paradigm — the layering is right. The spine is under-specified at exactly the seams the prompt named in advance (AD-3, AD-5, AD-7, AD-4, AD-6), plus two more (concurrent Save, solve invocation site) that surfaced from reading AD-1/AD-3/AD-5/AD-7 against each other rather than in isolation.

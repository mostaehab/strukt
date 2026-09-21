---
name: 'reconcile-inputs'
type: review
reviews: '_bmad-output/planning-artifacts/architecture/architecture-strukt-2026-08-30/ARCHITECTURE-SPINE.md'
lens: 'input-reconciliation (PRD, addendum, DESIGN.md, EXPERIENCE.md, existing codebase)'
altitude: initiative
created: '2026-08-30'
verdict: GAPS-FOUND
---

# Input Reconciliation — strukt Architecture Spine

Checked the spine against its four cited sources (`prd.md`, `addendum.md`, `DESIGN.md`, `EXPERIENCE.md`) and the actual on-disk code it claims to build on (`engine/types.ts`, `engine/constants.ts`, `engine/stiffness.ts`, `store/useStructureStore.ts`, `package.json`). Findings below, ordered roughly by severity.

## 1. AD-9 is cited three times but never written

The spine references "AD-9" as a load-bearing invariant in three places:
- Design Paradigm, Domain core bullet: "...independently testable against the benchmark suite (AD-9)..."
- Stack table: `Vitest | latest stable (new — benchmark/regression suite, AD-9 below)`
- Deferred: "Lives as a Vitest suite (AD-9 in memlog / Stack above), but exact problem count and maintenance owner is an epics-time decision..."

But `## Invariants & Rules` only contains AD-1 through AD-8 (`Domain core stays framework-free` / `Naming reconciliation` / `Solver contract` / `Units` / `Project persistence` / `Auth session ownership` / `Project CRUD` / `Cross-Section catalog`). No AD-9 heading exists anywhere in the document — "AD-9 below" points at nothing.

Checked `.memlog.md` for this architecture run: line 20 does record the underlying decision — *"Benchmark/regression validation suite (PRD FR-11 NFR, SM-4) lives as an automated Vitest suite against engine/, run in CI — not a UI-facing feature"* — so the decision was made, just never promoted from memlog into an actual AD in the spine. This isn't cosmetic: FR-11's Feature-specific NFR (≤0.1% relative error) and SM-4 (100%-pass launch gate, explicitly called a gate rather than a metric) are the PRD's single hardest correctness bar, and the addendum explicitly asks architecture to "assign an owner and a minimum problem count" for this suite. As written, the spine gestures at having ratified this and then doesn't — an epics author following only the Invariants & Rules section would never learn the benchmark suite is supposed to be an architectural invariant at all.

**Fix:** promote the memlog's AD-9 decision into an actual `### AD-9` section (binds: `engine/`, CI; rule: solver correctness gated by a Vitest suite in CI, referencing FR-11/SM-4), or strip the three dangling references if it's being deliberately deferred to epics instead.

## 2. AD-2 contradicts itself, and violates the spine's own naming rule, on `Material`/`MaterialKind`

AD-2's own two clauses disagree:
- **Binds:** "`engine/types.ts`, `engine/constants.ts`, and every consumer of `Support`/`StructureType`/`Material`" — names the type **`Material`**.
- **Rule:** "`engine/types.ts` is the single source of truth for... `MaterialKind` (`"STEEL" | "CONCRETE"`)" — renames it **`MaterialKind`**.

`MaterialKind` appears nowhere in the PRD, addendum, DESIGN.md, or EXPERIENCE.md — the addendum's own framing of this exact reconciliation task names only the two real candidates, `Material` (types.ts) and `MaterialType` (constants.ts), and asks architecture to pick one. AD-2 instead invents a third name. That would be a defensible architectural call on its own, except the spine's own **Consistency Conventions** table states: *"Glossary terms (Node, Element, Support, Load, Structure Type, BMD/SFD/NFD, **Material**, Cross-Section, Reaction, Project) are used verbatim in code identifiers wherever the concept appears — no synonyms."* `Material` is listed there verbatim as the protected glossary term. `MaterialKind` directly breaks that rule, inside the same document that states it.

Separately, AD-2's rule also silently renames the existing `StructuralSupport` (types.ts) to bare `Support` — dropping the `Structural` prefix — while the Structural Seed and Consistency Conventions both keep that prefix for `StructuralNode`/`StructuralElement` elsewhere. Nothing in AD-2 flags this as an intentional prefix-dropping decision for `Support` alone; it reads as an oversight, not a choice.

**Fix:** pick one term for the Rule that also satisfies the Binds line and the glossary-verbatim convention — `Material` is the only option that satisfies both without further edits — and either state explicitly why `Support` drops the `Structural` prefix that `Node`/`Element` keep, or make it `StructuralSupport` for consistency.

## 3. The addendum's explicit `StructuralNode.mz` question — and the missing `Load` entity behind it — is never answered

`addendum.md`'s "Existing codebase" section poses this directly: *"`StructuralNode.mz` pre-empts the FR-9 Out-of-Scope claim... Architecture/PM should explicitly decide whether `mz` (a) stays reserved/unused in v1, (b) is actually meant as a reaction-moment slot misplaced on the input side..., or (c) should be removed/renamed to avoid an accidental scope leak..."* — a direct, named ask for architecture to resolve. Confirmed against the real file: `engine/types.ts` line 14, `StructuralNode.mz: number` sits alongside `fx`/`fy` on every Node, even though applied moment loads are an explicit PRD Non-Goal (§6.2) and `NodeResult` already has its own `rmz` for reaction moments.

AD-2 (naming reconciliation) is the natural home for this — it's the AD that reconciles `engine/types.ts` field-level naming/scope — but says nothing about `mz`. No other AD touches it either.

This connects to a deeper, unacknowledged gap: FR-8 and FR-9 require **multiple Concentrated Loads summing on the same Node** and **UDLs applied to Elements** — neither of which `StructuralNode`'s singular `fx`/`fy`/`mz` fields (and `StructuralElement`'s complete absence of any load field) can represent. The Structural Seed and AD-5's persistence rule both refer to "Loads" as though it's already a settled, distinct entity ("the full Nodes/Elements/Supports/Loads/Materials/... shape"), but no AD actually introduces a `Load` type, and none flags that this requires *removing* `fx`/`fy`/`mz` from `StructuralNode` and replacing them with a proper array-of-Loads model. This is exactly the kind of data-model implication Check 1 (FR-6/FR-10-11/FR-16-19/FR-20/FR-21-24) was aimed at catching, just one feature earlier than those: FR-8/FR-9's architectural implication for `engine/types.ts` is bigger than a rename, and the spine treats it as already solved.

**Fix:** add an AD (or extend AD-2) that (a) resolves `mz`'s fate per the addendum's three options, and (b) introduces a `Load` entity (kind: concentrated | UDL, target: node | element, magnitude, direction) replacing the current inline fields, since FR-8/FR-9's "multiple loads sum" behavior cannot be represented otherwise.

## 4. Solver placement (client vs. Server Action) is left ambiguous where the PRD asked for a decision

PRD `Assumptions Index`: *"§ Constraints and Guardrails — Solver assumed to run client-side for cost reasons; not yet confirmed at architecture time."* This is a direct, named ask.

The spine's Domain core bullet answers with portability, not a decision: engine/ is "safe to run identically client-side or in a Server Action." Deployment & Environments then states the platform choice is partly justified because *"Server Actions and the solver need full Node.js"* — phrasing that implies the solver may actually execute server-side in v1, without ever saying so outright, and without ever revisiting the PRD's cost-assumption framing (client-side keeps backend cost to auth+storage only; server-side solving reintroduces compute cost per Solve).

This also means Deployment & Environments never cross-references FR-10's <1s solve+render NFR at all — if solve can run in a Server Action, Vercel invocation/cold-start behavior becomes relevant to that budget in a way it wouldn't be for a client-only solver; the spine's Fluid Compute justification talks about instance reuse in general terms but doesn't tie it back to the specific <1s bar.

**Fix:** either state plainly "solve() runs client-side in v1; the Server-Action-compatible signature is future-proofing for a server-side batch/API path, not something v1 uses," confirming the PRD's cost assumption — or, if server-side solving is actually intended for some path (e.g., a future public API), say so and connect it to the <1s NFR explicitly.

## 5. Silent, unratified rename in Consistency Conventions: `store.results`/`store.showSteps` vs. actual `analysisResults`

The Consistency Conventions table states: *"Any edit to Nodes/Elements/Supports/Loads/Materials/Cross-Sections after a Solve invalidates `store.results` and `store.showSteps` in the same action..."* The real `store/useStructureStore.ts` has neither field — its actual (and only) result field is `analysisResults` (matching the `AnalysisResults` type in `engine/types.ts`), and there is no `showSteps` field at all yet (expected, since Show Steps is new FR-16 work).

AD-2's Binds line only covers `engine/types.ts`/`engine/constants.ts` consumers of `Support`/`StructureType`/`Material` — it doesn't bind `store/`, so this `analysisResults` → `results` rename has no AD backing it at all, unlike every other renamed identifier in the document. It may well be the right call (shorter, and `showSteps` needs to sit next to it either way), but as written it's an uncalled rename introduced only in a table of "conventions," not a rule — the same class of drift AD-2 exists specifically to prevent.

**Fix:** either add this to AD-2's scope explicitly (bind `store/useStructureStore.ts` too, and state the rename), or use the real field name `analysisResults` in the Consistency Conventions table.

## 6. FR-22's "unique Project name per account" isn't reflected in the persistence AD

FR-22's testable consequence: *"Project names are unique per account; saving with a name already in use prompts the user to confirm overwrite or choose a different name — it never silently overwrites."* AD-5's schema shape — `(id, user_id, name, structure jsonb, updated_at, …)` — doesn't call out a uniqueness constraint (composite unique index on `(user_id, name)`, or an application-level check-then-write in the Save Server Action), and AD-7 (Server Actions for CRUD) doesn't assign that responsibility either. Not a severe gap — it's schema-level detail an epics author could reasonably infer — but it's exactly the kind of "quiet requirement" the PRD calls out as testable and the spine's own AD-5/AD-7 are the correct, and currently silent, place for it.

## 7. Two UX-spine load-bearing requirements get zero acknowledgment anywhere — not even in Deferred

Grepped the full spine for "WCAG", "dark", "accessib", "disclaimer" — all zero hits outside one unrelated line.

- **Safety disclaimer** (EXPERIENCE.md's dedicated "Safety & Learning-Tool Disclaimer" section; a named PRD Constraint, not incidental copy) — permanently docked footer component, fixed non-paraphrased wording. Purely a UI component with plausibly zero architectural implication, but the spine acknowledges other zero-implication items explicitly (e.g., monetization is named in Deferred: *"No billing/entitlement layer exists in this spine — PRD explicitly defers..."*). The disclaimer gets no equivalent "acknowledged, no architectural implication" treatment anywhere — not in Deferred, not in Consistency Conventions.
- **Dark mode** — DESIGN.md's frontmatter defines a complete, fully-populated dark palette (every token has a `-dark` pair) as load-bearing spec content, not a stretch goal. This has genuine potential architectural surface (a persisted per-user preference vs. OS-level `prefers-color-scheme` only, Tailwind v4's dark-mode strategy configuration) that a layering/data spine is exactly positioned to rule on, yet it's absent even as an assumption or a Deferred item.

Both should at minimum get the same one-line "acknowledged, no architectural implication" or "deferred, here's why" treatment the spine already gives touch gestures and monetization — their total absence reads as dropped, not considered.

## 8. FR-6's Imperial→SI catalog-conversion tolerance note isn't referenced by AD-8

FR-6: *"AISC W-shapes are natively Imperial; the catalog converts cleanly into an SI-unit Project... The converted value may no longer match the exact number in a US Imperial textbook table, though — the Correctness NFR's ≤0.1% tolerance must account for this conversion step, not just numerical solve accuracy."* This is a real correctness-NFR interaction, not a cosmetic detail — it directly affects what AD-9's (missing, see #1) benchmark suite needs to test.

AD-8 only says the catalog "lives as a versioned data module under `engine/catalog/`, imported directly." It doesn't say whether catalog values are pre-converted to SI once at authoring time (baked into the static module, and reviewable/testable independently) or converted at runtime whenever a Steel W-shape is selected (a code path that itself needs to be within the ≤0.1% budget FR-6 names). AD-4 ("Units are a presentation-layer concern only") is adjacent but is framed around user-facing display/input conversion, not catalog-authoring conversion, so it doesn't actually cover this case either.

**Fix:** AD-8 should state explicitly that catalog values are pre-converted to SI at authoring time (consistent with AD-4's "canonical structure is always SI" rule), so the ≤0.1% tolerance question becomes a one-time data-authoring correctness check, not a per-selection runtime one.

---

## Summary table

| # | Gap | Where it should live | Severity |
|---|---|---|---|
| 1 | AD-9 (benchmark suite) cited 3x, never defined | Invariants & Rules | High — orphans FR-11 NFR / SM-4 launch gate |
| 2 | AD-2 self-contradicts (`Material` vs `MaterialKind`), breaks own glossary-verbatim rule | AD-2 | High — internal contradiction |
| 3 | `StructuralNode.mz` / missing `Load` entity (addendum's explicit ask) unanswered | AD-2 or new AD | High — FR-8/FR-9 data-model gap |
| 4 | Solver placement (client vs. Server Action) left ambiguous vs. PRD's "confirm at architecture time" ask; <1s NFR not cross-referenced in Deployment | AD-1 / Deployment & Environments | Medium |
| 5 | `store.results`/`store.showSteps` named in Consistency Conventions with no AD backing the rename from real `analysisResults` | AD-2 scope or Consistency Conventions | Medium |
| 6 | FR-22 per-account Project-name uniqueness not in AD-5/AD-7 | AD-5 / AD-7 | Low |
| 7 | Safety disclaimer and dark mode: zero acknowledgment anywhere, unlike other UI-only items (monetization, touch gestures) which get an explicit "no/deferred" note | Deferred or Consistency Conventions | Low-Medium |
| 8 | FR-6 catalog SI-conversion tolerance not referenced by AD-8/AD-4 | AD-8 | Low |

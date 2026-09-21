---
review: architecture-spine-rubric
target: ../ARCHITECTURE-SPINE.md
reviewer: rubric-walker
date: 2026-08-30
verdict: changes-requested
---

# Rubric Review — ARCHITECTURE-SPINE.md (strukt)

## Verdict

**Changes requested.** The spine is well-formed where it engages (AD-1, AD-4, AD-5, AD-6, AD-7, AD-8 are concrete, enforceable, and correctly grounded in the memlog's decisions), but it has one critical capability-coverage gap (Loads), one broken cross-reference (a phantom AD-9), and one internal self-contradiction inside AD-2 — the very AD whose job is ending naming drift. These are exactly the class of gap that would let two independently-built epics diverge. Not ready to hand to epics/stories as-is.

---

## Critical

### C-1. Load entity model and sign convention are entirely unaddressed

FR-8/FR-9 require that multiple Concentrated Loads on a Node and multiple UDLs on an Element **sum rather than overwrite**, and PRD §9 Assumptions Index explicitly hands architecture the job of deciding the global sign/direction convention ("exact convention, e.g. positive y = upward, deferred to architecture"). The addendum separately instructs architecture to treat the brownfield store as needing a `Load` entity added, not assumed already-modeled.

The spine never picks this up. "Loads" appears only as a noun in prose (Design Paradigm's store bullet, AD-5's JSONB content list) — no AD defines:
- whether a Load is a first-class list entity (so an individual load can be edited/deleted, per FR-8/FR-9's "multiple loads... their effects sum") or continues as the brownfield's scalar `fx`/`fy`/`mz` accumulation on `StructuralNode` (which cannot represent "multiple loads" individually),
- the global coordinate/sign convention Show Steps (FR-17-19) and the equilibrium check (FR-15) both depend on being consistent,
- what happens to the existing `StructuralNode.mz` field, which the addendum flagged by name as ambiguous (reserved for a future feature? a misplaced reaction slot? dead weight from an excluded feature?) and asked architecture/PM to resolve explicitly.

This is not in the Deferred section either — it's simply silent. Two epics (one building FR-8's load-apply UI, one building FR-19's boundary-condition-reduced solve display) could each invent a different Load shape and a different sign convention, and nothing here would catch it. This is the single largest gap versus "fixes the real divergence points for the level below and misses none."

**Fix:** Add an AD binding `engine/types.ts` (Load shape/list vs. scalar) and `engine/stiffness.ts`/store (sign convention), or at minimum an explicit Deferred entry naming the open question and who owns closing it — silence isn't the right disposition for something the PRD directly delegated to this document.

---

## High

### H-1. Phantom "AD-9" — referenced three times, defined nowhere

"AD-9" is cited as if it exists: in the Design Paradigm's Domain-core bullet ("independently testable against the benchmark suite (AD-9)"), in the Stack table's Vitest row ("new — benchmark/regression suite, AD-9 below"), and in the Deferred section ("Lives as a Vitest suite (AD-9 in memlog / Stack above)"). The Invariants & Rules section stops at AD-8 — no AD-9 block with Binds/Prevents/Rule was ever written, even though the memlog records the underlying decision as fully settled ("Benchmark/regression validation suite... lives as an automated Vitest suite against engine/, run in CI — not a UI-facing feature"). This is functionally a missing AD masquerading as a real one via forward-reference — a story author searching for AD-9's Rule will find nothing.

**Fix:** Either promote this to a real AD-9 (Binds: `engine/`, CI config; Prevents: regression suite living as an ad-hoc/manual check that silently stops running; Rule: the suite runs in CI against `engine/`, gating merge), or strip every "(AD-9)" cross-reference and fold the one true decision (lives in CI) into the existing Deferred bullet, which currently only defers *sizing/ownership*, not the CI-suite fact itself.

### H-2. AD-2's Rule contradicts the spine's own Consistency Conventions table

Consistency Conventions states: "Glossary terms (Node, Element, Support, Load, Structure Type, ... **Material**, Cross-Section, Reaction, Project) are used verbatim in code identifiers wherever the concept appears — no synonyms." AD-2's Rule then names the canonical type **`MaterialKind`** — matching neither the glossary term ("Material"), nor either brownfield declaration (`Material` in `engine/types.ts`, `MaterialType` in `engine/constants.ts`). It's a fourth naming variant introduced with no stated rationale, inside the one AD whose entire purpose is ending exactly this kind of drift.

This is also inconsistent with how AD-2 treats `Support`: there, the canonical name correctly converges on the glossary term itself ("Support," not `StructuralSupport` or `SupportType`). Material gets the opposite treatment for no explained reason. A story author cannot tell from this document whether `Material` or `MaterialKind` is actually the type to import.

**Fix:** Either rename the canonical type to `Material` (matching the glossary and the Consistency Conventions rule, and requiring `constants.ts`'s `MaterialType` to be retired instead), or explicitly justify `MaterialKind` as intentionally distinct from a future richer `Material` interface — but the conflict with the Consistency Conventions table must be resolved one way or the other, not left standing.

### H-3. Where Solve actually executes (client vs. Server Action) is left ambiguous on the hot path

PRD Constraints and Guardrails flags: "`[ASSUMPTION]` The solver is expected to run client-side (consistent with `mathjs` already in the stack), keeping backend cost limited to auth and Project storage rather than compute. Confirm at architecture time." This is a direct, named ask.

AD-1 only says the domain core is "safe to run identically client-side or in a Server Action," and the Design Paradigm diagram draws both `STATE --> DOMAIN` and `ACTIONS --> DOMAIN` as equally legal edges. Nothing in the spine commits to *which* of these implements the actual interactive "click Solve" path that FR-10's <1s performance NFR and the cost guardrail both bear on. Leaving both arrows legal is fine as a statement about the domain core's portability (that's a legitimate AD-1 property) — but it isn't a substitute for deciding where the hot-path call site actually lives, which the PRD asked this document to settle.

**Fix:** Add a sentence (or a short AD) stating FR-10's interactive Solve is invoked client-side directly against `engine/`, and a Server Action re-running `solve()` server-side is reserved for save-time verification / Show-Steps-on-load (if that's even needed) — or whatever the actual intended split is. Silence here is the one deployment/environment-adjacent dimension not actually settled despite being explicitly requested.

---

## Medium

### M-1. Deferred "Anonymous canvas use before sign-in" contradicts AD-6 and the UX flow

The Deferred section lists this as still open ("PRD/UX both leave this open... doesn't design an anonymous-session path"), but AD-6's Rule already states "Clerk middleware is the only gate for **signed-in routes (Canvas Workspace**, Projects Dashboard)" — explicitly categorizing Canvas Workspace as sign-in-gated. `EXPERIENCE.md`'s own flow table only reaches Canvas Workspace via the Projects Dashboard, itself "post-login landing." Both of these already answer the question (no anonymous canvas use) — the Deferred bullet's framing as an open question is inconsistent with a Rule sitting one section above it in the same document.

**Fix:** Either remove the Deferred bullet (the question is already decided by AD-6) or rephrase it to state the decision plainly and defer only the "what if we add it post-MVP" question.

### M-2. Cross-Section's in-session representation on `StructuralElement` is unaddressed

AD-8 fixes catalog *storage* (static module) and AD-5 fixes *persistence* (resolved values snapshotted into JSONB at save time), but no AD says how an Element records, in-session, "this came from catalog entry W12x26" vs. "this is a manual override" — needed for FR-7's behavior ("selecting a new catalog Cross-Section... replaces the override") and for AD-5's own "resolved and written into JSONB at save time" to have something concrete to resolve *from*. The brownfield `StructuralElement` only has flat `crossSectionArea`/`inertia` numbers today with no catalog-reference field. This is a real construction question, distinct from the "which sections ship" sourcing question that actually is in Deferred.

**Fix:** A short line in AD-8 or AD-5 on the Element-level shape (e.g., a tagged union of catalog-reference vs. manual-override) would close this.

### M-3. Stack table hedges on the Neon driver where the memlog already decided

Stack table: "Neon Postgres | via `@neondatabase/serverless` or `pg` (node-postgres) on Vercel Fluid Compute." The memlog is decisive: "node-postgres driver via Vercel Fluid Compute per neon-postgres skill's own Vercel recommendation." Presenting both as live options in the document meant to prevent divergence risks exactly the divergence it exists to prevent (one Server Action file importing `@neondatabase/serverless`, another importing `pg`).

**Fix:** Collapse to the single decided driver (`pg` / node-postgres) in the Stack table.

### M-4. `StructuralNode.mz` ambiguity, named explicitly in the addendum, isn't mentioned

The addendum calls this out as a specific brownfield loose end for "architecture/PM" to resolve: keep reserved/unused, repurpose, or remove. It doesn't appear anywhere in the spine (folds into C-1's broader Load-model gap, but is worth naming individually since it was called out individually).

---

## Low

### L-1. "Latest stable" pins for KaTeX and Drizzle/drizzle-kit understate what was actually verified

The memlog records KaTeX as "verified current via web search 2026-08-30" — if a version was actually observed, the Stack table should carry it rather than "latest stable," which two different epics could resolve to two different actual npm versions months apart.

### L-2. AD-2's constants.ts rule is normative/future-tense rather than naming the current violation

"`engine/constants.ts`... never redeclares a type `types.ts` already owns" is correct as a target-state rule, but the current `constants.ts` already violates it (`export type StructureType = keyof typeof STRUCTURE_TYPES`). Stating this explicitly ("delete the existing redeclaration in constants.ts") would remove any inference burden from the first story that touches this file.

---

## What's solid (no action needed)

- AD-1, AD-4, AD-5, AD-6, AD-7, AD-8: each has a real Binds/Prevents/Rule, each Rule is concrete and mechanically checkable (import restrictions, schema shape, gating logic, dependency absence), no duplicate ids, no placeholders.
- AD-2 correctly resolves the HINGE-vs-PINNED value conflict per the memlog/PRD (the Support-naming half of AD-2 is done right — see H-2 for the Material half).
- Stack table versions otherwise match `package.json` exactly (Next.js, React/react-dom, TypeScript, zustand, mathjs, r3f, drei, three, Tailwind) and Clerk's "v7 (Core 3)" matches what the memlog records as verified.
- Deployment & Environments section is genuinely decided, not silent: platform/runtime, environment model, DB branching strategy, env-var provisioning, and an explicit, justified "no separate ops layer" call.
- The dependency-direction mermaid diagram is syntactically valid and encodes a real, enforceable constraint (one-way dependency into `engine/`), not a decorative picture.
- The [ASSUMPTION] on r3f/WebGL vs. SVG for the canvas correctly anticipates and flags the exact tension `DESIGN.md`'s hairline/dashed-stroke requirements could create in a WebGL renderer — good calibrated risk-flagging, not a gap.
- Touch-gesture and 3D-rendering Deferred items are correctly scoped and don't hide a real divergence risk at this altitude.

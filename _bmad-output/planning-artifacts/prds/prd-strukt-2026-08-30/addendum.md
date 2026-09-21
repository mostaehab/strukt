# Addendum: strukt PRD

Depth that informed the PRD but doesn't belong in its main narrative. Not authoritative on its own — read alongside `prd.md`.

## Competitive Landscape (full digest)

Researched 2026-08-30 via web fan-out, grounding the Vision (§1) and Monetization (§ Monetization) sections. **Methodology caveat** (surfaced by adversarial review): this is same-day desk research — pricing pages, comparison sites, forum threads — not user interviews, click-through testing, or willingness-to-pay/switch data. It establishes that the competitive conjunction (free + canvas UI + browser-native DSM + teaching-oriented) is genuinely unclaimed; it does not establish that users actually choose tools along that conjunction, or that any single axis is load-bearing for the JTBDs in §2.1. Treat the Vision's positioning claims as a validated *gap*, not a validated *thesis* — real user validation is still outstanding.

**Professional desktop tools:**
- **SAP2000 / ETABS** (CSI) — desktop, paid (~$1000s), professional-grade FEA. SAP2000 is relatively more beginner-friendly than peers; ETABS is more building/lateral-force specific.
- **STAAD.Pro** (Bentley) — desktop, paid (~$5,600/license), professional. Frequently criticized for a "frozen in time" GUI and steep learning curve.
- **RISA-3D** — desktop, paid (~$1,000/yr), professional. Easier to pick up than STAAD, but pricing "has gotten absurd" per user complaints.

**Browser-based paid tools:**
- **SkyCiv** (Structural 3D / Beam / Truss / Frame) — 100% browser-based, freemium. Free tier capped at 5 elements / 2 supports / 3 loads — too tight for real coursework. Student plan $19.99/mo; Pro $49.95–$190/mo; Enterprise. The only competitor with a deliberate student program (discounted subscription + institutional licenses).
- **ClearCalcs** — browser-based, paid (from $79/mo). Emphasizes transparent calc reports over raw modeling power; targets working engineers, not students.

**Free / code-first tools:**
- **OpenSees / OpenSeesPy, Frame3DD** — free, open-source, script/text-file input, no visual canvas. Used in research/academia; not approachable for undergrads without a coding background.
- **Free browser calculators** (StructureCalcs, Beamsolver, Optimal Beam, STRIAN, Truzme, BeamGuru, CivilCalc, FEA-Apps, EasyCiv) — no-signup, in-browser beam/truss/frame solvers producing SFD/BMD/NFD. Built for quick homework-style checks, not a full modeling workflow.
- **Stabileo** (lambdaclass, open-source, WASM in-browser) — closest direct technical analog: 2D & 3D structural analysis in the browser via the Direct Stiffness Method, real-time solving, no install. Worth studying its technical approach directly; does not appear to have a Figma-style canvas UX.

**The gap strukt targets:** nobody combines (a) genuinely free-during-MVP access for students, (b) a modern, direct-manipulation canvas UI, and (c) a browser-native Direct Stiffness Method engine with teaching-oriented UX. SkyCiv is closest on positioning but fails (a) — and notably already has a funded, revenue-backed student program, meaning strukt's edge over the one competitor already serious about students is price and UI polish, not an unaddressed insight. Stabileo is closest on architecture (also browser-native DSM) but doesn't appear to compete on UX or positioning — though as an open-source project with the hard technical part already solved, it is one fork away from closing that gap too.

Sources: SkyCiv pricing/student page, SkyCiv vs. ClearCalcs comparison, StructureCalcs, STAAD/RISA/SAP2000 pricing discussion threads, Frame3DD, Stabileo (GitHub), SkyCiv free-tier limit writeups, FEA-Apps/EasyCiv.

## "Show your work" pedagogical mode — reconsidered into MVP

During Discovery, a real differentiator surfaced: exposing the stiffness-method computation itself (DOF assembly, local/global stiffness matrices, the solve steps) as an optional teaching view, rather than just returning final diagrams. This would be a genuine point of difference — none of the researched competitors expose their solve mechanics to the user.

Initially deferred post-MVP, since it meaningfully increases scope (UI for matrix visualization, narrating the solve steps in a readable way, deciding how much detail is pedagogically useful vs. overwhelming) at a moment when the core draw → load → solve → view-diagrams loop didn't exist yet at all. The user then explicitly reversed this: the teaching value of showing real equations to students outweighs the added MVP scope. Now specified as PRD §4.7 (FR-16–FR-19), opt-in via a "Show Steps" toggle so the fast path (UJ-1) is unaffected.

**Technical-how, not decided in the PRD:** this requires `engine/stiffness.ts`'s solver to return intermediate computation data (per-Element local stiffness matrices, the local→global DOF mapping, the boundary-condition-reduced system) as part of its output, not just final results — a materially different function signature than the current empty stubs would suggest. Equation/matrix typesetting in the UI (e.g. KaTeX vs. MathJax vs. a custom renderer) is left for architecture to decide (§8 Open Question 2).

**Pedagogy-consistency risk (surfaced by adversarial review):** the Vision's opening line presents Beam as a first-class structure choice alongside Truss and Frame, but the data model treats Beam as a UI-level constraint over Frame (FR-2). Show Your Work derives from the underlying Frame stiffness matrices — whoever builds the Show Steps UI must make sure a student who explicitly picked "Beam" isn't shown unexplained "Frame" terminology/matrices, which would undercut trust in a feature whose entire premise is transparency. Flagged as a `[NOTE FOR PM]` on FR-2 in the PRD; resolve at UX time.

## Existing codebase — technical notes for architecture handoff

The codebase already has a partial data model and store, reviewed 2026-08-30:

- `engine/types.ts` defines `StructureType` ("TRUSS" | "FRAME"), `StructuralNode` (id, x, y, support, fx, fy, mz), `StructuralElement` (id, material, startNode, endNode, crossSectionArea, inertia), and result shapes (`NodeResult`, `ElementResult`, `AnalysisResults`).
- `engine/constants.ts` defines `MATERIALS` (STEEL, CONCRETE with E values), `SUPPORTS` (FIXED, HINGE, ROLLER, FREE with DOF-restraint flags), and `DOFS` (TRUSS: 2, FRAME: 3).
- **Naming inconsistency, unreconciled — three instances of the same root cause**: `constants.ts` and `types.ts` were authored independently over the same domain and disagree in three places:
  1. `engine/types.ts`'s `StructuralSupport` union uses `"PINNED"`, while `engine/constants.ts`'s `SUPPORTS` object key uses `"HINGE"`. The user's own vocabulary during Discovery was "Hinged supports," and the PRD (FR-4) settles the *UI label* as "Hinged" — but does not commit to the internal enum key. Reconciliation pass at architecture time still needs to pick `HINGE` or `PINNED` as the canonical key (confirmed by input reconciliation 2026-08-30 that this was only half-decided).
  2. `StructureType` is independently declared in both `types.ts` (a literal union) and `constants.ts` (`keyof typeof STRUCTURE_TYPES`) — two separate types that happen to resolve identically today but could silently diverge.
  3. `Material` (types.ts) vs `MaterialType` (constants.ts) — two different names for the same concept, no shared source of truth.

  Recommend architecture reconcile all three in one pass, not just the Support naming.

- **`StructuralNode.mz` pre-empts the FR-9 Out-of-Scope claim**: the existing type already carries `fx`, `fy`, *and* `mz` on every Node — i.e. a data-model slot for an applied moment already exists, even though PRD §4.4 explicitly defers applied moment loads post-MVP. Architecture/PM should explicitly decide whether `mz` (a) stays reserved/unused in v1, (b) is actually meant as a reaction-moment slot misplaced on the input side (reactions already have their own `rmz` in `NodeResult`), or (c) should be removed/renamed to avoid an accidental scope leak into a feature the PRD deliberately excluded.
- `engine/stiffness.ts` currently has two stub functions with empty bodies: `getLocalStiffnessMatrix()` and `getGlobalStiffnessMatrix()`. No solver logic exists yet — FR-10/FR-11 are greenfield work, and their signatures will need to change materially to return the intermediate data Show Your Work (FR-17–FR-19) needs (per below).
- `store/useStructureStore.ts` is a working zustand store implementing most of the CRUD operations the data model implies (add/update/delete Node and Element, set Structure Type, set analysis results, clear all) — a real head start on FR-1 through FR-3's state needs, but **not complete**: `deleteNode` does not cascade-delete attached Elements, so FR-3's testable consequence ("deleting a Node also removes any Elements attached to it, with a confirmation prompt") is not yet satisfied by the store as written. This is expected greenfield work at build time, not a documentation error — flagged here so it isn't assumed already-done.
- `components/canvas/`, `components/panels/`, `components/ui/`, and `utils/` all exist as empty directories — no UI has been built yet.
- `app/` is still the default Next.js scaffold (unedited `page.tsx`/`layout.tsx`).
- **Process note**: as of 2026-08-30, `engine/types.ts` and `engine/stiffness.ts` are uncommitted working-tree modifications on this branch (both were empty blobs at the last commit), and `store/` is untracked/new. The code this PRD builds on is real and on disk, but not yet committed — worth committing before any branch switch or rebase touches this area, so it isn't silently lost.

Net: the project has a real head start on the data model (aligned with most of §3 Glossary and §4.1–4.2 FRs) but zero solver logic and zero UI, and the store's FR-3 coverage is partial. Architecture should treat `engine/types.ts` and `store/useStructureStore.ts` as a starting point to extend and fix (adding `Load` and `CrossSection`/catalog entities, a `unitSystem` field, `Project`/account-related state, and the missing cascade-delete), not a green field and not a finished foundation.

## Section-catalog sourcing (FR-6) — technical-how, standard already decided

The catalog standard is decided in FR-6 (PRD §4.3). What's still technical-how: a catalog implies *sourcing* real section-property data, not just naming a standard — where that data comes from (a licensed dataset, a hand-curated subset, a public-domain table) and how much of each standard's full range v1 ships. Left for whoever picks this up at architecture/epics time to size.

## Benchmark validation suite — ownership and sizing undefined (surfaced by adversarial review)

FR-11's Feature-specific NFR and SM-4 both require passing "a maintained regression suite of known textbook/benchmark problems" at ≤0.1%/100%, but nothing in the PRD states the suite's size, who authors/curates it, or how it's kept current as FRs change. A 100%-pass target against an unsized, unowned suite risks becoming a metric that can't fail by construction. Recommend architecture or epics assign an owner and a minimum problem count (e.g. covering each Structure Type × Support combination in UJ-1's spirit: simply supported beam, cantilever, portal frame, simple truss, at minimum) when this is picked up.

## Known edge cases — deferred to UX/architecture, not PRD-level decisions

Surfaced by edge-case review 2026-08-30. These are real gaps, but the specific behavior chosen doesn't change what any FR promises at the capability level — they're UI/implementation decisions for `bmad-ux` or architecture to resolve, not PRD content. Listed here so none are silently lost:

- **Unit switching (FR-20) mid-edit of an uncommitted input field** — does an in-progress, not-yet-submitted keystroke buffer convert, get discarded, or show stale-unit text next to a new unit label?
- **Working on the canvas before signing in (FR-1 vs. FR-21)** — is drawing allowed anonymously at all, and if so, does triggering sign-in to Save (FR-22) preserve the in-progress canvas across the auth redirect, or discard it?
- **Cross-Section catalog value corrected/updated after a Project was saved using the old value (FR-6/FR-22)** — does a Project snapshot the resolved numeric Area/Inertia at save time (reproducible, but can silently diverge from a "live" catalog), or reference the catalog live (reproducible against the catalog, but can silently change a previously-solved Project's results on reopen)? This is a real trust/correctness trade-off, not a cosmetic one — whoever resolves it should read this note first.

# Input Reconciliation: Existing Codebase

Input: "existing codebase" (engine/types.ts, engine/constants.ts, engine/stiffness.ts, store/useStructureStore.ts, app/page.tsx, app/layout.tsx, components/, utils/, package.json), reconciled against `prd.md` and `addendum.md` (both dated 2026-08-30).

## Method

Read prd.md and addendum.md in full, then read every file the PRD/addendum claim to describe, plus globbed `components/**/*` and `utils/**/*` and checked `git status`/`git diff` to see whether the reviewed content is stable.

## 1. Glossary / data-model match — mostly holds, two undocumented drifts found

Confirmed matches:
- `StructureType` = "TRUSS" | "FRAME" — matches §3 Glossary.
- `StructuralNode` (id, x, y, support, fx, fy, mz) and `StructuralElement` (id, material, startNode, endNode, crossSectionArea, inertia) — matches Node/Element Glossary entries.
- `SUPPORTS` in constants.ts (FIXED, HINGE, ROLLER, FREE with u_x/u_y/theta_z restraint flags) — matches the four Support types and DOF-restraint semantics in §3.
- `MATERIALS` (STEEL E=2e11, CONCRETE E=2.5e7) — matches "Steel, Concrete" Material glossary entry.
- `DOFS` (TRUSS: 2, FRAME: 3) — matches the DOF Glossary entry exactly.
- `engine/stiffness.ts` still has exactly two empty-body stub functions (`getLocalStiffnessMatrix`, `getGlobalStiffnessMatrix`), importing from constants.ts but not referencing any types.ts types — confirms addendum's "greenfield, no solver logic exists yet" claim for FR-10/FR-11.

Undocumented drift #1 — `StructuralNode.mz` already models an applied moment, which pre-empts an Out-of-Scope claim:
`StructuralNode` carries `fx`, `fy`, `mz` fields alongside `support`. `fx`/`fy` read naturally as concentrated-load components (FR-8), but `mz` is then the applied-moment counterpart — i.e., the data model already has a field for an applied moment at a Node. This sits in tension with PRD §4.4's explicit Out-of-Scope line: "applied moment loads... deferred post-MVP." Neither the PRD nor the addendum's "existing codebase" notes mention this field or flag the tension. Architecture/PM should explicitly decide whether `mz` is (a) reserved for a future applied-moment-load feature and should stay unused in v1, (b) actually a reaction-moment slot that's misplaced on the input side of the model (reactions already have their own `rmz` in `NodeResult`), or (c) needs removing/renaming to avoid an accidental scope leak.

Undocumented drift #2 — duplicate/inconsistent type definitions beyond the flagged PINNED/HINGE mismatch:
- `StructureType` is independently defined in **both** `engine/types.ts` (`"TRUSS" | "FRAME"` literal union) and `engine/constants.ts` (`keyof typeof STRUCTURE_TYPES`) — two separate declarations of the same name that happen to resolve to the same values today, but aren't the same type and could silently diverge.
- `Material` (types.ts) vs `MaterialType` (constants.ts) — two differently-named types for the same concept, with no re-export/aliasing between the two files.

The addendum's "Naming mismatch, unreconciled" section calls out only the PINNED/HINGE case; it does not mention either of these. Recommend architecture's reconciliation pass cover all three (PINNED/HINGE, duplicate StructureType, Material/MaterialType) in one pass since they're the same root cause (constants.ts and types.ts were authored independently over the same domain).

## 2. components/canvas, components/panels, utils — confirmed empty, but inventory is incomplete

`Glob` and directory listing confirm `components/canvas/` and `components/panels/` contain 0 files, and `utils/` contains 0 files — the addendum's "no UI has been built yet" claim holds.

One gap: `components/` also contains a third subdirectory, `components/ui/`, which the addendum's enumeration ("components/canvas/, components/panels/, and utils/ exist as empty directories") does not mention. It is also empty (0 files), so the "no UI yet" conclusion is unaffected — but the addendum's file inventory is incomplete and should list all three subdirectories if it's going to enumerate them at all.

## 3. package.json — matches PRD assumptions exactly

Dependencies: `@react-three/drei`, `@react-three/fiber`, `mathjs`, `next` (16.2.6), `react`/`react-dom` (19.2.4), `three` (^0.184.0), `zustand`. Dev: tailwindcss, typescript, eslint, standard Next.js types.

- No auth library present — matches PRD §8 Open Question 1 (auth vendor undecided) and FR-21's `[ASSUMPTION]`.
- No math-typesetting library (no KaTeX, no MathJax, nothing else) — matches PRD §8 Open Question 2 (Show Steps typesetting choice deferred to architecture).
- `three` + `@react-three/fiber` + `@react-three/drei` all present — matches §6.2's "3D structures... three.js already a dependency, groundwork exists" claim exactly.
- `mathjs` present — matches the Cost Constraint's `[ASSUMPTION]` that the solver is expected to run client-side "(consistent with mathjs already in the stack)."
- `zustand` present — matches store implementation already in place.

No contradiction found here; PRD's dependency assumptions all hold.

## 4. Other findings not accounted for in Features (§4) / contradicting an FR

- **`store/useStructureStore.ts`'s `deleteNode` does not cascade-delete attached Elements.** It only filters `state.nodes`, leaving any `StructuralElement` whose `startNode`/`endNode` pointed at the deleted node as a dangling reference. FR-3's explicit testable consequence is "Deleting a Node also removes any Elements attached to it (with a confirmation prompt)." The addendum's claim that "this store shape already covers most of FR-1 through FR-3's state needs" overstates coverage on this specific point — the cascade-delete behavior (and the confirmation-prompt UX) does not exist yet at the store layer.
- `AnalysisResults`'s `NodeResult`/`ElementResult` shapes carry only final numeric outputs (ux/uy/theta_z/rx/ry/rmz; axialForce/shearForce/bendingMoment/stress) — no fields for per-Element local stiffness matrices, DOF mapping, or the boundary-condition-reduced system that FR-17–FR-19 (Show Your Work) need. This is already correctly flagged by the addendum ("a materially different function signature than the current empty stubs would suggest") — confirmed still accurate, no drift here.
- `app/page.tsx` and `app/layout.tsx` are confirmed still the unedited `create-next-app` scaffold (Next.js/Vercel starter content, default "Create Next App" metadata) — matches the addendum's claim exactly.

## 5. PINNED vs HINGE naming mismatch — confirmed still present

`engine/types.ts` line 3: `export type StructuralSupport = "FIXED" | "PINNED" | "ROLLER" | "FREE";`
`engine/constants.ts` line 21: the `SUPPORTS` object key is `HINGE` (`id: 'hinge'`).

The mismatch the addendum describes is real and unchanged. Note the addendum's own recommendation text is internally inconsistent about *which* term to standardize on: its analysis paragraph says "Recommend reconciling toward `HINGE`/'Hinged' terminology," while the PRD proper (FR-4's note) says "reconcile toward 'Hinged'" without committing to whether the code-level enum key becomes `HINGE` or stays `PINNED` with only the UI label changed to "Hinged." Both documents agree on the user-facing label ("Hinged," not "Pinned") but architecture will still need to pick one of `HINGE` or `PINNED` as the canonical internal enum key in `types.ts` — this PRD reconciliation surfaces that the "recommendation" is really only half-decided (label yes, internal key TBD).

## Process note (not a content gap)

`git status`/`git diff` show `engine/types.ts` and `engine/stiffness.ts` are currently *uncommitted* working-tree modifications (both were empty blobs at the last commit on this branch), and `store/` is untracked/new. This doesn't change any of the findings above — the content reviewed is exactly what's on disk today — but it means the "existing codebase" the PRD describes as already-reviewed prior art is not yet committed to this branch's git history. Worth flagging so a future `git status` / rebase / branch switch doesn't silently drop it.

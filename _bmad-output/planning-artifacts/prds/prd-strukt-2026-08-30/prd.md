---
title: strukt PRD
status: final
created: 2026-08-30
updated: 2026-08-30
---

# PRD: strukt
*Working title — confirm.*

## 0. Document Purpose

This PRD defines strukt v1 for Mostafa (product owner) and the downstream workflow owners who build directly from it — UX design (`bmad-ux`), architecture (`bmad-architecture`), and epics/stories breakdown (`bmad-create-epics-and-stories`). Vocabulary is Glossary-anchored (§3); Features (§4) group behavior with globally numbered Functional Requirements (FR-1 through FR-N) nested beneath each; inline `[ASSUMPTION]` tags mark inferred decisions, indexed in §9 for confirmation. No prior product-brief, UX, or architecture docs exist — this is the first planning artifact for the project, building on an existing (mostly stubbed) codebase noted throughout.

## 1. Vision

strukt is a browser-based structural analysis tool built specifically for civil engineering students learning the direct stiffness method — and, secondarily, for engineers who want a fast, no-friction way to run a quick 2D check. A user draws a beam, frame, or truss directly on a canvas, assigns supports and material/section properties, applies concentrated or uniformly distributed loads, and gets an instant Bending Moment Diagram (BMD), Shear Force Diagram (SFD), and Normal Force Diagram (NFD) — with reactions — as soon as they click Solve.

The structural-analysis software market splits between expensive, dated professional tools (SAP2000, ETABS, STAAD.Pro, RISA-3D) that price out and intimidate students, and free tools that are either code-first and inaccessible (OpenSees, Frame3DD) or bare-bones homework calculators with no real modeling workflow. Only SkyCiv seriously courts students, and its free tier is capped too tightly for real coursework (5 elements / 2 supports / 3 loads). Nobody combines a genuinely free-during-MVP, student-first offering with a modern, direct-manipulation canvas UI in the spirit of Figma — and none of them show the actual stiffness-method equations behind a result. strukt fills that gap: free during its MVP phase (§ Monetization), modern, and genuinely teaching-oriented, not just another calculator.

strukt is explicitly a **learning tool**, not a substitute for licensed professional engineering judgment — it will never claim to produce stamped or certified design output. Its bar for success is that a student trusts its diagrams enough to check their own hand calculations against it.

## 2. Target User

### 2.1 Jobs To Be Done

- When I'm working through a structural analysis homework problem, I want to build the same structure visually and get instant, correct diagrams, so I can check my hand calculations without fighting unfriendly software.
- When I'm learning the stiffness method for the first time, I want a tool that doesn't assume professional CAD-like fluency, so I can focus on the structural concepts, not the software.
- When I get a result, I want to see the actual equations and numbers behind it, so I understand *why* the answer is what it is, not just what it is.
- When I want to refresh my own understanding or sanity-check my intuition on a quick 2D idea, I want a fast, free tool, so I don't need to open a full professional package for it. *(secondary: engineer persona — explicitly informal, personal-use checking only, never a check that informs a real deliverable, client conversation, or professional judgment call; see § Constraints and Guardrails, Safety.)*

### 2.2 Non-Users (v1)

- Practicing engineers needing stamped/certified deliverables for real, liability-bearing projects.
- Anyone needing 3D, dynamic/seismic/time-dependent, or code-checking (member design against AISC/ACI etc.) analysis.
- Anyone needing structures beyond classroom scale (~50 nodes/elements) with guaranteed performance.

### 2.3 Key User Journeys

- **UJ-1. Sara checks her simply-supported beam homework.**
  - **Persona + context:** Sara, a civil engineering student working through a structural analysis homework problem on simply supported beams.
  - **Entry state:** Signed in, on the main canvas workspace, starting a new project.
  - **Path:** She draws an 8m beam using snap-to-grid. She opens the supports dropdown on each end node and sets both to **Hinged**. She opens the Loads menu, selects **Concentrated Load**, and places three 5kN point loads along the beam. She clicks **Solve**.
  - **Climax:** The engine solves instantly and renders the BMD, SFD, and NFD alongside the support reactions — Sara can immediately compare peak values against her hand calculation.
  - **Resolution:** She trusts the result (or spots a mismatch and goes back to check her own math or her model), then saves the Project to her account so she can reopen it before her next study session. Realizes FR-22.
  - **Edge case:** If Sara's structure were actually unstable (e.g. she'd set a support to Free), strukt blocks solving with a specific, actionable error rather than showing a wrong or crashed result. Realizes FR-11.

## 3. Glossary

- **Node** — a discrete point in the structure's geometry where Elements connect, Loads may be applied, and a Support may be assigned. Has coordinates (x, y) and degrees of freedom depending on Structure Type.
- **Element** — a straight structural member connecting two Nodes (start, end), carrying a Material and Cross-Section.
- **Degree of Freedom (DOF)** — an independent direction of possible nodal displacement (translation or rotation) the solver solves for. Truss Nodes have 2 DOF (translation x, y); Frame Nodes have 3 DOF (translation x, y, rotation z).
- **Support** — a boundary condition assigned to a Node, constraining some or all of its DOF. Types: **Fixed** (all DOF restrained), **Hinged** (translations restrained, rotation free), **Roller** (one translation restrained), **Free** (no restraint).
- **Direct Stiffness Method** — the matrix structural analysis method strukt's engine uses to solve for nodal displacements/rotations and internal forces given geometry, Material/Cross-Section, Supports, and Loads.
- **Load** — an applied force on the structure. v1 types: **Concentrated Load** (a single point force at a Node), **Uniformly Distributed Load (UDL)** (constant-intensity force along an Element's length).
- **Structure Type** — **Truss** (Elements carry axial force only) or **Frame** (Elements carry axial, shear, and bending). **Beam** is a Frame whose Nodes are collinear/horizontal — not a distinct Structure Type in the data model.
- **BMD (Bending Moment Diagram)** — plot of internal bending moment along each Element.
- **SFD (Shear Force Diagram)** — plot of internal shear force along each Element.
- **NFD (Normal/Axial Force Diagram)** — plot of internal axial force along each Element.
- **Material** — physical property set (elastic modulus E) assigned to an Element. v1: Steel, Concrete.
- **Cross-Section** — geometric property set (area, moment of inertia) assigned to an Element, chosen from a catalog or entered manually.
- **Reaction** — the force/moment the solver computes at a supported Node, balancing applied Loads.
- **Project** — a saved structure (all Nodes, Elements, Supports, Loads, Materials, Cross-Sections, and unit system) tied to a user account.

## 4. Features

### 4.1 Structure Modeling & Drawing Canvas

**Description:** The core canvas where a user builds a structure by placing Nodes and connecting them with Elements, using snap-to-grid for precision. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Draw a structure on a snap-to-grid canvas

User can place Nodes and connect them with Elements on a snap-to-grid canvas. Realizes UJ-1.

**Consequences (testable):**
- Placed Nodes snap to the nearest grid point.
- An Element can only connect two existing Nodes.
- An Element cannot connect a Node to itself, or to another Node at identical coordinates — the canvas blocks or merges these (not left to the solver to fail on as a divide-by-zero on a zero-length Element).
- Drawing, selecting, and editing all work via touch input on a tablet, not just mouse — tablet support is required for v1, not merely tolerated. `[NOTE FOR PM: this is real added scope for canvas interaction design — touch-friendly hit targets, gesture handling for pan/zoom, and a properties panel layout that works without hover states.]`

#### FR-2: Choose a Structure Type

User can choose a Structure Type — Truss or Frame — for the project. Beam is offered as a Frame preset/template that constrains drawing to a single horizontal line of Nodes. `[ASSUMPTION: Beam is a UI-level preset over Frame, not a new data model entity — confirm this doesn't need dedicated Beam affordances beyond the constrained drawing template.]`

**Consequences (testable):**
- Selecting "Beam" constrains new Nodes to one horizontal line; underlying Structure Type stored is Frame. `[NOTE FOR PM: Show Steps (§4.7) must stay understandable to a student who picked "Beam" even though the underlying matrices are Frame matrices — a pedagogy-consistency risk detailed in addendum.md, resolve at UX time.]`
- Selecting "Truss" restricts Elements to axial-only behavior in the solver (FR-10); Cross-Section's moment-of-inertia field (FR-6/FR-7) is not shown for Truss Elements, since the solver never uses it — no dead input the user might mistake for meaningful.
- Switching Structure Type (Truss ↔ Frame) after Elements/Supports/Loads already exist is blocked with a warning rather than silently carrying over now-partially-meaningless data (e.g. a Truss Element with no Inertia value becoming a Frame Element that needs one).

#### FR-3: Edit and delete Nodes and Elements

User can select, move, and delete previously placed Nodes and Elements.

**Consequences (testable):**
- Deleting a Node also removes any Elements attached to it (with a confirmation prompt).

### 4.2 Supports

**Description:** Assigning boundary conditions to Nodes. Realizes UJ-1.

#### FR-4: Assign a Support to a Node

User can assign a Support — Fixed, Hinged, Roller, or Free — to any Node via a dropdown menu. Realizes UJ-1.

**Consequences (testable):**
- Every Node defaults to Free until a Support is explicitly assigned.
- The dropdown label reads "Hinged" (not "Pinned") to match the vocabulary engineers/students actually use. `[NOTE FOR PM: existing engine/types.ts uses "PINNED" while engine/constants.ts uses "HINGE" — reconcile toward "Hinged" at architecture time.]`

### 4.3 Material & Cross-Section Properties

**Description:** Assigning physical properties to Elements, via catalog for approachability, with manual override for precision.

#### FR-5: Assign a Material to an Element

User can assign a Material — Steel or Concrete — to an Element.

**Consequences (testable):**
- An Element with no Material assigned blocks Solving (FR-10) with a specific validation error, rather than defaulting silently to one Material.
- Changing an Element's Material after a catalog Cross-Section (FR-6) was already chosen for it clears that Cross-Section selection — a Steel W-shape cannot remain attached to a Concrete Element.

#### FR-6: Choose a Cross-Section from a catalog

User can choose a Cross-Section for an Element from a standard catalog (e.g. steel W-shapes, rectangular concrete sections), auto-filling cross-sectional area and moment of inertia.

**Consequences (testable):**
- The catalog covers AISC W-shapes (steel) and basic rectangular/circular sections (concrete) — this is v1's full catalog scope, decided.
- AISC W-shapes are natively Imperial; the catalog converts cleanly into an SI-unit Project (FR-20) rather than showing a raw, awkward conversion. The converted value may no longer match the exact number in a US Imperial textbook table, though — the Correctness NFR's ≤0.1% tolerance must account for this conversion step, not just numerical solve accuracy.

**Out of Scope:**
- A comprehensive multi-country/multi-standard section catalog beyond AISC W-shapes and basic concrete shapes.

#### FR-7: Manually override Cross-Section properties

User can manually override the auto-filled area and/or moment of inertia for an Element.

**Consequences (testable):**
- Manually overridden area and inertia must be positive numbers; Solving (FR-10) is blocked with a validation error otherwise, rather than producing a singular/nonsensical result indistinguishable from a genuine instability.
- Selecting a new catalog Cross-Section after a manual override replaces the override with the catalog's values — the override never silently persists alongside a newly-displayed catalog shape name.

### 4.4 Loads

**Description:** Applying loads to the structure. Realizes UJ-1.

#### FR-8: Apply a Concentrated Load

User can apply a Concentrated Load to any Node, specifying magnitude and direction. Realizes UJ-1.

**Consequences (testable):**
- Direction is specified relative to a global coordinate system (not implicitly always-downward), and Show Steps (FR-17) reflects whatever convention is used. `[RESOLVED in architecture AD-10: positive x = rightward, positive y = upward.]`
- Multiple Concentrated Loads may be applied to the same Node; their effects sum rather than one overwriting another.

#### FR-9: Apply a Uniformly Distributed Load

User can apply a Uniformly Distributed Load (UDL) along any Element, specifying intensity.

**Consequences (testable):**
- Intensity and direction follow the same global-coordinate-system convention as Concentrated Loads (FR-8).
- Multiple UDLs may be applied to the same Element; their effects sum rather than one overwriting another.
- A point Load may also be applied along an Element at a stated distance from its start Node. This is not a duplicate of FR-8: on a Truss, moving the load onto a Node inserts a pin mid-member and turns it into a mechanism, so the load has no other representation. A station that no longer lies on its member (after the Node it measures from is moved) blocks the Solve by name rather than being silently clamped. `[AMENDED post-Epic-2 — see AD-10, AD-12.]`
- A Truss member carrying any of these is analyzed, not refused: it bends as a simply supported beam between its two pins while its joints stay moment-free. `[AMENDED post-Epic-2 — see AD-12.]`

**Out of Scope:**
- Trapezoidal/varying loads, applied moments, support settlements — see §6.2.

### 4.5 Structural Analysis Engine

**Description:** The solver: assembles the global stiffness matrix from the user's Nodes, Elements, Supports, and Loads, and solves via the Direct Stiffness Method. Realizes UJ-1.

#### FR-10: Solve the structure

System assembles the global stiffness matrix and solves for nodal displacements/rotations, Reactions, and internal Element forces via the Direct Stiffness Method, for the defined Truss or Frame structure. Realizes UJ-1.

**Consequences (testable):**
- Truss Elements are solved with 2 DOF/Node (axial only); Frame Elements with 3 DOF/Node (axial, shear, bending).
- Solve completes for a classroom-scale structure (~50 Nodes/Elements) in under 1 second, end-to-end including diagram render. Beyond ~50 Nodes/Elements, strukt does not block solving, but makes no performance or accuracy guarantee (§2.2 Non-Users) — it degrades rather than silently producing a wrong answer or crashing.
- The solver's output includes not just final results but every intermediate quantity Show Your Work (§4.7) needs to display: each Element's local stiffness matrix, the DOF mapping used for global assembly, and the boundary-condition-reduced system of equations. Realizes FR-17, FR-18, FR-19.
- Any structural edit (Node, Element, Support, Load, Material, or Cross-Section change) made after a Solve invalidates the displayed results (BMD/SFD/NFD, Reactions, and Show Steps) until the user solves again — stale results are never left visible against an edited structure. Realizes FR-16.

#### FR-11: Detect and block unstable structures

System detects a structurally unstable configuration (insufficient restraint; singular/near-singular global stiffness matrix) at or before solve time and blocks solving with a specific, actionable error message. Realizes UJ-1 edge case.

**Consequences (testable):**
- An unstable structure never returns a numeric result silently — the user always sees an explicit instability error, never a crash or garbage output.
- The error message identifies the specific Node(s) or region responsible where feasible (e.g. "Node N3 is unrestrained"), not just a generic "structure is unstable."
- If a Project contains multiple disconnected sub-structures (no shared Node), instability is checked per connected sub-structure; solving is blocked and the error identifies which sub-structure is unstable — an unstable "island" does not silently pass just because another island in the same Project is stable. `[NON-GOAL for MVP: solving the valid island independently while blocking only the unstable one — v1 blocks the whole Project's solve.]`
- A structure with zero Elements (only Nodes placed) is reported with a distinct "nothing to analyze yet" message, not the same wording as a geometric instability error.

**Feature-specific NFRs:**
- Solver correctness is validated against a maintained regression suite of known textbook/benchmark problems (e.g. simply supported beams, cantilevers, portal frames, simple trusses), matching known solutions within ≤0.1% relative error.

### 4.6 Results Visualization

**Description:** Rendering the solved structure's diagrams and reactions. Realizes UJ-1.

#### FR-12: Render the Bending Moment Diagram

System renders the BMD for a solved Frame/Beam structure. Realizes UJ-1.

**Consequences (testable):**
- The diagram labels the peak positive and peak negative moment values and their location along each Element.
- Rendering only occurs after a successful Solve (FR-10) with no blocking FR-11 error.
- The moment is drawn on the tension side — a sagging span below its member, a hogging joint above it — and the convention is stated on the drawing itself, not only in a document. `[RESOLVED in architecture AD-11; the review-rubric's "no stated sign convention" finding is closed by it.]`
- The diagram is plotted perpendicular to each member over the structure's real geometry, so a Frame reads as a Frame. `[AD-11.]`

#### FR-13: Render the Shear Force Diagram

System renders the SFD for a solved Frame/Beam structure. Realizes UJ-1.

**Consequences (testable):**
- The diagram labels the peak positive and peak negative shear values and their location along each Element.

#### FR-14: Render the Normal/Axial Force Diagram

System renders the NFD for a solved structure's Elements. Realizes UJ-1.

**Consequences (testable):**
- The diagram distinguishes tension from compression (e.g. sign or color), matching whatever convention Show Steps (FR-17) also uses.

#### FR-15: Display Reactions

System displays computed Reactions at every supported Node after solving. Realizes UJ-1.

**Consequences (testable):**
- Displayed Reactions satisfy global equilibrium with the applied Loads (within the ≤0.1% tolerance of the Correctness NFR) — an implicit, testable correctness signal, not just a UI requirement.

### 4.7 Show Your Work

**Description:** A key differentiator, not an afterthought (§1 Vision): an optional view revealing the actual stiffness-method equations behind a result, with the student's own numbers substituted in — not just the final diagrams. Off by default so the fast path (UJ-1) stays fast; one toggle away for whoever wants to learn from it.

#### FR-16: Toggle Show Steps

User can toggle a "Show Steps" view alongside the solved results.

**Consequences (testable):**
- Results (BMD/SFD/NFD/Reactions) are visible by default without toggling anything; Show Steps is opt-in, never forced.
- The toggle state is scoped to the current solve — reopening a Project defaults back to results-only.
- Show Steps is disabled (not just empty) until at least one successful Solve has occurred in the current session.
- If a subsequent Solve attempt is blocked by an FR-11 instability error, any previously-shown results and Show Steps content are cleared, not left visible — they described a structure that has since been edited into an unstable one.

#### FR-17: Show each Element's local stiffness matrix

Show Steps displays, per Element, the local stiffness matrix formula with that Element's actual material, cross-section, and geometry values substituted in — not just the resulting numeric matrix.

#### FR-18: Show global stiffness matrix assembly

Show Steps displays the DOF mapping from each Element's local stiffness matrix into the global stiffness matrix, and the assembled global matrix itself.

#### FR-19: Show the boundary-condition-reduced solve

Show Steps displays which DOFs were eliminated by Supports, the reduced system of equations actually solved, and how it yields the nodal displacements/rotations shown in the results.

**Feature-specific NFRs:**
- Whatever Show Steps displays must exactly match the values the solver actually used (FR-10) — a wrong or fabricated "step" is worse than not showing steps at all, for a tool whose entire premise is being trustworthy to learn from.

### 4.8 Units

**Description:** Supporting both unit conventions used across civil engineering curricula worldwide.

#### FR-20: Select unit system

User can select a unit system — SI or Imperial — per project; all geometry, Load, and result values display and accept input in the selected system.

**Consequences (testable):**
- Switching unit system converts displayed values without altering the underlying stored structure — the canonical stored value is authoritative, so repeated round-trip conversion (e.g. Imperial → SI → Imperial) never drifts the displayed value from what the user originally entered.
- Unit system is changeable at any point in a Project's life, not fixed at creation.

### 4.9 Accounts & Project Persistence

**Description:** Saving and reopening work across sessions, tied to a user account.

#### FR-21: Create an account and sign in

User can create an account and sign in, via email/password or social login (e.g. Google). `[ASSUMPTION: specific auth provider/vendor not chosen — deferred to architecture; the methods themselves are decided.]`

#### FR-22: Save a Project

Signed-in user can save the current structure as a named Project tied to their account.

**Consequences (testable):**
- Project names are unique per account; saving with a name already in use prompts the user to confirm overwrite or choose a different name — it never silently overwrites.

#### FR-23: Load a Project

Signed-in user can view a list of their saved Projects and reopen (load) any of them.

**Consequences (testable):**
- Reopening a Project exactly reproduces the saved Nodes, Elements, Supports, Loads, Materials, Cross-Sections, and unit system. Analysis results are not part of a Project (§3 Glossary) — reopening shows the structure unsolved (a "solve to see results" state), not stale results from before the save.

#### FR-24: Delete a Project

Signed-in user can delete a saved Project.

**Consequences (testable):**
- Deletion requires a confirmation prompt, matching the pattern FR-3 already sets for the lower-stakes Node/Element deletion.

## 5. Non-Goals (Explicit)

- strukt is **not** a substitute for stamped/certified professional structural design work — it is a learning tool, and this is communicated explicitly in-product, not just in this document.
- strukt does **not** perform dynamic, seismic, or time-dependent load analysis in v1 — static loads only.
- strukt does **not** perform code-checking or member design (e.g. AISC, ACI) — it produces analysis results (forces, moments, reactions), not a pass/fail design verdict.
- strukt does **not** support 3D structures in v1 — planned for a future release via three.js.
- strukt does **not** guarantee performance or usability for structures beyond classroom scale (~50 Nodes/Elements) in v1.
- strukt has **no monetization** during the MVP phase — entirely free. Paid plans are planned once the MVP phase ends (§ Monetization); this Non-Goal applies to v1, not to strukt's lifetime.

## 6. MVP Scope

### 6.1 In Scope

- Truss and Frame 2D modeling (Beam as a Frame preset), snap-to-grid canvas.
- Fixed, Hinged, Roller, Free supports.
- Steel and Concrete materials; Cross-Section catalog with manual override.
- Concentrated and Uniformly Distributed Loads.
- Direct Stiffness Method solver with instability detection.
- BMD, SFD, NFD, and Reactions visualization.
- Show Your Work: an optional toggle revealing the stiffness-method equations (local matrices, global assembly, boundary-condition-reduced solve) with the student's actual numbers substituted in.
- SI and Imperial units, user-selectable.
- User accounts with cloud-saved, multi-project persistence.
- Solver regression/validation test suite against known benchmark problems.

`[NOTE FOR PM]` This list is large for something labeled "MVP" — a full Direct Stiffness Method solver, a validated benchmark suite, touch/tablet parity, dual unit systems, Show Your Work, and full accounts/cloud persistence all ship together, starting from a codebase that today is only stubs (§0, addendum). Every item here was a deliberate choice made during Discovery, not scope creep, and nothing is being cut in response to this note — but this is a v1.0-sized commitment, not a walking skeleton. Plan and staff accordingly rather than assuming "MVP" implies a small build.

### 6.2 Out of Scope for MVP

- 3D structures — deferred to a future release (three.js already a dependency, groundwork exists).
- Trapezoidal/varying distributed loads, applied moment loads, internal hinges/releases mid-span, support settlements. `[AMENDED post-Epic-2: a *point* Load along an Element is now in scope — see FR-9. The rest of this line still holds.]`
- Dynamic/seismic/time-dependent analysis.
- Code-checking / member design.
- Paid tier / monetization — planned for post-MVP (§ Monetization), not v1.
- Native mobile app (v1 is desktop-first, browser-based).

## 7. Success Metrics

**Primary**
- **SM-1**: Weekly Active Students — unique student accounts running at least one Solve per week, target 100+ WAU within 3 months of launch. Validates FR-10, FR-22–FR-23.
- **SM-2**: Solve success rate — % of Solve attempts returning a valid result or a handled instability error (never an unhandled crash), target ~99%. Validates FR-10, FR-11.
- **SM-5**: Show Steps adoption — % of individual Solve actions (FR-10) immediately followed by the user toggling Show Steps on for that result, target >30%. Validates FR-16, and whether strukt's core differentiator is actually landing. Promoted to Primary: SM-1 and SM-2 alone could hit target in a world where strukt is used as a generic calculator and nobody ever touches its actual differentiator — SM-5 is what keeps the metric structure honest about validating the thesis, not just activity.

**Secondary**
- **SM-3**: Time-to-first-diagram — median time from opening the app to a new user's first successful BMD/SFD/NFD render. Validates FR-1–FR-15 (whole core flow).
- **SM-4**: Solver accuracy — % of the benchmark validation suite matching known solutions within tolerance, target 100%. Validates the Feature-specific NFR under FR-11. This is a launch gate more than a success metric — it must be 100% before shipping a "trustworthy" solver at all — kept here for traceability to FR-11, not as evidence of product-market success.

**Counter-metrics (do not optimize)**
- **SM-C1**: Do not optimize Time-to-first-diagram (SM-3) by skipping or weakening instability checks (FR-11) or input validation — a fast wrong answer is worse than a slower correct one for a learning tool.
- **SM-C2**: During the MVP phase (§ Monetization defines its end), do not grow Weekly Active Students (SM-1) by adding professional/paid-leaning features that dilute the free-for-students positioning (§1, §6.1) — this counter-metric does not conflict with the planned post-MVP paid plans, since those plans are committed to never removing free access to anything an existing user already has (§ Monetization).
- **SM-C3**: Do not grow Show Steps adoption (SM-5) by making the results-only path slower or more effortful — Show Steps must stay strictly additive, never a tax on the fast path.

## 8. Open Questions

All prior open questions were resolved in a single pass on 2026-08-30 (see `.memlog.md`); their answers are folded into the relevant sections above. What's left, genuinely deferred by design rather than pending:

1. Specific auth provider/vendor (FR-21) — the sign-in *methods* are decided (email/password + social login); which vendor implements them is architecture's call.
2. Equation/matrix typesetting implementation for Show Steps (§4.7) — an implementation/library choice, explicitly deferred to architecture; doesn't change what the feature does (see `addendum.md`).
3. `[NOTE FOR PM]` Post-MVP paid plan shape (§ Monetization) — which features gate for *new* users, and pricing — intentionally deferred until the go/no-go decision to end the MVP phase is made, so it doesn't compromise the MVP-phase free positioning. (The phase-end trigger and the existing-user grandfather commitment are both already decided — see § Monetization; only the paid tier's actual shape remains open.)

## 9. Assumptions Index

- §4.1 FR-2 — Beam is a UI-level preset over Frame, not a new Structure Type.
- §4.4 FR-8 — Exact Load sign convention (e.g. positive y = upward) deferred to architecture.
- §4.9 FR-21 — Auth provider/vendor not yet chosen (methods are decided).
- § Cross-Cutting NFRs — Browser compatibility scoped to modern evergreen browsers only; not explicitly confirmed.
- § Constraints and Guardrails — Privacy treated as light-touch (no special regulated data category); revisit if institutional/school accounts are added later.
- § Constraints and Guardrails — Solver assumed to run client-side for cost reasons; not yet confirmed at architecture time.
- § Information Architecture — Sketched at a high level only; `bmad-ux` owns the real IA.

---

## Cross-Cutting NFRs

- **Correctness**: Solver results must match a maintained regression suite of known textbook/benchmark structural analysis problems within ≤0.1% relative error. This is the single most important quality bar for a learning tool — a confidently wrong diagram is worse than no diagram.
- **Performance**: Solve and diagram render complete in under 1 second for classroom-scale structures (~50 Nodes/Elements), measured on the browser-compatibility baseline defined above (modern evergreen browsers), not a specific device tier.
- **Reliability**: An unstable structure never crashes the app or silently returns an invalid result (FR-11) — always a handled, specific error.
- **Browser compatibility**: Modern evergreen browsers (Chrome, Edge, Firefox, Safari); no legacy browser support required. `[ASSUMPTION]`

## Constraints and Guardrails

- **Safety**: strukt must clearly and persistently communicate — in-product, not just in this document — that it is a learning/educational tool and not certified for professional structural design use. The line: engineers may use strukt for informal, personal checks (refreshing a concept, sanity-checking intuition — JTBD-4) but never for anything that informs a real deliverable, client conversation, or professional judgment call on an actual project — that use is what §2.2's Non-Users and §5's Non-Goals disclaim. This guardrail exists because engineers are a real secondary audience who could otherwise blur that line, not as boilerplate. Ties to §5 Non-Goals.
- **Privacy**: User accounts store project geometry/data. No special regulated data category applies (not health or financial data), but standard account-data practices apply: secure password handling, account deletion removes associated Projects. `[ASSUMPTION — light touch; revisit if institutional/school accounts are added later.]`
- **Cost**: `[ASSUMPTION]` The solver is expected to run client-side (consistent with `mathjs` already in the stack), keeping backend cost limited to auth and Project storage rather than compute. Confirm at architecture time.

## Aesthetic and Tone

Canvas-first UI inspired by Figma's direct-manipulation interaction model — click/drag to place, a toolbar for tools, panels for properties — but with a distinct visual identity, not a Figma reskin. Tone should feel approachable and modern, in deliberate contrast to the dated, intimidating UX of legacy engineering software (STAAD.Pro and ETABS are both widely criticized for this). Full visual system is `bmad-ux`'s job, not this PRD's — this section exists to hand off intent, not specify pixels.

## Information Architecture

`[ASSUMPTION: high-level only — bmad-ux should own the real IA.]`
- A main canvas workspace (structure drawing/editing).
- A toolbar/toolbox for adding Nodes, Elements, Supports, and Loads.
- A properties panel for the currently selected Node/Element (Support type, Material, Cross-Section, Load values).
- A results view showing BMD/SFD/NFD and Reactions after solving.
- A projects list/dashboard for browsing and reopening saved Projects (tied to accounts).

## Monetization

Entirely free during the MVP phase — no paid tier (§5, §6.1). This is a deliberate differentiation strategy: the competitive research found no tool combining genuinely free access with a modern UX and a real modeling workflow (SkyCiv's free tier is capped too tightly for real coursework). Counter-metric SM-C2 protects this positioning specifically during the MVP phase.

**The MVP phase ends only at a deliberate go/no-go decision to build paid tiers** — not automatically, and not on any metric or calendar threshold defined here (that decision itself may be informed by SM-1/SM-5, but isn't triggered by them crossing a number). Until that decision is made, "MVP phase" is still in effect and SM-C2 still applies.

**Grandfather commitment**: any feature available free during the MVP phase stays free, forever, for users who already had access to it before paid tiers launch — strukt will not paywall something an existing user already relies on. Without this commitment, strukt's own roadmap would risk the same free-tier-erosion criticism the Vision (§1) levels at SkyCiv's overly restrictive free tier.

Paid plans are planned once the MVP phase ends. `[NOTE FOR PM]` Which features gate behind a paid plan for *new* users, and the pricing model itself, are undecided — deliberately not specified here so the MVP-phase free positioning doesn't get pre-emptively compromised by scope decisions made before the MVP has even shipped. Revisit as a dedicated PRD update once the go/no-go decision above is made (see §8 Open Question 3).

## Platform

Web-only, browser-based — built on the existing Next.js/React stack. The drawing canvas supports both mouse and tablet/touch input (FR-1) — it is not desktop-only, though there is no dedicated native mobile app in v1 (§5, §6.2); phone-sized screens are not a target form factor.

---
stepsCompleted: [1]
inputDocuments: [
  "_bmad-output/planning-artifacts/prds/prd-strukt-2026-08-30/prd.md",
  "_bmad-output/planning-artifacts/prds/prd-strukt-2026-08-30/addendum.md",
  "_bmad-output/planning-artifacts/architecture/architecture-strukt-2026-08-30/ARCHITECTURE-SPINE.md",
  "_bmad-output/planning-artifacts/ux-designs/ux-strukt-2026-08-30/DESIGN.md",
  "_bmad-output/planning-artifacts/ux-designs/ux-strukt-2026-08-30/EXPERIENCE.md"
]
---

# strukt - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for strukt, decomposing the requirements from the PRD, UX Design spines, and Architecture spine into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can place Nodes and connect them with Elements on a snap-to-grid canvas, with touch and mouse parity (no coincident/zero-length Elements, no self-referencing Elements).
FR2: User can choose a Structure Type (Truss or Frame) for the project; Beam is offered as a Frame preset constraining drawing to one horizontal line. Switching Structure Type after Elements/Supports/Loads exist is blocked with a warning. Truss Elements hide the moment-of-inertia field.
FR3: User can select, move, and delete previously placed Nodes and Elements (deleting a Node cascades to its attached Elements, with a confirmation prompt).
FR4: User can assign a Support (Fixed, Hinged, Roller, or Free) to any Node via a dropdown menu; every Node defaults to Free until assigned.
FR5: User can assign a Material (Steel or Concrete) to an Element; an Element with no Material blocks Solve with a validation error; changing Material after a catalog Cross-Section clears that selection.
FR6: User can choose a Cross-Section for an Element from a standard catalog (AISC W-shapes for steel, basic rectangular/circular for concrete), auto-filling area and moment of inertia.
FR7: User can manually override the auto-filled area/inertia for an Element; values must be positive; selecting a new catalog Cross-Section replaces a prior manual override.
FR8: User can apply a Concentrated Load to any Node (magnitude + direction, global coordinate system); multiple Loads on the same Node sum rather than overwrite.
FR9: User can apply a Uniformly Distributed Load (UDL) along any Element, or a point Load at a stated distance along one; multiple Loads on the same Element sum. [AMENDED post-Epic-2 — see AD-10, AD-12.]
FR10: System assembles the global stiffness matrix and solves for nodal displacements/rotations, Reactions, and internal Element forces via the Direct Stiffness Method; any structural edit after a Solve invalidates displayed results/Show Steps until re-solved; beyond ~50 Nodes/Elements the solve is not blocked but carries no performance/accuracy guarantee.
FR11: System detects structurally unstable configurations (including per-connected-sub-structure and zero-Element cases) at or before solve time and blocks solving with a specific, actionable error naming the responsible Node/region.
FR12: System renders the Bending Moment Diagram (BMD) for a solved structure, labeling peak positive/negative values and locations.
FR13: System renders the Shear Force Diagram (SFD), labeling peak positive/negative values and locations.
FR14: System renders the Normal/Axial Force Diagram (NFD), distinguishing tension from compression by sign in the label text (e.g. "+12.0 kN (tension)").
FR15: System displays computed Reactions at every supported Node after solving; Reactions satisfy global equilibrium within the Correctness NFR's tolerance.
FR16: User can toggle a "Show Steps" view alongside solved results; disabled until a successful Solve has occurred; cleared together with results if a subsequent Solve is blocked by instability.
FR17: Show Steps displays, per Element, the local stiffness matrix formula with that Element's actual values substituted in.
FR18: Show Steps displays the DOF mapping from local to global stiffness matrix assembly, and the assembled global matrix.
FR19: Show Steps displays which DOFs were eliminated by Supports, the boundary-condition-reduced system of equations, and how it yields the displayed nodal displacements/rotations.
FR20: User can select a unit system (SI or Imperial) per project, changeable at any point; all geometry/Load/result values display and accept input in the selected system without altering the canonical stored value.
FR21: User can create an account and sign in via email/password or social login (e.g. Google); social-login sign-ups skip email verification (provider already verified), email/password sign-ups must verify before dashboard access.
FR22: Signed-in user can save the current structure as a named Project tied to their account; a name collision prompts confirm-overwrite-or-rename, never a silent overwrite.
FR23: Signed-in user can view a list of their saved Projects and reopen (load) any of them; reopening exactly reproduces the saved structure, unsolved.
FR24: Signed-in user can delete a saved Project, always via a confirmation prompt.

### NonFunctional Requirements

NFR1: Correctness - Solver results must match a maintained regression suite of known textbook/benchmark problems within <=0.1% relative error (gated in CI per Architecture AD-9).
NFR2: Performance - Solve and diagram render complete in under 1 second for classroom-scale structures (~50 Nodes/Elements).
NFR3: Reliability - An unstable structure never crashes the app or silently returns an invalid result; always a handled, specific error.
NFR4: Browser compatibility - Modern evergreen browsers only (Chrome, Edge, Firefox, Safari); no legacy support required.
NFR5: Safety - strukt must clearly and persistently communicate (in-product) that it is a learning/educational tool, not certified for professional structural design use.
NFR6: Privacy - Standard account-data practices (secure password handling, account deletion removes associated Projects); no special regulated data category.
NFR7: Cost/placement - The solver runs client-side (Architecture AD-3, confirmed), keeping backend cost limited to auth and Project storage rather than compute.
NFR8: Show Steps fidelity - Whatever Show Steps displays must exactly match the values the solver actually used; no second code path ever recomputes or re-derives this for display (Architecture AD-3).
NFR9: Accessibility - WCAG 2.2 AA across the full web surface: full keyboard operability, visible focus indicator on every interactive element, text-based (never color-only) error communication, switch semantics on the Show Steps toggle, reduced-motion fallback.

### Additional Requirements

- **Brownfield, no starter template**: strukt already has a partial Next.js 16.2.6/React 19.2.4 codebase (engine/, store/, empty components/, default app/ scaffold) - Epic 1 Story 1 is foundation/reconciliation work on the existing codebase, not a greenfield starter setup.
- **Paradigm**: Layered architecture, isolated pure-computation domain core. Strict one-way dependency: UI -> store/ + Server Actions -> engine/ ; Server Actions -> lib/db/ + Clerk auth. engine/ imports only mathjs, never react/next/zustand/lib/db (AD-1).
- **Naming reconciliation** (AD-2, [ADOPTED]): engine/types.ts is the single source of truth for Support ("FIXED"|"HINGE"|"ROLLER"|"FREE" - HINGE not PINNED), StructureType ("TRUSS"|"FRAME"), Material ("STEEL"|"CONCRETE" - not MaterialType). constants.ts's redeclared StructureType is deleted. store/useStructureStore.ts's analysisResults field renamed to results, new showSteps field added.
- **Solver contract** (AD-3): One solve() call returns a single SolveResult keyed by entity id (never array index): displacements, reactions, elementForces, localStiffness, dofMap, reducedSystem (with explicit freeDofs field) - plain number/number[]/number[][] only, no mathjs Matrix crossing the boundary. Runs client-side, synchronous. SolveResult is never persisted.
- **Load entity model** (AD-10): Load becomes a first-class entity {id, kind: concentrated|udl|point, target: {type:node,nodeId}|{type:element,elementId}, magnitude, direction}, where kind:point also carries position (metres from the Element's start Node), replacing StructuralNode's fx/fy/mz scalar fields. mz is removed entirely (not reserved). Global sign convention: positive x = rightward, positive y = upward. [AMENDED post-Epic-2: the point kind was added when it became clear a Truss load between two joints has no other representation — putting a Node under it inserts a pin and turns the member into a mechanism. See AD-10, AD-12.]
- **Units** (AD-4): engine/ and store/'s canonical structure are always SI, with no exception including transiently. Conversion is read/write-through at the input/output boundary only. unitSystem is a UI preference flag, not a Node/Load field, and never triggers the stale-results invalidation rule.
- **Persistence** (AD-5): projects table row is (id, user_id text, name, structure jsonb, updated_at, ...) with a unique constraint on (user_id, name). structure has a mandatory schemaVersion:number field plus the full Nodes/Elements/Supports/Loads/Materials/Cross-Sections/unit-system shape, not normalized into per-entity tables. Cross-Section values are resolved and denormalized inline onto each Element at save time. Concurrent Save is last-write-wins, explicitly accepted for MVP.
- **Auth** (AD-6): Clerk middleware gates signed-in routes (Canvas Workspace, Projects Dashboard). Session read via Clerk's auth() server-side. projects.user_id is Clerk's userId string stored verbatim as text (exempt from the Ids-are-UUID convention). No separate users table.
- **Server Actions boundary** (AD-7): Save, Load, List, and Delete are all four named exported functions in app/**/actions.ts - never an inline Drizzle query in a Server Component or elsewhere. No React Query/SWR/client cache introduced.
- **Cross-Section catalog** (AD-8): AISC W-shape / basic-concrete catalog lives as a versioned static data module under engine/catalog/, imported directly - not a database table. Catalog values pre-converted to SI at authoring time.
- **Benchmark suite** (AD-9): A Vitest suite runs against engine/ in CI and gates merge - covers FR11's tolerance and the Correctness NFR.
- **Stack** (pinned, verified 2026-08-30): Next.js 16.2.6 (App Router), React/react-dom 19.2.4, TypeScript ^5, zustand ^5.0.13, mathjs ^15.2.0, @react-three/fiber ^9.6.1, @react-three/drei ^10.7.7, three ^0.184.0, Tailwind CSS ^4, Clerk (@clerk/nextjs) 7.8.0 (Core 3), Drizzle ORM + drizzle-kit 0.45.2, Neon Postgres via pg (node-postgres) + @vercel/functions's attachDatabasePool, KaTeX 0.16.22, Vitest 4.1.
  - `[ASSUMPTION]` Canvas rendering uses react-three-fiber + drei with an orthographic camera for the 2D canvas (not SVG/Canvas2D) - inferred from three/r3f/drei already being installed for the PRD's planned post-MVP 3D transition.
- **Deployment**: Vercel, Node.js runtime (Fluid Compute, not Edge). Production + Preview environments; Neon branch-per-environment. Clerk + Neon env vars auto-provisioned via Vercel Marketplace. No custom logging/monitoring stack in v1.
- **Deferred (architecture-level, not story-blocking now)**: 3D rendering; Cross-Section catalog sourcing/licensing depth; touch gesture library choice; benchmark suite sizing/ownership; post-MVP paid-tier gating; anonymous canvas-before-signin (decided: no, in v1).

### UX Design Requirements

UX-DR1: Implement the full DESIGN.md token system (colors incl. light/dark pairs, typography, rounded=0 with one full-radius exception for canvas glyphs, spacing scale incl. named layout tokens, shadows, component tokens) as the app's styling foundation (Precise & Clinical register, Blueprint Classic palette).
UX-DR2: Build the core component library per DESIGN.md.Components / EXPERIENCE.md Component Patterns: Button-Solve (+ blocked variant), Button-primary, Button-danger-outline, Toolbar-tool, Support/Material dropdowns, Cross-Section picker (catalog + manual override), Load input fields, Tag-outline (Reaction "R:" / Load "L:" prefixed), Type-badge, Canvas-element-stroke (dashed Truss / solid Frame), Diagram-card, Project-card, Disclaimer-badge, Error-banner, Steps-toggle-switch, Units-toggle, Canvas-grid, Focus-ring, Empty-state-card.
UX-DR3: Implement Canvas Workspace State Patterns: cold load, unsolved, solved, instability blocked, zero-Element, validation blocked, multiple-disconnected-sub-structures, Structure-Type-switch blocked, large/unsupported-scale structure.
UX-DR4: Implement Projects Dashboard State Patterns: cold load, populated, empty/first-login, save name conflict, delete requested, reopening (always unsolved).
UX-DR5: Implement Auth State Patterns: registered/unverified (email/password only; social login skips), verified, invalid credentials, failed registration, expired/invalid verification link, signed out/session expired.
UX-DR6: Implement Interaction Primitives with full touch+mouse parity and no hover-only affordances: tap/click to place, drag to move, tap/click to select (single Node/Element, properties panel), canvas pan/zoom `[ASSUMPTION: gesture convention not verified against a tested prototype]`, delete with cascade confirmation, Escape to deselect.
UX-DR7: Implement the Accessibility Floor: WCAG 2.2 AA, full keyboard operability, DESIGN.md's focus-ring on every interactive element, switch semantics + announced transitions on the Show Steps toggle, text-based (never color-only) error communication with aria-live, reading-order focus order, prefers-reduced-motion fallback.
UX-DR8: Implement the persistent Safety & Learning-Tool Disclaimer (fixed verbatim wording, footer-docked, non-dismissible, never a modal/toast) on every authenticated surface.
UX-DR9: Implement Progressive Disclosure: minimal canvas by default, properties panel expands only on selection, results render unprompted after Solve, Show Steps is the one deliberate second-order disclosure gate.
UX-DR10: Implement light + dark mode using DESIGN.md's token pairs (client-side theme switch per Architecture; no persisted per-user preference in v1).
UX-DR11: Implement Voice and Tone microcopy verbatim (specific Node/field-naming error text, "Hinged" never "Pinned", the Beam-solved-as-Frame Show Steps caption, plain non-playful destructive-action confirmations, the exact Safety disclaimer sentence).
UX-DR12: Implement Key Flows UJ-1 (Sara: draw -> supports -> loads -> Solve -> results -> optional Show Steps -> Save, plus the FR11 failure path) and UJ-2 (Sara: register -> verify -> Dashboard -> Open a saved Project, plus its Auth failure path) end-to-end.

### FR Coverage Map

FR1: Epic 1 - Draw structure on snap-to-grid canvas
FR2: Epic 1 - Choose Structure Type (Truss/Frame/Beam preset)
FR3: Epic 1 - Edit/delete Nodes and Elements
FR4: Epic 1 - Assign Support to a Node
FR5: Epic 1 - Assign Material to an Element
FR6: Epic 1 - Choose Cross-Section from catalog
FR7: Epic 1 - Manually override Cross-Section properties
FR8: Epic 1 - Apply Concentrated Load
FR9: Epic 1 - Apply Uniformly Distributed Load
FR10: Epic 1 - Solve the structure
FR11: Epic 1 - Detect and block unstable structures
FR12: Epic 1 - Render Bending Moment Diagram
FR13: Epic 1 - Render Shear Force Diagram
FR14: Epic 1 - Render Normal/Axial Force Diagram
FR15: Epic 1 - Display Reactions
FR16: Epic 2 - Toggle Show Steps
FR17: Epic 2 - Show local stiffness matrix
FR18: Epic 2 - Show global stiffness matrix assembly
FR19: Epic 2 - Show boundary-condition-reduced solve
FR20: Epic 1 - Select unit system
FR21: Epic 3 - Create account and sign in
FR22: Epic 3 - Save a Project
FR23: Epic 3 - Load a Project
FR24: Epic 3 - Delete a Project

## Epic List

### Epic 1: Structural Modeling & Analysis

Sara can draw a 2D structure (Truss, Frame, or Beam), configure its Supports, Materials, Cross-Sections, and Loads, choose her unit system, and get an instant, correct Bending Moment/Shear Force/Normal Force Diagram with Reactions the moment she clicks Solve — including a clear, specific error if her structure is unstable.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR20

**Implementation notes:** Story 1 of this epic is the brownfield foundation work — Architecture AD-2 (naming reconciliation), AD-10 (Load entity model, `mz` removal, sign convention), and AD-3's `SolveResult` shape — before any UI story builds on it; this is not a separate setup epic. Covers NFR1 (correctness/benchmark suite, AD-9), NFR2 (performance), NFR3 (reliability), NFR7 (client-side solve placement). Draws on UX-DR1–3, UX-DR6–9, UX-DR11 (design tokens, core components, Canvas Workspace states, interaction primitives, progressive disclosure, microcopy) and UJ-1 (UX-DR12, minus the Show Steps portion).

### Story 1.1: Draw and Edit a Structure on the Canvas

As a civil engineering student,
I want to draw Nodes and Elements on a snap-to-grid canvas and choose a Structure Type,
So that I can lay out the geometry of my structure before analyzing it.

**Acceptance Criteria:**

**Given** the Canvas Workspace is open on a new Project
**When** I use the Node/Element tool to place points and connect them
**Then** each Node snaps to the nearest grid point, and an Element only ever connects two distinct, non-coincident Nodes (FR1)

**Given** I attempt to draw an Element between two Nodes at identical coordinates, or from a Node to itself
**When** I complete the placement
**Then** the canvas blocks or merges the attempt rather than creating a zero-length or self-referencing Element (FR1)

**Given** I am starting a new Project
**When** I choose a Structure Type
**Then** I can select Truss, Frame, or Beam; choosing Beam constrains new Nodes to one horizontal line while storing the Project as Frame under the hood (FR2)

**Given** a Project already has Elements, Supports, or Loads
**When** I try to change its Structure Type
**Then** the change is blocked with a warning, not silently applied (FR2)

**Given** a Truss-type Project
**When** I view an Element's properties
**Then** the moment-of-inertia field is not shown, since the solver never uses it for axial-only members (FR2)

**Given** a previously placed Node or Element
**When** I select and delete it
**Then** deleting a Node also removes any Elements attached to it, and I am shown a confirmation prompt first (FR3)

**Given** I am using a touch-only tablet
**When** I place, select, move, or delete a Node or Element
**Then** every interaction works identically to mouse, with no hover-dependent behavior (FR1, PRD FR-1)

**Implementation note:** Includes fixing `engine/constants.ts`'s duplicate `StructureType` redeclaration per Architecture AD-2 — this story is the first to touch `StructureType`.

### Story 1.2: Assign Supports to Nodes

As a civil engineering student,
I want to assign a Support type to any Node,
So that I can define how my structure is restrained.

**Acceptance Criteria:**

**Given** a Node with no Support assigned
**When** I view it
**Then** it defaults to Free until I explicitly assign one (FR4)

**Given** a selected Node
**When** I open its Support dropdown
**Then** I can choose Fixed, Hinged, Roller, or Free, and the dropdown label reads "Hinged," never "Pinned" (FR4)

**Implementation note:** This is the first story to touch the `Support` type — reconciles `engine/types.ts`'s `StructuralSupport` union to `Support` with `HINGE` (not `PINNED`) per Architecture AD-2.

### Story 1.3: Assign Materials and Cross-Sections to Elements

As a civil engineering student,
I want to assign a Material and a Cross-Section to an Element,
So that my structure has the physical properties the solver needs.

**Acceptance Criteria:**

**Given** a selected Element
**When** I open its Material dropdown
**Then** I can choose Steel or Concrete (FR5)

**Given** an Element with no Material assigned
**When** I attempt to Solve
**Then** Solve is blocked with a specific validation error naming the Element (FR5)

**Given** an Element with a catalog Cross-Section already chosen
**When** I change its Material
**Then** the Cross-Section selection is cleared — a Steel W-shape cannot remain attached to a Concrete Element (FR5)

**Given** a selected Element
**When** I open its Cross-Section picker
**Then** I can choose from the AISC W-shape (Steel) or basic rectangular/circular (Concrete) catalog, which auto-fills area and moment of inertia (FR6)

**Given** a selected Element
**When** I manually override its area or moment of inertia
**Then** the value must be positive or Solve blocks with a validation error, and later selecting a new catalog Cross-Section replaces the override outright (FR7)

**Implementation note:** First story to touch `Material` — reconciles to `Material` (not `constants.ts`'s `MaterialType`) per AD-2. Also builds the static Cross-Section catalog module under `engine/catalog/`, pre-converted to SI, per AD-8.

### Story 1.4: Apply Loads to the Structure

As a civil engineering student,
I want to apply Concentrated Loads to Nodes and Uniformly Distributed Loads to Elements,
So that I can simulate the forces acting on my structure.

**Acceptance Criteria:**

**Given** a selected Node
**When** I apply a Concentrated Load with a magnitude and direction
**Then** the Load is stored in the global coordinate system (positive x = rightward, positive y = upward), and a second Load on the same Node sums with the first rather than overwriting it (FR8)

**Given** a selected Element
**When** I apply a Uniformly Distributed Load, or a point Load at a stated distance along the Element
**Then** it follows the same global-coordinate convention, and multiple Loads on the same Element sum (FR9)

**Given** a Truss whose member carries a Load between its joints
**When** I Solve
**Then** it is analyzed rather than refused: the member bends as a simply supported beam between its two pins, and the joints take only the simple-beam reactions (AD-12) [AMENDED post-Epic-2 — this originally required the Solve to be blocked]

**Implementation note:** Introduces the first-class `Load` entity (`{id, kind, target, magnitude, direction}`) replacing `StructuralNode.fx`/`fy`/`mz`; `mz` is removed entirely, not reserved, per Architecture AD-10.

### Story 1.5: Solve the Structure

As a civil engineering student,
I want to click Solve and have my structure analyzed via the Direct Stiffness Method,
So that I know whether my structure is stable and what its internal forces are.

**Acceptance Criteria:**

**Given** a fully defined, stable structure
**When** I click Solve
**Then** the solver returns a `SolveResult` (displacements, Reactions, per-Element forces, local stiffness matrices, DOF mapping, boundary-condition-reduced system — all keyed by entity id, per AD-3) in under 1 second for a classroom-scale structure (NFR2)

**Given** a structure edited after a prior Solve
**When** the edit is made
**Then** the previous results and Show Steps content are invalidated in that same action, never left stale (FR10)

**Given** a structure with insufficient restraint, a disconnected unstable sub-structure, or zero Elements
**When** I click Solve
**Then** solving is blocked with a specific, actionable error naming the responsible Node or sub-structure — never a crash or silent wrong answer (FR11)

**Given** a structure beyond ~50 Nodes/Elements
**When** I click Solve
**Then** solving is not blocked, but no performance or accuracy guarantee applies — it degrades visibly, never silently (FR10)

**Implementation note:** Establishes the Vitest benchmark/regression suite (known textbook problems, ≤0.1% tolerance) gating CI per AD-9 — this is the story where NFR1 is actually enforced, not just declared.

### Story 1.6: View Analysis Results

As a civil engineering student,
I want to see the Bending Moment, Shear Force, and Normal Force Diagrams plus Reactions after solving,
So that I can check my hand calculations.

**Acceptance Criteria:**

**Given** a successful Solve
**When** the results render
**Then** the Bending Moment Diagram and Shear Force Diagram each label their peak positive and negative values and locations (FR12, FR13)

**Given** a successful Solve
**When** the Normal Force Diagram renders
**Then** it distinguishes tension from compression by sign in the label text (e.g. "+12.0 kN (tension)"), never by an additional color (FR14)

**Given** a successful Solve
**When** Reactions render
**Then** every supported Node shows its Reaction, and the full set satisfies global equilibrium with the applied Loads within the Correctness NFR's tolerance (FR15)

### Story 1.7: Select Unit System

As a civil engineering student,
I want to select SI or Imperial units for my Project,
So that I can work in the system my coursework uses.

**Acceptance Criteria:**

**Given** an open Project
**When** I toggle between SI and Imperial
**Then** all geometry, Load, and result values display and accept input in the selected system, at any point in the Project's life (FR20)

**Given** a value entered in one unit system
**When** I switch units back and forth repeatedly
**Then** the canonical stored value (always SI internally, per AD-4) never drifts from what I originally entered

**Given** I toggle the unit system
**When** the toggle completes
**Then** it never triggers the stale-results invalidation rule — Show Steps and results stay exactly as they were (AD-4)

### Epic 2: Show Your Work

Sara can toggle "Show Steps" after a successful Solve to see the actual stiffness-method equations — local stiffness matrices, global assembly, and the boundary-condition-reduced solve — with her own numbers substituted in, rendered exactly from what the solver used.

**FRs covered:** FR16, FR17, FR18, FR19

**Implementation notes:** Depends on Epic 1's `SolveResult` shape (AD-3) already exposing this data — no new solver logic, this epic is presentation of an already-computed result. Covers NFR8 (Show Steps fidelity). New dependency: KaTeX for equation rendering. Includes the Beam-solved-as-Frame caption and the Steps-toggle-switch component (UX-DR2, UX-DR11).

### Epic 3: Accounts & Projects

Sara can create an account (email/password or social login), verify her email if needed, and see a dashboard of her saved Projects — creating new ones, reopening old ones exactly as she left them, and deleting ones she no longer needs.

**FRs covered:** FR21, FR22, FR23, FR24

**Implementation notes:** Entirely separate surface (auth, `lib/db`, dashboard) from Epic 1/2's canvas work — can be built in parallel once Epic 1's Project data shape (`structure` JSONB, AD-5) is stable. Covers NFR5 (safety disclaimer, UX-DR8), NFR6 (privacy). Draws on UX-DR4–5 (Dashboard + Auth state patterns) and UJ-2 (UX-DR12).

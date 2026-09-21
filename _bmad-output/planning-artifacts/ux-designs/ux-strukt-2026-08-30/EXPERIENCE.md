---
name: strukt
status: final
sources:
  - {planning_artifacts}/prds/prd-strukt-2026-08-30/prd.md
  - {planning_artifacts}/prds/prd-strukt-2026-08-30/addendum.md
created: 2026-08-30
updated: 2026-08-30
---

# strukt — Experience Spine

> Single-surface responsive web, desktop/tablet form factor, touch AND mouse dual-input required (no native mobile app, phone-sized screens explicitly out of scope). No named UI system inherited — bespoke visual system, see `DESIGN.md`. Paired with `DESIGN.md` (Blueprint Classic / Precise & Clinical). Composition references: `mockups/key-canvas.html` (Canvas Workspace), `mockups/key-dashboard.html` (Projects Dashboard) — spine wins on conflict.

## Foundation

Single-surface responsive web, built on the existing Next.js/React stack, targeting modern evergreen browsers only (Chrome, Edge, Firefox, Safari — no legacy support). No third-party UI system (shadcn/MUI/etc.) is inherited — `DESIGN.md` is the full, bespoke visual identity reference for this spine.

Form factor is desktop/tablet, not phone: phone-sized screens are an explicit PRD non-goal, and no breakpoint table appears anywhere in Discovery's artifacts, so none is invented here. Within that one form-factor range, touch and mouse are **both** first-class input methods (PRD FR-1) — this is not a responsive-layout concern (no reflow between input modes) but an interaction-parity concern, detailed in its own section below.

Two account states gate the product: signed-out (Register / Sign In / Verify Email) and signed-in (Canvas Workspace, Projects Dashboard). `[NOTE FOR UX: whether the canvas can be drawn on anonymously before signing in, and whether an in-progress anonymous structure survives the redirect through sign-in when the user tries to Save (FR-1 vs. FR-21), is flagged as an open edge case in the PRD addendum and was never resolved during Discovery. This spine assumes the primary v1 path is sign-in-first — UJ-1's own entry state is already "signed in" — and treats anonymous canvas use as unspecified rather than assumed-supported.]`

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Register | Signed-out entry | Create an account (email/password or social login, FR-21) |
| Verify Email | Immediately after Register (email/password sign-up only) | Blocks dashboard access until the user verifies — a required gate, not optional. Social-login sign-ups (e.g. Google) skip this surface entirely, since the provider already verified that email; only email/password sign-ups pass through it |
| Sign In | Signed-out entry / session expiry | Authenticate an existing account |
| Projects Dashboard | Post-login landing; logo click | Browse saved Projects as cards; New / Open / Delete (FR-22–24) |
| Canvas Workspace | Dashboard "+ New Project" or "Open" | Draw/edit a structure, assign Supports/Materials/Cross-Sections/Loads, Solve, view results |

The PRD's own high-level IA sketch lists a "results view" as if it were a separate destination (item 4 of its IA list). Discovery's mocks resolve this concretely: **results (BMD/SFD/NFD/Reactions) and Show Steps are not a separate surface** — they're an inline, bottom-docked expansion of the same Canvas Workspace screen (`.working/key-canvas.html`'s `results-area`), never a navigation target. There is no route for "results" independent of the Project it belongs to.

→ `mockups/key-canvas.html` illustrates Canvas Workspace's primary (solved) and secondary (FR-11 instability-blocked) states. `mockups/key-dashboard.html` illustrates Projects Dashboard's populated and empty (first-login) states. Neither mock renders Register / Sign In / Verify Email — those surfaces follow the same chrome (topbar, footer disclaimer badge, `DESIGN.md` tokens) but have no dedicated Discovery mock; treat their exact layout as open to the standard patterns below rather than a specific rendered composition.

## Voice and Tone

Microcopy only — brand voice and aesthetic posture live in `DESIGN.md`'s Brand & Style. The tone is technical and precise, matching the visual register: never chatty, never falsely alarmed, never generic.

| Do | Don't |
|---|---|
| "Node N5 is unrestrained. Assign a Support (Fixed, Hinged, or Roller) to continue." | "The structure is unstable." (FR-11 requires naming the specific Node/region) |
| "No results to show — fix the structure above, then Solve again." | "Oops! Something went wrong." |
| "No Projects yet. Draw your first beam, frame, or truss on the canvas — it'll show up here once you save it." | "Welcome! Let's get started on your engineering journey! 🎉" |
| "strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment." (verbatim, never paraphrased per-surface) | A legalistic disclaimer wall, or an alarmist tone that undercuts the confident-modern brand posture |
| "Hinged" (the settled Glossary/UI term) | "Pinned" — rejected vocabulary; never appears in UI copy |
| Plain, specific confirmation prompts ("Delete this Project? This can't be undone.") | Playful copy on a destructive action |
| "Beam is solved as a Frame — the matrices below use Frame notation." (shown only atop Show Steps for Beam-preset Projects) | Showing unexplained Frame terminology (DOF, moment matrices) silently to a student who picked "Beam," with no acknowledgment of the substitution |

## Component Patterns

Behavioral only — visual specs live in `DESIGN.md.Components`. Names below are identical to `DESIGN.md`'s component headings.

| Component | Use | Behavioral rules |
|---|---|---|
| Button — Solve | Topbar, Canvas Workspace | Fires FR-10. Any structural edit after a prior Solve invalidates displayed results and Show Steps until Solve fires again (FR-10's stale-invalidation rule) — the button itself doesn't change label for "stale," but the results-area below it does (see State Patterns). Blocked variant appears the instant FR-11/FR-5/FR-7 validation fails; never a silent no-op click. |
| Button — primary | Topbar ("+ New Project"), Project card ("Open") | Routes into a fresh Canvas Workspace (New) or the exact saved state of a Project, unsolved (Open, FR-23). Never itself shows a confirmation — only Delete and destructive Solve-blocking states do. |
| Button — danger outline | Project card ("Delete") | Always opens a confirmation prompt first (FR-24) — never deletes on a single click/tap, matching the Node/Element delete pattern (FR-3). |
| Toolbar tool | Canvas Workspace left rail | Node / Element / Support / Load / Select. Exactly one active at a time. Switching tools never discards an in-progress placement silently — an uncommitted Element drag completes or cancels explicitly. Must be operable by tap, not just click (no hover-dependent tool preview). |
| Support dropdown | Properties panel, selected Node | Assigns Fixed / Hinged / Roller / Free (FR-4) — every Node defaults to Free until explicitly assigned. Label reads "Hinged," never "Pinned" (see Voice and Tone). |
| Material dropdown | Properties panel, selected Element | Assigns Steel or Concrete (FR-5) — an Element with no Material assigned blocks Solve with a specific validation error (see State Patterns). Changing Material after a catalog Cross-Section was already chosen for that Element clears the Cross-Section selection — a Steel W-shape can't remain attached to a Concrete Element. |
| Cross-Section picker | Properties panel, selected Element | Catalog picker (FR-6, AISC W-shapes for Steel / basic rectangular-circular for Concrete) auto-fills area and moment of inertia; a manual-override mode (FR-7) lets the student enter area/inertia directly instead — both must be positive numbers or Solve blocks with a validation error. Selecting a new catalog Cross-Section after a manual override REPLACES the override outright; the override never silently persists alongside a newly-displayed catalog shape name. The moment-of-inertia field is not shown at all for Truss Elements (FR-2) — the solver never uses it for axial-only members, so it's omitted rather than shown-and-ignored. |
| Load inputs (magnitude/direction) | Properties panel, selected Node (Concentrated Load) or Element (UDL) | Magnitude and direction fields (FR-8/FR-9) read/write relative to the global coordinate system already established for the solver — never an implicit always-downward convention. Multiple loads on the same Node/Element sum rather than one overwriting another. |
| Tag — outline | Properties panel, Results area | Reaction tag and Load tag render only when the relevant data exists (a Reaction only after a successful Solve; a Load tag only once one is assigned) — never an empty/zero-value placeholder tag. Reaction and Load tags now carry a distinguishing text prefix in the label itself ("R:" / "L:"), so hue (accent-success vs. accent-primary) is never the sole differentiator between them. |
| Type badge | Project card | Reads "Truss," "Frame," or "Beam" per the Project's user-facing Structure Type choice (FR-2) — Beam always carries `{colors.element-frame}`, never a third code path. |
| Diagram card | Results area (BMD/SFD/NFD) | Renders only after a successful Solve with no blocking FR-11 error (FR-12–14). Peak positive/negative value and its location are always labeled, not just implied by the curve shape. The NFD (FR-14) distinguishes tension from compression by sign alone in the label text (e.g. "+12.0 kN (tension)" / "−8.0 kN (compression)"), never by an additional color. |
| Project card | Projects Dashboard | Click/tap anywhere except Open/Delete does nothing (no accidental navigation) — Open and Delete are the only actions. Delete always confirms (FR-24), matching the Node/Element delete pattern (FR-3). |
| Disclaimer badge | App footer, every authenticated surface | Always present, never dismissible, never a toast/banner that times out or requires acknowledgment (`{components.disclaimer-badge}` stays transparent/hairline-outline, never filled) — see the dedicated Safety section below. |
| Error banner | Canvas Workspace, on a blocked Solve | Appears in the same location every time (above the canvas, below the topbar) so the user doesn't hunt for it. Text always names the specific Node/Element/field responsible where feasible (FR-11's testable consequence), and a distinct message covers the zero-Element "nothing to analyze yet" case rather than reusing instability wording. This is the one status surface allowed `{colors.error-banner-fill}` as a filled background. |
| Show Steps toggle | Results area | Disabled (not merely empty) until at least one successful Solve has occurred this session (FR-16). Always defaults to off (`{components.steps-toggle-switch}` thumb at `{colors.ink-secondary}`), including on reopening a previously-solved Project — the toggle state is never persisted with the Project. If a subsequent Solve is blocked (FR-11), both the results and any visible Show Steps content clear together, not independently. When the Project's Structure Type is the Beam preset, the panel opens with a fixed caption at its top — "Beam is solved as a Frame — the matrices below use Frame notation." — never shown for Truss or (non-Beam) Frame Projects. |
| Units toggle | Topbar | Switches SI ↔ Imperial for **display only** — the canonical stored value never changes, so repeated round-trip switching never drifts the number the user originally entered (FR-20). Changeable at any point in a Project's life, not fixed at creation. `[NOTE FOR UX: behavior for an in-progress, not-yet-submitted keystroke buffer in an open input field at the moment the unit is switched — convert live, discard, or show a stale-unit label next to the new unit — is an explicitly deferred edge case in the PRD addendum, unresolved in Discovery.]` |
| Canvas grid | Canvas Workspace background | Purely visual texture (see `DESIGN.md`); Node placement snaps to the underlying grid regardless of the dot pitch shown, which may render at the compact pitch in smaller canvas contexts. |
| Canvas element stroke | Canvas Workspace | Truss elements render dashed, Frame/Beam elements render solid (`{components.canvas-element-stroke}`) — a non-color cue that never depends on hover or selection state to be legible, matching `DESIGN.md`'s settled Colors decision. |

## State Patterns

**Canvas Workspace**

| State | Treatment |
|---|---|
| Cold load (opening a saved Project) | Topbar/toolbar chrome renders immediately (static); the canvas area itself shows a brief loading placeholder until the saved structure resolves, then renders unsolved per the Reopening rule below |
| Unsolved (fresh Project, or edited since last Solve) | Results area empty/invalidated; Show Steps disabled if no Solve has occurred yet this session (FR-16), or cleared if a prior Solve's results are now stale |
| Solved | Diagrams + Reactions render immediately, unprompted; Show Steps becomes available (still opt-in, never auto-opened) |
| Instability blocked (FR-11) | Error banner names the specific Node/sub-structure; any previously shown results and Show Steps content are cleared, not left stale (FR-16) |
| Zero-Element Project | Distinct "nothing to analyze yet" message — never reuses the geometric-instability wording (FR-11) |
| Validation blocked (missing Material FR-5, invalid manual override FR-7) | Same error-banner treatment as instability, with a message specific to the missing/invalid field, not the instability wording |
| Multiple disconnected sub-structures, one unstable | Error identifies which sub-structure; the whole Project's Solve is blocked, not just the bad island (v1 non-goal: solving the valid island independently) |
| Structure Type switch blocked (FR-2) | Attempting to change Structure Type (Truss/Frame/Beam) after any Element, Support, or Load already exists is blocked with a warning, not silently applied — switching stays available only on an otherwise-empty Project. |
| Large/unsupported-scale structure (FR-10, beyond ~50 Nodes/Elements) | Solve is not blocked — there is no hard element-count gate — but no performance/accuracy guarantee applies past that scale; treatment communicates this degrades gracefully (e.g. a visible note near Solve) rather than failing silently or implying the same sub-1-second/tolerance guarantee still holds. |

**Projects Dashboard**

| State | Treatment |
|---|---|
| Cold load (fetching saved Projects) | Topbar renders immediately; the card grid area shows a brief loading placeholder, resolving into either the Populated or Empty state below once the Projects list arrives |
| Populated | Cards in a grid: title, type badge, node/element count, unit system, last-updated timestamp |
| Empty (first login, zero Projects) | Dedicated empty-state card with its own "+ New Project" CTA, not a blank page |
| Save name conflict (FR-22) | Confirm-overwrite-or-rename prompt; never a silent overwrite |
| Delete requested (FR-24) | Confirmation prompt, matching FR-3's Node/Element delete pattern |
| Reopening a Project (FR-23) | Always loads unsolved — a "solve to see results" state — even though the structure itself reproduces exactly as saved; never shows stale pre-save results. `[NOTE FOR UX: whether a reopened Project's Cross-Section values (FR-6) are a snapshot taken at save time or a live reference back to the catalog — a real trust/correctness trade-off flagged explicitly in the PRD addendum — is unresolved in Discovery; this spine assumes reopening reproduces whatever the underlying data model decides (architecture's call), and takes no position on which.]` |

**Auth**

| State | Treatment |
|---|---|
| Registered, unverified (email/password sign-up only) | Blocked from the dashboard entirely; sees a "verify your email" state, not a degraded/read-only dashboard. Social-login sign-ups (e.g. Google) skip this state entirely — the provider already verified that email — and land directly in Verified below. |
| Verified | Full dashboard access. Reached either by completing the email/password verification gate above, or immediately on first sign-in for social login. |
| Invalid credentials (Sign In) | Inline field-error/error-banner convention, matching Canvas Workspace's error treatment — never a silent failure or generic page reload. |
| Failed registration (Register — duplicate email / weak password) | Same inline field-error/error-banner convention, naming the specific problem rather than a generic failure. |
| Expired or invalid verification link (Verify Email) | Same error-banner convention, with a path back to requesting a new verification email rather than a dead end. |
| Signed out / session expired | Routed to Sign In, not a dead-end error page |

## Interaction Primitives

- **Tap/click to place** — Node, Element, Support, Load tools all place on tap or click identically.
- **Drag to move** — an unselected-then-selected Node or Element can be repositioned by drag (mouse) or touch-drag (tablet).
- **Tap/click to select** — opens the properties panel for exactly one Node or Element at a time; the panel never depends on a hover state to reveal its contents or any control inside it (FR-1's explicit touch-parity requirement — a properties layout that only works with a mouse hover is out).
- **Canvas pan/zoom** — `[ASSUMPTION: Discovery's mocks are static images with no interaction spec; pinch-to-zoom + two-finger pan for touch and scroll-wheel-zoom + click-drag pan for mouse are assumed as the standard direct-manipulation-canvas convention the PRD's Figma reference implies, not verified against a tested prototype.]`
- **Delete** — a Delete/Backspace key (mouse+keyboard) or an explicit on-canvas delete affordance (touch) removes the selected Node/Element, always through the FR-3 confirmation prompt when the deletion cascades (deleting a Node removes its attached Elements).
- **Escape** — deselects the current Node/Element and closes the properties panel back to its collapsed (nothing-selected) state.

**Banned:** hover-only affordances anywhere (breaks touch parity); auto-expanding Show Steps or the properties panel without an explicit user action; more than one modal/dialog stacked at a time (e.g. a Delete confirmation never opens on top of another open dialog).

## Accessibility Floor

Behavioral only — visual contrast values live in `DESIGN.md.Colors` (`{colors.ink-primary}` ~13:1 and ~15.7:1 against background in light/dark; `{colors.ink-secondary}` ~5.6:1, the system's contrast floor for secondary/meta text).

- WCAG 2.2 AA across the full web surface.
- Every interactive element (toolbar tool, Solve button, Show Steps toggle, Units toggle, Project card actions) is reachable and operable via keyboard, not mouse/touch-only — Solve in particular must never be a mouse-only action.
- Show Steps toggle exposes switch semantics (role/state), announcing on/off transitions.
- Errors (FR-11 instability, FR-5/FR-7 validation) are always communicated in text, never by color alone — the mocks already show this (e.g. "Node N5 is unrestrained" as literal text, not just a red outline) and that pairing is a floor, not a nice-to-have. Error text is associated with the specific field/Node it concerns, and announced (e.g. via `aria-live`) rather than silently appearing.
- Focus order follows visual/reading order on every surface; Escape always closes the topmost panel/dialog.
- `[NOTE FOR UX: minimum touch target size — 44pt/48dp is the standard cross-platform floor assumed here — is not specified anywhere in the PRD or Discovery record; treat as a reasonable default pending explicit confirmation.]`
- Screen-reader access to the BMD/SFD/NFD diagrams is their labeled peak values (already visible text per FR-12–14) — this is the confirmed v1 floor. A fuller accessible description of the curve shape was considered and explicitly decided against, not merely deferred.
- Every interactive element shows `DESIGN.md`'s `{components.focus-ring}` when keyboard-focused, not merely reachable in the right order — focus order and focus visibility are separate requirements, and both are a floor here.
- All transitions (Show Steps toggle thumb shift, toolbar/units-toggle active-underline movement, results-area reveal after Solve, loading-placeholder animations) collapse to instant state changes under `prefers-reduced-motion: reduce`.

## Safety & Learning-Tool Disclaimer

A dedicated section because this is a named PRD Constraint (Safety), not an incidental copy detail. The `{components.disclaimer-badge}` is the in-product realization of the rule that strukt "must clearly and persistently communicate... that it is a learning/educational tool and not certified for professional structural design use."

- Present on every authenticated surface (Canvas Workspace and Projects Dashboard both), docked in the app footer.
- Fixed wording, never paraphrased per-surface: "strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment."
- Never a dismissible toast, never a modal requiring acknowledgment, never blocks any action — it has to coexist with the PRD's "confident, modern" tone requirement, which is why it stays permanent-but-quiet (transparent fill at `{typography.body}`, per `{components.disclaimer-badge}`) rather than urgent-looking.
- Realizes the line the PRD draws for the secondary engineer persona: informal personal use is fine, but nothing here should read as license for using strukt's output on a real deliverable.

## Progressive Disclosure (Density Philosophy)

A dedicated section because this is the stated content-density strategy for the whole product, not just one component's behavior — it governs both major surfaces.

- The canvas is minimal by default: the properties panel shows nothing (or only collapsed/global state) until a Node or Element is selected.
- Results (BMD/SFD/NFD/Reactions) are **not** behind a second gate — they render immediately after a successful Solve, unprompted. This is the fast path UJ-1 depends on and Show Steps must never tax (PRD counter-metric SM-C3).
- Show Steps is the one deliberate second-order disclosure: gated behind both a successful Solve *and* an explicit toggle, off by default, never auto-expanded. Two distinct levels of disclosure exist in this product — "solve to see results" and "toggle to see the math" — and they are not the same gate.

## Touch + Mouse Dual-Input

A dedicated section because the PRD is explicit this is required scope, not a stretch goal — "drawing, selecting, and editing all work via touch input on a tablet, not just mouse" (FR-1), with an explicit PM note flagging the added interaction-design and gesture-handling scope this implies.

- Every canvas interaction — place, select, move, connect Nodes into an Element, pan, zoom — needs a working touch equivalent; a mouse-only interaction (drag-to-connect with no touch analog, for instance) is a gap, not an acceptable v1 shortcut.
- The properties panel must be fully usable without any hover state (see Interaction Primitives and Component Patterns → Toolbar tool).
- No dedicated native mobile app exists in v1, and phone-sized screens are out of scope — this requirement is about input method parity at the desktop/tablet form factor, not about supporting a smaller screen.

## Inspiration & Anti-patterns

- **Lifted from Figma:** the direct-manipulation canvas + toolbar + properties-panel model (PRD's own stated reference point) — click/drag to place, a toolbar for tool selection, panels for the selected object's properties. strukt is explicitly *not* a Figma reskin; only the interaction model is borrowed, not the visual identity (see `DESIGN.md`).
- **Rejected — legacy engineering-software chrome (STAAD.Pro, ETABS):** both are named in the PRD/addendum as the dated, intimidating baseline strukt deliberately contrasts against ("frozen in time" GUI, steep learning curve). The Precise & Clinical register is legible and modern *despite* being technical, not despite being simple.
- **Rejected — "Pinned" as a Support label:** the settled Glossary/UI term is "Hinged." "Pinned" never appears in copy, even though it persists as an internal type-union name in the current codebase (`engine/types.ts`) pending an architecture-level rename.
- **Rejected — three visual directions during Discovery:** Warm & Approachable, Bold & Confident, and Minimal & Airy were all considered and rejected before Precise & Clinical was chosen — none read as credible instrument-grade tooling for the target audience.
- **Rejected — three color themes plus one reverted choice:** Graphite & Ink, Slate & Amber, and Sepia Drafting were rejected outright; Deep Navy & Safety Orange was chosen once, built into working mocks, then explicitly reverted back to Blueprint Classic after a visual-weight review. Blueprint Classic is what ships (see `DESIGN.md`).
- **Rejected — SkyCiv-style capped free tier as a positioning reference:** not a visual pattern, but worth naming as the product-level anti-pattern this experience is built against — strukt's free-during-MVP stance (PRD Monetization) means no feature in this spine should be designed assuming a paywall gate sits behind it.

## Key Flows

### UJ-1 — Sara checks her simply-supported beam homework

Sara, a civil engineering student, is working through a homework problem on simply supported beams. Entry state: signed in, on the Canvas Workspace, starting a new Project.

1. She starts a new Project and selects the Beam preset (a Frame under the hood, FR-2), then draws an 8m beam using snap-to-grid — five Nodes (N1–N5) along one horizontal line.
2. She opens the Support dropdown on N1 and N5 and sets both to **Hinged**.
3. She opens the Loads menu, selects **Concentrated Load**, and places three 5kN point loads at N2, N3, and N4.
4. She clicks **Solve**.
5. **Climax:** the engine solves instantly — the BMD, SFD, and NFD render alongside the support Reactions, unprompted, in the same Canvas Workspace screen she's already on. Sara compares peak values directly against her hand calculation.
6. She trusts the result (or catches a mismatch and goes back to check her math or her model), then saves the Project (FR-22) so she can reopen it before her next study session.

Optionally, she toggles **Show Steps** to inspect the local stiffness matrices, the DOF assembly, and the boundary-condition-reduced solve with her own numbers substituted in — rendered in genuine Frame-matrix terms even though she picked "Beam," since Beam is a Frame preset (see `DESIGN.md`'s Colors section on this exact point). Because her Project used the Beam preset, the panel opens with the caption "Beam is solved as a Frame — the matrices below use Frame notation." at its top, so the substitution is explicit rather than silent.

**Failure path (FR-11):** if Sara had left a support set to Free instead of assigning Hinged, Solve blocks with a specific error naming the unrestrained Node (e.g. "Node N5 is unrestrained. Assign a Support..."), never a wrong or crashed result. Any previously shown results and Show Steps content clear rather than staying visible against the now-invalid structure.

### UJ-2 — Sara's account and Projects (register, verify, dashboard, reopen)

Sara wants her homework Project to persist across study sessions, not just the current browser tab.

1. Sara registers via email/password or social login (FR-21).
2. A verification email is sent (email/password sign-up only — a social-login sign-up like Google skips this step entirely, since the provider already verified that email); she's blocked from the dashboard until she verifies — she sees a "check your email" state, not a degraded dashboard.
3. She verifies and signs in.
4. **Climax:** the Projects Dashboard loads and shows her saved beam Project as a card — name, "Beam" type badge, node/element count, unit system, and the timestamp from when she saved it in UJ-1. This is the trust moment for the accounts side of the product: her work is exactly where she left it, without her having to re-verify it survived.
5. She clicks **Open** to reopen it. It reproduces exactly as saved (Nodes, Elements, Supports, Loads, Materials, Cross-Sections, unit system) — but unsolved, a "solve to see results" state, never stale results from before the save (FR-23).

First-login variant: if this were Sara's very first sign-in with zero saved Projects, step 4 instead shows the empty-state card ("No Projects yet") with its own "+ New Project" CTA, routing her into a fresh UJ-1 rather than a blank dashboard.

**Secondary paths:** saving a Project under a name she's already used prompts her to confirm overwrite or choose a different name — it never silently overwrites (FR-22). Deleting a Project always asks for confirmation first (FR-24), the same pattern as deleting a Node or Element (FR-3).

**Failure path (FR-21):** if Sara mistypes her password at Sign In, or returns later to an expired or already-used verification link before completing verification, she sees the same inline-field-error/error-banner convention as the Canvas Workspace failure states (see Auth State Patterns above) — never a silent failure or a dead-end error page.

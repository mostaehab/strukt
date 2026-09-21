---
title: Input Reconciliation — UX Spines vs. PRD
status: draft
created: 2026-08-30
inputs:
  - {planning_artifacts}/ux-designs/ux-strukt-2026-08-30/DESIGN.md
  - {planning_artifacts}/ux-designs/ux-strukt-2026-08-30/EXPERIENCE.md
  - {planning_artifacts}/prds/prd-strukt-2026-08-30/prd.md
  - {planning_artifacts}/prds/prd-strukt-2026-08-30/addendum.md
---

# Input Reconciliation: strukt UX Spines vs. PRD + Addendum

Checks the just-drafted `DESIGN.md` + `EXPERIENCE.md` against their stated source (`prd.md` + `addendum.md`) for gaps, drift, and silently-resolved open questions.

## 1. FR coverage in EXPERIENCE.md (Component Patterns / State Patterns / Key Flows)

Walked all 24 FRs. Most are well covered (FR-1, FR-3, FR-4 core, FR-5 validation state, FR-10, FR-11, FR-12/13/15, FR-16–19, FR-20 core, FR-21–24 all have explicit Component Pattern, State Pattern, or Key Flow coverage). Five gaps found:

### Gap A — Properties panel's internal field components have no Component Pattern entry at all
FR-4 (Support dropdown), FR-5 (Material dropdown + its "clears Cross-Section on change" consequence), FR-6 (Cross-Section catalog picker), FR-7 (manual override, and "new catalog pick replaces the override" consequence), FR-8/FR-9 (Load magnitude/direction inputs) all live inside the properties panel — one of the PRD's five named IA surfaces (`prd.md` § Information Architecture, item 3) and a PRD-anchored surface DESIGN.md itself references (`panel-width` token, Progressive Disclosure section). But neither `DESIGN.md.Components` nor `EXPERIENCE.md`'s Component Patterns table has an entry for the Support dropdown, Material dropdown, Cross-Section catalog picker, or Load input fields — only the panel's *empty/collapsed* state (Progressive Disclosure: "shows nothing... until a Node or Element is selected") is specified. Every other component named in the PRD/FRs (toolbar tool, tags, diagram card, project card, disclaimer, error banner, Show Steps toggle, units toggle) got a dedicated pattern row; these did not. Testable FR consequences that depend on this UI — Material-change clearing a chosen Cross-Section (FR-5), catalog-selection overwriting a manual override (FR-7) — have no behavioral home in either spine.

### Gap B — FR-2's two Structure-Type-switching consequences are uncovered
FR-2 has two testable consequences beyond "Beam is a Frame preset" (which *is* well covered): (1) "Cross-Section's moment-of-inertia field... is not shown for Truss Elements," and (2) "Switching Structure Type (Truss ↔ Frame) after Elements/Supports/Loads already exist is blocked with a warning." Neither appears in `EXPERIENCE.md`'s Component Patterns or State Patterns. There's no "blocked-switch warning" row alongside the other blocked-action patterns (Solve-blocked, Delete-confirm) it would naturally sit next to.

### Gap C — FR-14's tension/compression convention is unpicked
FR-14: NFD "distinguishes tension from compression (e.g. sign or color)." Neither `DESIGN.md`'s `diagram-card` component nor `EXPERIENCE.md`'s Diagram card row commits to sign-only vs. color-based distinction. This interacts with a real constraint (see Gap D below) rather than being a pure omission.

### Gap D — FR-10's beyond-~50-element degraded-performance behavior has no UI state
FR-10: "Beyond ~50 Nodes/Elements, strukt does not block solving, but makes no performance or accuracy guarantee... it degrades rather than silently producing a wrong answer or crashing." `EXPERIENCE.md`'s Canvas Workspace State Patterns table has no corresponding row (no "large/unsupported-scale structure" state, warning, or messaging pattern) — the nearest neighboring states (Unsolved, Solved, Instability blocked, Zero-Element) don't cover it.

*(Minor, not counted above: FR-9 UDL-specific placement/direction UI and FR-8's "direction relative to global coordinate system" input aren't separately called out beyond the generic "Load" toolbar tool — acceptable given EXPERIENCE.md's stated behavioral-only scope, but worth a second look if UDL placement turns out to need a distinct interaction from Concentrated Load.)*

## 2. Vocabulary match against PRD Glossary (§3)

No drift found. Checked every Glossary term (Node, Element, DOF, Support/Fixed/Hinged/Roller/Free, Direct Stiffness Method, Load/Concentrated Load/UDL, Structure Type/Truss/Frame/Beam, BMD/SFD/NFD, Material, Cross-Section, Reaction, Project) against both spines:

- "Hinged" is used consistently and correctly; "Pinned" is explicitly named and rejected in `EXPERIENCE.md`'s Voice and Tone table and Anti-patterns section, matching FR-4's settled UI label exactly — and correctly distinguishes this from the *unreconciled internal enum key* question (HINGE vs. PINNED in `engine/types.ts`/`constants.ts`), which the spine correctly leaves to architecture rather than conflating with the UI-label decision.
- "Beam is a Frame preset" is stated identically in both PRD and both spines, with no invented third terminology.
- Extension vocabulary introduced by the spines ("sub-structure," "island" for FR-11's disconnected-structure case; "Cold load," "Show Steps" as FR-16's own already-PRD-given short name) all trace back to PRD/addendum wording rather than introducing synonyms for existing Glossary terms.
- "Show Your Work" (PRD §4.7 title) vs. "Show Steps" (the actual toggle, FR-16) — PRD itself uses both; the spines consistently use "Show Steps" for the UI control and never invent a third label. Not a drift.

## 3. Non-Goals / Constraints — silent violation or drift check

No violations found; some notable positive fidelity worth recording:

- **Safety constraint** — the disclaimer's exact wording is preserved verbatim in `EXPERIENCE.md` ("strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment"), never paraphrased, matching the PRD's explicit "never paraphrased" instruction.
- **Monetization Non-Goal** — neither spine references pricing, tiers, or paywalled features; `EXPERIENCE.md`'s Anti-patterns section explicitly warns against designing "assuming a paywall gate sits behind" any feature, directly protecting SM-C2. No drift.
- **Platform Non-Goal (no native mobile, no phone breakpoint)** — correctly reflected; `DESIGN.md` explicitly states no breakpoint table exists because none was rendered and none is invented.
- **Single-select interaction** — PRD's IA sketch implies a properties panel for "the currently selected Node/Element" (singular); `EXPERIENCE.md`'s Interaction Primitives explicitly locks this to "exactly one Node or Element at a time," not a superset (no multi-select invented).
- **FR-11 island Non-Goal** ("solving the valid island independently... v1 blocks the whole Project's solve") — `EXPERIENCE.md`'s State Patterns row matches this exactly, no more-permissive behavior implied.

One soft concern, not a clean violation: FR-14's "sign or color" choice (Gap C above) sits next to `DESIGN.md`'s closed-palette rule ("Avoid: any additional chromatic color beyond the five [named colors]"). If tension/compression were ever resolved toward a *color*-based distinction, it would need a color the current DESIGN.md palette doesn't allocate — the spines don't commit either way, so this isn't yet a violation, but it's a latent conflict between an uncovered FR (Gap C) and an already-locked DESIGN.md constraint.

## 4. Information Architecture — every PRD-named surface accounted for

Full pass, no gaps. PRD's own IA sketch (§ Information Architecture) names five items:

1. Main canvas workspace → `EXPERIENCE.md` IA table: Canvas Workspace. ✓.
2. Toolbar/toolbox → folded into Canvas Workspace as the `toolbar-tool` component (defensible: PRD's own sketch treats it as a sub-element of the canvas workspace, not an independent destination). ✓.
3. Properties panel → folded into Canvas Workspace, referenced in Progressive Disclosure and Interaction Primitives (though see Gap A — the surface is *accounted for structurally* but its internal components are under-specified). ✓ (IA-level), partial (component-level, tracked as Gap A).
4. Results view → **explicitly and deliberately reconciled**: `EXPERIENCE.md` calls out that the PRD's sketch lists this "as if it were a separate destination" and states plainly that Discovery's mocks resolve it as an inline, bottom-docked expansion of Canvas Workspace, not a route. This is exactly the kind of PRD/spine tension check 4 is looking for, and it's handled well rather than silently dropped.
5. Projects dashboard → `EXPERIENCE.md` IA table: Projects Dashboard. ✓.

Register / Verify Email / Sign In (FR-21) are additionally named, correctly, as IA rows the PRD implies but never sketches explicitly — appropriate extension, not invention, since FR-21 requires them structurally.

## 5. Open items — invented vs. correctly carried forward

### Correctly carried forward (no invention)
All three addendum "Known edge cases — deferred to UX/architecture" items are carried forward as explicit `[NOTE FOR UX: ...]` tags rather than silently resolved:
- Unit-switching mid-edit keystroke buffer (FR-20) — `EXPERIENCE.md` Units toggle row, tagged unresolved.
- Anonymous canvas use before sign-in (FR-1 vs. FR-21) — `EXPERIENCE.md` Foundation section, tagged unresolved; spine states its sign-in-first assumption explicitly rather than presenting it as decided.
- Cross-Section snapshot-vs-live-reference on reopen (FR-6/FR-22) — `EXPERIENCE.md` Dashboard "Reopening a Project" row, tagged unresolved, explicitly deferred to architecture.

§8 Open Questions (auth vendor, equation-typesetting library, post-MVP paid-plan shape) are correctly left untouched by both spines — none is silently decided.

### Gap E — the Beam/Show-Steps pedagogy-consistency task was only half-resolved, and the remaining half isn't flagged as open
This one is qualitatively different from the three above: the addendum doesn't just note this as an ambient open edge case — it assigns it as a `[NOTE FOR PM]` on FR-2 with an explicit instruction to **resolve at UX time**: "whoever builds the Show Steps UI must make sure a student who explicitly picked 'Beam' isn't shown unexplained 'Frame' terminology/matrices, which would undercut trust."

The spines resolve *half* of this: `DESIGN.md`'s Colors section decides the visual-encoding half (Beam elements render in `element-frame` color, never a third color, "since Beam is a Frame preset"). But the substantive half PM actually flagged — **how the Show Steps UI itself communicates to a Beam-picking student why she's looking at Frame-labeled matrices, so the terminology isn't "unexplained"** — is not resolved anywhere. `EXPERIENCE.md`'s Show Steps toggle row (Component Patterns) and Key Flow UJ-1 both simply assert the fact ("rendered in genuine Frame-matrix terms... since Beam is a Frame preset") as narration aimed at the spine's own reader, not as an in-product copy/UI rule a builder could implement. There is no companion component, caption pattern, or Voice-and-Tone entry addressing this the way the spine handled the three edge cases above.

This matters because it's inconsistent with how the spines otherwise operate: elsewhere, a genuinely unresolved PRD-flagged item gets an explicit `[NOTE FOR UX: ...]` tag preserving it as open (see the three items above). Here, a PM-delegated decision got partially made and then dropped without either a full resolution or an honest "still open" tag — the risk the addendum raised (a Beam-picking student seeing unexplained Frame terminology) is not actually foreclosed by anything currently written down.

## Summary Table

| # | Gap | Type | Severity |
|---|---|---|---|
| A | Properties panel's Support/Material/Cross-Section/Load field components have no Component Pattern entries | FR coverage (§1) | High — touches FR-4–FR-9, a named IA surface |
| B | FR-2's Truss-hides-inertia-field and blocked-Structure-Type-switch-with-warning consequences uncovered | FR coverage (§1) | Medium |
| C | FR-14 tension/compression convention (sign vs. color) unpicked | FR coverage (§1) / latent constraint conflict (§3) | Low–Medium |
| D | FR-10's beyond-~50-element degraded-performance state has no UI treatment | FR coverage (§1) | Low |
| E | Beam/Show-Steps pedagogy-consistency PM-delegated decision only half-resolved, remainder not flagged as open | Invented-vs-carried-forward (§5) | Medium — trust-critical per addendum's own framing |

No findings for: vocabulary match (§2, clean); Non-Goals/Constraints drift (§3, clean aside from the Gap C interaction); IA surface coverage (§4, clean — results-view ambiguity explicitly and correctly reconciled).

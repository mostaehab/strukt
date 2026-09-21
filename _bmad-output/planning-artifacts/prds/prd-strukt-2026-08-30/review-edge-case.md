# Edge Case Review — strukt PRD (2026-08-30)

Method: walked every branching path/boundary condition implied by each FR. Only genuine unhandled cases listed — general critique and already-covered items excluded.

## Solver & Instability (FR-10, FR-11)

1. **Zero-Element structure (Nodes placed, none connected).** Global stiffness matrix is entirely zero — trivially singular. Unclear whether this routes through FR-11's "instability" error (implying a *geometry* problem) or needs a distinct "nothing to analyze" message, since telling a user "structure is unstable" when they simply haven't drawn an Element yet is misleading, not actionable. Add as a Consequence under FR-11 (or a new pre-check ahead of it).

2. **Zero-length Element (two Nodes at identical/near-identical coordinates connected by an Element).** Both truss and frame local stiffness matrices divide by element length L; L=0 produces divide-by-zero/NaN, not a clean "instability" error. FR-1's "An Element can only connect two existing Nodes" does not forbid two *coincident* Nodes, and snap-to-grid doesn't dedupe Nodes at the same grid point. Needs an explicit pre-solve geometry check (distinct from FR-11's stiffness-matrix instability check) and a Consequence added to FR-1 or FR-10.

3. **Element with start Node == end Node.** Nothing in FR-1/FR-3 states an Element can't reference the same Node twice. Same divide-by-zero failure mode as #2. Add as a Consequence to FR-1.

4. **Disconnected sub-structures within one Project** (e.g., two separate trusses drawn on the same canvas sharing no Node). The block-diagonal global matrix is singular even if each island is individually stable, so FR-11 as written blocks the *entire* solve — including the valid island — with no way to isolate/solve the good part. FR-11's "specific, actionable error" doesn't say whether the message can localize *which* island/DOF is the problem, which matters most exactly in this case. Add as a Consequence/Out-of-Scope callout to FR-11.

5. **Localized/partial mechanism inside an otherwise well-restrained structure** (e.g., one internal joint under-connected while global support count looks adequate). FR-11 only names "insufficient restraint" and "singular/near-singular" globally; it doesn't commit to whether the error identifies the specific Node/region causing it. For a ~50-element structure, a generic "unstable" message is far less actionable than the FR's own "specific, actionable" promise implies. Add as a Consequence to FR-11 clarifying what the error message must identify.

6. **Near-singular but not blocked (ill-conditioned) structures** — e.g., mixing extremely stiff and extremely flexible Elements. FR-11 only defines a block/no-block boundary; there's no stated behavior for a structure that passes the instability check but is numerically ill-conditioned enough to threaten the ≤0.1% accuracy NFR. Silent inaccurate output would violate the Cross-Cutting Correctness NFR without any user-facing signal. Add as a Consequence to FR-11 or the Correctness NFR.

7. **Manually-overridden Cross-Section with zero or negative Area/Inertia (FR-7).** Feeds directly into the stiffness matrix; zero/negative values are non-physical and produce singular or nonsensical results indistinguishable from a genuine instability. FR-7 has no validation Consequence. Add input validation as a Consequence to FR-7.

## Loads (FR-8, FR-9)

8. **Concentrated Load applied to a Node with no connected Element** (isolated, possibly also unsupported Node). Not addressed by FR-8 or FR-11 — unclear if Solve blocks this (as an instability, since an unconnected loaded Node with no Support can't be in equilibrium) or silently ignores the Load. Add as a Consequence to FR-8 or FR-11.

9. **UDL applied to a zero-length Element.** Total load = intensity × length = 0, so the Load silently vanishes with no warning that it's contributing nothing — easy to overlook in a homework check where the user expects a specific loaded case. Add as a Consequence to FR-9 (ties to #2).

10. **Multiple Concentrated Loads at the same Node, or multiple UDLs on the same Element.** FR-8/FR-9 don't state whether these sum, whether the UI overwrites the prior Load, or whether only one Load per Node/Element is allowed at all. This is a basic and likely common input pattern (e.g., self-weight UDL + a live-load UDL on the same beam segment), not a corner case. Add as a Consequence to FR-8 and FR-9.

## Units (FR-20)

11. **Switching unit system while a Load/geometry input field is mid-edit (uncommitted text).** FR-20's Consequence only covers already-*stored* values ("converts displayed values without altering the underlying stored structure"). It says nothing about an in-progress, not-yet-committed keystroke buffer — is it converted, discarded, or left showing stale-unit text next to a new unit label? Add as a Consequence to FR-20.

12. **Cross-Section catalog value defined natively in one unit system, used in a Project set to the other** (AISC W-shapes are inherently US customary; the "basic rectangular/circular" concrete catalog per FR-6 doesn't state its native unit either). Selecting an Imperial-native W-shape into an SI-unit Project means either converting on selection (introducing rounding that no longer matches the "clean" catalog number a student would look up in a textbook table) or storing/display mismatch. This undermines the tool's core trust bar (§1: matching hand calculations) since students cross-check catalog values directly against textbook tables. Add as a Consequence to FR-6 and FR-20.

13. **Repeated round-trip unit conversion of a freshly-typed (not catalog) value** — e.g., type "12 in" while in Imperial, switch to SI and back to Imperial. Even with canonical internal storage, the display conversion on the way in and back out can introduce floating-point rounding drift (e.g., redisplays as "11.9999in" or "12.0001in"), which reads as the tool silently altering the user's own input. Add as a Consequence to FR-20.

14. **Whether unit system (FR-20) is fixed at Project creation or changeable anytime mid-project.** FR-20 says "per project" but not when it can be set/changed. If changeable at any time, every existing Node coordinate, Load magnitude, and catalog-derived Cross-Section in that Project is subject to #11–#13 on every toggle, not just once. Needs an explicit Consequence stating whether unit system is mutable post-creation.

## Show Your Work (FR-16–FR-19)

15. **Structure edited after a solve, without re-solving.** This is the most significant gap: FR-16 states results are visible by default and Show Steps is scoped to "the current solve," but no FR states what happens to the *displayed* BMD/SFD/NFD/Reactions/Show-Steps panel when the user then moves a Node, changes a Support, or edits a Load without clicking Solve again. Nothing invalidates or flags the stale results, so the tool could keep showing diagrams/equations for a structure that no longer matches the canvas — directly undermining the Vision's trust bar ("trust its diagrams enough to check hand calculations") and the FR-16-19 NFR that steps must "exactly match the values the solver actually used." Add as a Consequence to FR-10 or FR-16 (e.g., "any structural edit post-solve clears/invalidates displayed results until re-solved").

16. **Show Steps toggled (or attempted) before any Solve has run.** FR-16 implies the toggle lives "alongside solved results," but doesn't state whether the control is hidden, disabled, or clickable-but-empty prior to a first Solve. Add as a Consequence to FR-16.

17. **Show Steps display after a solve attempt is blocked by an FR-11 instability error.** No FR addresses whether a *previous* successful solve's results/steps remain visible behind or alongside the new instability error banner (implying they're still valid for the now-edited, now-unstable structure) or are cleared. Add as a Consequence to FR-11 or FR-16 (overlaps with #15 but specific to the error path).

18. **Reopening a saved Project.** Per the Glossary, a Project stores "Nodes, Elements, Supports, Loads, Materials, Cross-Sections, and unit system" — analysis results are notably absent from that list, and FR-16's Consequence confirms Show Steps defaults off on reopen. But no FR states whether the results view itself shows blank/prompt-to-solve state, or whether users might expect (and be confused by the absence of) their last-viewed diagrams. Add as a Consequence to FR-23.

## Accounts & Persistence (FR-21–FR-24)

19. **Deleting a Project while it is the one currently open/being edited** (e.g., via a second tab, or a delete action reachable from within the open Project). FR-24 doesn't state what happens to the open canvas session — silent orphaning as an unsaved local session, forced redirect, or error on next autosave/save attempt. Add as a Consequence to FR-24.

20. **Saving a Project with a name that duplicates an existing one.** FR-22 doesn't state whether names must be unique per account, and if not unique, whether save auto-suffixes, silently overwrites the existing Project, or blocks with an error. Given FR-24 has no stated confirmation either (see #21), a silent overwrite here would be a real data-loss path. Add as a Consequence to FR-22.

21. **No confirmation stated for Project deletion (FR-24)**, in direct contrast to FR-3 which explicitly requires a confirmation prompt for deleting a Node/Element — a much lower-stakes action than permanently losing an entire saved Project. This inconsistency should be resolved explicitly, not left implicit. Add as a Consequence to FR-24.

22. **Cross-Section catalog value changes (correction/update) after a Project was already saved using the old value.** Not addressed whether a Project stores a resolved numeric Area/Inertia snapshot (reproducible, but silently diverges from the "live" catalog a student might expect to match a textbook) or a live catalog reference (which would silently change a previously-solved/checked homework Project's results on reopen — a correctness/trust problem for a tool whose bar is exact reproducibility of hand calculations). Add as a Consequence to FR-22/FR-6.

23. **Working extensively on the canvas before ever signing in, then attempting to Save (FR-22).** FR-21/FR-22 don't state whether drawing (FR-1) requires sign-in at all, and if not, whether triggering sign-in from an in-progress anonymous session preserves the current canvas state across the auth redirect/flow or discards it. Add as a Consequence to FR-21 or FR-22.

## Cross-Section Catalog + Manual Override (FR-6, FR-7)

24. **Switching an Element's Material after a catalog Cross-Section was already chosen** (e.g., pick a Steel W-shape, then change Material to Concrete). A W-shape catalog entry assigned to a "Concrete" Element is physically nonsensical. FR-5/FR-6 don't state whether changing Material clears/resets the now-invalid Cross-Section selection or leaves stale catalog geometry silently attached to the wrong Material. Add as a Consequence to FR-5 or FR-6.

25. **Manually overriding Area/Inertia (FR-7), then re-selecting a catalog Cross-Section afterward.** Precedence is undefined: does the catalog pick overwrite the manual override (expected), or does the prior override silently persist and mask the new catalog selection so the UI shows the new shape name next to stale numbers? Add as a Consequence to FR-7.

26. **Catalog/manual Inertia value on a Truss Element.** Per FR-2's Consequence, Truss Elements are axial-only and don't use Inertia in the solver, yet FR-6/FR-7 don't state whether the UI still exposes an Inertia field for Truss Elements — if it does, a value can be entered/overridden that is silently discarded by the solver, misleading the user into thinking it matters. Add as a Consequence to FR-2 or FR-6.

## Structure Type / Modeling

27. **Changing Structure Type (Truss ↔ Frame) after Elements/Supports/Loads already exist (FR-2).** Not addressed: existing Fixed vs. Hinged Support distinctions are only meaningful for Frame's rotational DOF (Truss has none), and existing Elements may lack Inertia values if they were created as Truss. No FR states whether switching Structure Type retroactively revalidates or silently carries over now-partially-meaningless data. Add as a Consequence to FR-2.

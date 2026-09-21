---
name: strukt
type: accessibility-review
reviewed:
  - DESIGN.md
  - EXPERIENCE.md
reviewer-scope: WCAG 2.2 AA — contrast recomputation, color-only information, focus-visible, reduced-motion, monospace/numeral risk
date: 2026-08-30
---

# Accessibility Review — strukt UX Spine (DESIGN.md + EXPERIENCE.md)

## Scope note

Per instructions, this review does **not** re-flag the two accepted open items already marked in EXPERIENCE.md's Accessibility Floor: (1) touch target size (44pt/48dp, unconfirmed) and (2) screen-reader access to BMD/SFD/NFD diagram *shape* beyond labeled peak values. Both remain open exactly as recorded. Everything below is either new or a verification of an existing claim.

## Verdict

**Conditional pass.** All three contrast ratios DESIGN.md explicitly states are mathematically correct — no arithmetic errors found. However, the audit surfaces one clear WCAG 1.4.1 (Use of Color) gap the spine's own stated principle should have caught (the on-canvas Truss/Frame legend), one unstated contrast ratio that clears AA by a hair rather than the comfortable margins claimed elsewhere, and two structural omissions (focus-visible appearance, reduced-motion policy) that the "WCAG 2.2 AA" claim doesn't currently back up. None of these are relitigations of the two accepted open items; all are new.

---

## Finding 1 — Truss/Frame canvas legend is color-only, contradicting the spine's own color-alone rule (High)

**Recomputed:** `element-truss` (`#1D5FBF`) vs `element-frame` (`#10233B`) — relative luminance 0.1221 vs 0.0163 → contrast ratio **≈2.60:1** between the two colors themselves. They are close enough in lightness that hue is nearly the only differentiator between them.

DESIGN.md's Colors section describes this pairing as "the two-color element-stroke legend on canvas" with no line-style (dash/weight), icon, or on-canvas text differentiator — confirmed by the Components section, which gives Truss/Frame *text* badges only on Project cards ("Type badge... Reads 'Truss,' 'Frame,' or 'Beam'"), never on individual canvas elements. On the canvas itself, whether a given member is Truss (pin-jointed, axial-only) or Frame/Beam (moment-resisting) is conveyed by stroke color alone.

This directly conflicts with the principle both Voice and Tone and the Accessibility Floor state for errors ("never communicated by color alone... that pairing is a floor, not a nice-to-have"). The Accessibility Floor's color-alone rule is scoped narrowly to *errors* (FR-11/FR-5/FR-7) and never extends that same logic to this legend — yet misreading which members are Truss vs Frame is a structural-behavior misunderstanding at least as consequential as a validation error for a learning tool whose whole purpose is teaching correct structural behavior. This is a genuine WCAG 1.4.1 gap, worsened by the low (~2.6:1) luminance separation between the two colors — recommend a redundant cue (dash pattern for Truss vs solid for Frame is the conventional structural-drafting convention and would cost nothing register-wise).

## Finding 2 — accent-success vs accent-primary: near-identical lightness makes tag-outline color coding hue-only (Medium)

**Recomputed:** `accent-success` (`#1E7F5C`) vs `accent-primary` (`#1D5FBF`) — luminance 0.1621 vs 0.1221 → contrast ratio **≈1.23:1** between the two. They sit almost exactly at the same lightness; the only distinguishing channel is hue (teal-green vs blue).

This is the color pair the outline-only `tag-outline` component uses to distinguish Load tags (accent-primary) from Reaction tags (accent-success). Same-lightness, hue-only coding is the classic failure pattern for color-vision deficiency — though the specific hues here (blue vs teal-green) are a safer pairing for the most common deuteranopia/protanopia than a red/green pair would be; a tritanope (blue-yellow deficiency) is the population most at risk of conflating them. Mitigating factor: Load tags and Reaction tags don't appear in the same UI region at the same time (Properties panel while assigning a load, vs. Results area after Solve), so positional/temporal context does most of the disambiguating work in practice. The "Solved ✓" tag additionally carries a checkmark glyph, which is a good non-color cue — but that glyph is specific to the Solved state; bare Reaction and Load tags have no such icon. Recommend confirming the tags' text content itself always carries a distinguishing label (e.g. "R" prefix) rather than relying on context alone, since the pill styling gives colorblind users nothing to go on besides hue.

## Finding 3 — accent-success as tag text/border clears AA contrast by a hair, and is the one text-color role DESIGN.md never verifies (Medium)

DESIGN.md's Colors section states and I independently recomputed (sRGB relative-luminance method) three ratios, all correct:
- ink-primary on background: **≈13.06:1** (claimed ~13:1) ✓
- ink-primary-dark on background-dark: **≈15.67:1** (claimed ~15.7:1) ✓
- ink-secondary on background: **≈5.59:1** (claimed ~5.6:1) ✓
- white on accent-primary (button label): **≈6.10:1** (claimed ~6.1:1) ✓

But `accent-success` (`#1E7F5C`) is also rendered as text/border color via `currentColor` in `tag-outline` (Reaction tags, Solved tag), at `{typography.numeral}` — 11.5px, below any "large text" exemption, so the applicable AA floor is 4.5:1, not 3:1. Recomputed against `surface`/white (the tag's own stated background per `components.tag-outline`): **≈4.95:1**. This clears AA — but by far the thinnest margin of any color/background pairing in the system (compare ink-secondary's stated ~5.6:1, explicitly called "the floor... not a target to erode further"). Unlike every other role, this ratio is never stated or checked anywhere in DESIGN.md. Any future hex nudge toward a "more legible on canvas" darker background, or a shift of accent-success even slightly lighter for a dark-mode-first edit pass, would put this under AA with no one having flagged it as fragile. (Dark-mode equivalent, accent-success-dark on surface-dark, recomputes to a comfortable ≈7.26:1 — the risk is light-mode-specific.) Recommend DESIGN.md state this ratio explicitly alongside the other three, the same way it already does for ink-secondary as "the floor."

## Finding 4 — No focus-visible (keyboard focus indicator) appearance is specified anywhere (High)

The Accessibility Floor states "Focus order follows visual/reading order on every surface" and requires every interactive element to be keyboard-operable — both are about *order* and *operability*, not *visibility* of the focus indicator itself. Neither DESIGN.md nor EXPERIENCE.md specifies a focus-ring color, width, offset, or its contrast against adjacent fills/backgrounds.

This is not the same thing as the canvas "selection ring" under Shapes (`{rounded.full}`, dashed) — that is a mouse/touch *selection* state for a chosen Node/Element on the canvas, orthogonal to *keyboard focus* on interactive chrome (toolbar buttons, Solve, Show Steps toggle, Units toggle, Project card actions, form inputs on Register/Sign In). A keyboard user tabbing through the topbar and toolbar today has no stated visual treatment at all — this is a direct gap against WCAG 2.2's carried-forward SC 2.4.7 (Focus Visible, AA), not a lower-priority nicety, given the doc's own "WCAG 2.2 AA across the full web surface" claim. This is a new, distinct gap — not a restatement of the touch-target-size or diagram-description open items. Recommend adding a focus-ring token (e.g., a 2px accent-primary outline with sufficient offset/contrast against both `surface` and `background`) to the Colors/Components sections before implementation.

## Finding 5 — No prefers-reduced-motion policy despite several implied transitions (Medium)

Elevation & Depth and the Components section imply state-change motion in multiple places: the `steps-toggle-switch` thumb "shifts" between ink-secondary and accent-primary; `toolbar-tool` and `units-toggle` active states move an underline indicator between items; Results area content "renders immediately" after Solve (an implied reveal/expand); Canvas Workspace and Projects Dashboard both specify a "brief loading placeholder" state (commonly implemented as a pulsing/animated skeleton). Nowhere in either document is a `prefers-reduced-motion` fallback (or a simple "no motion beyond instant state changes" policy) stated.

Note for calibration: SC 2.3.3 (Animation from Interactions) is an AAA success criterion, not AA, so this is not strictly required by the stated AA target. It's flagged because it was explicitly in scope for this review and because vestibular-disorder sensitivity is a real access concern independent of the AA/AAA line — worth a one-line policy (e.g., "all transitions collapse to instant state changes under `prefers-reduced-motion: reduce`") given how many implied transitions exist.

## Finding 6 — Monospace-for-numerals: no screen-reader mispronunciation risk from the font itself, but two adjacent issues worth flagging (Low)

To be precise about the mechanism: screen readers vocalize the accessible text/DOM content, not the rendered glyph — switching a numeral's `font-family` to monospace does **not**, by itself, change how NVDA/JAWS/VoiceOver pronounce it. So the "monospace-for-all-numerals" rule itself is not a mispronunciation risk in the way, e.g., custom icon-fonts or ligature-substituted glyphs would be.

Two adjacent issues are real, though:
1. **Spec inconsistency, not just a naming quibble:** DESIGN.md's own typography rule is "`{typography.numeral}` renders every literal engineering or data value; the sans stack renders everything else... narrative/help copy." But the `disclaimer-badge` — a full prose sentence containing zero numerals ("strukt is a learning tool — not a substitute for licensed/certified professional engineering judgment.") — is assigned `{typography.numeral-sm}` (monospace, 9.5px), not `{typography.body}` (sans). This contradicts the rule as written. Practically, it's a low-vision legibility concern more than a screen-reader one: a full sentence set in small monospace with `0.02em` tracking is measurably harder to read at a glance for low-vision users than the same content in the sans body face — worth a second look given this is the mandated safety-disclaimer text, the one piece of copy in the system with a legal/safety purpose.
2. **Show Steps matrices:** matrix entries are also monospace-numeral per the type rule. Screen-reader access to these dense, visually-tabular matrix layouts isn't addressed anywhere in either document — this is adjacent to, but distinct from, the already-accepted "diagram descriptions beyond peak values" open item (that item is scoped to BMD/SFD/NFD curves specifically, not to Show Steps' stiffness-matrix/DOF-assembly content). Worth folding into the same future accessibility pass rather than treating as covered by the existing accepted item.

Localization: no locale-specific numeral formatting (decimal comma vs. period, etc.) is addressed in either document, but nothing in the PRD/spine context suggests non-English locale support is in scope for v1, so this is noted only for completeness, not raised as an actionable gap.

---

## Summary table

| # | Finding | Severity | New or restates an accepted open item? |
|---|---|---|---|
| 1 | Truss/Frame canvas legend is color-only (~2.6:1 apart), contradicts spine's own color-alone principle | High | New |
| 2 | accent-success vs accent-primary near-identical lightness (~1.23:1) makes tag-outline coding hue-only | Medium | New |
| 3 | accent-success text/border on white ≈4.95:1 — clears AA barely, never stated/verified unlike other 3 ratios | Medium | New |
| 4 | No focus-visible appearance (ring color/contrast) specified — only focus *order* is | High | New |
| 5 | No prefers-reduced-motion policy despite implied toggle/underline/reveal transitions | Medium | New |
| 6 | Monospace itself doesn't cause SR mispronunciation; but disclaimer-badge-as-numeral is a spec inconsistency/legibility risk, and Show Steps matrices have an unaddressed SR gap adjacent to the accepted diagram-description item | Low | New (does not restate touch-target or diagram-description items) |

All three DESIGN.md-stated contrast ratios (ink-primary light/dark, ink-secondary light, white-on-accent-primary) were independently recomputed via the WCAG relative-luminance formula and confirmed correct.

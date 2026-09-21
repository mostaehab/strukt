---
name: strukt
description: Browser-based 2D structural-analysis learning tool for civil engineering students — a drafting-table register (hairline strokes, zero corner-radius, graph-paper grid, monospace numerals) built so a solved diagram reads like instrument output, not marketing UI.
status: final
created: 2026-08-30
updated: 2026-08-30
colors:
  # Blueprint Classic (color-themes-1.html, Variation 1) — the FINAL chosen theme.
  # Variation 3 (Deep Navy & Safety Orange) was tried, then explicitly reverted back
  # to Blueprint Classic (.memlog.md); some working mocks still carry stale "Deep Navy
  # & Safety Orange" rationale comments from that detour — cosmetic only, ignored here.
  # Blueprint Classic ships ONE interactive accent (blueprint-blue), not two — it does
  # double duty for actions, loads, and selection. There is no shipped safety-orange role.
  background: '#E4EAEF'
  background-dark: '#0B1420'
  surface: '#FFFFFF'
  surface-dark: '#121E2E'
  canvas-grid-line: '#C7D3DB'
  canvas-grid-line-dark: '#223347'
  ink-primary: '#10233B'
  ink-primary-dark: '#E7EDF2'
  ink-secondary: '#4B5D70'
  ink-secondary-dark: '#93A5B8'
  accent-primary: '#1D5FBF'
  accent-primary-dark: '#5B95F2'
  accent-success: '#1E7F5C'
  accent-success-dark: '#4FBE8D'
  accent-danger: '#B3261E'
  accent-danger-dark: '#FF6B5E'
  element-truss: '#1D5FBF'
  element-truss-dark: '#5B95F2'
  element-frame: '#10233B'
  element-frame-dark: '#E7EDF2'
  # Locked reference token — NOT the rendered hairline (see border-hairline below).
  # Kept for a future heavier-border / high-contrast-mode treatment; not used in v1 chrome.
  border-reference: '#B7C4CC'
  border-reference-dark: '#2B3F55'
  # The hairline actually rendered everywhere in the final (lighter-chrome) mocks —
  # a low-opacity tint of ink-primary, not a solid swatch.
  border-hairline: 'rgba(16,35,59,0.14)'
  border-hairline-dark: 'rgba(231,237,242,0.14)'
  # Filled tint reserved for the one high-severity, blocking state (FR-11 / validation
  # errors) — every other status pill in the system is outline-only (see Components).
  error-banner-fill: '#FCEBEA'
  # [ASSUMPTION: no dark-mode error-banner-fill exists in any Discovery mock — Discovery
  # never rendered a dark-mode screen. Derived as a low-opacity accent-danger-dark tint
  # over surface-dark, following the same "filled tint only for this one state" rule.
  # Verify against the real dark surface before ship.]
  error-banner-fill-dark: 'rgba(255,107,94,0.14)'
typography:
  heading:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: 15px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: 0.01em
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: 10.5px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: 0.1em
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.55'
  button:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: 12px
    fontWeight: '700'
    letterSpacing: 0.03em
  numeral:
    fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, "Liberation Mono", monospace'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.4'
  numeral-sm:
    fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, "Liberation Mono", monospace'
    fontSize: 9.5px
    fontWeight: '400'
    letterSpacing: 0.02em
rounded:
  DEFAULT: 0px
  full: 9999px
shadows:
  card: '0 1px 3px rgba(16,35,59,0.05)'
  card-dark: '0 1px 3px rgba(0,0,0,0.24)'
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '7': 32px
  '8': 40px
  '9': 48px
  gutter: 18px
  toolbar-width: 60px
  panel-width: 270px
  canvas-grid-pitch: 30px
  canvas-grid-pitch-compact: 22px
components:
  button-solve:
    background: '{colors.accent-primary}'
    foreground: '{colors.surface}'
    border: '{colors.accent-primary}'
    radius: '{rounded.DEFAULT}'
    typography: '{typography.button}'
    textTransform: uppercase
  button-solve-blocked:
    background: '{colors.surface}'
    foreground: '{colors.accent-danger}'
    border: '{colors.accent-danger}'
    radius: '{rounded.DEFAULT}'
  button-primary:
    background: '{colors.accent-primary}'
    foreground: '{colors.surface}'
    border: '{colors.accent-primary}'
    radius: '{rounded.DEFAULT}'
    typography: '{typography.button}'
  button-danger-outline:
    background: '{colors.surface}'
    foreground: '{colors.accent-danger}'
    border: '{colors.accent-danger}'
    radius: '{rounded.DEFAULT}'
    typography: '{typography.button}'
  toolbar-tool:
    foreground-inactive: '{colors.ink-secondary}'
    foreground-active: '{colors.ink-primary}'
    indicator-active: '{colors.accent-primary}'
    note: 'active state is a 2px bottom-border underline in accent-primary, never a filled box'
  tag-outline:
    background: '{colors.surface}'
    border: 'currentColor (accent-primary for loads/selection, accent-success for solved/reactions)'
    radius: '{rounded.DEFAULT}'
    typography: '{typography.numeral}'
    note: 'reaction tags, load tags, and the Solved tag all share this one outline-pill pattern — no filled variant. Reaction tags carry an "R:" text prefix and Load tags an "L:" text prefix in the label content, so hue is never the sole differentiator between them (accent-primary vs accent-success is only ~1.23:1 apart)'
  type-badge:
    truss: '{colors.element-truss}'
    frame: '{colors.element-frame}'
    beam: '{colors.element-frame}'
    radius: '{rounded.DEFAULT}'
    typography: '{typography.numeral-sm}'
    note: 'Beam is a Frame preset (FR-2) — it renders in the frame color, never a third color'
  canvas-element-stroke:
    truss-color: '{colors.element-truss}'
    truss-style: dashed
    frame-color: '{colors.element-frame}'
    frame-style: solid
    note: 'Truss = dashed (pin-jointed/axial-only), Frame/Beam = solid (moment-resisting) — standard structural-drafting convention, independent of and in addition to the color difference (WCAG 1.4.1 non-color cue)'
  diagram-card:
    background: '{colors.surface}'
    border: '{colors.border-hairline}'
    radius: '{rounded.DEFAULT}'
    shadow: '{shadows.card}'
    peak-label-color: '{colors.accent-primary}'
    note: 'NFD distinguishes tension/compression by sign in the label text (e.g. "+12.0 kN (tension)" / "−8.0 kN (compression)"), never by an additional color — see Colors' Avoid rule on the fixed five-color palette'
  project-card:
    background: '{colors.surface}'
    border: '{colors.border-hairline}'
    radius: '{rounded.DEFAULT}'
    shadow: '{shadows.card}'
  disclaimer-badge:
    background: transparent
    foreground: '{colors.ink-secondary}'
    border: '{colors.border-hairline}'
    radius: '{rounded.DEFAULT}'
    typography: '{typography.body}'
  error-banner:
    background: '{colors.error-banner-fill}'
    foreground: '{colors.accent-danger}'
    border: '{colors.accent-danger}'
    radius: '{rounded.DEFAULT}'
    typography: '{typography.numeral}'
  steps-toggle-switch:
    track: '{colors.surface}'
    track-border: '{colors.border-hairline}'
    thumb-off: '{colors.ink-secondary}'
    thumb-on: '{colors.accent-primary}'
  units-toggle:
    inactive-foreground: '{colors.ink-secondary}'
    active-foreground: '{colors.ink-primary}'
    active-indicator: '{colors.accent-primary}'
    note: 'segmented control, active state is a bottom-border underline, matching toolbar-tool'
  canvas-grid:
    background: '{colors.background}'
    dot-color: '{colors.canvas-grid-line}'
    pitch: '{spacing.canvas-grid-pitch}'
  focus-ring:
    color: '{colors.accent-primary}'
    width: '2px'
    offset: '2px'
    note: 'applies to every interactive element site-wide on keyboard focus (WCAG 2.2 SC 2.4.7) — focus order alone is not focus visibility'
  empty-state-card:
    note: 'composes {components.project-card} (border/radius/shadow) + {components.button-primary} (CTA) — no new visual properties of its own'
---

## Brand & Style

> Visual sources, in order of authority: `mockups/key-canvas.html` and `mockups/key-dashboard.html` are the final, current layout and color truth (Blueprint Classic, lighter-chrome treatment) and win on any conflict below. `.working/direction-precise-clinical.html` is read for register only — typography, shape, and component composition cues — its own placeholder blueprint-blue palette is superseded. `.working/color-themes-1.html` is read for color only — Variation 1 (Blueprint Classic)'s light *and* dark hex chip lists are the source for every token in this file's frontmatter, including the dark-mode values, which no other mock ever rendered.

strukt is a drafting-table instrument, not a marketing surface. The register is **Precise & Clinical**: hairline strokes, zero corner-radius, a graph-paper canvas grid, and monospace numerals wherever a real engineering value appears — so a Reaction or a peak Bending Moment reads like instrument output, not decorative UI copy. This is deliberate triangulation against both failure modes the competitive field shows: it must not read like STAAD.Pro/ETABS's dated, boxy, intimidating chrome, and it must not read like a generic consumer productivity app either. It reads as precision tooling built specifically for structural engineering, in a modern direct-manipulation idiom the PRD names after Figma (toolbar + canvas + panels) — without being a Figma reskin.

Blueprint Classic (the shipped color theme) reinforces this: blueprint-blue as the **sole** interactive accent recalls an actual cartographic/blueprint convention, not an arbitrary brand color. Two other directions were tried and rejected during Discovery — Deep Navy & Safety Orange (cooler, higher-contrast, orange promoted to sole accent) was chosen once, then explicitly reverted back to Blueprint Classic; Warm & Approachable, Bold & Confident, and Minimal & Airy were rejected outright as overall directions before Precise & Clinical was chosen (`.working/direction-warm-approachable.html`, `.working/direction-bold-confident.html`, `.working/direction-minimal-airy.html`). None of that history changes what ships — it's recorded here only so a downstream reader doesn't mistake a stale code comment in the working mocks (some still say "Deep Navy & Safety Orange" in rationale text) for the real palette.

The tone is confident and modern but never playful — the persistent safety disclaimer (see Components) has to coexist with that confidence without undercutting it, which is why it is treated as quiet, permanent instrument signage rather than a warning banner.

## Colors

Blueprint Classic ships **one** interactive accent (`accent-primary`), doing double duty for primary actions (Solve), canvas loads, and selection — this is a real simplification versus an earlier two-accent concept (blueprint-blue for actions, safety-orange for selection/loads) that appeared only in the pre-color-selection direction mock. The shipped palette has no orange role at all.

- **Background (`{colors.background}` / dark `{colors.background-dark}`)** — the page/canvas backdrop. Same value as the canvas surface itself; the canvas doesn't get a separate "paper" tint from the app chrome.
- **Surface (`{colors.surface}` / dark)** — panel, card, topbar, and footer fill. Pure white in light mode; a lifted near-black in dark mode, never pure black.
- **Canvas-grid-line (`{colors.canvas-grid-line}` / dark)** — the graph-paper dot grid. Deliberately low-contrast against background — a texture, not a visible line drawing.
- **Ink-primary (`{colors.ink-primary}` / dark)** — primary text and line-art ink (Frame/Beam element strokes, node glyphs, support hatching). ~13:1 contrast against background in light mode (#10233B on #E4EAEF), ~15.7:1 in dark mode (#E7EDF2 on #0B1420) — both far exceed WCAG AA.
- **Ink-secondary (`{colors.ink-secondary}` / dark)** — secondary/meta text: field labels, captions, dimension-line labels, disclaimer text. ~5.6:1 against background in light mode — clears AA (4.5:1) for normal text with headroom, though not AAA; treat as the contrast floor for this role, not a target to erode further. In dark mode, `{colors.ink-secondary-dark}` on `{colors.background-dark}` computes to ~7.3:1 — clears AA comfortably, better than light mode's 5.6:1 floor.
- **Accent-primary (`{colors.accent-primary}` / dark)** — the sole interactive color: Solve button fill, active toolbar/units-toggle indicator, load glyphs and labels, selection rings, links. White text on the light-mode accent fill (`#FFFFFF` on `#1D5FBF`) is ~6.1:1 — clears AA for button labels. In dark mode, `button-solve`'s foreground is `{colors.surface}` — not hardcoded white — which resolves to the dark surface token: `{colors.surface-dark}` (`#121E2E`) on `{colors.accent-primary-dark}` (`#5B95F2`) computes to ~5.6:1, clearing AA.
- **Accent-success (`{colors.accent-success}` / dark)** — the "Solved ✓" tag and Reaction tags only. Never used for anything else (not a generic "positive" color). As tag text/border on `{colors.surface}` (light mode, `#1E7F5C` on `#FFFFFF`), contrast computes to ~4.9:1 — clears AA but by the thinnest margin anywhere in this system; this is the new contrast floor to watch, not a target to erode further.
- **Accent-danger (`{colors.accent-danger}` / dark)** — instability/validation errors (FR-11, FR-5, FR-7) and the Delete affordance (FR-3, FR-24). The one color role that also gets a filled background (`error-banner-fill`) rather than staying outline-only, because it's the system's single highest-severity, blocking state and needs to read as more urgent than a status tag.
- **Element-truss / Element-frame (`{colors.element-truss}` / `{colors.element-frame}`, both with dark pairs)** — the two-color element-stroke legend on canvas. Truss elements render in accent-primary blue; Frame elements render in ink-primary. **Beam is a Frame preset (FR-2), not a third Structure Type** — a Beam project's elements always render in `element-frame`, never a third color. Inventing a distinct "Beam" stroke color would visually contradict the data model and undercut Show Steps, whose matrices are genuinely Frame matrices even when the student picked "Beam" — a pedagogy-consistency risk the PRD addendum flags explicitly. Beyond color, the legend also carries a non-color cue (`components.canvas-element-stroke`): Truss elements render with a **dashed** stroke, Frame/Beam elements render **solid** — the standard structural-drafting convention (dashed = pin-jointed/axial-only, solid = moment-resisting) — since the two element colors alone sit only ~2.6:1 apart, short of a reliable non-text distinction (WCAG 1.4.1).
- **Border-hairline (`{colors.border-hairline}` / dark)** — a low-opacity tint of ink-primary, not a solid swatch. This is what every divider, panel edge, card border, and input border actually renders as in the final (lighter-chrome) mocks.
- **Border-reference (`{colors.border-reference}` / dark)** — the original solid hairline color from the direction/color-theme mocks. Retained as a token but **not** used in v1 chrome; reserved for a future heavier-border or high-contrast-mode need.

Avoid: any additional chromatic color beyond the five above (accent-primary/success/danger + the two element colors); gradients; filled/tinted backgrounds on status tags other than the error banner; using accent-danger for anything other than errors or the Delete action (it is not a generic "important" highlight).

## Typography

Two families carry the whole system, split by a strict rule: **`{typography.numeral}` (monospace) renders every literal engineering or data value; the sans stack renders everything else** (headings, labels, buttons, breadcrumbs, narrative/help copy). This includes values a narrative-UI convention would usually set in sans — dates, unit toggles, type badges, and the error banner are all monospace here, because they're read as instrument output, not prose. The disclaimer badge is the one deliberate exception: its content is a full prose sentence with zero numerals, so it renders in `{typography.body}` like any other narrative copy, never monospace.

- **`{typography.heading}`** — screen/card titles (Project card title, empty-state title, the app logotype). Bold, tight leading, used sparingly — one per card/panel, never body-length.
- **`{typography.label}`** — uppercase micro-labels: field labels, panel headers ("Node N2 — Properties," "Results," "Your Projects"), section headers. Always uppercase, always tracked out (`0.1em`).
- **`{typography.body}`** — narrative/help prose only: empty-state subtext, the rationale/help copy pattern, disclaimer sentence content. Never used for a number.
- **`{typography.button}`** — all button labels. One deliberate exception to the "buttons aren't uppercased" default: **the Solve button is the only UI element ever rendered in uppercase.** It marks the single most important action in the app; New Project / Open / Delete stay mixed-case.
- **`{typography.numeral}` / `{typography.numeral-sm}`** — coordinates, forces (kN), moments (kNm), Reactions, dates/timestamps, Node/Element IDs, DOF notation, matrix entries in Show Steps, unit-toggle labels, type badges. `numeral-sm` covers the smallest instances (dimension-line labels, canvas node ID captions).

## Layout & Spacing

Spacing runs a 4px-based numeric scale (`{spacing.1}`–`{spacing.9}`) plus named tokens for the handful of measurements that recur as fixed dimensions rather than gaps: `{spacing.toolbar-width}` (the left tool rail), `{spacing.panel-width}` (the right properties panel), and `{spacing.canvas-grid-pitch}` (the graph-paper dot pitch — deliberately widened from an earlier, denser pitch during the lighter-chrome revision, for more breathing room; `{spacing.canvas-grid-pitch-compact}` is the one permitted narrower variant, for smaller canvas areas like the FR-11 blocked-state panel).

The app is a full-viewport, canvas-first tool, not a centered marketing column — the toolbar, canvas, and properties panel share the available width edge-to-edge; only the Projects Dashboard's card grid and empty-state card constrain to a comfortable reading/scanning width. Panel and card interior padding runs `{spacing.5}`–`{spacing.6}` (20–24px); grid gaps (project cards, diagram cards) run `{spacing.gutter}` (18px). Dividers between fields use `{spacing.6}` (24px) of vertical breathing room, not a tight list rhythm — this is a drafting table, not a dense data grid.

Discovery never rendered a phone-sized breakpoint, and phone-sized screens are explicitly out of scope (PRD Platform) — there is no responsive breakpoint table in this spine because no artifact defines one. Touch and mouse are dual-supported at the *same* desktop/tablet form factor (see EXPERIENCE.md's Touch + Mouse Dual-Input section), not via layout reflow.

## Elevation & Depth

Exactly one shadow level exists, used sparingly (project cards, diagram cards, the outer app frame) — there is no multi-tier elevation system, and elevation is never used as the primary hierarchy signal (layout, typography, and the hairline grid already carry that job).

- **Light mode:** `{shadows.card}` (`0 1px 3px rgba(16,35,59,0.05)`) — a soft, diffuse, low-opacity blur. This *replaces* an earlier, harder `0 2px 0 rgba(16,35,59,0.06)` offset shadow that appeared in the pre-color-selection direction mock; the harder shadow is superseded, not an alternate to choose between.
- **Dark mode:** `[ASSUMPTION: no dark-mode elevation was ever rendered during Discovery.]` A soft blur keyed to ink-tint (as in light mode) reads as nearly invisible against a dark surface, so this spine specifies `{shadows.card-dark}` (`0 1px 3px rgba(0,0,0,0.24)`) — a black-based shadow at higher opacity than the light-mode formula, which is the standard adjustment dark UIs make since shadows read by contrast against a light-mode's pale ground, not by hue. Verify visually before ship; no dark mock exists to confirm the exact opacity reads correctly.

Both values are now frontmatter tokens, referenced directly from `components.diagram-card` and `components.project-card`'s `shadow` field rather than living as prose-only literals.

## Shapes

Zero corner-radius (`{rounded.DEFAULT}` = `0px`) is a totalizing rule for every piece of UI chrome: buttons, panels, cards, inputs, dropdowns, badges, tags. There is no `sm`/`md`/`lg` softening scale — this is not an oversight, it's the visual thesis of "drafting table, not consumer app."

The one token exception, `{rounded.full}` (`9999px`), exists solely for the canvas's own drafting glyphs — Node markers (drawn as circles) and the dashed selection ring — which follow structural-drafting convention (a node *is* a point, drawn as a dot) rather than interface softness. Don't read this as a crack in the sharp-corner rule: it never appears on a button, card, input, or any other piece of app chrome, only on the technical drawing content itself.

## Components

- **Button — Solve (`components.button-solve`)** — primary action, accent-primary fill, uppercase label (the one uppercase button in the system). Blocked state (`components.button-solve-blocked`) swaps to an outline treatment in accent-danger with the label "Solve — blocked," never disabled-and-silent.
- **Button — primary (`components.button-primary`)** — "+ New Project," "Open." Accent-primary fill, mixed-case label.
- **Button — danger outline (`components.button-danger-outline`)** — "Delete." White/surface fill, accent-danger border and label text — never a filled red button.
- **Toolbar tool (`components.toolbar-tool`)** — Node / Element / Support / Load / Select. Active state is a 2px accent-primary underline beneath the icon, not a filled or bordered box — this is a deliberate lighter-chrome revision from an earlier filled-box active state.
- **Tag — outline (`components.tag-outline`)** — the one shared pattern behind the Reaction tag, Load tag, and "Solved ✓" tag: monospace text, a hairline border in the semantic color (accent-primary for loads/selection-adjacent values, accent-success for solved/reactions), transparent or white fill. No tag in the system uses a filled/tinted background except the error banner. Reaction tags are prefixed "R:" and Load tags "L:" in the label content itself (e.g. "R: 7.5 kN," "L: 5 kN") — a required non-color cue, since accent-primary and accent-success sit only ~1.23:1 apart and can't carry the distinction alone.
- **Type badge (`components.type-badge`)** — Truss / Frame / Beam, shown on Project cards. Outline pill, monospace label, colored by the underlying two-color element legend — Beam always renders in the frame color (see Colors).
- **Canvas element stroke (`components.canvas-element-stroke`)** — the on-canvas Truss/Frame legend's non-color cue: Truss elements render dashed, Frame/Beam elements render solid, independent of and in addition to the accent-primary/ink-primary color difference (see Colors).
- **Diagram card (`components.diagram-card`)** — BMD / SFD / NFD. Hairline border, soft shadow (`{shadows.card}`), the peak value (e.g. "M·max = 20.0 kNm") set in accent-primary monospace in the card header. The NFD distinguishes tension from compression by sign in the label text alone (e.g. "+12.0 kN (tension)" / "−8.0 kN (compression)"), never by an additional color.
- **Project card (`components.project-card`)** — title, type badge, monospace meta line (node/element count, unit system, "Updated" timestamp), a hairline divider, soft shadow (`{shadows.card}`), then Open + Delete actions.
- **Disclaimer badge (`components.disclaimer-badge`)** — transparent fill, hairline outline, sans prose text (`{typography.body}` — a full sentence with zero numerals, never monospace), permanently docked in the app footer on every authenticated surface. This is the persistent, low-weight realization of the PRD's Safety constraint — see Do's and Don'ts.
- **Error banner (`components.error-banner`)** — the one filled-background status element in the system (`error-banner-fill`). Used for FR-11 instability blocks and FR-5/FR-7 validation blocks on Solve.
- **Show Steps toggle (`components.steps-toggle-switch`)** — a hairline-bordered switch, off by default, thumb color shifts from ink-secondary (off) to accent-primary (on).
- **Units toggle (`components.units-toggle`)** — SI / Imperial segmented control, active state an underline (matching the toolbar-tool pattern), not a filled pill.
- **Canvas grid (`components.canvas-grid`)** — the graph-paper dot background every canvas surface renders against, at `{spacing.canvas-grid-pitch}`.
- **Focus ring (`components.focus-ring`)** — a 2px `{colors.accent-primary}` outline at 2px offset, applied to every interactive element site-wide (buttons, toolbar tools, tags-as-controls, inputs, dropdowns, toggles) on keyboard focus. This closes a WCAG 2.2 SC 2.4.7 gap: focus *order* was already specified (see EXPERIENCE.md), focus *visibility* was not.
- **Empty-state card (`components.empty-state-card`)** — composes `{components.project-card}`'s border, radius, and shadow with a `{components.button-primary}` CTA ("+ New Project"); no new visual properties of its own.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Render every engineering/data value (coordinates, forces, dates, IDs, matrix entries) in `{typography.numeral}` | Set a numeral in the sans stack — even "just a date" |
| Zero corner-radius on all UI chrome | Round any button, card, panel, or input corner — the canvas drafting glyphs (Node dots, selection ring) are the sole, intentional exception |
| One interactive accent (`{colors.accent-primary}`) for actions, loads, and selection | Introduce a second interactive accent (e.g. reviving the rejected safety-orange selection color) |
| Render a Beam project's elements in `{colors.element-frame}` | Invent a third "Beam" element color — Beam is a Frame preset, not a distinct Structure Type |
| Hairline dividers (`{colors.border-hairline}`) for anything non-structural | Use a solid `{colors.border-reference}` border by default — that token is reference-only in v1 |
| Keep the disclaimer badge transparent-fill, hairline-outline, permanently docked | Render the disclaimer as a filled/colored chip, a dismissible toast, or a modal the user must acknowledge |
| Reserve uppercase text-transform for the Solve button only | Uppercase other buttons "for consistency" — it dilutes the one intentional emphasis |
| Use the single soft-diffuse shadow (`{shadows.card}`) sparingly, on cards/panels only | Add a second elevation tier, or revive the earlier hard-offset shadow |
| Keep status tags (Reaction, Load, Solved) outline-only | Add a filled/tinted background to a status tag — that treatment is reserved for the error banner alone |

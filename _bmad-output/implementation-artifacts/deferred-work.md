# Deferred Work

Items surfaced during Reviewer Gate review that are real but not this story's problem to fix now.

## From Story 1.1 + 1.2 (spec-1-1-1-2-canvas-drawing-supports.md) Reviewer Gate — 2026-08-30

- **`engine/stiffness.ts`'s unused imports (`MATERIALS`, `SUPPORTS`, `STRUCTURE_TYPES`) and empty stub functions.** Pre-existing (predates this story), not caused by this change. Story 1.5 (Solve the Structure) replaces this file's contents entirely — will resolve naturally then.
- **Keyboard form-guard doesn't check `target.isContentEditable`**, only `tagName` against INPUT/TEXTAREA/SELECT (`app/page.tsx`'s keydown handler). Not currently exploitable — no contentEditable element exists anywhere in the app yet. Revisit if one is ever added.
- **`CanvasWorkspace.tsx`'s hardcoded `COLORS` constant duplicates hex values already in `components/ui/tokens.css`.** Accepted for now since this story deliberately used a minimal CSS-custom-property subset, not a full token pipeline (per spec's own scope boundary). Revisit when a fuller design-token system is built (r3f can't consume CSS custom properties directly without a JS bridge — worth solving properly once more of the canvas's visual system exists, not for two components' worth of colors).

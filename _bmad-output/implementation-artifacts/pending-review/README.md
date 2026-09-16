# Pending reviewer gate — solver and results path

Five stories shipped without their adversarial review: **1.5a, 1.5b, 1.6, 1.7, 2.1**.
Between them that is the entire solver, diagram, units and Show Steps path —
the code where a defect produces plausible-looking *wrong numbers* rather than
a visible failure.

The three layers could not be run here (weekly model limit). Each file in this
directory is a complete, self-contained prompt: paste one into a fresh session —
ideally a different model, which is the point of an independent layer — and
paste the findings back.

Run all three. They are deliberately orthogonal: one hunts what is missing, one
walks boundary conditions, one checks whether the tests verify what they claim.

## Why this matters more than usual here

A known example of the exact failure mode: `StiffnessMatrix` rendered raw LaTeX
source on screen for several commits because its tests asserted only that a
labelled element existed, never that KaTeX had parsed. It was caught by a human
looking at the screen, not by the suite. There is no reason to think it was the
only one.

## After collecting findings

Triage into: `intent_gap` / `bad_spec` (either triggers a spec loopback),
`patch` (fix in place), `defer` (record in `deferred-work.md`), `reject` (noise).

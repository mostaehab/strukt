Find places where the code's behaviour is not actually verified by its tests — tests that look like coverage but would pass against broken behaviour.

For each finding report: the changed surface, the impacted consumer, the existing test evidence (classify as `Regression gap` or `Broken-verification gap`), what verification is missing, a concrete demonstration that the suite stays green while the behaviour breaks, the consequence, and a suggested test shape.

Review content — the solver and results path in C:\Users\user\strukt\strukt, which shipped WITHOUT an adversarial review pass. Read in full:

Source: engine/stiffness.ts, engine/diagrams.ts, engine/stability.ts, engine/validation.ts, components/panels/ResultsArea.tsx, components/panels/ShowStepsPanel.tsx, components/panels/StiffnessMatrix.tsx

Tests: engine/stiffness.test.ts, engine/benchmark.test.ts, engine/diagrams.test.ts, engine/stability.test.ts, engine/validation.test.ts, components/panels/ResultsArea.test.tsx, components/panels/StiffnessMatrix.test.tsx

A known example of the exact failure mode you are hunting: StiffnessMatrix rendered raw LaTeX source on screen for several commits because the tests asserted only that a labelled element existed, never that KaTeX had parsed. That bug was found by a human looking at the screen. Find the others like it.

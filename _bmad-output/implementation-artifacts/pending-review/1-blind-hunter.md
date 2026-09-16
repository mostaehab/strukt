Review the structural-analysis code in C:\Users\user\strukt\strukt. Read these files in full — they are the CONTENT under review:

1. engine/stiffness.ts — Direct Stiffness Method solver
2. engine/diagrams.ts — internal force sampling (N, V, M along each member)
3. engine/stability.ts — instability detection
4. engine/validation.ts — pre-solve completeness checks
5. engine/types.ts — the SolveResult contract

Then read their tests to judge whether they verify what they claim:
engine/stiffness.test.ts, engine/benchmark.test.ts, engine/diagrams.test.ts, engine/stability.test.ts, engine/validation.test.ts

Context you need: this is an educational structural-engineering tool. A defect here produces plausible-looking WRONG NUMBERS rather than an obvious failure, which is the worst possible outcome — a student checks homework against it. The benchmark suite asserts six closed-form textbook problems to within 0.1%.

Conduct a review of CONTENT.
Look for what's missing, not only what's wrong. Pay particular attention to: sign conventions, edge cases the benchmarks do not reach, tests that appear to cover something they do not actually exercise, and any place a wrong answer would still look reasonable.
Find at least ten issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

# Pending reviewer gate — solver, results and diagram path

Five stories shipped without their adversarial review: **1.5a, 1.5b, 1.6, 1.7, 2.1**.
Between them that is the entire solver, diagram, units and Show Steps path —
the code where a defect produces plausible-looking *wrong numbers* rather than
a visible failure.

**Scope widened 2026-09-21.** Four further commits landed by direct request
rather than through a story, so they have no spec of their own and no gate:

| Commit | What |
| --- | --- |
| `5058343` | Diagrams re-plotted on the structure's real geometry (`engine/diagramGeometry.ts`) |
| `5b6fc83` | Diagrams moved to a full workspace view (`DiagramView`, `DiagramPane`, `ViewSwitch`) |
| `236dc5e` | Truss members may carry load between joints; new `point` Load kind; `utils/labelLayout.ts` |
| `2f80760` | Canvas glyph for a point Load |

That is roughly 1,900 lines spanning `engine/`, `store/`, the canvas and the
panel, including a new entry in the `Load` union — which touches the persisted
shape. Review it alongside the five stories, not after them.

The architecture and PRD have since been amended to describe what was built
(AD-10 amended, **AD-11** and **AD-12** added, FR-9 and FR-12 extended), so the
specs are current — but they were written *after* the code. Read them as a
record of intent, not as an independent check on it.

The three layers could not be run here (weekly model limit). Each file in this
directory is a complete, self-contained prompt: paste one into a fresh session —
ideally a different model, which is the point of an independent layer — and
paste the findings back.

Run all three. They are deliberately orthogonal: one hunts what is missing, one
walks boundary conditions, one checks whether the tests verify what they claim.

Worth pointing each layer at these specifically, since nothing else will:

- **`engine/diagrams.ts`'s `samplePositions`** — point Loads step the shear, so
  zero crossings are solved segment by segment and stations are emitted twice
  (left and right limit). Coincident stations, a load exactly at 0 or L, two
  loads at one station, and the `POSITION_TOLERANCE` comparisons are all
  untested edges.
- **`engine/stiffness.ts`'s `pointEquivalentLoads`** — verified at midspan and
  one off-centre station. `a = 0`, `a = L`, and a load whose direction has an
  along-member component are not.
- **`utils/labelLayout.ts`** — greedy, order-dependent, and drops a label it
  cannot place within `MAX_STEPS`. What gets dropped, and whether it is ever
  the value rather than the member name.
- **The `point` Load kind end to end** — `types.ts`, `load.ts`'s overloads,
  `loadResolution.ts`'s split of per-metre from newtons, and the store's
  partial validation (it rejects a negative station but leaves "past the end"
  to the solver, which is the only layer that knows the member's length).

## Two bugs this brief already found

Writing the list above turned up two defects in `PropertiesPanel`'s station
field, both fixed before the gate ran. They are recorded because they say
something about where to look:

1. **`positionRef` survived its own reset.** The field's text emptied after
   each Apply but the ref kept the last station, so a second point Load was
   placed where the first went while the field showed nothing. A silent wrong
   value, from a ref and a reset signal that were each individually correct.
2. **The station field refused its own default.** It rendered `0` and
   `NumericField` rejects anything `<= 0`, so the one value the field offered
   was the one it would not accept.

Neither was reachable from the engine tests, and neither would have been caught
by asking "is the solver right" — they live in the seam between a controlled
input, a ref, and a reset signal. **Look hard at the other refs in that
component** (`draftRef`, `discardRef`, `focusAfterDeleteRef`) and at every
`resetSignal` consumer, for the same shape of mismatch.

## Why this matters more than usual here

Two known instances of the exact failure mode, both caught by a human looking
at the screen while the suite stayed green:

1. `StiffnessMatrix` rendered raw LaTeX source for several commits, because its
   tests asserted only that a labelled element existed, never that KaTeX had
   parsed it.
2. Every Frame diagram was drawn wrong for three commits — members laid end to
   end on one strip in array order, so a portal frame rendered as a fictional
   14 m beam and a symmetric frame drew antisymmetrically — with 465 tests
   passing throughout.

The second one matters most for what you are about to review, because the
replacement was written by the same author under the same habits. It carries
one real property test (portal-frame symmetry in
`engine/diagramGeometry.test.ts`), but most of the rendering assertions are
still the shape that missed the original: *"a path exists and contains no
NaN"* proves a curve was drawn, not that it was drawn correctly.

**So treat rendering assertions as the prime suspect.** For each one ask what
it would still pass on if the geometry were mirrored, transposed, scaled, or
attributed to the wrong member.

## After collecting findings

Triage into: `intent_gap` / `bad_spec` (either triggers a spec loopback),
`patch` (fix in place), `defer` (record in `deferred-work.md`), `reject` (noise).

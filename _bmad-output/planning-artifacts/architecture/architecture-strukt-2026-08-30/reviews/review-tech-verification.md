---
name: 'review-tech-verification'
type: review
reviews: '_bmad-output/planning-artifacts/architecture/architecture-strukt-2026-08-30/ARCHITECTURE-SPINE.md'
lens: 'tech-verification (reviewer gate)'
altitude: initiative
created: '2026-08-30'
verdict: PASS-WITH-FLAGS
---

# Tech Verification Review — strukt Architecture Spine

## Verdict

**PASS WITH FLAGS.** No fabricated or contradicted version claims found. Every named technology is either (a) a real, already-installed version confirmed against `package.json`, or (b) independently checkable and confirmed correct via fresh web search. The gap is a *documentation* one, not a *correctness* one: three entries (Drizzle ORM, Vitest, and the Neon driver choice) carry no verification trail in the memlog at all, relying on unstated familiarity — exactly the "unearned confidence" pattern this gate exists to catch, even though the underlying claims turned out to be correct when checked independently just now.

## 1. Already-installed stack entries (Next.js, React, zustand, mathjs, r3f, drei, three, Tailwind)

Checked directly against `C:\Users\user\strukt\strukt\package.json`:

| Package | Spine claims | package.json actual | Match |
|---|---|---|---|
| next | 16.2.6 | 16.2.6 | yes |
| react / react-dom | 19.2.4 | 19.2.4 | yes |
| zustand | ^5.0.13 | ^5.0.13 | yes |
| mathjs | ^15.2.0 | ^15.2.0 | yes |
| @react-three/fiber | ^9.6.1 | ^9.6.1 | yes |
| @react-three/drei | ^10.7.7 | ^10.7.7 | yes |
| three | ^0.184.0 | ^0.184.0 | yes |
| tailwindcss | ^4 | ^4 | yes |

**Reasoning check: sound.** Treating "this is the version already installed and running in the repo" as sufficient verification is a legitimate reality-check — it eliminates the specific risk this gate is meant to catch (a hallucinated/nonexistent version number lifted from stale training data), because the number is provably real: it's what the project's own lockfile-adjacent manifest says is present today. It correctly does *not* claim these are "the best/newest choice for 2026" — the spine doesn't make that claim either, so there's no overreach. One nuance worth naming rather than flagging as a defect: this check only proves the versions are *real and installed*, not that they're mutually *compatible* (e.g. @react-three/fiber ^9.6.1 / drei ^10.7.7 against React 19.2.4 and three ^0.184.0 working correctly together) — but since they're already co-installed in a working repo rather than a fresh proposal, that risk is materially lower than for a greenfield pick, so treating it as out-of-scope for this gate is reasonable.

## 2. Claims with a documented verification trail — checked against the memlog

- **Clerk (`@clerk/nextjs` v7, Core 3):** memlog line 10 cites the `vercel:auth` skill's decision matrix (Clerk vs. Descope vs. Auth0). Independently re-confirmed via web search: `@clerk/nextjs` latest is 7.8.0, running on Core 3, requires `next@>=15.2.3` — satisfied by the project's Next.js 16.2.6. Claim is accurate and the memlog's citation is real.
- **Neon Postgres:** memlog line 11 cites the `neon-postgres` skill "own Vercel recommendation," specifically for **node-postgres (`pg`)** over Fluid Compute. **Inconsistency found:** the Stack table in the spine (line 118) waters this down to *"via `@neondatabase/serverless` **or** `pg` (node-postgres)"* — presenting as an open-or choice what the memlog recorded as a resolved decision. My own independent check confirms the memlog's specific pick was correct and more precise than the spine's hedge: Vercel's current Fluid Compute guidance is to use `pg` with `attachDatabasePool` from `@vercel/functions` (TCP connection reuse across warm invocations), reserving `@neondatabase/serverless`'s HTTP/WebSocket transport for environments that can't hold a TCP connection (e.g. Edge). **Flag:** the spine's Stack table should be tightened to match the memlog's actual decision (`pg` via `attachDatabasePool`), not left as an "or."
- **KaTeX:** memlog line 14 states "verified current via web search 2026-08-30." Independently re-confirmed: KaTeX's current stable is v0.16.22 (no newer release since ~April 2025 — a mature, feature-frozen library, not an abandoned one). The memlog's stated tradeoff (KaTeX faster/smaller/synchronous vs. MathJax's MathML/screen-reader accessibility edge) matches what a fresh search finds. Accurate, and correctly deferred against the already-accepted Show-Steps accessibility gap rather than treated as newly discovered.

## 3. Claims with NO verification trail — independently checked now

- **Drizzle ORM + drizzle-kit ("latest stable"):** No memlog entry checks whether Drizzle is still current/maintained — it's asserted alongside the Neon decision with no independent citation, unlike Clerk/Neon (skill-checked) and KaTeX (web-searched). **Independently confirmed now:** Drizzle is actively maintained — current stable is 0.45.2 (~March 2026) with a v1.0.0-beta/rc track in progress — remains a standard, actively-recommended ORM choice for Postgres+Next.js, with native Neon support. The underlying claim holds, but it reached the spine on assumed familiarity, not verification — this is the unearned-confidence pattern the gate is watching for, even though it resolved fine.
- **Vitest ("latest stable... new"):** Spine explicitly flags this as *new* to the stack (AD-9), which makes the absence of any verification note more notable, not less. **Independently confirmed now:** Vitest 4.x (4.1 landed March 2026) is current and widely used with Next.js 16 in 2026. One documented limitation exists — Vitest cannot exercise async Server Components — but it's irrelevant here: AD-9's benchmark suite targets `engine/`, which AD-1 mandates stays framework-free, so there are no Server Components in scope to begin with. Claim holds; verification trail is still missing.

## Summary of flags

1. **(Documentation gap, not a factual error)** Drizzle ORM and Vitest are committed with zero verification trail in the memlog — no skill check, no web search, no citation — unlike every other non-package.json entry. Recommend the memlog record an explicit check for these two before this gate is considered fully satisfied, even though independent verification just now shows both picks are correct.
2. **(Internal inconsistency)** The Stack table's Neon driver line ("`@neondatabase/serverless` or `pg`") is looser than the actual decision recorded in the memlog (`pg` specifically, per Vercel's Fluid Compute guidance). Tighten the spine to state the resolved choice, not an open-or.

No fabricated versions, no contradicted compatibility claims, no unresolved training-data staleness found anywhere in the Stack table.

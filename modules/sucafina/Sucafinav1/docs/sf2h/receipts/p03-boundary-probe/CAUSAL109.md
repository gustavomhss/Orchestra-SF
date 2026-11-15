# P03 mission109 — first-failure discriminator and ownership handoff

Scope: **inert patch**, not an applied product change, and not a PASS or performance closure. Owner99 retains all code authority; integrator106 owns composition; dispatcher107 owns hosted tests.

## Evidence already observed

- Original P03 unchanged: SHA `47b5358c8dda3179045499388ce98871576a2aa9`; **72 assertions** and **180000ms** timeout.
- R1 `43681302722` / job `132712328135`: fail at 180s; `portfolio-selection-changed` at `wp13/semantic-union-source-scenario.test.ts:50`; 10897 C08 case reads, 132668 host revalidations and 4236 Planner verification calls at deadline.
- F2 `43682515795` / job `132715983023`: same failure at 180s; 11452 case reads, 139454 revalidations and 4454 verifyOperation calls. Source-only phase finished at 5.856s with 426 case reads, 2962 revalidations and 96 verifyOperation calls.
- Bounded R3 `43682264507` / job `132715223675`: 22 PASS / 234 expects, 87440 ordered callback events, SHA256 `979b2e2ed8ca4658f1b9138abd0f69aca87b616ff8e3ca6f3996523d38cbacb4`; no original P03 or Portfolio selection/revalidation outcome. F2 removes projection SHA equality-only overhead, not repeated verification.

## First causal boundary to distinguish

`product/portfolio/analysis.ts::evaluate` returns `portfolio-selection-changed` when either (a) **the second select is NOT ok** (denied, unavailable, actual replay mismatch, stale, or source change) **or** (b) both selects succeed but their values differ. This is a **lossy reason mapping**. A single observed `portfolio-selection-changed` does *not* establish that C08's active selection changed.

The upstream **amplification entry** is `createPortfolioSelectionResolver`: it invokes `selection.read` twice. Each `createDecisionPortfolioSelection.read` calls its canonical comparison twice, each comparison replays real Planner/C08/criterion checks, before `createPortfolioAnalysis.evaluate` independently calls the resolver again at the end. That makes at least **eight** complete source-selection comparison replays across initial/final selects, not counting intermediate `bindings.read`, `persist`, `revalidate(analysis)`, or separate product evaluation. Historical elapsed counters establish multiplicity, **not** which inner replay first failed. Do not replace those callbacks with a cached yes, remove a second observation or suppress revocation.

## Scoped discriminant (awaiting run via107)

`test/product/p03-boundary-probe/selection-boundary.test.ts` uses `createWp13AnalysisFixture({renewal:{}})`, a pinned **USD 240000 renewal** baseline and missing-training scenario from canonical Planner, real SQLite/LocalStore/C08 and consumer UI admission. It instruments actual producer calls without replacing their results:
1. Stable selection: compare/replay fanout, C08 unchanged, getter observation and noncloneable refusal.
2. Legitimate rule CAS: criteria/replay can change while **C08 active selection bytes do not**; examine status/reason of the first rejected inner select (not just wrapper).
3. Revocation/UI finish: must fail without publishing private result.
4. Analysis boundary: mutate canonical rule *after* first fully verified select and observe downstream classification and C08 equality. No edited P03, no global regression waiver.

The synthetic source declarations and human grants of the existing WP13 fixture remain disclosed. A PASS in this short test proves only these scoped behaviors. The 99 writer must use its findings to locate the first failing nested callback on the original-shaped path, not equate green controls with P03 closure.

## Minimal inert patch — semantic classification only

`delivery/analysis-precise-failure109.patch.txt` is a **complete, one-hunk patch** against exactly `product/portfolio/analysis.ts` from owner99 source `54cff4caf3cbd1d94751009bcfa9564622e926b3`; full bytes in `delivery/preimage-analysis.ts.txt` and `delivery/postimage-analysis.ts.txt`. It preserves the second real select, every source and policy callback, successful comparison, and fail-closed policy. It propagates a nested non-ok result rather than calling every nested failure `portfolio-selection-changed`. True successful re-selection content drift still emits `portfolio-selection-changed`.

**Impact/limit:** This patch **does not remove eight replay branches or solve 180 seconds**. It makes the *first underlying refusal* visible to the producer/CI. The original P03 after application may still FAIL with a more precise reason. It MUST NOT be accepted as performance closure. No alternate timeout, stale ignore, fixture reduction, skipped revalidate or cloned/cached callback is proposed.

## Controlled validation and handoff

- 107: first run the own test on a coherent admitted candidate through the existing `test:ci` GitHub Actions; keep the original 180000ms P03 request deduplicated and blocked until a meaningful producer delta. Check callbacks, getter/noncloneable behavior, rule CAS, source revocation, shortness and issuer identity.
- 99: reconcile these exact source SHA/preimages to current owner HEAD; inspect selection's `read→compare→Planner` first refusal using the discriminant. Propose a *separate performance fix only if every independent observation and authorization remains intact*. Reviewer rechecks required.
- 106: do not merge this evidence branch wholesale, do not consume F2 as P03 PASS. Admit only owner-approved product blobs and tests after real CI. No GLOBAL_RELEASE.

The true P03 root cause remains open until the first nested failing callback is witnessed under a short discriminant and an accepted product delta makes the **unchanged** original scenario pass.

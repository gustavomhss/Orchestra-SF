# Planner: explicit numeric rate identity

**HOLD — source-derived counterexample; no production change or test execution.**

The complete independent review found that published `port838` does not normalize a numeric position `rateId` in the same way as the current Planner runtime. The domain converts it to a string before choosing a rate. The qualifier leaves it numeric, then `text()` turns it into an empty selector and enables automatic selection. An explicit but unresolved numeric rate can therefore become a false confirmed zero when another card matches the location.

This is a qualification defect under the existing financial policy. The underlying legacy engine zero, role and lock rules, FX behavior and permitted aggregate visibility must remain. The source trace and exact pins are in `review.json`; it does not claim that this counterexample has run or reached complete C10, a persisted analysis or native inference.

## Concrete proposal

`proposed-owner-fix.NOT_APPLIED.patch` adds a narrow runtime export delegating to the existing `versionOf(row).hc`. The source projector uses those canonical normalized inputs only while qualifying aggregate HR cells. The getter does not authorize access or expose a new user-facing field. Existing projection redaction, source digests and authority checks remain in the port.

The proposal is based on runtime `c487332777d4053be7a2b177ea598efb77ca0d66` and port `8389709232225424b5905638d0951d8cdbb71dd7`. Its derived hashes are unpublished proposal artifacts. They are **not eligible intake sources**. The owner must publish a complete compatible output; no broad runtime snapshot or reversal of newer owner work is requested.

`proposed-owner-test.NOT_RUN.patch` extends the published HR source test with a dangling numeric identity and a compatible automatic card. The test preserves the domain's zero and `hasRate=false`, requires the qualified value and component to remain absent, checks finance and viewer behavior, and checks the source snapshot. It uses the existing real issuer/UI-authority fixture; it creates no Session, provider, fake receipt or result.

## Evidence and next gate

`review.json` is the independent complete review by `compose_typecheck`: Git blob `9b25b0db91520ecf1dafdccadb87dc2befab42a4`, SHA256 `4bfe8a748b8affea57835dc6ed290b03730ebdd14f4727128d30ff8b0edc73b3`. It records one blocking finding and no further concrete compatibility defect in the inspected five-file set.

The full published history inspected contains no readPair-bearing port that fixes the issue: all three distinct blobs share the same raw-position qualifier. The latest queried PR35 head remains `ec052c2c3bef96f492512f3d5f663919580f25c8`.

The owner exit is a pinned complete source publication plus scoped GitHub Actions evidence, followed by a fresh integration closure review. The five-file candidate remains on hold. WP12's four own helpers also need explicit legitimate hypothetical operations or separate source-only controls before a mission rerun. No expectation, authority lifetime, deadline or archived digest may be relaxed to obtain a pass.

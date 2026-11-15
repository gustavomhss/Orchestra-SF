# Mission 135 / W17 e3 — C64 portfolio closed validation: terminal handoff

**Status: ARTIFACT_READY only. NOT INTEGRATED, NOT QUALIFIED, GLOBAL_RELEASE=false.** The Native Goal stays paused.

## Real authority and immutable evidence

- Epoch: `ux-native-w17-e3`, fresh ChatGPT GPT-6 actor (GitHub account `gustavomhss`; session ID not exposed); old e2 future writes revoked, no runtime death inferred.
- Original source HEAD `373fc83bd97ddade3b08c7173a062cd7208fb5cd`; ACK `e2479bb941558efaad43e9acb2cd17218fe8a5d4`; implementation `1cd6e321488e795113218a73a87049df4c7bb029`; tree `2a3fc02f2052680361435ea9200091bf4c1b875e`.
- Frozen catalog blob `31dbec1726fd8147156b01dc545726650ffd49e1`; `CONTRACTS.md` `94553a3119826ef1c44271966233dd58042ddd70`. Producer `apps/cli/src/sucafina-product/portfolio-http.ts` `6cbfc373ea72a90351e4f9997f65663e0f5fc775`, pinned `6cbfc373ea72a90351e4f9997f65663e0f5fc775`.
- Source/consumer old preimages verified separately. Consumer `sf2-stack` HEAD `d8f14f81855858120f914af4f3934406bfdb74f1`, tree `c792f5d0d3be378ca86aea09bcabdd8781734d8f`. No consumer commit/ACK from132 is claimed.

## Bounded file changes

- `packages/schema/src/sucafina/portfolio.ts`: source preimage `2ba680ae66d493b8f04c5d921773ac3a56f66829` → e3 source postimage `708731dbbaf1fe69664715a4f34007976a4b0476`; consumer preimage at `d8f14f81855858120f914af4f3934406bfdb74f1` `2ba680ae66d493b8f04c5d921773ac3a56f66829`. Diff: `PATCH-e3.patch`.
- `modules/sucafina/Sucafinav1/test/native-ui-contract/portfolio.test.ts`: source preimage `5453346c462d1f0f3e21db5b3822c502713ab294` → e3 source postimage `3820d0dea2470e7ad620bbf48ee50120ccdaece6`; consumer preimage at `d8f14f81855858120f914af4f3934406bfdb74f1` `5453346c462d1f0f3e21db5b3822c502713ab294`. Diff: `PATCH-e3.patch`.

## Root cause / original oracle preservation

- Original hosted native5 run [43738115971](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738115971), job `132885115197`: `portfolio.test.ts:37`, `:54`, `:68` each failed because invalid surplus fields were *accepted*, not thrown. The prior positives for zero/null, sensitivity and lost mutation response passed in that job; no later PASS claimed.
- Effect Schema v4 default removes unknown keys from `Schema.Struct` decoding; the rejected fields were stripped before the test could observe them. All 10 `SfPortfolio` operations now apply strict `onExcessProperty:error` to the **original** unknown input and output envelopes (including nested CaseRef, request, result arrays, refusal metadata), retaining exact typed shape and domain decoding. A source refusal's status/reason remains unchanged.
- Two additive regression cases include valid controls, root and nested surplus/authority, sensitivity units, nested results and all seven canonical refusals; no old assertion relaxed, no TS suppressions/casts/any, no fixtures or policy changes.

## Integration/handoff to132 (only shared/current writer)

1. Read the **full** `PATCH-e3.patch` against the exact source preblobs above. Apply only these two hunks on the **current** `sf2-stack` consumer, compare consumer preblobs anew, reconcile any newer foreign changes without force/reset/rebase/whole-file copies.
2. Preserve existing F01 context/F02 transport, all ten catalog operation bindings, existing original-Request host adapter, current package exports/routes/generator. Mission135 does not edit these shared paths. No raw public Protocol/Server HttpApi edit by135.
3. Publish **real** consumer ACK (new C/tree, source/postblobs, contracts, code merged/held, blockers). This author artifact cannot self-declare INTEGRATED or QUALIFIED.

## Hosted checks (delegated; not executed by135)

- **129 / PR106**: after132 has a coherent new integrated candidate, run surgical `modules/sucafina/Sucafinav1/test/native-ui-contract/portfolio.test.ts` and transitive affected tests through existing hosted `test:ci`, with C/tree/selection/runtime/fixture dedup. Compare original three failure oracle locations; preserve expected thrown refusals and exact original reason. No run has been requested to dispatch directly from135.
- **128 / PR107**: on that same integrated C, hosted `bun typecheck` from `packages/schema`, `packages/client`, `apps/cli`, and scoped guards. No local test/parser/typecheck or generated edits. Since135 changes no public Protocol/HttpApi, no new generate needed from this patch alone; any other integrated API change remains128's duty.
- The earlier hosted C64 job was **FAIL**, after e3 CI/compiler/guards are **NOT_RUN**. Other C64 failures outside portfolio and the 15 WP / 74 task / 17 contract / 1610 criteria + native UX, FINAL, G7/G8/AM gates stay open.

## Exact diff

See `PATCH-e3.patch` (complete two-file unified diff). No shared fragment from135: new source edits are restricted to granted schema/test paths. Historical e2 receipts and commits are retained.

**Terminal lease / checkpoint:** e3 author output submitted for132; release source authoring after handoff, no second writer. C/G7, D/G8, global release and Goal remain unopened.

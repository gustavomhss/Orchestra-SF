# PR40 latest intake into finance W18

Source: `be50d42d6a2c030d57d17038dec267ebd33ea78c` → `2bf0197c5d607b43063c36e1c8fef9e769c716ca`. New commits: `11261a57ebb5ad7281bb7bcdd9d3f2687c2c76de`, `2bf0197c5d607b43063c36e1c8fef9e769c716ca`.

Finance baseline: `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f`, tree `a843c5d5767c4a055fcacb77668c3798fd8a564c`. Status: **files ready; no runtime validation of candidate bytes**.

36 paths triaged;29 source files verified by Git blob and SHA256.12 owned test/helper files written under exact published-blob guards:10 exact adoptions and2 bounded merges.6 files were already identical; newer BI rendering is preserved.17 historical receipts are mapped for remote carrythrough by parent, without granting this candidate their outcomes.

## Bounded merges

- `calculation-persistence.test.ts`: minimal real Planner/source-issuer/SQLite fixture from latest PR40, including canonical source CAS invalidation. Retains W17 issue/request/result/source/replay diagnostics with the new trace. Keeps211000/null/conditioned and conservative-reader, nested-source, reopen and source-invalidated assertions. Timeout remains180000ms.
- `cross-domain-execution.test.ts`: new successful two-domain apply, ordered receipts, restart/idempotency and receipt/domain revocation assertions; uses the existing `createSfSourceScopeProjector` that already dispatches the canonical Procurement projector. No foreign source file imported or authored.

## Oracles and boundaries

- 211000 knownSubtotal, total=null, conditioned, USD/2027 for nested C17
- 55000 omitted-training threshold and15000 confirmed-training threshold
- renewal240000; transition210000 conditioned; confirmed training40000 gives250000 complete and criterionfailed
- baseline1200; selected1142; knownDifference=-58; total=null; separate official January edit42 only after application grant
- original180000ms timeout remains on C17 persistence and renewal choice history; new trace deadline fails incomplete work
- calculation-source-unsupported conservative result/request reads; nested ancestry/reopen equality; canonical source CAS invalidates source while UI lease remains current
- N/A/shared/omitted/confirmed/zero/null classifications unchanged; no financial formulas copied into test producers

### Proof boundaries

- Renewal history source references and membership declarations remain explicit synthetic fixture inputs; actual money, coverage assessment, criterion, thresholds and quotes use canonical production implementations.
- Source-only operation fixture branch performs strict decode, actual canonical Planner comparison and current host/source ingress/egress fences; no cache survives one evidence.context call. Nonempty operations or assumptions retain complete canonical operation verifier.
- C17 persistence and new choice-prepared execution use actual scoped source issuer. Human/UI admissions are in-process fixtures, not mounted/native person or identity-provider evidence.
- Cross-domain execution fixture seeds a prior choice and uses explicit host reviewed-intent admissions; the new separate choice-prepared-execution test supplies the actual ChoiceRecord→prepared→reviewed→apply chain.
- Restart proofs dispose/reopen SQLite and rebuild readers/sessions within hosted process; no native process/browser restart is claimed.
- Previous upstream failures and parent S10/S11/S12 results are not attributed to these candidate bytes.
- C17 depth/replay cost and renewal-history180s budget remain runtime risks until a new exact snapshot completes; no timeout/assertion was relaxed.

## Per-path triage

Paths are relative to `modules/sucafina/Sucafinav1/`. The JSON companion contains full paths, before/source/candidate hashes, SHA256 and reasons.

| Path | Action | Source blob | Desired tree blob |
|---|---|---|---|
| `docs/sf2h/receipts/WP11/resume-20261114/artifact-download-verification.json` | historical-receipt-remote-carrythrough | `88c19d5114d48f3f3366b8e732fdbd089ffc50b6` | `88c19d5114d48f3f3366b8e732fdbd089ffc50b6` |
| `docs/sf2h/receipts/WP11/resume-20261114/check-W5.json` | historical-receipt-remote-carrythrough | `0b95c7c2c15de84dc6df56147b36596d7344f9f6` | `0b95c7c2c15de84dc6df56147b36596d7344f9f6` |
| `docs/sf2h/receipts/WP11/resume-20261114/check-W6.json` | historical-receipt-remote-carrythrough | `0a34731e9a998ea52a5401c87896adda6b614978` | `0a34731e9a998ea52a5401c87896adda6b614978` |
| `docs/sf2h/receipts/WP11/resume-20261114/ci-selection-W6-H1.json` | historical-receipt-remote-carrythrough | `f38e2d5322c5bda39cc2a2f64ee24eb4371317b4` | `f38e2d5322c5bda39cc2a2f64ee24eb4371317b4` |
| `docs/sf2h/receipts/WP11/resume-20261114/finance-fe13-targeted-intake.json` | historical-receipt-remote-carrythrough | `9012914dc8d5890ca88a150f99cdf02f211ef45e` | `9012914dc8d5890ca88a150f99cdf02f211ef45e` |
| `docs/sf2h/receipts/WP11/resume-20261114/finance-fixture-performance-W7.json` | historical-receipt-remote-carrythrough | `01a66c9e73556f5dc617e639615f68f4a4c88a85` | `01a66c9e73556f5dc617e639615f68f4a4c88a85` |
| `docs/sf2h/receipts/WP11/resume-20261114/finance-fixture-performance-reconciliation.json` | historical-receipt-remote-carrythrough | `f61f77a507605af61f6cadadf79fa80b96e2dc5d` | `f61f77a507605af61f6cadadf79fa80b96e2dc5d` |
| `docs/sf2h/receipts/WP11/resume-20261114/independent-review-W6.json` | historical-receipt-remote-carrythrough | `47acd82ac5dd88f51fb006483d0798ba52d172e6` | `47acd82ac5dd88f51fb006483d0798ba52d172e6` |
| `docs/sf2h/receipts/WP11/resume-20261114/independent-review-W7.json` | historical-receipt-remote-carrythrough | `44583f486552a2c9913786f764a4acdb98be99c8` | `44583f486552a2c9913786f764a4acdb98be99c8` |
| `docs/sf2h/receipts/WP11/resume-20261114/protocol-W5-A1.json` | historical-receipt-remote-carrythrough | `1c6c83dbf5882deb9af3dff1707ec72c58bbc645` | `1c6c83dbf5882deb9af3dff1707ec72c58bbc645` |
| `docs/sf2h/receipts/WP11/resume-20261114/run-W5-A1.json` | historical-receipt-remote-carrythrough | `2ebe1bf8d34bbbc10097bea8426f1394a8cd8b68` | `2ebe1bf8d34bbbc10097bea8426f1394a8cd8b68` |
| `docs/sf2h/receipts/WP11/resume-20261114/run-W6-AR1.json` | historical-receipt-remote-carrythrough | `ba05e0bbf39556fa3fbbf2d3819ac618d89697c0` | `ba05e0bbf39556fa3fbbf2d3819ac618d89697c0` |
| `docs/sf2h/receipts/WP11/resume-20261114/run-W6-H1.json` | historical-receipt-remote-carrythrough | `080d92e3ff6507a4abe9f40e6c5d71f98adf0f51` | `080d92e3ff6507a4abe9f40e6c5d71f98adf0f51` |
| `docs/sf2h/receipts/WP11/resume-20261114/tests-W5-A1.json` | historical-receipt-remote-carrythrough | `993aae62320bcd92dea011339850986dae4957dd` | `993aae62320bcd92dea011339850986dae4957dd` |
| `docs/sf2h/receipts/WP11/resume-20261114/tests-W6-AR1.json` | historical-receipt-remote-carrythrough | `ac435dd330724bb6cb1d93dd8790de716b5a0216` | `ac435dd330724bb6cb1d93dd8790de716b5a0216` |
| `docs/sf2h/receipts/WP11/resume-20261114/tests-W6-H1.json` | historical-receipt-remote-carrythrough | `9ae005d8cbfe032e43aeb7ba9c50cfbd9cbb45ce` | `9ae005d8cbfe032e43aeb7ba9c50cfbd9cbb45ce` |
| `docs/sf2h/receipts/WP11/resume-20261114/typecheck-W6.json` | historical-receipt-remote-carrythrough | `c20033354b1c6fba667fc080e0421206a749298d` | `c20033354b1c6fba667fc080e0421206a749298d` |
| `product/analytics/source-navigation.ts` | already-identical | `c6f3d5cf5772b588cb0da9f0648ce69f8775f357` | `c6f3d5cf5772b588cb0da9f0648ce69f8775f357` |
| `product/analytics/view.ts` | preserve-newer-finance | `9b279523da60f18eebdc270707d1b42c865e3dca` | `4a6d481a8c7de805d7e13a3d3ab334beffd5692e` |
| `product/planner/scenario-port.ts` | already-identical | `fc15d2d9130e23d0a290f5a14f61423152d2c72c` | `fc15d2d9130e23d0a290f5a14f61423152d2c72c` |
| `test/product/wp03/scenario-engine-fixture.ts` | already-identical | `fd6a6b8b75152e858961360d16f7432233700b2f` | `fd6a6b8b75152e858961360d16f7432233700b2f` |
| `test/product/wp03/scenario-qualification.test.ts` | already-identical | `8ba0ad3e8e4ce04df044dbe77df8e745008f5191` | `8ba0ad3e8e4ce04df044dbe77df8e745008f5191` |
| `test/product/wp05/planner-origins.test.ts` | already-identical | `bf92905dccfd01eaedc624841d808d5ce21b6f21` | `bf92905dccfd01eaedc624841d808d5ce21b6f21` |
| `test/product/wp11/calculation-history.test.ts` | already-identical | `ae99e63e1e9987be91c46d231bba05ec24748ca1` | `ae99e63e1e9987be91c46d231bba05ec24748ca1` |
| `test/product/wp11/calculation-persistence.test.ts` | merge-own-diagnostics | `a120cda86e58c479d8d2cab34f85a908c8a4e578` | `f0d1d60a0426cd10a5f559b4bcf0fc2858bae60c` |
| `test/product/wp11/case-port.test.ts` | adopt-exact | `42cbc7e3440192c71df79e6adbe86f95aa75e6df` | `42cbc7e3440192c71df79e6adbe86f95aa75e6df` |
| `test/product/wp11/choice-prepared-execution.test.ts` | adopt-exact | `08e0b05c8f35225b80d580d61ef5983fd6fc3032` | `08e0b05c8f35225b80d580d61ef5983fd6fc3032` |
| `test/product/wp11/cross-domain-execution.test.ts` | merge-current-source-projector | `296a878ea43768d2df3b2d75396ae07e411f2168` | `2be9d8b282315bf6c030eea4b92e1fd39ed20d55` |
| `test/product/wp11/fixture-trace.ts` | adopt-exact | `23ed2604b5a8b11d392e57f0424d3d806aaf03a1` | `23ed2604b5a8b11d392e57f0424d3d806aaf03a1` |
| `test/product/wp11/renewal-choice-fixture.ts` | adopt-exact | `35281782202c59bb61c49e68ff206ee22183464e` | `35281782202c59bb61c49e68ff206ee22183464e` |
| `test/product/wp11/renewal-choice-history.test.ts` | adopt-exact | `6dcb733518a225039da3e7d7f39ff1c63a35fb09` | `6dcb733518a225039da3e7d7f39ff1c63a35fb09` |
| `test/product/wp11/renewal-coverage-fixture.ts` | adopt-exact | `d1b8c7b91c071ee970ff217c3a2745d84b99486b` | `d1b8c7b91c071ee970ff217c3a2745d84b99486b` |
| `test/product/wp11/renewal-human-choice-fixture.ts` | adopt-exact | `55c04318f2196d24f9d3e94eb99dffb0915c593f` | `55c04318f2196d24f9d3e94eb99dffb0915c593f` |
| `test/product/wp11/renewal-operation-verifier.ts` | adopt-exact | `f83ca8b14429905f84d42d27bb57e8b19d7aba42` | `f83ca8b14429905f84d42d27bb57e8b19d7aba42` |
| `test/product/wp11/renewal-restart-reader.ts` | adopt-exact | `3086ebdaf8049ab38cc0855934389bdec3f251c8` | `3086ebdaf8049ab38cc0855934389bdec3f251c8` |
| `test/product/wp11/renewal-source-fixture.ts` | adopt-exact | `fb973752979eb98ba2e1c3c9002ade471443b728` | `fb973752979eb98ba2e1c3c9002ade471443b728` |

## Checks and next actions

Only deterministic metadata/import-path checks were executed. No Bun, product tests, remote mutation or CI dispatch was performed. Parent owns publication, surgical exact-snapshot Actions and independent review; existing inflight outcomes must remain attached to their original W/S pins.

The case/mutation no-op fix being produced by the independent composition worker is outside this intake and may change the final publication tree.

## Decisão de publicação do grupo

O recibo histórico `resume-20261114/artifact-download-verification.json` já publicado permanece intacto. A revisão recebida da PR40 é armazenada separadamente em `finance-20261114/pr40-2bf019-history/artifact-download-verification.json`, pelo blob original `88c19d5114d48f3f3366b8e732fdbd089ffc50b6`. Os16recibos novos mantêm seus caminhos e blobs originais. Seus checks históricos não são atribuídos ao Finance.

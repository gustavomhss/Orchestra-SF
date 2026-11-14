# Finance resume performance — checkpoint 03

## Confirmed evidence

W2 product 95f474484fb49cedb563ed3d02a61e9638d6784d passed S2 (run43628402812/job132549346211):15tests,159assertions. One discovery search instead of two;9instead of18internal previews;2instead of4search unit issues;8consumer previews and4revalidations retained. Fresh persisted recertification used0searches,4unit issues,10previews and2root checks; forged evidence, swallowed write poison and final Request revocation refused. See S2-result.json.

S3 (run43629238602/job132551927313; W2/S10750da63ec539002a014b598a8e40afb817ec22) failed the unchanged180000ms fixture guard. Active phase was confirmed.exact→confirmed.preview, after both coverage qualifications and sample writes. 18assertions reached; threshold15000/15001, historical read/replay and reopening were not reached. Omitted evaluation28621ms; choice9825ms; confirmation43619ms; confirmed interval26942ms; qualifications17464/18478ms. Inclusive nested times are not additive. No global or FIN-IND-005 acceptance.

W3 189cb74252b3b6aa160038da4410b1c7cdcaa31b changed tests/receipts only. S4 (run43629852422/job132553814068; Sff04e4ff973f3369fb71b0fe5c058f4b98249996) isolated the second cause in433.55ms including fixture: two real sibling results were correct, two complete case reads preserved, but16C08 read envelopes versus expected10. Failure occurred only at count assertion after5earlier assertions (6total).

## Additional narrow correction

Only product/decisions/result-store.ts and product/planner/stored-scenarios.ts change in this product delta.

The factory registers function provenance, never authority/results. Only the original scalar reader identity can use grouped C08 projections. Overridden scalar facades keep the existing per-occurrence loop. Swapping the method or complete store during an await refuses the operation instead of falling back.

Each successful occurrence still executes4explicit host revalidations,2case authorizations and2source verifications. Three independent C08 phases remain; final C08 follows all surviving sibling callbacks and compares the entire case and stored record. The caller retains projection work and both full-case observations. Grouping namespace envelopes reduces namespace-level ingress/egress authorization overhead, not the explicit per-result callbacks. This is not a cross-domain atomicity claim.

readForCalculation/readHistoricalCalculation, ancestry, writes/CAS, result schema and external contracts are unchanged. No WP10, host-binding or finance-journey paths change. No new timeout or local product execution.

## Next gate

Surgical Actions: real sibling/duplicate/facade count tests; new final-source/case/result/Request/lease/reader/store mutations; existing scenario-batch and result-store boundaries; affected numeric/replay/units regressions. Long journey can run again only after this material correction passes. Existing global criteria and dependencies from the original handoff remain open.

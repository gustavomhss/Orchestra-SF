# C17 replay performance: observed failure and directed measurement

## Observed S5 failure

The scoped S5 execution reported `nested C17 calculations reopen through persisted canonical requests and replay every ancestor` at **195,910.67 ms**, above its existing **180,000 ms** limit. The relevant normalized log is `test5-clean.log`, SHA256 `4b9345bc9a037fbc712f2154f3b4a8856376abb691f87b0e2f6267439e534dd7`. That failed result remains a failed gate.

The following historical-calculation test failed with `Real UI authority unavailable`. That is a separate deterministic fixture error: `plannerFixture.admit` defaults to an unconsumed admission, and the real UI authority exposes its private `Request` only after `validate` consumes the admitted intention. The correction passes `consume=true` through the existing fixture admission path. It does not fabricate a trusted context or change production authorization. The 55-second setup recorded for that following test does not, by itself, identify the source of the C17 replay timeout.

## Static accounting, not a measured profile

The nested-persistence test first calls `createWp05SensitivityFixture`. That fixture constructs and persists scenarios, comparison, criteria and sensitivity before the first C17 assertion. The new sibling-case batch can reduce this setup cost even though it does not change the C17 issuer.

For one successful `createPlannerCalculationEvidence.issue` invocation with nested evidence, static tracing gives these direct source-verification paths for the requested result:

| Path within the issuer | Calls to the requested result's `verifyCalculationSources` |
| --- | ---: |
| Two request loads; each load performs two result reads with two source checks, plus two request-source checks | 12 |
| Two direct result reads, each with two source checks | 4 |
| Two explicit request-source checks in the issuer | 2 |
| Total inferred from the call graph | **18** |

The number 18 is inferred from the current control flow. It is **not** a measurement of all C08 reads, all source checks, all ancestor issuances or all domain replays. The generic result-source verifier also resolves calculation references in this test, and both canonical scenario simulations re-resolve assumption evidence. Each ancestor issuance performs its own full checks. Those nested paths can therefore multiply the work beyond the table.

The existing checks protect different observation boundaries: request persistence, result persistence, source closure, actual engine replay and final authorization. No authenticated phase token currently permits replacing all those independently observed values with one reused result. Removing a callback, accepting a cached authorization or parallelizing callbacks that a host might not support would require a separate correctness argument. No such production change was made for this diagnosis.

## Instrumentation supplied

Only `test/product/wp11/calculation-persistence.test.ts` is instrumented. Its original scenario values, C17 references, canonical producers, assertions, reopening, revocation checks and 180-second timeout remain intact.

The test now emits start/completion/failure records with elapsed time, phase duration and counter deltas for:

- Sensitivity fixture construction.
- Inner and outer scenario simulation, result persistence and canonical request registration.
- Inner issuance, outer issuance and resolution.
- The conservative record-only result/request refusals.
- Reopening, the reopened request and reopened issuance.
- Source revocation checks and cleanup.

Counters observe the issuer's request/result-loader boundaries, generic result-source verification, result-store calculation-source hooks, request-store source hooks, record/calculation evidence resolutions and canonical replay callbacks. They include descendant work occurring through those same boundaries; they do not claim to count every raw database read or every internal verifier call.

This is diagnostic instrumentation, not an optimization or a passing receipt. Actions must establish which phases consume the time and whether the previously published case batching brings the unchanged C17 test within its limit. Any later optimization must preserve the closure, current authority, full reference equality, both actual replays and the final C08/source fences.

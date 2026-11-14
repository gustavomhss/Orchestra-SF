# W22 — Historical Memory observation scope

**Status: frozen builder package; hosted CHECK and functional CI pending.** No local product execution, foreign edits, remote mutations or native/global acceptance occurred.

## Recorded failure

Baseline product `532da498e08fa36fadbd3c01e3e7da00d869dd47`, tree `5dcac0d207da530a4ff9b8f3ccd39e2e1cd2ef1f`; snapshot `43e3f3cc819a0e154dbe927662a0b473ffa6a401`. W21 run `43604032487`, job `132474686748` ended in failure. The complete Memory section is retained in `W21-memory-excerpt.txt`, with raw-log identity and parsed observations in `failure-provenance.json`.

| Phase | Observed time | Persistence API calls | C08 reads | Exposed case reads | Canonical Atlas reads/completed |
|---|---:|---:|---:|---:|---:|
| prepare, returned ok | 84,840 ms | 24,954 | 738 | 24 | 2 / 2 |
| verify, deadline interrupted | 136,224 ms | 40,050 | 1,042 | 33 | 2 / 2 |

The test consumed 225,021.63 ms. The cooperative deadline remains **225,000 ms** and the outer Bun budget remains **240,000 ms**. Persistence metrics count calls to transaction APIs, including nested calls; they do not count physical commits. Exposed case-read counts include reuse and do not count only complete producer replays.

## Demonstrated cause and correction

The previous scope covered only `business.caseRecall`. `readSfMemorySelection` performed its initial and final complete case projections outside that scope. The verifier additionally called `readRecallSelection` before and after the memory read; the real reader reads the current case, the selected candidates and the checked candidates. With the one-case fixture, each selection reader repeated the same case three times. Every complete case projection performs its two canonical evidence contexts and two scenario-operation checks.

W22 gives each whole observation its own scope, including those surrounding selection reads. Its first case and Atlas proofs still come from the complete canonical producers. Each later reuse still opens real C08, reads the complete protected state and source fences, authenticates the principal and checks Request identity/all headers, binding, lease, selection, reader, environment and semantic day. Only completed results are cloned. The existing full witness, eligibility, first-read behavior and invalidation functions are byte exact against W21.

The authorized recall enters through a private one-use callback captured for that observation. A public `business.caseRecall` cannot join an active scope, including before the intended recall begins. This avoids an implicit “first matching call” admission that another same-context invocation could consume. The callback requires exact context identity and input digest before and after the canonical await, and claims its admission synchronously. `finally` closes the scope, clears its proof maps and removes only its own active entry.

Prepare still creates two sequential independent observations. Verify and output validation each retain their own two independent observations. No proof or pending Promise crosses between these observations. The host injects the runner only for exact `caseRecall === business.caseRecall`; custom or absent bindings remain canonical. Native, missing-selection/reader and ineligible Planner/mixed/timed-approval paths retain canonical readers.

## Static cost model, not measured gain

| Work, one selected case | W21 complete case projections per observation | W22 expected complete case projections per observation |
|---|---:|---:|
| prepare | 3 | 1 |
| verify | 9 | 1 |

The new `evidenceContextReads` counter records actual calls to `business.context.context`. For the prepared fixture, each observation has two contexts in the first complete case producer and one explicit source-context read. The test therefore expects **six** for each pair of independent prepare/verify observations. Atlas uses its internal BCS `.resolve`, so it is not counted by that proxy. Two canonical Atlas reads and two successful completions remain required for both prepare and verify. W21 did not record the new counter; its 14/38 context estimates are static call-graph estimates only.

## Evidence prepared for hosted execution

The whole `historical-memory.test.ts` remains the primary regression. A new early interleave at the second C08 fence, before any canonical Atlas read, tries a public recall with the same arguments and context and requires refusal while the intended observation still succeeds. A late interleave also refuses another observation and public recall after canonical Atlas completion. The complete old assertion tail, including original/current historical proof, source/capture/principal/day/lease/final-header races, detached reads, same-Request fresh scope and stale-analysis lifecycle checks, is byte exact.

The test uses the real SQLite/C08 authority, original capture, source mutation, scanner, Atlas and continuity proof. Existing structural model-output metadata remains explicitly unexecuted. No model, Session or native publication is inferred.

Select the complete historical-memory file and the existing complete `analysis-services.test.ts` for consumer compatibility, alongside the parent’s hosted CHECK. There is no new test path. Do not widen budgets, select only a positive fragment, transfer W21 results to W22 or report the static estimates as measured performance. Completion of the entire file is still pending; first proofs and later negative probes have real cost.

## Frozen product identities

| File | Git blob SHA |
|---|---|
| `memory-case-read-scope.ts` | `907d1a0c48389af4b32cc958d53d2b1a7ae1fcc3` |
| `business-services.ts` | `da80511814c86214a963fc721fda4a3a891df147` |
| `analysis-memory-evidence.ts` | `7f59bd020ee61d1a88e41b915943080db156bdaf` |
| `input-producer-memory.ts` | `34c9d636ae3f1ea4ff35268cb777dd095c70f51f` |
| `analysis-verifier-memory.ts` | `31a3db47ff70eb22a33c5b411995e489211f863d` |
| `analysis-host-services.ts` | `6b5f44ef8eb4d969cfc43fbbad4d0f2e923d5c1b` |
| `historical-memory.test.ts` | `463483caed199961c7212daacc5822f0646c493e` |

`manifest.json` records full repository paths, source/before/after identities, package copies and each regenerated diff. `changes.patch` contains exactly these seven deltas against frozen W21. `readonly-dependencies.json` pins twelve unchanged causal dependencies; all remain exact W21. The old WIP patches containing `recallAvailable` were replaced by patches generated from the final private-callback bytes.

The auxiliary audit by `/root/c17_composition/w22_observation_audit` found no concrete blocker in these bytes. It is a builder check. The three independent reviewers, hosted CHECK/functional result and eventual global epic remain separate outstanding gates.

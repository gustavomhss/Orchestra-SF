# Independent review — PR40 d777 intake

**Verdict: no static blocker for the seven frozen test/helper paths. Runtime qualification remains pending on the exact composed candidate.**

Base Finance W29: `96fc3162ae309f8b91b2c55524335026f8704714`, tree `d3fa003182dd1c38778b37e7b7219a5015bb58a2`. Source PR40: `d7775d6f1eb17af1590ccfb98547259eb017cd1b`, tree `e6831add3e891e020d34540234bd685a7dd05e01`.

## Exact reviewed bytes

| File under test/product/wp11 | Candidate blob | Intake | Old → new expect lines |
| --- | --- | --- | ---: |
| calculation-history.test.ts | `7cda99c2d2a0ae9f0400d95f6b4ffae9f1935842` | merge-additive-preserve-finance-negative-or-diagnostic | 41 → 45 |
| choice-prepared-execution.test.ts | `326a262f17914de6675657dd1e6f82baec31e5c3` | adopt-exact | 35 → 35 |
| hot-topic-snapshot.test.ts | `447ae83e4a49175f6751138d44d3221f364b0731` | merge-additive-preserve-finance-negative-or-diagnostic | 52 → 53 |
| promotion-coverage-proof.test.ts | `73f0e3b3b7e5579f2cc645503d78f067d9b832c9` | adopt-exact | 39 → 39 |
| renewal-choice-fixture.ts | `d5395570b44366fa81003d5f5aa68a3023c26fa5` | adopt-exact | 0 → 0 |
| renewal-choice-history.test.ts | `cbce0fa5bc9cff4131ce540e98e05db70574015b` | adopt-exact | 41 → 44 |
| renewal-source-fixture.ts | `3c1caeff08728b3e0c2aed8ae916c0754ad6318d` | adopt-exact | 0 → 0 |

Five adoptions equal source bytes exactly. Both merges differ from their source by one explicitly preserved Finance item. Candidate captures, local files, W29 backups and source copies were hashed independently; all declared blob and SHA256 values match. The JSON records14 unchanged supporting/canonical blobs. The33 inherited receipt paths are absent from the W29 manifest and therefore do not overwrite historical receipts.

## Canonical boundaries and composition

### Auxiliary source projections

sourcePlanner still delegates to createPlannerPort.compareForecast. The canonical port authenticates the actor, applies Planner roles, validates exact evidence/project/principal/source scope and projection digests, rereads source/projection, and revalidates authority. Explicit unavailable coverage yields a conditioned auxiliary FinancialAnalysis; the three changed consumers use only its canonical DomainProjection, not that analysis as evidence of complete comparison.

### C10 remains canonical and classified

Baseline.register still validates projection context/source identity, resolves exact fresh evidence, calls canonical classifyCoverage/assessCostCoverage, persists supported classification and locks source/basis checks. The classified sources object and Planner remain wired to mutation.addAlternative, comparison/criteria, sensitivity preview, and the final classified projection. No locally supplied complete assessment replaces these producers.

### Initialization order

The baseline constructor only captures the projectForecast callback. sourcePlanner is initialized before preparePhase/register can invoke it, so the forward lexical reference does not introduce an observed initialization-order defect by inspection.

### Readonly verifier composition

W29 helper blob2338917427497733e4bd88aec852985206cce066 is unchanged. The new operationSources adapter still resolves only existing references through current.sources and now returns a constant unavailable coverage result. Its actual source reads are the same raw LocalStore readonly projections; no scoped issuer, C08 write, nested commit or new transactionAll is introduced inside its read scope. The canonical operation verifier and source-only projection, ingress/egress revalidation, signal checks and no cross-call cache remain.

### Twelve-month confirmed training quote

The old f vector and new f0 through f11 payload both supply eleven explicit confirmed zero forecast months and the November amount40000 through the real Planner save command. Runtime planner.ts first assigns vector fields or individual monthly fields then normalizes the same forecast vector, separately from annual budget handling. This is static input-path equivalence, not runtime proof. CAS, version copy, original-source digest, currency and amount70000 for implementation remain.

### Additive historical calculation merge

Candidate7cda99c2 equals PR40 source9f804318 plus exactly the Finance assertion that the old revoked context remains denied after a renewed context successfully reads the stored result. Four source additions verify requestFor old context absent, distinct new requestId, same principal, and active renewed lease after source-edit negatives. Every old assertion remains in order.

### Additive Hot Topic merge

Candidate447ae83e equals PR40 sourcef3f66378 except preserving Finance detailed canonical error text. It keeps canonical status open and adds explicit proof the official concurrent command committed, while preserving exactly-one Dashboard snapshot, no private write, audit/source edit and Planner unchanged. Additional Procurement initialization uses the canonical lifecycle.

### Original oracles

All208 prior expect-containing lines remain in order. Eight lines are added: four calculation-history, one Hot Topic, three training calendar checks. Existing explicit180000ms timeouts and default-timeout omission remain unchanged. No assertion was removed or relaxed.

## Limitations and required next evidence

- This review did not execute any product code, imports, Bun, tests, typecheck, guards, CI or native runtime. No runtime pass or performance gain is inferred.
- The source-only auxiliary port intentionally exposes conditioned FinancialAnalysis with unavailable C10. It must remain confined to source projections and operation admission; it is not a complete decision/comparison producer.
- The real readonly transaction retains the lock across callbacks and a coherent snapshot for each invocation. It does not prove freshness after releasing the lock, application authorization, a generic source-issuer wrapper, or installed replay.
- The three new read-scope cases and affected full history/revision/implementation/BI consumers remain necessary on the composed candidate. Additional changed calculation-history, promotion and choice-prepared-execution files need their scoped selection.
- 33 historical receipt paths are new relative to W29; their source bytes may be preserved without transferring their status or old run qualification to the current candidate.
- Installed/native proof, accepted independent C/D review and S0 final bundle epic remain separate. No READY/DONE claim is made.

No source, remote ref or user-facing file was altered by this reviewer. Metadata-only Python checks and scratch report writes were performed. No product import/execution, Bun command, CI dispatch or native process was performed.

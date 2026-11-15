# P7 v2 — revisão estática independente

**PASS estático, sem bloqueio objetivo identificado nos hashes abaixo.** Não compilado ou executado.

Esta revisão substitui o parecer v1 para o próximo candidato. V1 permanece histórica e não foi executada. A revisão dos pares encontrou que a ausência inicial de Request retornava denied dentro do work, mas o guard posterior a classificava como stale. O delta v2 resolve essa classificação antes de entrar nos leitores, sem alterar a assertion.

Material SHA256: `6302975fc3bf0446f38dc9bdd7e9158197da3875288fc572e95b334c6ba3558f`.

| Arquivo | Postimage |
|---|---|
| `apps/cli/src/sucafina-product/known-subtotal-metric.ts` | `0fbe3adf8280621b93972385e3af36dfa833c831` |
| `apps/cli/src/sucafina-product/portfolio-authority.ts` | `632a47e792502d7476149d2b790ad447cbd96649` |

## Achados estáticos

### P7-CA-01 — Applicability and failure routing

Only requested known-subtotal metric with two distinct scenarios enters the proof. Unsupported shapes are classified after successful history/current-case reads, before narrow projection proof. No operations/assumptions, USD, a non-null stored known subtotal and Planner-record-only result evidence are required. Exactly one base Planner-version ref must bind the alternative. The sentinel is not returned after any eligible projection/source/coverage/freshness failure. Catch returns unavailable. portfolio-authority falls through only for the exact unique symbol.

Limite: This is an intentional private producer with a restricted domain; general mixed, document, operation and unsupported shapes retain existing producer behavior.

### P7-CA-02 — Canonical financial calculation

Both current canonical projections must match stored scenario component digests. The known subtotal is recomputed by the existing plannerKnownSubtotal in original component order and checked against the stored result; a wholly absent projection is null, explicit zero is accepted, and non-finite component/subtotal values fail. Final comparison delegates to comparePlannerScenarios with genuine result/coverage/basis/source/projection proof objects. Both independent observations are compared again before publication.

Limite: No handwritten difference formula replaces the canonical comparator. Comparison status can remain conditioned; the metric does not invent complete coverage or approval.

### P7-CA-03 — Authorization and request integrity

The helper captures host/business/persistence/authenticate/environment/requestFor/revalidate identities, trusted binding identity and digest, lease identity, Request object/header/method/URL fingerprint, input clone/digest and all delegated business reader identities. current() checks after every awaited proof and before egress; aborted or changed requests fail. Initial/final host revalidation remains, as do canonical cases.read, result-store, Planner evidence and coverage authorizers.

### P7-CA-04 — Freshness and independent phases

Initial historical batch and exact current whole-case observation bind id/incarnation/current version. Historical case versions may precede but never exceed current version; each alternative must be a unique digest match. Each of two proof phases freshly invokes the real projector, source reader and coverage reader for each scenario. Projection/source arguments are cloned and fingerprinted. Phase observations are retained independently and compared using the canonical projection digest. Final history and whole-case reads follow all proof callbacks; no external awaited work occurs inside work() after final case verification.

### P7-CA-05 — Canonical snapshot and guarded producer closure

readPortfolioSnapshot remains the canonical helper from exact source59 blob3cf82bd. It preserves Dashboard transaction admission, Source/CurrentChoice wrappers, root method/request/authority/payload fences, poison behavior and final egress. The Planner projector30e67 reads the actual authorized Planner projection twice and verifies source envelopes and period. Coverage25e605 independently reauthorizes case and evidence twice. No direct store bypass, fabricated projection, reusable result cache or cross-invocation scenario cache is introduced.

Limite: Source59 remains an isolated proposal dependency; this review grants no release or integration authority.

### P7-CA-06 — P6 general path preserved

Deterministic text comparison proves portfolio-authority's entire legacy readMetric body from const captured = structuredClone(request) to const rules is byte-identical to cb89ba0139a7cf3965e0bb2898ab13f3015d7837. The registry and remainder are byte-identical too. The real resolveMany batch wrapper, per-invocation observation map and all fallback final checks therefore remain unchanged. Only one import, factory construction and exact-sentinel dispatch precede that body.

### P7-CA-07 — Type and API surface

Request and metric types derive from the canonical registry; PortResult non-ok variants are reused. DomainPortHost and PlannerSourceHost match exact imported interfaces. business-services returns the already existing projectPlannerEvidence function with compatible selected-period/USD arguments. ResolvedScenario/ScenarioResult components match existing comparator signatures. Type-only factory imports are used only for Parameters/ReturnType. readPortfolioSnapshot generic permits the status-discriminated InternalResult. All new canonical import targets were read from immutable W09.

Limite: This is source inspection, not a TypeScript result. A45/compiler and surgical hosted qualification remain separate.

### P7-CA-08 — Protected ownership and policy

Only new private host helper and portfolio-authority proposal change. Criterion rule authority/verifyMetric/verifyEvidence/verifySnapshot code remains exact. There are no new grants, writes, seeds, mutation calls, policy/approval transitions, C12 changes or CurrentChoice edits. confirmed is the existing metric evidence state produced only from canonical complete comparison; it grants no formal financial approval.

### P7-CA-09 — Initial Request denial classification

The exact sole functional delta adds if (!request || request.signal.aborted) return { status: denied, reason: criterion-metric-access-unavailable } immediately after requestFor. Missing or already-aborted initial Request now returns before fingerprint, snapshot work, delegated readers or final stale guard. Assertion remains denied; later in-flight changes still follow the existing stale/failure fences. No policy/grant or successful path changes.

## Limites

- No installed journey PASS, numeric-rule acceptance or latency improvement follows from this static review.
- Nominal09 remains3PASS/2FAIL: J1 third comparison after rule save aborted; financial Requests503 unchanged.
- Exact complete candidate needs its own unchanged five-journey qualification and any required owner checks. Source59 R2 and P03 outcomes do not transfer.
- This verdict binds only the exact material SHA256 and two postimages above; later changes require delta review.

O controle posterior1f01a01f mantém71/74/76 preparados; nenhum novo C ou ACK71 foi observado no targetfaa30fddb. P7 não muda os paths canônicos76 nem aplica transporte74. `GLOBAL_RELEASE=false`.

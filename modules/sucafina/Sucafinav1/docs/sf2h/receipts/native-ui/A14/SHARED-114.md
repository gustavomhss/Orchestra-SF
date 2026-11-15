# A14 → 114 / I00: shared integration proposal (INERT)

This file is handoff content only. No shared registry/package/export, generated
client, native host, admission logic or producer was changed by A14.

## Package exports (only owner 114)

Add the following two entries to the existing explicit export maps:

Schema package packages/schema/package.json:
    "./sucafina/memory": "./src/sucafina/memory.ts"

Client package packages/client/package.json:
    "./sucafina/memory": "./src/sucafina/memory.ts"

Do not add wildcard exports or a parallel SDK.

## Closed operation metadata, from the frozen catalog

operation ID | method | path | fixedQuery.sf | schemaExport
intelligence.memory-catalog | GET | {mount}/dashboard | memory-catalog | SfIntelligenceMemoryCatalog
intelligence.memory-conditions | GET | {mount}/dashboard | memory-conditions | SfIntelligenceMemoryConditions
intelligence.memory-signals | GET | {mount}/dashboard | memory-signals | SfIntelligenceMemorySignals
intelligence.memory-materiality | GET | {mount}/dashboard | memory-materiality | SfIntelligenceMemoryMateriality
intelligence.memory-outcome | GET | {mount}/dashboard | memory-outcome | SfIntelligenceMemoryOutcome
intelligence.memory-condition | POST | {mount}/dashboard | memory-condition | SfIntelligenceMemoryCondition
intelligence.memory-outcome-selection | POST | {mount}/dashboard | memory-outcome-selection | SfIntelligenceMemoryOutcomeSelection

In I00's central registry, retain the metadata-only full 305-entry list without
an import of the A14 leaf. Once the F02 typed transport exists, admit precisely
the seven SfMemory.operations bindings into the central schema codec map using
the real strict decoder. An absent binding fails contract-unavailable before
network; no Any/Json permissive codec, raw path, generic RPC or dynamic dispatch.

## Producer equivalence and transport requirements

Existing route is dashboard?sf=<selector> and not a new native RPC:
- GET catalog accepts no additional query beyond sf.
- Other GET inputs encode flat caseId, incarnation and numeric positive version,
  plus conditionId only for materiality and choiceId only for outcome.
- POST sends the selection as the whole original JSON body. Distinct producer
  actions are decisions.condition.record and decisions.outcome.select. The F02
  transport supplies approved origin/CSRF and Idempotency-Key, and never retries
  a POST after response loss.
- Signal-list GET may reconcile dedupe state server-side: no stale UI cache or
  synthetic background reconciliation. Preserve error status and access recheck.
- Materiality is computed by the real host. Outcome compares expected/observed
  with cutoff/sourceRefs and causality not-attributed. Never infer cause from
  zero or delta; never replace null with zero.
- Current access, exact case versions, evidence digests, recipient, review grants,
  source fence, revocation, actual transaction and original Request remain solely
  the existing server's responsibility. Schema validation is not a grant.

Pinned and observed producer memory-http.ts blob:
f727d5250024df7338491321c36e7055d7c18f74 (SAME).
All seven operations already have JSON handlers. No CLI server projection
is needed or permitted as a second admission/persistence implementation.

Committed code 2702cfc24db283c6e29272bda41f464ca7bed78f and real ACK
b799592f83f46e133e74a510d23a5a33c4638a36. Native contract
spec is WRITTEN_NOT_RUN; 120 owns surgical CI Actions, 119 compiler and guards,
114 integration and consumer ACK.

Coverage gap: WP14.T02 includes similar cases, but none of the seven assigned
memory-http operations performs a similar-case recall. UI62 requires a
separately admitted real producer/owner; do not broaden this catalog or fake
past memories.

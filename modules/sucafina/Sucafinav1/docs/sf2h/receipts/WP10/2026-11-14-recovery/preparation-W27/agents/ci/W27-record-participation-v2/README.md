# W27 record participation v2 — owned overlay

Base: W26 `a1434e7ea7340aa1d1c8ce6bb48958b724218170`. Two owned files only. V1 is preserved and superseded; it was never applied or published. This v2 remains isolated from staging `repo/`, foreign inputs and earlier seals.

The generic API remains `(incoming, call, work)`. An unexported AsyncLocalStorage owner is created only after the complete witness succeeds inside the actual LocalStore transaction. Identical dependency bundles can participate when every complete input ref already belongs to that owner. Different bundles retain the complete W26 qualification and separate witness; they receive no borrowed authority or closure.

Each participating child executes its actual canonical callback once, revalidates/authenticates/reads environment at both boundaries, reopens defensive snapshot copies and checks full snapshot/source-fence bytes. Its distinct reader/getter and complete input, dependency, Request/all-header, binding, lease and selection predicates remain retained until the owner has completed its awaited transaction egress. No returned projection, pending Promise or successful authorization decision is cached.

## Closed static review findings

Pins survive both child return and protected-callback return. The callback finally closes `open` and `accepting` but does not clear predicates. After the real `await persistence.transaction(...)` returns, the helper checks owner invalid/pending state and every completed predicate before returning or transferring predicates to a surrounding owner. Cleanup happens in the outer finally. Lexical admission is never reopened. The forwarding egress test changes the child reader after the actual LocalStore root closes and verifies denial with exactly one real canonical execution and unchanged durable state.

The owner cannot successfully finish with pending children. A detached continuation carrying a closed token is refused before canonical work and cannot reopen a scope. A mismatch, attempted nested writer, exception or after-work change invalidates owner/ancestors without retry. No returned currentRef extends closure. The exact current-scope materialization function is byte-identical to W26; fresh undefined and the pre-work cold/preferences fallback remain.

## Proof inventory and measurement scope

The existing three bodies, 24 literal expectation calls and 120000 ms budgets remain byte-identical. Fourteen new source cases in the same whole file cover repeated identical real refs and recursive participation, six transient reader/header/auth/environment changes restored after refusal, late reader/input changes after child return, full-ref closure refusal, detached continuation, real transaction egress and a real nested writer. The fixture forwards to actual authority/C08/LocalStore/business producers; it synthesizes no successful product state or verifier result.

The positive assertions of two full witnesses/two context reads apply only to the fixture's shared owner/child dependency bundle. Internal BCS factories have different dependencies and retain full W26 qualification; those witnesses are outside this local counter. Global composition behavior must be observed through Memory A27's real C08 instrumentation. No global elimination count or temporal gain is inferred from this focused proof.

## Remaining verification and cost

This package is a builder artifact, not independent review acceptance or hosted success. No product was imported, built, typechecked or executed locally. The unchanged eight-file A request can select the whole file after publication. Retained pins add a linear synchronous scan per liveness check, potentially quadratic over many completed participants. This deliberately preserves the full root-lifetime guarantee; any performance improvement must be measured in hosted CI.

The separate Memory bridge must qualify the entire partition through the actual atlas namespace grant, retain external sf-memory-case-fence hooks, and compare common full C08/snapshot/source/context/identity components across its external before-witness, authorized partition capture and fresh root entry. This helper does not move those hooks or cache Atlas output.

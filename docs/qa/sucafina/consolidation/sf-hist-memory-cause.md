# sf-hist-memory cause

Run `44329483839` job `sf/test-CI-SF-7` (`134890490891`), head `2e5839eebb`. File `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts`. Not already fixed on `sf-red-clusters`: `input-producer-memory.ts`, `analysis-memory-evidence.ts`, `memory-case-read-scope.ts`, `case-recall.ts`, and `atlas-memory.ts` are identical from `2e5839eebb` to `707ce445dc`.

## Proven

`producer.prepare` at line 292 expected `{ status: "ok", value }` and received `{ status: "unavailable", reason: "analysis-source-unavailable" }`. Stack is that line, not an interleave `expect`. Phase `memory.prepare` counts:

- `atlasCanonicalReads` 1, `atlasCanonicalCompleted` 1, both grouped
- `evidenceContextReads` 2, both grouped
- `caseReads` 7, `caseFences` 9
- no ungrouped selection source read

A green prepare needs 2 atlas reads and 6 evidence-context reads (3 per observation: the case producer's two contexts, then the selection's own source read). The first observation finished its case producer and one grouped `atlas.memory.recall` that returned `ok`, then died before `context.context` and before the second observation.

That is `createSfMemoryInputProducer`: `observeSfMemorySelection` -> `readSfMemorySelection`. The selection returns undefined, and the producer maps that to `analysis-source-unavailable`, when `caseRecall` is not `ok` or its match filter fails. `caseRecall` / `memoryCaseScope.memory` can do that after the inner recall is already `ok`:

- `readMemory` refuses a grouped root that is not `observed` (`procurement-record-read-scope.ts` poisons a nested writer).
- `memory()` refuses when the post-recall fence digest differs from the pre-recall fence. The digest includes full product state and snapshots (`memory-case-read-scope.ts` around the `before.digest !== after.digest` memory check).

The case-read path already allows a first source materialization to change that digest and still return the canonical result. The memory path does not. Copying that exception is not safe: the same test's later probes mutate after a completed atlas read and require `unavailable`.

The versioned egress reopen is not this failure. The cache-hit check `digestSfValue(incoming) !== argumentDigest` compares the current argument to itself. This run never started a second canonical atlas read.

Nested `caseRecall` / `withMemoryObservation` while `active.has(call)` return before work. They do not explain the unavailable result by themselves.

## Not proven

The rejecting predicate after the successful grouped recall is not proven. No test or CI was run. Do not weaken the assertion. Do not edit `analysis-lifecycle-admission.test.ts` or `revocation-tail.test.ts`.

## Unapplied direction

Keep post-atlas external mutations fatal. Stop the happy-path historical current-source observation from writing inside the grouped atlas root. `edit(150)` is a real `domain.execute` save; `context.resolve` already returned `historical` before `prepare`. The current issued scope's `inputDigest` no longer matches that projection (`procurement-record-read-scope.ts` `materialized`). A resolve or `proveContinuity` that issues inside the atlas root would poison it or move the fence. Prove the write site before patching. No product patch is in this commit.

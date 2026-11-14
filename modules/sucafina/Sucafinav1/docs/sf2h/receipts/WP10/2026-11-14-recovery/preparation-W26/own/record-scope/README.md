# W26 Procurement record read scope — isolated candidate

Base publication: `3d59829e5d9e438cbb443428a9479d7f63b5bf31` (W25). This package contains three WP10-owned paths only. It has not been applied to the shared repository, published, imported, typechecked or executed. It is builder work and does not replace an independent review.

## Change

`procurement-record-read-scope.ts` extracts the existing evidence read scope into one generic callback boundary. It requires every supplied ref to be an individual Procurement request, reconstructs the current actor's exact canonical source scope for each one, and runs the actual callback once under the real LocalStore transaction. The complete `materialized` function is byte-identical to W25. In particular, a historical original is preserved: qualification uses the current actor's scope, while original/capture/physical continuity still belong to the canonical producer.

The whole ref array is pinned, without refId deduplication. Request identity/method/URL/all headers, binding identity and bytes, lease identity, selection identity/bytes/expiry, reader identity, authenticated principal, context, UTC day, directory and bank key remain fenced. Each private witness includes the full C08 state, all three source snapshots and source fences. The only new identity guards are binding and lease identity; no existing guard is removed.

The result is `observed` with the actual cloned value, `unsupported` before canonical execution, or `changed`. A failed post-work witness, callback failure or actual nested writer closes the observation with no returned value and no second execution. The generic does not authorize, cache results or retry outside the root.

`procurement-evidence-read-scope.ts` remains the existing one-ref API and re-exports the generic factory for the root's current import. It alone performs the original ordinary fallback when generic qualification is unsupported before work. A canonical `undefined` remains an observed value and therefore preserves the fresh-source fallthrough. Cold C08 and missing preferences authority add no grant or new precondition.

## Tests and limits

The existing `procurement-evidence-read-scope.test.ts` is byte-identical to frozen W25, including its four cases, assertions and 120,000 ms budgets. A25's four passes remain evidence for W25 only.

The added whole test file has three cases, 24 expectation calls, and 120,000 ms per case:

1. Two real BCS resolutions execute inside one actual root; fresh refs, numeric projections and full durable snapshot identity are checked.
2. Removal of the second actual persisted scope, solely as a negative storage probe, causes `unsupported` before work (`executions == 0`) and no durable change during observation. Explicit canonical issuance afterward uses a separate real admitted/validated lease and can write outside the closed root.
3. Mutating the second full ref after two canonical reads returns `changed`, one callback execution, no retry and no durable change.

The fixture uses LocalStore, source lifecycle/projector, C08 and real product authority/UI admissions, source issuer and BCS. It owns a private selection holder derived from the real period and source context. This is a test of the generic primitive; mounted historical Memory acceptance remains the root's separate real `historical-memory.test.ts`. No native, global or timing acceptance is claimed.

The root's Memory/central overlay is only read here. Its full-ref collection and external Memory witnesses form the necessary opt-in closure; ordinary case reads retain the prepared-only helper. Source/capture writer hooks remain outside the generic transaction, and the existing hook assertions are preserved. The recommended captured case-request clone was sent to the root separately.

## Files

- `manifest.json`: exact candidate paths, base blobs, output Git blob IDs/SHA256, and local application paths.
- `changes.patch` and `diffs/`: complete diffs against frozen W25, with new files explicit.
- `audit.json`: preserved guards/tests and limits.
- `import-closure.json`: 28 relative imports resolved in the overlay or verified W25 tree. Two existing imports are tree-verified but not hydrated locally; no import was executed.
- `root-overlay-audit.json`: auxiliary read-only review of the root-owned union, with inspected hashes.
- `seal.json`: hashes of this complete package.

Suggested hosted selection: the existing four-case evidence file, the new three-case record file, and the existing whole historical Memory file with the root's instrumentation. Keep all existing deadlines and assertions. No wall-time reduction has been measured for this candidate.

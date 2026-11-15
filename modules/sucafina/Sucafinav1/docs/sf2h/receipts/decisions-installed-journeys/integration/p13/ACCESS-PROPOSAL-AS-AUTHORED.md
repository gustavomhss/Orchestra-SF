# P13 — fresh access projection, inert owner proposal

This proposal addresses measured repeated copying during installed Decisions authorization. It is not integrated, has no hosted qualification yet, and does not grant release or integration authority to52.

## Evidence and intended behavior

Diagnostic16 ran the unchanged five-case installed UI specification on the frozen P11/C45 candidate. Its third comparison returned HTTP200 and its measured adapter-producer interval was8711.000879ms. That interval included6004 `currentSnapshots` calls totaling3065.590418ms, of which dashboard copying totaled2763.239823ms. Canonical serialization and hashing totaled3002.856392ms across167110 calls. These stages are inclusive; their nested durations cannot be added as exclusive CPU or end-to-end HTTP latency. The subsequent choice POST aborted before an original response was observed. Its commit/capture outcome is unqualified, not proven absent.

The existing product-authority observer uses `roleMap(snapshot, surface)` and `snapshot.data.access`. The canonical role-map implementation reads `data.roleMap`. It does not need the whole `data.__sfProductV1` graph to perform that observation.

P13 adds optional `Persistence.currentAccessSnapshots`. Each invocation copies the current root's own `data.roleMap` and `data.access`, plus all outer Snapshot fields through the existing `cloneSnapshot`/`validateSnapshot` path. It never retains an ACL result, principal, role map, credential, request or permission verdict between calls. The source SQL observations, lock, authenticator calls, access digest, authority before/after checks, scope/abort guards, mutable-root behavior, lifetime fences and budgets remain in place.

The product-authority adapter uses the optional access projection when present. Older persistence adapters retain their existing `currentSnapshots` path. A present projection returning undefined is not replaced by a permissive fallback. This is a capability for the trusted host's existing current root, not an HTTP option or an authority input supplied by a user or model.

## Explicit projection boundary

The existing full `currentSnapshots` implementation is byte-identical. The new method deliberately omits unrelated business data from `data`. It therefore does not claim universal equivalence to traversing getters or invalid graphs in fields outside the projection. It preserves selected property descriptors, rejects selected accessors through the canonical copier without invoking them, preserves prototype checks, rejects data symbol properties, and retains validation/copying of outer Snapshot metadata. Callers cannot use the projection as a source or business-data read.

Readonly roots continue to expose independent copies of the already-admitted business snapshot. Mutable roots are projected afresh on every call, so changes to roleMap/access inside a transaction are not hidden by a memo. A later root still observes current committed SQL; credential reads remain independently fresh under P11.

## Material and dependencies

The three-file incremental patch is against the P11 LocalStore postimage and the exact C51 runtime contract and product-authority blobs. The cumulative owner packet must compose P11's Auth72 connection work with this addition against current target preimages; this incremental patch is not a standalone authorization to apply P11 or write shared source paths.

The prior Runtime59 operations and P11 credential machinery are unchanged. Removing only the added method from the proposed LocalStore produces the P11 postimage byte-for-byte. The product-authority principal body and all state authorization callbacks are unchanged; only the selected current-snapshot provider changes. The static preservation audit is `m52-audit/P13-root-static-preservation.json`.

Before any nominal qualification, the two existing P11 overlays that overlap C51 must be reconciled: host-context with NativeC49 and business-context with the denied-read preflightC50. All diagnostic16 changes must be absent. P12's coverage-selector proposal is not included because the diagnostic measured only about106ms in all full cases-state clones combined, far below the current-snapshot cost.

## Required verification

Hosted surgical tests must demonstrate detached copies, original full-reader behavior, selected malformed/accessor refusal, mutable ACL observations, final lease/access revision rejection, cancellation and ended-scope refusal, fresh committed state in the next root, and exact fallback behavior for adapters without the optional capability. The actual installed UI journeys remain the acceptance path. Neither the static diff nor supplemental unit tests replace them.

No source52 shared live path, sf2-stack, Procurement/C12/CurrentChoice, Reports48 path or workflow45 is edited by this inert proposal.

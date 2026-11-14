# W14 — case work selection, access recovery and published caller intake

Parent product: `4bd1f807e449d040e3db61c4d2b1e177b205ac69`, tree `2459923b94c080688a31a1138e73ddf30c5be744` (W13). This record describes the published candidate; it does not assign an Actions result before execution.

## Owned changes

- Mount a case-bound work selection consumer in the actual Workbench case page. It chooses record references from the authorized case projection, validates a covered period, reads the current case and selection version, and invokes the published selection create/list/cycle ports.
- Preserve an uncertain first save as the exact body and idempotency key. Listing saved selections does not silently resolve an unknown write. A received acknowledgement remains saved even if the subsequent authorized case read detects a concurrent change; it never becomes a second create attempt.
- Keep a first, known precommit `selection-not-committed` conflict separate from an uncertain attempt. The former offers explicit review before another request. This particular branch has static contract support but no positive real execution credited here.
- Distinguish a configured selection with unavailable work composition from a selection with no pending work. The published BCS does not wire WorkSignals or a destination resolver; no empty provider or successful navigation substitute is introduced.
- Purge the entire My work list and its private selectors on authenticated denial. Fence or abort older responses so they cannot reactivate detached controls. Direct selection denial or principal/access-revision changes also notify the existing access-revocation consumers.
- Correct the W13 recipient fixture by composing the real Dashboard record issuer over its existing authority and persistence. The retained BCS is `b289a4a376f937c2cf4b56a00a6c1247152c5798`; it does not expose the private record issuer assumed by that fixture.
- Make the delayed-review counterproof observe response headers and an incomplete exact body before revocation, then the complete original payload afterwards. Retain zero-start, purge and response-completion assertions and the existing 5 s/30 s bounds. This remains a declared transport fixture, with no new domain mock and no claim about the unique cause of W13's header timeout.

The nine owned paths are recorded in [work selection inputs](w14-work-selection-own.json) and [delayed-review inputs](w14-delayed-review.json). The completed destination peer read is in [w14-work-destination-peer-read.json](w14-work-destination-peer-read.json); it supersedes the earlier pending marker in preparation metadata.

## Exact foreign inputs, with preserved closure

| Path | Published owner head | Blob |
|---|---|---|
| `apps/cli/src/sucafina-product/dashboard-services.ts` | Compose `ed10a3806a4ffdf6ad5891e2065d93a4c91412cf` | `0891d178833165fff098e3c05f3a64c5f5b35043` |
| `modules/sucafina/Sucafinav1/product/documents/capabilities.ts` | Operations `ba8a09e371ce8d93eb917eabb102caaee5affaf4` | `6b655187d4444cff5b8966e868ba163191adfc42` |

Both are copied byte-for-byte, with their source hashes, preimages and 27 unchanged direct dependencies in [the intake manifest](w14-published-caller-intake.json). The Dashboard caller supplies the real creation target and rejects nonempty outcome/decision collections that this host has not composed. The Operations caller includes idempotent extraction reuse and final source revalidation for search, so its affected document tests are selected explicitly.

No foreign implementation was authored. The complete new Compose host is held because its BCS/domain closure intersects the unresolved C12 caller-preservation boundary, not because of file size. `business-services.ts` blob `4b02413b5a98e750187fa8f5fa54f3cb2415f4e3` remains a published held input, not the retained BCS.

## Surgical validation selection

The next request contains nine explicit files: WP01 browser startup; WP06 documents candidates and runtime-e2e; WP01 question recipients, case work selection, destination recovery, edit recovery, Workbench HTTP, and browser lifecycle. Existing product assertions remain intact. The document tests exercise the changed extraction/search producer and its actual identity/storage consumer. The Workbench HTTP case covers the changed mounted page. The unchanged W13 state, Hot Topics and thread consumers are not repeated.

Static validation remains `bun typecheck` in the Sucafina and CLI packages and the repository guards against `origin/dev`, in Actions. W13's 13 unique diagnostic locations included two own fixture locations and 11 foreign locations. The own fixture fix and these two published caller inputs address four of those locations by source inspection; the five retained host narrowing locations and four WP07 fixture callers require owner publication. No typecheck PASS is inferred from this analysis.

## Evidence and pending owner work

W13 remains attached to its exact product/snapshot: [81 pass / 3 fail](../runs/43590725536.json), [review](../runs/43590725536.md), and [static failure with guards passing](../runs/43590727281.static.json). The two recipient cases failed fixture setup and do not receive UI proof. The delayed-review case failed before its final business assertions. These results are preserved, not replaced by the intended W14 outcome.

[The foreign static finding](../findings/w13-static-foreign-closure.md) includes two unapplied owner-only patches: separate the `ok`/`preview` type discriminants without dropping contract fields, and reconcile the retained WP07 fixtures without losing the SQLite proof or adding unrestricted authorizers. C12's real Planner partial-domain/replay assertions remain preserved, with the rejected replacement and caller boundaries documented in [the held manifest](w13-c12-held-inputs.json) and [the ownership report](../findings/ownership-closure-w13.md).

C05 whole-review history, F04 draft continuity after write-only withdrawal, C12 lost-Apply discovery after reload, shared WorkSignals/destination wiring, native proofs and global gates remain distinct open boundaries. This increment does not declare either WP DONE. S0 retains final composition, native/global acceptance and the final epic.

No approved plan, original branch, original receipt, engine, deployment, identity implementation or financial policy was changed. No Protocol or Server HttpApi definition changed, so official API generation was not applicable. No product test, typecheck or guard ran locally; local operations were source inspection, file/hash/Git metadata and official CI-request metadata validation.

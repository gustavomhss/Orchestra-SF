# Owner proposal: C17 original-reference and replay reauthorization

Status: **PROPOSED_NOT_APPLIED_NOT_RUN**. Mission35 does not own these runtime paths. These files are receipt attachments for WP10 / PR29 and session33; they are not runtime edits.

## Observed failure and attribution

GitHub Actions run [43645127480](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43645127480), job [132601067130](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43645127480/job/132601067130), executed the mission35 test overlay on composition input `b19606b73f1ffc5a9e58702e939f1aa788dabfa1`.

The unchanged C17 test replaced the real supplier blob from `Price: 42` to `Price: 99`. The canonical document resolution was no longer fresh and released neither `authorizedProjection` nor `currentRef`. The subsequent public composition call `atlas.memory.readOriginal(caseRef, documentRef.refDigest, call)` nevertheless returned the old document reference at test line444. This is a mismatch at the exposed composition boundary: the lower-level capture reader deliberately proves case ACL and persisted integrity, while the composed original-reference path is expected to enforce current source authority.

This observation does not establish a leak through the MCP evidence capability: the observed BCS resolution already refused. It also does not justify weakening the C17 assertion. The original fixture's native-admission limit remains unchanged.

The helper parser failure in the same run (`source` declared twice) is a separate mission35 test defect. This owner proposal does not address it.

## Why the private capture reader remains unchanged

`createSfAtlasMemory.readOriginalCapture` is an integrity/ACL primitive used by historical source resolution and continuity. In `business-context.ts`, record history and calculation history call that private capture path. Adding `evidence.resolve` inside it can recurse into historical resolution, which requires the same capture.

The proposal overrides only `memory.readOriginal` returned by `createSfAtlasBusiness`. It reads the protected capture with the canonical primitive, authorizes the original through the assembled context, rereads the canonical capture, and authorizes the source again before release. Request identity, headers, binding, selected case and capture bytes are fenced across awaits. Historical results remain admissible only with differences and their exact persisted projection. The internal capture-reader and continuity closures keep their existing route, so the new public method does not call itself.

## Latent replay problem found by static reading

The C17 assertions after line444 were **not reached** in the observed run. In particular, the test subsequently expects `emitFromLedger` to refuse after blob replacement.

The current `atlas-memory.ts` settled-outbox branch uses the injected lightweight `authorizeCase` callback instead of `cases.read`. With that callback supplied, it checks case ACL/ledger/outbox identity but never reopens the case's document dependencies. Static reading therefore predicts an `already-committed` result after the document has become unavailable. This is an inferred additional failure, not an observed test result.

The second hunk reopens the real canonical case reader before and after the replay fences. That reader reauthorizes the case's evidence. A receipt remains a read/recovery result: the patch neither appends nor reruns the scanner, and it leaves persisted Atlas/outbox content untouched.

## Exact inputs and complete output

Both preimages are identical at the composed input and the observed owner head `539a3c7f95174190f783debc74e3694d84ca8653`:

| Runtime path under modules/sucafina/Sucafinav1/product/host-binding/ | Preimage blob | Proposed postimage blob |
| --- | --- | --- |
| business-context.ts | 6e0aba2f7aa058cef1b35ecd0c963312e98ef993 | f25faacf0958538858184b4cb926f43061f55375 |
| atlas-memory.ts | 91e8bc8f5d80f83b7756b4647c790cc5e5936d59 | 79717acff408628401336fd4a7f1defa4b5be6ad |

- `0001-public-original-and-replay-reauthorization.patch`: complete two-file unified patch.
- `preimages/` and `postimages/`: full exact preimages and proposed file bodies, intentionally stored as receipt text.
- `manifest.json`: exact refs, blobs, SHA256 values and attribution.

Static artifact processing verified hunk counts and reverse application from each proposed postimage to its exact Git preimage blob. No runtime source path or test source path was written, and no remote mutation was performed for this proposal.

## Required owner validation

The proposal has not been compiled, typechecked or executed. It is not a fix claimed as delivered.

The owner must reconcile current authority/head before applying either hunk. Surgical Actions validation must retain the unchanged C17 test and cover its positive document recall, blob revocation, denied original/recall/replay, and unchanged Atlas/outbox assertions. The original-reference wrapper also needs existing historical-source coverage, because valid historical capture access is intentionally preserved. The extra protected reads in public original access and replay have a real cost; measure them under existing budgets, with no budget increase or source/ACL shortcut.

Do not move `context.resolve` into the canonical `readOriginalCapture`, change scanner behavior, grant fixture permissions, remove assertions, or claim AM05 native acceptance.

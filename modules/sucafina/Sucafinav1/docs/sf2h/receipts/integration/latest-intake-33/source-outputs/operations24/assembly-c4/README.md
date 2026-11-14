# Operations follow-up after partial C4 intake

State: READY_INERT_PATCH_PENDING_SESSION23_INTAKE_AND_ACTIONS_QUALIFICATION.

This is an additive proposal for session23. It does not change the previous `assembly/` receipt directory, any remote source, or the C4 identity. Source is PR23 at `49d29bf4d6512d130307f46e145885949f213ea8`. Exact target preimages were read from checkpoint `402a091485e11d60dff433049c7dedd7fcead687`, whose frozen product candidate is C4 at `253baad3f2ff4af5beac695feae4c2f6372dc2e7`.

## Reconciliation

C4 consumed an explicit partial package from PR23 at `0042a95967ad651fe65ac0da216db6af86ed804c`. Its consumer ACK says `ACK_PARTIAL_SOURCE_AND_SHARED_ASSEMBLY_CONSUMED_LANE_REMAINS_OPEN` and explicitly excludes the later source49 revision. The earlier host and selector assembly is already present. Reapplying the old patch would use stale preimages.

This proposal preserves that intake and derives only the remaining changes from actual C4 bytes:

| Destination | C4 preimage | Desired postimage | Action |
| --- | --- | --- | --- |
| `packages/app-shell/e2e/sucafina/wp04/host.ts` | `8ba8d97ec138265454507852a5ab50b600b96c60` | `8230eb28f322dde255382b74280192f39844724d` | Add the positive attachment byte limit through existing Settings/save. |
| `packages/app-shell/e2e/sucafina/wp04/selection.ts` | `1bfa058531fc84f012dcb8b601d471abd8fa0aad` | Same | Already present; no patch hunk. |
| `packages/app-shell/e2e/tsconfig.json` | `8364221434311400cae3007ea74cc67ddcfde765` | `fd63fd70922e9cc243626b52302ecd7774e4b478` | Add exact Operations spec/helpers and actual host to the existing typecheck graph. |
| `modules/sucafina/Sucafinav1/test/product/operations-functional-closure/mount-boundary.test.ts` | `508f4580d0decb1d5c97208fed650f51d8566045` | `eddc60289524c374f970ea226632a030fc9b994d` | Intake the corrected fixture cap precondition from source49. |

The Operations spec, imports helper, documents helper, installation helper and selector regression are already byte-identical to source49. Their exact identities are retained in `manifest.json`. No replacement is proposed for them. No Portfolio, Decisions, Finance, Memory or C12 producer file appears in this patch.

## Payload and order

`preimages/` and `postimages/` contain complete inert `.txt` copies of all four destinations, including the selector no-op. `shared.patch` changes only the host and E2E tsconfig. `test-source-intake.patch` changes only the corrected boundary fixture. `complete-followup.patch` combines those three changes as an alternative; apply the combined patch or the two component patches, never both.

Only session23 integrates the shared targets. Before intake, reread current destination blobs and compare them with the manifest. If another writer has advanced a target, preserve that change and derive a new exact preimage; do not replace a divergent file using this snapshot. Keep all earlier candidate and receipt records. Accepted material changes require a new candidate; this proposal does not relabel C4.

## Behavior and remaining proof

The host and boundary fixture set `uploadCap` to 16,777,216 bytes through the real Procurement Settings/save command with the current settings revision. This is the positive limit required before the production upload path calls its scanner. Existing approval levels and all unrelated settings remain intact. The cap does not create a scanner verdict.

The production `scanLocalFile` boundary still requires an already approved real ClamD endpoint at 127.0.0.1, provided through `SF_OPERATIONS_CLAMD_PORT`. No service is installed or started here. Missing scanner configuration remains fail-closed. Positive upload/parser evidence is pending until actual scanner admission executes.

All five nominal browser scenarios and all five boundary behavior assertions are preserved. The fixture change adds the required Settings command and a stored-byte-value assertion; no expected denial status, test body, timeout, retry, or selection is weakened.

`verification.json` records exact byte hashes and strict unified-hunk reconstruction. This is text verification only; it imports and executes no product code. The child performing this text verification ran no tests or typechecks and dispatched no CI. The mission's actual Actions results are recorded separately in the parent handoff. After accepted intake, qualify the two surgical regression files, the existing E2E typecheck, and the unchanged nominal five-case request through the existing Actions interface with deduplication. Prior source results do not qualify the new composition. C06 material proof, human timing and native/AM evidence retain their existing boundaries.

## Tooling ownership and exact requests

The E2E tsconfig target is now explicitly owned by tooling26 (`astra-compose`, PR32). Session23 must reconcile that lane's accepted output and current lease before applying this inert hunk. Operations24 does not write that shared source. The original assembly proposal remains historical; use this C4 delta for the pinned preimages.

The exact seven-case auxiliary request is [regression-request.json](regression-request.json). The five-case nominal request remains [../nominal-request.json](../nominal-request.json). The required typecheck is the existing `bun run typecheck:e2e` in `packages/app-shell`, through Actions. No new workflow, dispatcher, test retry or timeout override is supplied.

The completed source check [43641839432](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43641839432) passed generated contracts, module typecheck and guards at `837ff32d178fc754a38e9b42b117c49c5390257a` (zero gate findings, 11 inherited warnings). Boundary run [43641173533](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43641173533) returned 3 pass / 2 fail on source49. Neither run qualifies C4 or this follow-up composition.

## Final documentary checkpoint

Checkpoint `3c0b7df201559223ddf1631c182a409af700ff38` adds only integrator records; all effective patch preimages were reread and remain identical. C4 is unchanged. Session23 closed its bounded integration slice with `TERMINAL_BOUNDED_INTAKE_HANDOFF_TO_S0`; S0 must authorize continuation of that same integrator before the next intake. No new writer or active lease is presumed. See [../final-disposition.json](../final-disposition.json), including the authoritative source49 tree correction to `0d982446f0708975895b59fad3c94d0a53704f58`.

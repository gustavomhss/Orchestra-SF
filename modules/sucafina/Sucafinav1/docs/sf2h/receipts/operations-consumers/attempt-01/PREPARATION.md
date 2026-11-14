# Operations consumers — bounded continuation of PR34

Status at preparation: implementation prepared; hosted validation not yet executed. This document does not assert a functional PASS or global acceptance.

## Authority and preserved history

Repository `gustavomhss/Orchestra-SF`; existing branch `astra-operations`; existing draft PR34 against `sf2-stack`. The live head was read through GitHub MCP and reread before publication: `ba8a09e371ce8d93eb917eabb102caaee5affaf4`, tree `eb427121bcfd8c2511aac31d908f3c0d52c1915e`. It matches the observed starting head; no later product commits were present at those reads.

The previous writer published `OPERATIONS-DELIVERY.md` (blob `d04550f1006b5531f154463d71201d4336e802b2`), `delivery-status.json` (blob `3270bc5e2fb8db221a501adfe269bf9ac3e0a944`) and the terminal D2 receipt at PR34 comment `6876138417`, dated 2026-11-14T10:48:06Z. Subsequent PR comments concern external consumers/findings, not a new claim on these two paths. The new user instruction explicitly assigns this continuation, and mission `operations-consumers.json` at `61eea4adb1fcf0fa50eecf5f6fa5f17e426059e3` identifies this branch, head and bounded write set. This session accepts the delivered head on that positive handoff evidence, not on silence. Any unexpected head movement before a ref update requires reconciliation.

The branch remains the sole product branch for this mission; commits append to that head. No reset, merge, history replacement, new product PR or modification of the original receipts is authorized. `operations-fixes` retains Documents and decision-apply ownership; the other correction lanes retain their assigned files.

## Normative inputs and exact intake

- Fixed plan: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- Review-fixes COMMON: `30e2215749d5295f81fdeafccb9e69ba21d0cdb8`, blob `77528795ad0ac28e077dd070898f758825db12ec`.
- Complete WP04 pack and CI: `a3d29d011ba3607a57914701300f09117a3e2de9`; blobs `1f3eb42761a54b1ce57c9fc330cca2e598b251fe` and `c34ab425e0f3b7dc0899a05826829f38b5af84bb`.
- Root AGENTS: blob `643ec9f8f960895b2e3294f7f2cc25db6f8488e4`; no nested AGENTS in the complete Sucafina subtree or its modules parent.
- `normative-read.json` preserves the 111 WP04 criterion IDs and canonical text hash. Scope remains 15 WPs / 74 tasks / 17 contracts / 1,610 criteria.
- Sourcing input: `a3b7fb9b45d7852a3000e01098336a1aca9526c3`; intake only `product/procurement/monetary.ts`, exact existing Git blob `c9a224b12c13b7cec506be90527300caa7e984fd`. The old blob is `5ed7b1c7e8f140c2820d9e3095a7427374d10f69`. Comparison with the Operations head shows that this is the only changed producer file; its existing runtime/contract and procurement-screen dependencies are unchanged. The complete Sourcing branch is not integrated. PR57 and its source commits remain intact.

## Product changes

1. `runtime/procurement.ts` starts at blob `6cd5783d5b4f6f9c9ed3e15547d59f79ccb5ef72`. Its domain `value`, register projection, Requests fallback table and request detail use the same stage-aware monetary helper. Sourcing EUR100 submitted at FX1.08 remains USD108 after Settings changes to FX2. PO-only presentation projects the future PO separately with the same helper, so its estimate USD200 can be compared explicitly with the sourcing approval USD108. This projection changes no persisted state, policy, scoring, alçada or command semantics. Absent values/FX remain unavailable. Cancelled and real PO states continue to follow the exact producer semantics.
2. The composed `test/product/wp14/source-access-atlas.test.ts` starts at blob `fbe627ffde443ff7e2d3b1204bbcf67523404f41`. Apply the already published `OPS-CONSUMER-02.patch` (blob `2ab9a6b6f18709d5bad95f58247c70ba286a00aa`), preserving both scenarios and all assertions. A single empty `WeakSet<object>` is passed to both `createSfProductAuthority` and `createSfBusinessServices`. No marker is inserted and the service capability stays required. The expected corrected blob is `d7d2a69837560f42438d470b83724c1a61939a73`.

The shorter Sourcing owner patch is reconciled, not blindly applied: adding a set only to the business service would satisfy the type but fail to share the callback capability with the authority. Real contracts are product-authority `6e6338ca557304774051864b47900640e216c031`, business-services `9aee116a091c684ba467f81316d2fb915b3f8758`, state-provider `93fd627e0e5f9a3f439e0649c692b6c46f148750` and decision-host `23d9291b3dcedda36edc4aa4f38856024e3c58f4`.

## External export dependency discovered

`runtime/downloads.ts` is outside this mission's write paths. Its preimage is `fa365f9d350be341348ab69d789e40779c8b9756`. It calls the request-level helper for columns and HTML explicitly labelled PO. After the mandated producer intake, a future PO can borrow sourcing amount, FX, approval and whole-quote line totals. `downloads-owner.patch` proposes the analogous PO-only read projection, without changing persisted data or the producer. The patch is not applied or claimed tested.

Two ordinary regression tests retain the correct expected output. They deliberately do not mark the broken behavior as expected success, skip assertions or weaken the oracle. Hosted results must distinguish this external finding from the authorized runtime and Atlas results. One case follows real commands through export; the two-line case modifies only a discarded read snapshot and does not claim that pending sourcing authorizes PO editing.

## Surgical validation and reuse

Selection consists only of the new monetary consumer file, the new export regression file and the exact two-scenario Atlas file. The request uses the existing Bun default `--timeout 120000`, also present in Sourcing final snapshot `fb440a03e4d712e0d6f40f021997b31a80943a3d`; no deadline is increased. All product execution is GitHub Actions through the existing `test-ci` snapshot protocol. One run at a time; deduplicate product tree, normalized selection, fixtures, config and environment before dispatch. W and S are separate, with only `.ci-run.json` added in S.

Reuse the prior Sourcing producer proofs without rerunning its 58-test selection or five-case revalidation. The new consumer tests explicitly cover runtime paths changed here; earlier greens are not assigned to this new W. Import14 and Apply10 are outside the altered closure and are not repeated. Canonical checks use the existing `astra-operations-check.yml`: package `bun typecheck` in Sucafina and CLI, then `bun run check:guards --base origin/dev`. Guards are not functional proof. The final documentation commit is checked in normal mode; its terminal check outcome is recorded on PR34 to avoid a self-referential receipt.

The test fixture is adapted from the published Sourcing fixture with attribution. It uses actual domain commands, local durable store, source lifecycle, UI authority, C02 and C06. Eight new monetary consumer tests include the narrow display distinction between missing/nonfinite values and observed zero in the quote selector and PO document. Two further tests expose the external export dependency. The Atlas file retains its two scenarios and its scanner/document-fixture distinctions. No local product tests, native worker restarts, engine changes, new access, deployment, full suite or epic are part of this mission.

## Criteria addressed without promotion

Primary IDs: WP04.INV.02/03, CMP.02/03; WP04.T03.CHK.03/04/05, DOD.02, INV.01/02, CMP.01/02, SUC.02; WP04.T04.DOD.01/QLT.02; WP04.T05.CHK.03/04. SD06, SD07, C02, C06 and the actual C17/Atlas caller contracts remain normative. Tests qualify only their observed component paths; external export failures, historic UI/H09/native/human obligations and AM/global gates remain explicit.

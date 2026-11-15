# A13 collaboration — author handoff to 114 / 119 / 120

**Branch:** `sf-ux-a13`  **PR:** [#139](https://github.com/gustavomhss/Orchestra-SF/pull/139)  **Code HEAD:** `4ae17cb6c35dbb214d06882f3ae6dd50bcef62d2`  **Tree:** `89a4b5b56630355060cd0ef43a4a24756eab7115`

## Delivery

Six exclusive A13 files authored and pushed with `SfCollaboration` / `createSfCollaborationClient` and exactly **29** typed source-bound existing-HTTP operations. Schema declarations cover source C17 evidence, case/question provenance, separate actor/recipient thread projections, mutations, relation/handoff, confirmation and answer observation, work presentation, storage versions and failure statuses. No producer, generic dispatch, server forwarder, policy, shared registry or package file changed.

**Source pin:** `product/collaboration/http-routes.ts` blob `a266e12bd80a2ff95922c2492225ced86eda3ac3` at C58 and current preflight; source delta `SAME_BLOB`. Catalog SHA `31dbec1726fd8147156b01dc545726650ffd49e1`. The complete 29-row field/operation/source/route registry fragment is in `REGISTRY_FRAGMENT.json`.

## Exact authored file blobs (all added; preimage absent)

- `packages/schema/src/sucafina/collaboration/fields.ts` — `8a41fc6915dfbdcb76cee6521218c3ab72156749`
- `packages/schema/src/sucafina/collaboration/contracts.ts` — `ffbfd2e1816125a3ae3b8a04a15e4c80f202da08`
- `packages/schema/src/sucafina/collaboration/operations.ts` — `a37dc39b600740af0a78345dfa3d4565256c791a`
- `packages/schema/src/sucafina/collaboration.ts` — `03bb179e7e6260aaded62fba075c4def3bdd7b46`
- `packages/client/src/sucafina/collaboration.ts` — `79dc64adc03103300e48f0fae8a75e8d5f7ce64f`
- `modules/sucafina/Sucafinav1/test/native-ui-contract/collaboration.test.ts` — `1cf009887afbe56f8191dd32dd9da64e9a06682b`

## Integration handoff / inert shared edits for owner 114

1. **`packages/schema/package.json`** previous blob `adc53ecfa8f4ac83fee37854db2dc0ec2bb9136a`: add to `exports`: `"./sucafina/collaboration": "./src/sucafina/collaboration.ts"`.
2. **`packages/client/package.json`** previous blob `4cd0244e98ff18b5e65d3c2808196705095b6691`: add to `exports`: `"./sucafina/collaboration": "./src/sucafina/collaboration.ts"`.
3. **`packages/schema/src/sucafina/operation-registry.ts`**: declaratively incorporate all 29 operation metadata rows in `REGISTRY_FRAGMENT.json` (owner I00/114). It must NOT import the A13 schema leaf. Per-entry exact `POST` method, `{mount}/{surface}` path, `?sf=collaboration-*` selector, original HTTP headers, and `source-envelope-preserved`; no retry.
4. **`packages/schema/src/sucafina/index.ts`**: only here import `SfCollaboration` and extend `SfNativeOperationBindings` with all `SfCollaboration.operations` once the actual F01/F02 stack is admitted.
5. **F02/CLI router**: use frozen `SfTransport` and original JSON endpoints. **No** `apps/cli/src/sucafina-product/native-ui/collaboration.ts` is needed or authorized as a duplicate server forwarder. Current browser A13 branch itself does not have F02; integration must supply it.

These are proposed shared patches, **not applied**. Preimages must be verified at 114's current head; do not clobber concurrent changes.

## Acceptance and evidence boundaries

- **A13-AC01:** source fields/zero/null/absence and C17 incarnations represented; tests authored, **NOT_RUN**.
- **A13-AC02:** explicit 29-call allowlist and literal inputs; no arbitrary action; negatives authored, **NOT_RUN**.
- **A13-AC03:** F02-bound calls with CAS/idempotency and denial/stale error preservation; no automatic retry; tests authored, **NOT_RUN**.
- **119:** run compiler and guards only in authorized role after integration. **120:** run surgical Actions specs after same-material C is composed. No author local test, parser, typecheck or CI run.
- **114:** branch and `sf2-stack` diverged; the overall PR comparison includes inherited UX planning docs. **Consume the six A13 source blobs selectively** and do not merge the inherited cohort or rebase this author branch.
- **No verified consumer ACK yet;** authoring handoff submitted. Status `ARTIFACT_READY` (not `INTEGRATED`, `QUALIFIED` or `GLOBAL_RELEASE`). No merge, deploy, Azure or Goal resume.

## Source-equivalence review correction

After source review, commit `4ae17cb6c35dbb214d06882f3ae6dd50bcef62d2` corrected `SensitivityResult.unresolvedConditions` to the producer's structured `UnresolvedCondition` (evidenceRefs retained), and narrowed complete cost-coverage and portfolio status discriminants. Updated fields blob `8a41fc6915dfbdcb76cee6521218c3ab72156749`. No tests, typecheck or service probes were executed. GitHub PR mergeability was `unknown` at latest read; diverged baseline still requires selective integration.

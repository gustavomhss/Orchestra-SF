# Cold review — three shared host merges

## Verdict and scope

No new composition defect was confirmed in the three reviewed source blobs. This is an independent, read-only source review of merges authored by `/root/ci_coordination`; it is not group acceptance, native qualification, or a claim that the current candidate passed all required checks. The reviewer did not author these three source files and made no changes to them.

Candidate W: `de6959db82dbe48bd59e3d012ff668a86347a6cd`; tree `e7c36171c132009e34d4f870e5d300bab4a1c82a`; PR #34. Inputs were the pinned PR23 head `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62`, PR26 head `e7fd8ff797441681f360e7775155a8cc2830280c`, and their recorded base inputs. The local Git blob hashes match the three requested review pins exactly.

| Source | Reviewed blob | Result |
| --- | --- | --- |
| apps/cli/src/sucafina-product/host-context.ts | `5d64d3424cbf37509e9aab75a660e79656563879` | Published behavior from both inputs retained in the reviewed composition. |
| apps/cli/src/sucafina-product/business-services.ts | `41a795e5a2c05600741e694efca19f0ab329db55` | Procurement services retained; WP06 document scenario additions composed. |
| modules/sucafina/Sucafinav1/product/contracts/host-context.ts | `69f1f73ca6a1fa0d48114c554aca0747e4934624` | Both host surfaces represented; routine discovery type remains structurally equivalent. |

## Host-context review

The merged host preserves PR23's `procurementEvidenceWrites` WeakSet and passes the same instance to product authority and business services. The prepared-target authorization callback still delegates to the Procurement decision host after business initialization. This retains receipt and source-evidence write authorization instead of creating a second authority.

The runtime still publishes the real `productView` queue consumer, `sourcingInputs`, collaboration work, and Procurement decision HTTP handler. The handler chain retains the WP04 route before the WP06 document/import/dossier/document-scenario routes. The additions retain each route's own admission; the composition does not broaden buying roles, scoring, approval thresholds or state meanings.

The WP06 native SkillLoadReceipt observer/verifier and normalized Core model/location references are retained. The selection intersection remains limited to operations supported by the selected skills. Import and document input producers remain behind `analysis.prepare`; start and reads retain their separate human authorization and current source checks. Prompt context is included consistently in initial and repeated fingerprints. Required document namespace fencing is preserved for extraction and import-preview analysis.

The combined output reader keeps PR23's denial for uninitialized or inaccessible authority and its ready-run/native-receipt checks. It retains WP06's DocumentEvidence-specific current candidate reader and repeated source, case and run checks. Other contributions still use the original repeated current/historical evidence checks. The merged `analysisStateFailure` helper preserves reason-bearing failures and maps non-result state to unavailable; no success path is synthesized.

These source checks do not establish actual native parity for WP04. The ten native and four human obligations remain unqualified.

## Business-services review

The diff against PR23 is restricted to importing/creating `documentScenarios` and exposing `documentScenarios` plus the existing `resolveProcurement` service. PR23's queue page view, C06 observer, cross-actor source resolution/continuity, C12 decision host, preparation, collaboration, source fences, and read-only Procurement dossier remain intact.

Document scenarios use the same host, Planner product, evidence service, current document reader and locked source fence reader. Their authorization callback remains `planner.preview`. The Procurement host retains the explicit `ProcurementSourceHost` type and current request resolution before fallback to individual selectors. The `documentEvidenceList` supplied by the merged host preserves the Procurement dossier's attachment-to-evidence selection path.

The dossier producer is outside these three reviewed files. The full current producer/consumer reconciliation and owner patch handoff remain separate evidence; this review does not promote that integration from a type declaration or an imported factory alone.

## Contract review

`productView`, collaboration `work`, and `sourcingInputs` from PR23 coexist with WP06's `analysisInputs`. The new field accepts a typed analysis request and an unknown selection that the runtime validates; it does not expose a serialized trusted binding.

The `routineRuns.discoverRuns` type is structurally the same as the current factory declaration: `(context: TrustedDomainContext) => Promise<PortResult<readonly RoutineResult[]>>`. The factory was read at candidate W through GitHub MCP; its blob is `56ab7cf58e65d2d051279aac484d58b17ccf1f0e`. Replacing the type-only factory-derived `Pick` does not add a route, bypass the routine authority, or qualify actual routine execution.

## Validation and unresolved boundary

The separate impact review selects 35 affected historical WP04 Bun files and the eight real-host Procurement browser cases, while preserving 18 Bun files and two isolated controller cases with explicit source relations. No product test, typecheck or server was executed locally by this reviewer. No CI was dispatched here.

The current `source-access-atlas.test.ts` caller omits the required `procurementEvidenceWrites` argument to `createSfBusinessServices`; this agrees with the reported TS2741 gate. It is outside this review's source ownership and is already an astra-compose finding/patch, not a source edit by this reviewer. The group remains pending that gate and the affected hosted results.

This reviewer authored eight separate test-overlap selections. Accordingly, this cold review is independent only for the three source merges named above; independent review of those eight test inputs belongs to another reviewer. Global C/G7, D/G8, AM01–AM06 and the final epic remain with S0.

# WP06 latest intake for WP10

Source pin: `e4e9ceb5ec97a9c3238a35582cb7ca5401756536`; compared from `2f33fd0eac79606cd0ba9c0724f8035a7c9bffbb`. Acquisition used GitHub MCP only. All 85 code/test deltas and all 64 available modified-file base blobs were archived with SHA1 verification. Three documentation paths were excluded. The unchanged `documents/format-fixtures.ts` dependency was also fetched at the same pin.

`consumed.json` records 36 exact published blobs with path, blobSha, sourceCommit, owner and publisher. `manifest-latest.json` accounts for every acquired delta, including rejected regressions. `own-adapters.json` records the three composed WP10 adapter files. No foreign source was edited by this builder.

## Own composition

- `business-services.ts`: creates `documentScenarios` through `createSfDocumentScenarios` with the existing Planner product, BusinessContextService, actual document reader, source fences and exact human `planner.preview` authorization. Exposes `documentScenarios` and callable `resolveProcurement`. Preserves the forecast-coverage closure, scenario-operation access, Atlas, queue view, existing dossier preparation and all other composition.
- `analysis-verifier-documents.ts`: resolves the registered full schema ref (`schema:id:version`) and reopens extracted candidate output with the document reader. Extracted output is not admitted as a confirmed BusinessContextService premise. Preserves purchase PreparedChangeSet readSet verification and exact allowed-target evidence; adopts the explicit pending cost-coverage type guard.
- `analysis-host-services.ts`: mounts the actual WP06 `createSfImportIntentAnalysis` and `createSfDocumentAnalysisInput` within the existing prepare/verify/acceptsOutput selection scopes. Accepts exact public import selections `{caseRef, previewRef, importRequest, intentText}` alongside existing intent selections. Accepts public document selections `{caseRef, documentRef, fieldSchemaRef}` and canonical `{authorizedFileRef, fieldSchemaRef, limits}` with the actual fixed parser limits. Forecast import composition was already present in `analysis-services-inputs.ts` and now receives the exact updated `import-analysis.ts` with preview digest revalidation and prompt context. All existing pair composition, authority gates and unavailable cases remain.

## Hooks delivered to root

- `createSfDossierServices({runtime: input, authority, business, documents})` in `dossier-services.ts`: `.http(request, surface)` and `.prepare(requestRef, call)`.
- `createSfDocumentScenarioHttp({origin, mount, authority, service: business.documentScenarios})` in product/interface/document-scenario-http.ts.
- `sfAnalysisPrompt(objective, proof)` from `analysis-verifier.ts` includes authorized preview promptContext.
- `readSfDocumentAnalysisCandidate(evidence, call, documents.documents.evidenceHost)` reopens native candidate output.
- Root confirmed it mounted the own bounded HTTP `choices`/`prepare` route before the preserved producer route, with exact `analysis.prepare` admission. It also mounted dossier/document-scenario routes and prompt context fingerprinting.

## Preserved stronger producer outputs

The latest WP06 branch was not a semantic superset of current WP10 intake. In particular, replacing whole blobs would remove receipt review proofs, alternative capture and checkNamespaces, case-event ancestry/evidence authorization, query-compatible Procurement projection delegation, historical Dashboard reissue, collaboration discovery/identity checks, Portfolio source revalidation, and richer commercial rendering. These files remain untouched, with path-specific reasons in `manifest-latest.json`. The protected WP09 dossier producer was left to root's owner-pinned intake.

## Validation and precise limits

- No local product tests, typecheck or CI were run by this builder. Root owns publication and hosted surgical CI.
- Exact consumed bytes were rehashed against their archived producer blobs before closing.
- Hosted test candidates now present include WP06 document extraction reuse, runtime e2e, scenario consumer, dossier runtime, import analysis options, native document/import fixtures, and the published Playwright document/import specs. Native fixtures use a deterministic native event provider; passing them is not live native/global acceptance.
- Some modules outside this hydrated snapshot (Atlas package metadata and packages/llm source) remain remote repository dependencies. The WP06 format fixture was specifically acquired and consumed because its local test import was missing.
- The published foreign document-scenario HTTP helper awaits stream cancellation on overflow. It is preserved exact and remains a producer hardening follow-up; no cancellation safety claim is made here.
- The exact published dossier-services helper prepares Request/comparison/documents; its preparation does not set the optional newer WP09 `sourcing` field. The current dossier producer therefore reports optional proposal-terms detail unavailable for this path instead of inventing data. Root can compose the existing actual sourcingEvidence into an own adapter if full optional commercial detail is required.

Builder closed; further edits require an explicit follow-up or hosted CI findings.

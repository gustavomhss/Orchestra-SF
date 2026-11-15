# A07 → 114 / 119 / 120: integration handoff (e1)

**Branch**: `sf-ux-a07` → `sf2-stack`, authoring lease `ux-native-a07-e1`. ACK: `ACK-e1.json`. No source producer files, shared registries or package.json were modified.

## Delivered

- `packages/schema/src/sucafina/reviews.ts`: ten closed operation IDs with typed request/result decoders, preserved review and evidence/source projection envelopes. Complex producer-owned stored `content` and decision/chart payloads are read-only; never accepted as mutation authority.
- `packages/client/src/sucafina/reviews.ts`: ten operation-specific wrappers for F02 `SfTransport`, no duplicate financial calculations, explicit idempotency on capture/preserve, fail-closed ambiguity, **no automatic retries**.
- `apps/cli/src/sucafina-product/native-ui/reviews.ts`: `createSfReviewsProjectionHandlers`, F02-shaped `{operationId:"projection.review",handle(originalRequest)}`. Existing authority UI admission (`sf_review_prepare` + canonical digest), C08 review read scope, version/digest checks and fresh dashboard selections; no raw persistence/HTML parsing.
- `modules/sucafina/Sucafinav1/test/native-ui-contract/reviews.test.ts`: contract negative tests and client no-network refusal checks. **Not executed locally** per order; 120 owns Actions.

## Shared integration patch required (owned only by 114)

1. Expose `./sucafina/reviews` from `@orchestra/schema` and `@orchestra/client` package manifests.
2. Install all **ten exact IDs** and original wire metadata from `handoff-e1.json` in the F02 `SfOperationRegistry`; bind source-verified codecs to `SfNativeOperationBindings`. The catalog is not an authorization engine.
3. Inject `createSfReviewsProjectionHandlers({origin,mount,authority,business,reviews,persistence})` into `mountSfNativeProjections` before the legacy business handler. Do not rewrite/clone `Request`. Reject missing producer/context; no parallel backend.
4. C58 read drift: `dashboard-http.ts` returns `unavailable` on interrupted authority resolution; never equate it with revoked `denied` without fresh proof.
5. Office exports: `?page=Generate Report&download=docx|pptx&year=2026&topic=...` currently opens a **review HTML workspace**, NOT document bytes. Its `topic` may be repeated; F02 generic GET/JSON codec cannot represent this navigation safely. Connect safe owner-bound F01 navigation first and the canonical review-report / artifact-download flow for genuine DOCX/PPTX; never fabricate success or MIME. Current exported wrappers deliberately return `contract-unavailable` until this integration.

## Acceptance / qualification

- A07 code artifacts and ten typed methods: **published**. Native registry / executable installed routes: **pending 114**. Actual DOCX/PPTX export: **blocked, not claimed**.
- 119: typecheck and static/security guards on integrated candidate; particularly review `Schema.Json` boundary, effect 4 schema API, and new route's host constructor.
- 120: surgical Actions contract tests, source revocation/C08, stale review updates, same-owner navigation and paginated Office download; no local tests run.
- No merge, deploy, policy changes or Goal resumed. See `handoff-e1.json` for exact blob SHA, source pins, per-operation route metadata and outstanding proof obligations.

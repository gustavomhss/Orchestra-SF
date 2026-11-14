# Operations assembly proposal for session23

State: READY_PATCH_PENDING_SESSION23_ASSEMBLY_AND_ACTIONS_QUALIFICATION. This shared patch has not been applied. The nominal run is recorded separately and failed before the host mount.

## Exact inputs and consumer

Product composition: `b62c32940d06c15c04f52b88209d5b4930cf1a3e`.
Observed stack: `d8ab1d3321a76870ed3092ba043fe1b5781a2c23`.
Terminal Operations source: `39b50786b8d341d13f98ca2c5ada035a4bd7a46a`.
Only session23 applies shared host/selection changes. Verify all preimages against the head that session23 accepts. Do not overwrite a later writer.

## Payload

1. `operations-support/installation.ts` is new source for the mission24 writer's allowed directory. It assembles actual production factories over the host's one SQLite/source store and real local-operator authentication.
2. `tests/mount-boundary.test.ts` is a new allowed regression test file. It contains five real assembly checks: unauthenticated denial/no effects; actual Planner/import/document workbench routes; viewer mutation denial; unissued source selector and revoked-session denial; scanner-absent upload refusal with exact source state preserved. These checks are not five browser journey passes.
3. `preimages/` and `postimages/` contain complete shared `wp04/host.ts` and `wp04/selection.ts`. Original blobs are verified in `manifest.json`.
4. `shared-only.patch` applies the two shared seams after exact helper/test source intake. `assembly.patch` additionally includes the two new files and should be used only if those new paths are absent.
5. `direct-bindings.json` identifies the actual source factories and HTTP adapters. `input-subtrees.json` adds 723 exact composed path/blob entries across the explicitly declared complete subtrees, with 541 matching published owner provenance records. Neither artifact claims an exhaustive transitive dependency closure; workspace, npm and native/scanner boundaries stay explicit.
6. The helper feature-detects the source39 document service disposer while remaining compatible with composed d8ab, whose factory has no disposer. Fixture teardown attempts all registered cleanup operations even if one fails. This repair is statically reviewed and untested.

## Resulting assembly

The existing host's listener, private temporary directory, SQLite, source lifecycle, local-operator enrollment, synthetic business records, and teardown remain the host lifecycle. It delegates application assembly to the allowed helper. Procurement and C02 use the existing business-services composition. Planner uses PlannerModule. Import and document workbenches are the production HTTP adapters and their real rendered HTML.

The private asset adapter is exactly the same persistence object as the application and services. Document target authorization uses createSfDocumentTargetAuthority. It rechecks actual scoped source identities, current roles, access revision, policy, asset ownership and source incarnation. There is no allow-all target callback.

Product grants are confined to documents/receipts state, the five needed read/prepare operations (including sf_evidence_get for document-open), and four explicit writer human actions. Read-only accounts have no human actions. Native session/skill/provider entrypoints stay unavailable; they are not simulated.

POST identity uses the production Idempotency-Key rule. Browser mutations still occur once and existing UI assertions remain unchanged. The proposed selector activates the same host for the exact nominal operations.spec.ts filename while retaining wp04/procurement.spec.ts. It does not widen the selected tests or change the production config.

## Real scanner dependency remains explicit

The helper invokes production scanLocalFile, using only a host-owned already approved ClamD service at 127.0.0.1 and the `SF_OPERATIONS_CLAMD_PORT` value. It installs/starts no scanner. Missing endpoint passes null to the production scanner and upload/import admission fails closed. No callback manufactures acceptance. The Actions availability and request allowlist for this environment input are not established here. Session23 must reconcile an approved existing service through the existing CI interface before claiming positive upload/import execution.

The scanner-absent regression intentionally proves refusal and unchanged state; it is not positive scanner, parser or nominal document acceptance evidence.

## Required qualification after intake

Run the exact nominal CI-UI-OPERATIONS five-case spec through the current dispatcher, once per changed candidate with deduplication. Run only the new mount-boundary.test.ts regression file for assembly behavior, through Actions. Include the helper/test graph in a package bun typecheck gate; the predecessor's excluded E2E graph remains an explicit gate gap until handled by its owner.

No positive result is recorded in this proposal. C06 material confirmation, native/AM parity, human timing, PDF/DOCX/OCR, and wider campaign criteria remain outside this payload.


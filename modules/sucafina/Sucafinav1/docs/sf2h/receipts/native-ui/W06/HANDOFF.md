# W06 / S01 — ARTIFACT_READY handoff to integrator 114

**State:** Authoring completed, remote source commits published. Not INTEGRATED, QUALIFIED, CLOSED or GLOBAL_RELEASE. Output admission and terminal lease acceptance are **not independently confirmed**.

## Remote custody

- Branch: sf-ux-w06; reserved lease: ux-native-w06-e1; actual model: GPT-6; execution via authorized GitHub connector actor gustavomhss.
- Cohort base: f8e442616c96651f3b26013b34b8ce697860e3e2; ACK: a49ea45db5957ac5c1c4f12a24afd7ce1ab57721.
- Code commit: 37bb114d52978146816329380fe5e531291ff74e; fence correction: caa812eff298ac5666b62aa2e8b2a01534405e3d.
- Latest code tree: 1f620be57823eab7d280b1d49da1f497a82f8ec5 (after accessibility and value hardening commit 940a29a51215ab9914392952c57e6b60c07f6e4f). Publication by GitHub MCP CAS expected-head, force=false.
- All eight code paths are NEW (preimage absent); exact postimage Git blobs in ARTIFACT_READY.json. ACK and all receipts only in W06 receipt prefix.

## Component contracts and slots

- SfDataTable<Row>: packages/app-shell/src/orchestra/chapters/sucafina/shared/table/index.tsx; props SfDataTableProps<Row>.
- SfListDetail, SfRecordDetail: packages/app-shell/src/orchestra/chapters/sucafina/shared/detail/index.tsx; props SfListDetailProps and SfRecordDetailProps.
- Frozen public carrier definitions in table/contracts.ts; F01 owns SfOpaque/SfRef/SfVersion. F03's public ../states SfStatePanel is the only imported F03 export; no private source copy.
- Reads only authorized props supplied by owners; no backend or private snapshots, no new auth system, no fetch, no mutation on mount. Producer remains responsible for version, filter, paging/selection and authority.
- S01 does not know or generate a route href; row Open record is a semantic button invoking onSelect(original SfRef). Consumer/F01 owns actual authorized routing.
- First rendered column preserves arbitrary consumer JSX without nested interactive controls. Stable record reference is never array index or title.
- Native table with caption, column headers, aria-sort, explicit keyboard-safe row and action buttons, controlled sort/offset/cursor navigation. Unknown totals never become zero.
- Split/split-context and single use layoutMode from F03 (no second resize observer); single mode keeps the authorized same-owner list mounted with filters, scroll and keyboard-focus restoration; parent must unmount when owner changes or access is revoked.
- SfRecordDetail displays source-provided text, status, metadata, typed values, sections, primary/secondary/source actions; zero is distinct from missing/unavailable; no financial computations.
- The owned S01 dictionary exports SF_S01_COPY and SF_S01_COPY_BR from packages/app-shell/src/i18n/orchestra-chapters/sf-s01.ts. Shared sf.common keys belong to F03.

## Exact inert patch for 114 (not applied)

Path: packages/app-shell/src/i18n/orchestra.ts
Patch file: PATCH-orchestra-i18n.patch; blob a8f7cbfd4730cd7a098bc9d613c6b9c871f7120b.
Preimage at sf2-stack@2105c17b51fd9cb5131418c116433a05f9479cb7: 2eeaa42e02a45b3301fc765c6c92635af5101079.
Complete proposed postimage blob: 42aada3f90ddc4ec41d037a697ca776553620e6e.
Fragment: import SF_S01_COPY, SF_S01_COPY_BR from ./orchestra-chapters/sf-s01; spread SF_S01_COPY into ORCHESTRA_COPY and SF_S01_COPY_BR into ORCHESTRA_COPY_BR.
Apply by 114 only after reconciling current HEAD and F03's sf.common registration. No S01 worker wrote this shared registry.

## Qualifications and causal blockers

- F03 and its registered sf.common copy, indirect F01 types and a real 114 candidate are required before installed test/typecheck. Frozen signatures are present; F03 implementation was not assumed or stubbed.
- Browser component suite authored: packages/app-shell/test-browser/sucafina-native/s01.test.ts. Cases cover opaque IDs with identical visible titles, controlled sort/page, zero/unknown total, disabled write, denial/session expiry DOM purge, distinct empty states and same-owner round trip including scroll and focus. These are component fixtures, NOT installed proofs.
- CI120: TEST_REQUEST.json has precise selection; NOT_RUN, run/job absent. Do not dispatch from W06.
- Compiler/guards119: COMPILER_REQUEST.json; bun typecheck in packages/app-shell after composition; NOT_RUN. No local tests, typecheck, validators or parsers were executed.
- Procedural source drift needing 114 disposition: frozen EXECUTION-PROTOCOL.md blob 0151a8e6cbb0da2118e058142af801ba7cf72094 vs cohort file blob 4a50abfee84335d2ca4db7e3351af144248c9fd1. Component lock/signature family unchanged; no silent protocol rewrite.
- Acceptance S01-AC01 and S01-AC02: IMPLEMENTED_SPEC_NOT_RUN; canonical WP01.T02 checks/invariants inherited and cannot be marked PASS until same-C qualified.

## Lease transfer

ACK publication was real. This handoff offers output S01 as ARTIFACT_READY and releases the authoring slot only after 114 accepts the source/lease terminal. Per-output admission by 114 was not observed; do not infer consent from silence. No shared writer or second dispatcher was created.
Owner 114: consume exact code blobs/commit, apply or reconcile inert i18n patch, compose F01/F03 and dispatch one candidate. Owner 120: deduplicated surgical Actions. Owner 119: compiler, guards. No merge/deploy/Azure.

## Draft PR #125 / ancestry warning

The GitHub files API compared sf-ux-w06 against sf2-stack@2105c17b51fd9cb5131418c116433a05f9479cb7. It showed 170 files: 14 newly-authored W06 paths and 156 pre-existing native-UI cohort/planning files inherited from the prepared branch. The later census receipt adds one more own W06 file (expected total 171); verify the PR head before integration. See PR_DIFF_CENSUS.json for exact inherited paths.

**Do not merge the entire draft PR.** Integrator 114 must consume only the W06 code/receipt file additions with exact blob preimages/postimages, reconstruct on the current sf2-stack tree under its own lease, and reconcile the common cohort separately. No W06 rebase, force push or merge was attempted.

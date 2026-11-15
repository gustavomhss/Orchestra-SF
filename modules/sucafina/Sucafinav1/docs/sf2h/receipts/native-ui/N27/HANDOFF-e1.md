# N27 — U23/U24 — handoff e1 to integrator 125

**Authoring:** ARTIFACT_READY (unqualified); **branch:** `sf-ux-n27`; **original HEAD:** `526e7204b310756e552196bbf3d64037dbbf047c`; **material:** C60 `af479f68c22ef1d1e9ac100a81a820f8b0273338`; **lease:** `ux-native-n27-e1`.

## Exact delivery / importable exports

- `packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx` — `SfImportsView(props: SfSurfaceProps<"UI55" | "UI56" | "UI57" | "UI68">): JSX.Element` (U23).
- `packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx` — `SfDocumentsView(props: SfSurfaceProps<"UI58" | "UI59" | "UI60">): JSX.Element` (U24).
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u23.ts` exports `SF_U23_COPY`, `SF_U23_COPY_BR`; `sf-u24.ts` exports `SF_U24_COPY`, `SF_U24_COPY_BR`; source-locked English copied unchanged for legacy labels; new title/primary exact en/pt-BR.
- CSS siblings are native token/Orchestra-based, responsive with 44px controls.
- Real-installed specs `packages/app-shell/e2e/sucafina/native/journeys/u23.spec.ts` and `u24.spec.ts` (written, **NOT RUN**).

**Source preimages (C60, verified GitHub):** `runtime/application.ts` `a0deff8a3b272019f472aa2f93499d1940a78370`; `product/interface/import-http.ts` `72196e5d8ac256e161be0c4bde2fbf1090cc6786`; `product/interface/document-scenario-http.ts` `d6926db6f770692e4d2ccbe9f425bf389a9f5c95`; `product/interface/document-http.ts` `8f679deec37dc99ae335c4bacae2162c9a7a076a`. These producer paths were read only, not edited.

**Pre/postimages for all author leaf paths:** every file absent at `526e7204b310756e552196bbf3d64037dbbf047c`, with resulting **blob** SHA:

| File | Preimage | Postimage (Git blob SHA) |
| --- | --- | --- |
| `imports/index.tsx` | ABSENT | `3f3ff8a2d307bf57fe95f3f212c230758f01297b` |
| `documents/index.tsx` | ABSENT | `304d5887db0b0db22eac81c1309274ea7f5155dd` |
| `imports/imports.css` | ABSENT | `79b80cbdccf2a3d343efeba0350380c2d65657ec` |
| `documents/documents.css` | ABSENT | `1215beb3936f740309f3d1771bcf06d5d1722a1c` |
| `sf-u23.ts` | ABSENT | `a5e70551947081c7ee63f51fde8ed499d1e3c53a` |
| `sf-u24.ts` | ABSENT | `9d87e1da57f2bd1e224134577e21ab2dff294279` |
| `u23.spec.ts` | ABSENT | `adeb55aa710ccf64209f96c196c6fe13c9a29d59` |
| `u24.spec.ts` | ABSENT | `aca343068e5ae26087c5def249e819010d6c3b47` |
| `N27/ACK-e1.json` | ABSENT | `268d68e532f924e468c847efc9fd0d5dd8372276` |

No foreign or protected paths modified. Source catalog `31dbec1726fd8147156b01dc545726650ffd49e1`; surface manifest `50e2993a881e207aa3b2a1cd250a7da84cea5855`; component locks `818728d0a47c3f4c826943a7ab7262b4faac6a24`.

## Inert shared i18n patch for 125 (DO NOT apply in N27)

File: `packages/app-shell/src/i18n/orchestra.ts`, **preimage blob** `91e526cd53e2c020f36efacb60ecad250a4da11b` on `sf2-stack` as inspected. If preimage changed, reconcile with live file rather than applying blindly.

```diff
@@ imports, immediately after SF_S05_COPY @@
 import { SF_S05_COPY, SF_S05_COPY_BR } from "./orchestra-chapters/sf-s05"
+import { SF_U23_COPY, SF_U23_COPY_BR } from "./orchestra-chapters/sf-u23"
+import { SF_U24_COPY, SF_U24_COPY_BR } from "./orchestra-chapters/sf-u24"
@@ ORCHESTRA_COPY English spreads @@
   ...SF_S05_COPY,
+  ...SF_U23_COPY,
+  ...SF_U24_COPY,
   ...MCP_COPY,
@@ ORCHESTRA_COPY_BR Portuguese spreads @@
   ...SF_S05_COPY_BR,
+  ...SF_U23_COPY_BR,
+  ...SF_U24_COPY_BR,
   ...MCP_COPY_BR,
```

**Postimage is an inert desired diff, NOT A WRITTEN BLOB**. 125 owns the patch, global i18n and generated artifacts. This receipt is not an integration approval.

## Inert route/registration fragment for 125 (central registry path remains protected)

```tsx
import { SfImportsView } from "@/orchestra/chapters/sucafina/imports"
import { SfDocumentsView } from "@/orchestra/chapters/sucafina/documents"
// Route-resolved native chapter mapping, no untrusted URL override:
// UI55/UI56/UI57/UI68 => SfImportsView
// UI58/UI59/UI60 => SfDocumentsView
```

Bind exact routes in frozen `surface-manifest.json` and `route-signatures.ts` without adding a second router:

- U23: `/orchestra/sf-imports/new`; `/orchestra/sf-imports/:manifestId/preview`; `/orchestra/sf-imports/:manifestId/receipt`, `/review`, `/orchestra/sf-imports` history; `/orchestra/sf-imports/exports`.
- U24: `/orchestra/sf-documents`, `/new`, `/:documentRef`, `/:documentRef/evidence`, `/:documentRef/scenario`.

125 must additionally bind route decoder, owner/surface/context (F01), availability, F02 transport and A06 files adapter, F03/S01/S03/S04 composition. N27 did not write protected host, shared registries, model, access grants, transport or backend.

## Scope implemented

**U23:** target lookup with period selection, accepted format and max-byte guards, manual local file to A06 upload bytes, options `newVersion/removeMissing/sheet/replace/headerRow`, idempotent producer preview, current-version/current-digest refetch, impact/added/changed/removed/ignored/rejected/details, explicit apply once (no retry after unknown), actual receipt and refetch, read-only receipt routes, authorized XLSX/CSV/JSON bytes with transient object URL and revoke.

**U24:** source/request selections, exact search through A06, original source reopened via document ref (never raw HTML insertion), schema/extraction to candidate, explicit confirmation with source and producer re-read, strictly producer-confirmed monetary evidence and Planner scenario targets, scenario preview only (`domainApplied:false`), no optimistic confirmation or parallel solver.

## Known precise blockers, not fabricated as success

1. **BLOCKED_INTEGRATION/QUALIFICATION:** A06 (schema/client), F01, F02, F03, S01, S03, S04 + native installed fixture/real owner not integrated/qualified on this author branch. Typecheck delegated 119; E2E to 120. No local validation.
2. **BLOCKED_CONTRACT_UI57_HISTORY:** frozen A06 `SfFiles` operation set has `files.import-reference` and `files.import-detail` but **no import history list operation** to select real manifest IDs for `/orchestra/sf-imports`. Leaf fails closed (unavailable), no fake receipts/list. 125/A06 owner must provide approved list or narrow route action.
3. **BLOCKED_CONTRACT_SCANNER_STATE:** `files.import-admit` returns `{ ref,digest,expiresAt }` but **no browser-visible scanner verdict**. Leaf never claims file clean; caller only handles server admission/preview. UI55 requires scanner-status in frozen section order; 125/A06 must supply frozen public verdict if separately displayed.
4. **BLOCKED_CONTRACT_ASSET_BINDING:** U24 references `files.asset.link/download/upload`, but document request/source DTOs do not expose the `assetId` or target `record/recordVersion/page` needed to bind a safe file control. Do not invent attachment IDs or use an unsafe URL; coordinate with A06/125 for valid source selection.
5. **SOURCE-SURFACE_RESOLUTION:** route params identify manifest/document, but frozen A06 operation requires explicit `surface`. Current route exposes no surface. Manual planner/dashboard or dashboard/procurement surface selection is used. 125 must preserve per-owner current surface and direct read/availability semantics; never default from chapter name. UI56/57 loaded by deliberate refresh.
6. **Acceptance not proven:** no compiler or CI run by N27, all U23-AC01..03/U24-AC01..03 `NOT_RUN`. E2E additionally requires installed candidate and explicit seed env (see spec); 200%/400% text zoom and mobile themes not yet empirically qualified.

## Qualification requests

- **119**: compilation/codegen only, `bun typecheck` in `packages/app-shell`, check source A06 integration, responsive/i18n typed key registry and unchanged protected modules. No local runner.
- **120**: use already authorized *existing* dispatcher, surgical exact specs `packages/app-shell/e2e/sucafina/native/journeys/u23.spec.ts` and `u24.spec.ts`, after 125 integration and installed manifest readiness. Do not trigger new workflow or weaken missing seed checks; record real candidate SHA, actor, manifest and evidence. Original WP06/Planner acceptance still needed.
- **125**: apply/reconcile two inert patches, bring A06/client + F01/F02/F03/S01/S03/S04 owner/route into common candidate, resolve blocker contracts before calling finished, preserve N27 authored blobs (no one-off rewrite).

**No tests, merges, deploy, force updates, Goal reactivation, new dispatcher, or global release by N27.** All source/credential lifecycle remains controlled by authorized owners. User-visible UI is product Solid, not legacy iframe/mock.

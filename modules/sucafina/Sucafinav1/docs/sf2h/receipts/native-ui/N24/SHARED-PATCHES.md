# N24 → 125: inert shared integration patches (U16/U17)

**Owner:** 125 / `sf2-stack` · **Author:** gustavomhss, epoch `ux-native-n24-e1`  
**No shared file was modified by N24.** This document is a patch proposal, not evidence of integration. Preimages are from `sf2-stack` as read during this session; 125 must refetch live HEAD before applying any shared edit.

## 1. Typed dictionary aggregation — exact patch

Protected preimage: `packages/app-shell/src/i18n/orchestra.ts` **blob `91e526cd53e2c020f36efacb60ecad250a4da11b`**.

```diff
--- a/packages/app-shell/src/i18n/orchestra.ts
+++ b/packages/app-shell/src/i18n/orchestra.ts
@@
 import { SF_S05_COPY, SF_S05_COPY_BR } from "./orchestra-chapters/sf-s05"
+import { SF_U16_COPY, SF_U16_COPY_BR } from "./orchestra-chapters/sf-u16"
+import { SF_U17_COPY, SF_U17_COPY_BR } from "./orchestra-chapters/sf-u17"
@@ ORCHESTRA_COPY
   ...SF_S05_COPY,
+  ...SF_U16_COPY,
+  ...SF_U17_COPY,
@@ ORCHESTRA_COPY_BR
   ...SF_S05_COPY_BR,
+  ...SF_U16_COPY_BR,
+  ...SF_U17_COPY_BR,
```

Input postimage files: `packages/app-shell/src/i18n/orchestra-chapters/sf-u16.ts`, `sf-u17.ts`. English copy preserves legacy labels; a small number of those same English legacy labels are intentionally carried into PT-BR pending localization review. Do not spread a partial, unverified dictionary.

## 2. Native F01 route composer — exact exports and dispatch

N24 authored the five leaf components, **not** shared registry files. F01 dispatcher/URL validation belongs to 125; do not add a second dispatcher.

```ts
import { SfCasesView } from "./decisions/cases"
import { SfIntentView } from "./decisions/intent"
import { SfAlternativesView } from "./decisions/alternatives"
import { SfAssumptionsView } from "./decisions/assumptions"
import { SfQuestionsView } from "./decisions/questions"

// Add to 125's existing typed F01 surface component registry:
// UI33 -> SfCasesView        /orchestra/sf-decisions
// UI34 -> SfIntentView       /orchestra/sf-decisions/:caseRef
// UI35 -> SfAlternativesView /orchestra/sf-decisions/:caseRef/alternatives
// UI36 -> SfAssumptionsView  /orchestra/sf-decisions/:caseRef/assumptions
// UI37 -> SfQuestionsView    /orchestra/sf-decisions/:caseRef/questions
```

All leaf exports take `SfSurfaceProps`; F01 passes the already-authorized `route`, preserves owner/installation, rejects foreign deep links, and wraps with `SfContextProvider`. Source route patterns are **exactly** `surface-manifest.json#/surfaces/UI33..UI37` and frozen `route-signatures.ts`. N24's owned `decisions/cases/route.ts` builds candidates with F01's `encodeSfRouteRef`; **125 should replace local candidates with the central typed URL builder if present in the final compositor**. Never navigate by bare user input or make a host-relative route outside F01.

Possible existing shared registration shell: `packages/app-shell/src/orchestra/chapter-route.tsx` (preimage blob `f22a07f31ed99055d30cd360fcdc6a1d1f365d99`); it currently registers only generic chapters and has no N24 routes. 125 must choose its native router, not add a conflicting chapter entry.

## 3. A13 collaboration dependency + exported SDK

Branch `sf-ux-a13` publishes `packages/schema/src/sucafina/collaboration/{operations,contracts,fields}.ts` and typed `packages/client/src/sucafina/collaboration.ts`. At the `sf2-stack` preimage, the two manifests do **not** yet expose these subpaths; integrate **only** after A13's producer/contract and signatures pass its own fencing:

```diff
--- a/packages/schema/package.json
+++ b/packages/schema/package.json
@@ "exports"
+    "./sucafina/collaboration": "./src/sucafina/collaboration.ts",
--- a/packages/client/package.json
+++ b/packages/client/package.json
@@ "exports"
+    "./sucafina/collaboration": "./src/sucafina/collaboration.ts",
```

Actual shared source files may already be in A13; do not recreate or overwrite them. N24's U17 `questions/{index,answer,cycles,consume}.tsx` are direct typed consumers of their existing methods, not a substitute producer.

## 4. F02/A04 operation-route blocker (highest priority for 125/119)

The `sf2-stack` `packages/schema/src/sucafina/decisions.ts` has A04 operations such as `decisions.command.sf_case_draft`, `decisions.command.sf_question_prepare`, `decisions.choice.read`, `decisions.current-choice-prepare` with `pathTemplate:"{mount}/{surface}"`. Their strict **input** schemas do not carry `surface`.

The existing `packages/client/src/sucafina/transport.ts` `operationUrl` resolves `{surface}` **from top-level input only** (otherwise `__unbound__`, rejected), so the implementation cannot be certified until F02/A04 binds the producer-selected source surface safely. Do not add an untyped `surface` to strict bodies, infer surface from the screen, call a parallel endpoint, or bypass catalog guardrails. The canonical workbench host supports `dashboard|planner|procurement` and validates the source instance.

Please have 119 verify this mismatch with the adapter owner and land an authorized contract-level fix before accepting 120's hosted tests. Keep the N24 leaf code unchanged unless the real producer's frozen contract specifically requires a revised call shape.

## 5. Creation response-loss / recovery contract blocker

Legacy producer `modules/sucafina/Sucafinav1/product/ui/decision-create.ts` implements `sf=workbench-create-recover` using original idempotency key and canonical private creation scope. A04 **does not expose the recovery operation** in `SfDecisions.operations`; N24 may record only an opaque scoped UUID marker and must show **unknown**, not resubmit on any ambiguous 400/409/timeout. **125/A04** needs a typed authorized recovery operation with the producer's native scope provenance; the N24 marker prefix intentionally does **not** impersonate the legacy recovery prefix.

Until recovery is available, a lost response blocks another creation under the same scoped marker (safe fail-closed); do not call it complete or bypass the guard. Also ensure the source idempotency key and `X-SF-Creation-Scope` are emitted by an authorized transport binding, not arbitrary UI-supplied HTTP headers.

## 6. CI and compiler handoff

- **120 / PR #106:** execute `packages/app-shell/e2e/sucafina/native/journeys/u16.spec.ts` and `u17.spec.ts` only on authorized hosted test fixtures after A04/A13/F01 integration; selectors require real cases. Check 320/768/1024/1280/1440, 200% root text, denied/expired/unknown states, permission scope changes, source deep links and no cross-owner leaked data. No local tests were run by N24.
- **119 / PR #107:** compile after shared exports/registry; specifically inspect `SfSourceInput_sf_* ` operation path binding, discrimination of `SfTransportResult`, A13 client exports, case choice source type, and all new leaf import paths. No local compiler was run by N24.
- **125 / PR #65:** retain separate authors' protected paths, integrate typed dictionaries and F01 surfaces, then request 120/119 evidence. **No dev merge, deploy, or Goal restart** by N24.

## Verification ledger

Verified product postimage blobs: `EVIDENCE.json` in the same receipt directory (16 owned files, all absent at original N24 HEAD). All hosted/visual/CI claims are `NOT_RUN`; neither a green test nor integration/production release is asserted.

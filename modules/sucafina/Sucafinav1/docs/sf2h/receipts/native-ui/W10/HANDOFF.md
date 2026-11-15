# W10 / S05 — Handoff for integrator 114

**Status:** S05 source files authored on `sf-ux-w10`; **NOT integrated, NOT qualified, NOT approved for release**. The authored components and test fixtures are ready for 114 intake, subject to **114's explicit per-output admission** and canonical source checks. This handoff does not claim a live grant, an installed service, a successful GitHub Actions test or a C06 receipt.

## Frozen scope and authority

- Mission `UX20-W10`, order `S05`; original `f8e442616c96651f3b26013b34b8ce697860e3e2`; canonical plan `dbf9547211d9b0fade619790de7c19c0869b7c7d`; C58 material `422f1ed7b549021d7c62c834c9d9041279112af4`.
- W10 ACK: `ACK.json`, committed `56a84d3e009d8e88057a279f285fd277991cf0b2`. Requested name Astra; actual runtime GPT-6, not disguised as Astra. 114's `S0-C-e17-browser114` is the sole integrator; no lease or product admission has been invented for W10.
- Exact S05 product write paths, no shared registries: `collaboration/{index.tsx,types.ts,collaboration.css}`, `i18n/orchestra-chapters/sf-s05.ts`, `test-browser/sucafina-native/s05.test.ts`. All were previously absent on the initial W10 branch; no foreign source files edited.
- Frozen component type source: `component-signatures.ts` blob `e283b2021697fb6666e88a13707cb05469540ae0`; contract `COMPONENT-CONTRACTS.md` blob `5e53813bff5c4f515f9122393e308ad5336b041a`; surface manifest `50e2993a881e207aa3b2a1cd250a7da84cea5855`; component locks `818728d0a47c3f4c826943a7ab7262b4faac6a24`.
- Original collaboration producer unchanged at C58 pins: `product/collaboration/http.ts` blob `ccae839a2bc35634554a2ac2721d345671c16f77` and `http-routes.ts` blob `a266e12bd80a2ff95922c2492225ced86eda3ac3`. No source adapters or authorization engines modified.
- `EXECUTION-PROTOCOL.md` observed `4a50abfee84335d2ca4db7e3351af144248c9fd1` versus lock `0151a8e6cbb0da2118e058142af801ba7cf72094`; two textual authority/dispatcher labels differ (lines 15 and 53), not component signatures. COMMON/owner instructions designate **114 / 120 / 119** for integration, hosted tests, compiler. 114 must reconcile drift explicitly.

## Product and consumer contract

`index.tsx` exports exactly `SfRelations`, `SfThread`, `SfQuestion`, `SfConfirmation` and their public types (from `./types`). The components are **pure SolidJS presentation**: no fetch, no server client, no direct message sends, no fake agent answer, no financial calculation, no second workflow, no own permission grant. Everything comes from owner-scoped props, and every domain mutation is an explicit event delegated to the real consumer. Core rights and mutation outcomes remain in F01/A13/U44 and original server.

- **Relations / UI51**: original typed `sourceRef`, candidate `targetRef`, relation kind ID; optionally no case; remove uses original `relationRef` + expected `version`. Denied state removes private labels. Stale target selection cannot cross sources.
- **Thread / UI52**: original `threadRef`/`incarnation`/`expectedVersion`, controlled exact-text `draft`, author/message provenance. One pending click per version, no automatic resend on `outcome-unknown`; only `onReconcileRead`. Unavailable preserves owner-controlled draft; denied hides its DOM.
- **Question / WP08.T06**: recipient chosen by **authorized ref**, never name/email; retain `sourceRefs`; owner performs genuine server preparation before executing `onSubmit` and must verify that the prepared version still matches. Answer text is not a fabricated agent response and no external messaging exists in S05. **Contract limitation:** frozen `SfQuestionProps` does not expose a prepared-operation token or a separate prepared phase; S05 cannot certify preparation from `state=ready` and the U44 owner **must** fail closed when `onSubmit` has no real frozen prepared intent.
- **Confirmation / UI53**: only `status=current`, `state=ready` and complete material coverage may request C06 no-change confirmation, with the exact `selectionRef`/`materialVersion`. No approval or invented receipt. Revoked material is not displayed.

No route page, registry, dispatcher, i18n root or shared framework path is modified by W10.

## Exact integration-only fragments — apply by 114, not by W10

1. Import and spread S05 localized copy in **`packages/app-shell/src/i18n/orchestra.ts`** without overwriting later edits:

```ts
import { SF_S05_COPY, SF_S05_COPY_BR } from "./orchestra-chapters/sf-s05"
// Within ORCHESTRA_COPY:
...SF_S05_COPY,
// Within ORCHESTRA_COPY_BR:
...SF_S05_COPY_BR,
```

All keys follow the `sf.ui51/52/53` frozen strings; additional labels are local to S05. Runtime `sf.common.*` copy is supplied by F03 via its **own** `sf-common.ts` and 114's registry composition.

2. After **F01 Schema/context** and **F03 shared frame** are integrated, U44 owns **UI51, UI52, UI53** route consumers and binds these leaves:

```ts
import {
  SfRelations, SfThread, SfQuestion, SfConfirmation,
} from "@/orchestra/chapters/sucafina/collaboration"
```

U44 must use the canonical `domain-read`/`reviews` A13 transport, current per-owner scope, recipient permissions, original request admission and real C06 source state. Re-mount on owner switch, revalidate source before effects, handle accepted/rejected/uncertain mutation outcomes in original domain. No W10 fallback backend, iframe, mailbox or host call.

3. No W10-created `registry` or type aggregator; I00/114 is sole publisher of entrypoint and correct global copy. The README fragment is inert until applied by 114.

## Proposed 120/119 selections (NOT executed)

- 120 **only after 114 composition**: component-scope browser test `packages/app-shell/test-browser/sucafina-native/s05.test.ts`; its five tests cover relation identity and CAS, source rollover, thread idempotency/outcome unknown and data purge, authorized recipient/question, and C06 material confirmation. **Fixtures are component contract evidence only, never installed end-to-end producer proof.**
- 119 only after 114 composes F01/schema and root i18n: `bun typecheck` in `packages/app-shell` via the approved hosted compiler, canonical guards on changed paths.
- Live E2E for UI51/UI52/UI53 requires U44 wiring, F01 real owner, A13 server admission, and native desktop/main transport; neither W10 tests nor component markup provides that proof.
- **No local test, GitHub Actions dispatch, merge, deploy or Azure action performed by W10.** No test result or agent response invented.

## Intake instructions

114 should fetch **exact W10 commit/tree and individual Git blobs** recorded in `ARTIFACT.json`, reconcile per-output admission with the frozen manifest, consume S05 leaf files only after verifying active writer leases and dependency availability, then create/record real component-test and compiler requests routed to 120/119. Recheck git pre/postimages and use a bounded integration patch (not whole-branch merge).

**Terminal status for this authoring handoff:** code delivered and ownership offered to 114; **admission/qualification remain pending**. Do not interpret this as lease authorization, global release or acceptance.

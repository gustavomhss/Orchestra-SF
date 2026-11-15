# N30 → 125: shared integration patch and source lock

**Scope:** N30 only authors exclusive U26/U37 leaves on `sf-ux-n30`. This is a proposal for the current integrator **125**, not a modification of a protected shared path. No local tests, compiler invocation, merge, deploy, dispatcher, or Goal activation occurred.

## Preimages and source locks

- Branch original head: `526e7204b310756e552196bbf3d64037dbbf047c` (confirmed before authoring)
- Material: `af479f68c22ef1d1e9ac100a81a820f8b0273338`
- `apps/cli/src/sucafina-product/memory-http.ts`: `f727d5250024df7338491321c36e7055d7c18f74`
- `modules/sucafina/Sucafinav1/product/interface/analysis-http.ts`: `87b4c36950db61cdf6d7b9b0feb8ba9ebb1e8329`
- `apps/cli/src/sucafina-product/analysis-http.ts`: `06522fa4a2eaa0841af8aabead799d9d56a8ada7`
- `packages/app-shell/src/i18n/orchestra.ts` on sf2-stack at handoff: `91e526cd53e2c020f36efacb60ecad250a4da11b`
- `packages/app-shell/src/orchestra/chapter-route.tsx` on sf2-stack: `f22a07f31ed99055d30cd360fcdc6a1d1f365d99`
- `packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx` on sf2-stack: `8b949f966725f8a7d22a486e3391f79deecce258`
- A14 memory schema leaf observed on `sf-ux-a14`: `d501d30c2e0f0693f8533c8fe4d217f0068cde86`; client: `cddd7ceccc66bc5faf38d169bede03efa31440db`
- A15 analysis schema leaf observed on `sf-ux-a15`: `ff222fcc02d26dbe59ccb40da797d2a723c2ed47`; client: `43c096141146c3ce2b5a9fac67282c5eed959bdf`.

Do not assume these shared preimages remain current; refresh before applying and reconcile concurrent authors' lines. A14/A15 were not present on the current `sf2-stack` when N30 authored, so runtime/typecheck qualification is **gated** on their real integration.

## 125 shared patch: i18n

In `packages/app-shell/src/i18n/orchestra.ts` (125-owned), insert alongside existing frozen SF imports:

```ts
import { SF_U26_COPY, SF_U26_COPY_BR } from "./orchestra-chapters/sf-u26"
import { SF_U37_COPY, SF_U37_COPY_BR } from "./orchestra-chapters/sf-u37"
```

In `ORCHESTRA_COPY`, near the other `...SF_S05_COPY` spreads, insert:

```ts
  ...SF_U26_COPY,
  ...SF_U37_COPY,
```

In `ORCHESTRA_COPY_BR`, next to the `...SF_S05_COPY_BR` spread, insert:

```ts
  ...SF_U26_COPY_BR,
  ...SF_U37_COPY_BR,
```

The two N30 leaf dictionaries contain no global runtime registration or alternate locale fallback. Primary/title strings are frozen UI41/UI61/UI62/UI63 literals. Preserve source English field labels when already pinned and do not invent authority from translations.

## 125 shared patch: routes/chapter mounting

Use the **existing F01** validated `SfResolvedRoute`/context provider and static manifest dispatch. Do not fabricate a second route resolver, direct HTTP proxy, browser grant or new entrypoint contract.

```ts
import { SfMemoryView } from "./chapters/sucafina/memory"
import { SfAnalysesView } from "./chapters/sucafina/decisions/analyses"
```

Wire **exactly**:

- `UI61` (`/orchestra/sf-memory/signals`), `UI62` (`/orchestra/sf-memory/cases`), `UI63` (`/orchestra/sf-memory/outcomes/:selectionRef` plus selection route) → `SfMemoryView({surfaceId, route})`
- `UI41` (`/orchestra/sf-decisions/:caseRef/analyses/:analysisRef` plus list route) → `SfAnalysesView({surfaceId:"UI41", route})`

`SfMemoryView` accepts `SfSurfaceProps` for UI61/62/63; `SfAnalysesView` accepts `SfSurfaceProps<"UI41">`. Preserve the current F01 parent provider through transitions, so owner generation/transport identity fences late reads. `chapter-route.tsx` still has the old `ChapterPageProps`; adapt only in 125's existing composition, never pass raw `ChapterPageProps` into these leaves.

Both leaves import ONLY public A14/A15 factories `createSfMemoryClient` and `createSfAnalysesClient`; 125 must first publish the actual A14/A15 Schema/Client exports in the package export maps and admitted F02/I00 codec map. Missing bindings must return `contract-unavailable` **before networking**, not `Schema.Any`.

## Fixed limitations — do not convert to green acceptance

1. **UI62 similar-case discovery:** A14's closed 7-operation catalog has no similar-case search/list method. UI62 shows an explicit unavailable explanation. No Atlas fallback, inferred authorized cases, unscoped search or private backend import.
2. **UI61 signal/condition authoring, UI63 outcome selection:** `memory-condition` and `memory-outcome-selection` require original Planner evidence/selection with digests and case identity. N30 has no published source-locked chooser that can construct it. Both writes remain unoffered; read materiality and observed comparisons work against original A14 authorized reads. Never synthesize PlannerEvidence.
3. **UI63 entry deep link:** `selectionRef` cannot be resolved to `caseRef/choiceId` by the admitted A14 interface. The selection route supports explicit authorized case/read; exact-entry binding is unqualified.
4. **U37 additional skills/continue:** `sf-enquadrar-decisao` accepts an exact empty selection in pinned `case-analysis-input.ts`. Other analysis selections require a producer-published trusted input adapter; no generic prompt/JSON editor or fake skill input. The source publishes no continue operation. `needs-input` remains a review state.
5. **U37 review/outcomes:** the A15 original output is HTML only; U37 escapes it as text and never executes `innerHTML`/iframe. No author/reviewer session or receipt is invented from a run ref. The original `review` offer is read-only.

These are **contract/producer integration blockers**, not failed qualifications quietly converted to a stub.

## 120 installed journeys / 119 compiler

- Run (only after 125 integration): `packages/app-shell/e2e/sucafina/native/journeys/u26.spec.ts` and `u37.spec.ts`.
- CI120 must provide an installed authorized native shell URL (`SF_NATIVE_APP_ORIGIN`, or Playwright baseURL), real `SF_NATIVE_N30_CASE_ID`, `SF_NATIVE_N30_CASE_INCARNATION`, `SF_NATIVE_N30_CASE_VERSION`, `SF_NATIVE_N30_CONDITION_ID`, `SF_NATIVE_N30_CHOICE_ID`, `SF_NATIVE_N30_READY_RUN_REF`, and a **disposable** `SF_NATIVE_N30_DISPOSABLE_RUN_REF` for cancellation.
- Do not create a fake grant, credentials, model session, receipt, case or planner evidence for tests. No test is skipped for missing inputs; failures are visible.
- CI120 owns browser/installed tests and screenshots at 320/768/1024/1280/1440; 119 owns the cross-source compiler and static check. N30 did not run either. Their results must be attached in a later receipt and are not implied by this PR.
- Recheck accessibility, keyboard focus and no horizontal overflow against the actual installed owner. No local screenshots or green claims exist.

## Ownership and handoff

- N30: exclusive U26/U37 TSX, CSS, i18n fragments, E2E sources, `receipts/native-ui/N30/**`.
- 125: shared composition and merge into `sf2-stack`, **only after verifying** true A14/A15 authority and allowed public exports.
- 120: CI installed, 119: compiler; no other session may be credited with these unrun proofs.
- No writes to protected/shared files from this branch. Diff of `sf-ux-n30` versus its original head should contain only N30 allowlist files.

**Handoff state:** code authored and committed; **integration/installed acceptance pending**. See `HANDOFF.json` for exact leaf postimages and criterion states.

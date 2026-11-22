# Decisions handoff — UI34–UI41 complete

## Integration result

**The eight-area implementation, complete 41-image gallery and scoped regression are qualified in their recorded states.** Product and tests are already integrated into `sf-design-twenty` at the root heads below. The final worker follow-up from `edd5c2eb62e2bea46143c214e8f738943f29004e` changes evidence/docs only; integrate its incremental file diff without copying stale host, registry or fixture files.

| Item | Exact reference |
| --- | --- |
| Worker branch / original base | `sf-twenty-decisions` / `2a68bcb676ed0c159c5c48130c2413e0e5637a00` |
| Last product/spec correction | `4978956b0ceeceec66df7c8f942c7495e83fa3e6` — procurement-case-read-scope and added UI35 focused qualification capture only |
| Last regression/docs checkpoint | `edd5c2eb62e2bea46143c214e8f738943f29004e` — new case-scope test plus these docs |
| Browser-qualified root product | `e5494ff044ee46cdd80c1d754131c284538d4d31` |
| Root product with final regression | `0550c4bb8fc3b4b4e68561777010ca03483e2391` |
| Upstream dev composition | `2eeb114266f8b9c9df9bb8f78a02ccf242cdc68b` |
| Browser run / snapshot | [44972048219](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972048219) / `58def9db4b3aa4c156a041eb86fbbd41de95bba7` |
| Gate17 run / snapshot | [44972927162](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972927162) / `e6b7de08b4cbb7790a585e2292bb985a41e60902` |

No individual PR or merge is intended. Parent owns the final integration and CI. No local execution or user-machine operation occurred.

## Final evidence and exact coverage

- Decisions14: one production Chromium test passed in 10.3m, one worker, retries 0, unchanged 780-second limit.
- All 41 JPEGs and all 196 log parts are complete; no skipped/missing/extra capture. Total original preview bytes: 3,161,553. Original quality-78 bytes are preserved; canonical PNG attachments remain in the run artifact.
- Each area has dark/light EN desktop 1440×1100, dark EN 390×844 and pt-BR dark desktop 1440×1100. Nine interaction images include the actual 320×800 comparison qualification and pt-BR review.
- Own review: 33 images; independent Procurement light review: eight; independent root representative review: eight. No visual blocker.
- The monitored source reads are 35 case projections, 11 current-choice, five analysis choices and five history reads, all HTTP 200. Twenty-one finish after 300 seconds; last case read is 200 at 453,279ms. Both page error/console arrays are empty, with no source-failure/probe event.
- Gate17: 15 checks / 89 regression cases; app, E2E and full CLI typechecks pass with zero CLI diagnostics; source guards 78 rules/254 files/0 errors/21 warnings/0 approval requirements; palette parity passes.
- New original case-read regression: two cases / 81 assertions. Decision/analysis health remain 24+19 passing cases; browser-condition Solid/codec regressions remain five passing cases.

| Area | Capture count | Actual tested behavior | Preserved limit |
| --- | ---: | --- | --- |
| UI34 — Case summary | 6 | Retained edit/review/cancel/reopen, one decision-edit POST, exact case CAS and unchanged source references/criteria on original readback. | Source attachments are disclosed; no new evidence is invented. |
| UI35 — Alternatives | 7 | Authorized empty alternative/choice state, actual two-source amounts and comparison, historical choice on the opaque case route. | The original producer does not admit current-choice preparation in this installation; no provenance, recalculation or promotion is fabricated. |
| UI36 — Assumptions | 5 | Open assumptions, confirmed filter with genuine filtered-empty state, exact evidence detail, empty derived missing categories and original coverage divergences. | Review does not confirm or mutate an assumption. |
| UI37 — Questions | 7 | Retained composer and review, one actual sf_question_prepare POST, unchanged case version/question list. | Preparation does not send or record a question. Optional cycle/recipient reads remain unavailable when unadmitted. |
| UI38 — Current choice | 4 | Actual recorded choice and explicit producer preparation refusal. | No source provenance or successful recalculation is fabricated. |
| UI39 — Prepared changes | 4 | Original empty prepared-change ledger. | Populated application/CAS/recovery paths are preserved but are not browser-qualified by this fixture. |
| UI40 — Application result | 4 | Original empty application-receipt ledger. | No apply/recover request or receipt is invented; populated receipt detail remains unqualified. |
| UI41 — Analysis | 4 | Original choices/list POST reads, real selector counts and history, objective input and actual catalog admission state. | No provider credential, model, run or output is fabricated. Prepare/start/cancel/output require separately admitted source configuration. |

Read [the final gallery](../evidence/decisions/README.md), [per-image manifest](../evidence/decisions/manifest.json), and [REVIEW.md](REVIEW.md) for exact provenance, visual notes, source diagnosis and qualifications. The gallery contains only Decisions14; earlier partial or diagnostic images are excluded.

## Browser commands and authoritative checks

UI34 executes exactly one decision-edit POST with a real original CAS reference and idempotency key. Review/cancel, close/reopen retention, source disclosure and hidden mounted fields are checked first. Original readback verifies the changed objective, increased version, and structurally identical sourceRefs/criteria. The narrow review asserts visible 44px actions.

UI37 executes exactly one sf_question_prepare POST after retained review/cancel and original-source/criterion disclosure. Its native acknowledgement distinguishes preparation from sending/recording. Original readback verifies unchanged case version and questions. The localized 320px review is cancelled and retains the draft.

No current-choice promotion, decision-apply or receipt recovery is emitted. UI41 reads original catalog/history POSTs and compares visible selectors against a fresh authorized API read independent of CDP response-body lifetime. A genuine empty model list keeps analysis preparation disabled. Its conditional prepared-input branch does not execute in the final run.

## Required fixture hook — already integrated

Keep `waveFourTest.use({ designWave: "four-decisions" })`. The Decisions-specific native fixture is needed for bounded canonical calculation data; the other wave-four journeys retain their own richer Planner fixture.

`design-support/native-host.ts` imports both hooks from `./wave-four-decisions-seed`:

```ts
seedWaveFourDecisionsPlanner(snapshot, actor, environment, year): void
seedWaveFourDecisions(installed, year): Promise<void>
```

The first runs in the original Planner transaction with an empty Planner and uses domain.execute only. It creates two named versions, their USD service line and original closed month. The second runs after withNativeInstallation yields the installed authenticated boundary and before browser metadata is published:

```ts
type Installed = {
  request(pathname: string, init?: RequestInit): Promise<Response>
}

if (decisionsWave) yield* Effect.promise(() => seedWaveFourDecisions(installed, year))
```

BI01/source/choice IDs and digests are emitted at runtime; no static evidence ID or manual TrustedUiContext is installed. Keep the real default decision-controls path: adding procurement=attached or clearing its selection would hide the regression instead of proving the corrected boundary.

## Product/test ownership

Owned UI paths (prefix `packages/app-shell/src/orchestra/chapters/sucafina/`):

- `decisions/intent/index.tsx`, `sources.tsx`, `request.ts`, `decision.css`
- `decisions/alternatives/index.tsx`
- `decisions/assumptions/index.tsx`
- `decisions/questions/index.tsx`, `cycles.tsx`, `consume.tsx`
- `decisions/choice/index.tsx`
- `decisions/changes/index.tsx`
- `decisions/receipts/index.tsx`
- `decisions/analyses/index.tsx`

Canonical fixture/browser regression:

- `packages/app-shell/e2e/sucafina/design-wave-four-decisions.spec.ts`
- `packages/app-shell/e2e/sucafina/design-support/wave-four-decisions-data.ts`
- `packages/app-shell/e2e/sucafina/design-support/wave-four-decisions-seed.ts`
- `packages/app-shell/test-browser/sucafina-decision-command.test.ts` — five actual browser-condition Solid/schema/codec cases; requires the existing Happy DOM preloader and browser condition.

Native composition and business regression:

- `apps/cli/src/sucafina-product/native-ui/decision-reading-health.ts`
- `apps/cli/src/sucafina-product/native-ui/analysis-reading-health.ts`
- `apps/cli/src/sucafina-product/procurement-case-read-scope.ts`
- `apps/cli/test/sucafina-decision-reading-health.test.ts` — 24 cases.
- `apps/cli/test/sucafina-analysis-reading-health.test.ts` — 19 cases.
- `apps/cli/test/sucafina-case-read-scope.test.ts` — two cases / 81 assertions.

Reserved catalogs sf-u16/UI34, sf-u17, sf-u18 and sf-u37 are unchanged. No new visible strings were needed. Existing source/state/reason values remain literal. UI33 is unchanged.

## Parent-owned integration contracts

Do not overwrite the current `apps/cli/src/sucafina-product/host-context.ts` with this worker's earlier file. The root already installed both observers in the genuine native operational composition and added only these read bindings: decisions.choice.read, decisions.command.sf_question_prepare, intelligence.analysis.choices and intelligence.analysis.list.

The decision observer requires the effective dashboard route, original registered choice fence, both real metadata observations and final snapshot verification. Pinning includes nested persistence transaction/transactionAll/currentSnapshots methods and final binding identity after lease finish. The question observer requires the same original descriptor/schemas in the installed arrays plus cases/threads namespace authority. It never calls options/dispatch/prepare as a health probe.

The analysis observer retains the original private analysis.prepare admission for choices and analysis.read for history; Cases/Contributions metadata and original source dependencies remain fenced. A missing optional model provider must not disable history; when present, its identity is captured. No prepare/start/cancel readiness is inferred.

The root owns all seven A15 effective route overrides to dashboard. Inputs are closed and lack surface; keep their methods/effects/fixed bodies/query/limits and the frozen catalog unchanged. F02 owns POST-read identity; command keys remain reserved for commands.

Shared frame/navigation/context menu, native fixture lifecycle, scope allowances and consolidated Actions remain root-owned. Final evidence/docs are safe to integrate incrementally from edd5c2eb.

## Proven case-read bug and regression boundary

The original default decision-controls evidence picker invokes procurementSelections.create even for a Planner case. It releases the collection reference and lease while the global selected-period Map retains its five-minute object. Decisions13's finite disposable diagnostic proved global origin and selection-expired at transaction entry/egress. The old wrapper could therefore veto a canonical Planner case based on unrelated Procurement state.

The reviewed fix keeps common Request/signal/header, binding/input identity, authorization and C08 checks. It requires the full selection/expiry/reader fence only after the unchanged eligible planned-Procurement predicate and again at eligible egress. Other cases use the original canonical reader outside the SQLite scope. Writer, TTL, seed, proofs, source materialization, final checks, exceptions, grants and schemas remain intact.

The canonical positive test issues the Planner source/case and original global selection, advances only the controlled clock and obtains fresh leases. Case/evidence/C08 revision remain unchanged after expiry and unrelated-period replacement. Structural eligible Procurement negatives, common identity/header/input/lease/abort guards and revocation remain refused. Every structural guard refusal checks successful C08 read plus zero canonical reads, avoiding a false pass from a throwing stub.

All diagnostic/relay instrumentation remains confined to disposable diagnostic branches. None is integrated into the browser-qualified product. Decisions10's URL-method error and Decisions12's temporary relay parse error are invalid diagnostics; they are not source conclusions. No full positive C12 first-preparation/application test was found during focused review, so that coverage is not claimed.

## Remaining limits

- UI35/UI38 show the actual recorded choice, but the original producer does not admit current-choice preparation. No missing-provenance cause is inferred beyond its returned refusal; recalculation and promotion are not browser-qualified.
- UI36 reviews and filters assumptions; it does not confirm or mutate them. Producer codes and authored evidence remain literal.
- UI37 prepares one proposal but does not record or send it. The optional cycle/recipient reads remain unavailable when not admitted; their populated states are not qualified.
- UI39/UI40 have genuine empty prepared-change and application-receipt ledgers. Populated application, CAS conflict, recovery and receipt-detail states are preserved but not exercised by this browser fixture.
- UI41 has original authorized cases, analysis options and an empty history, but no admitted model. Preparation review, start, cancel and output are not exercised; no provider credentials, model, run or result are fabricated.
- The case-scope regression uses original authority, SQLite, sources and Planner producers with a bounded test identity provider. Its eligible Procurement negatives use an explicitly structural planned-change fixture; they do not prove an emitted C12 preparation, application or receipt.
- Visual evidence is Chromium at 1440x1100, 390x844 and 320x800. It covers the recorded theme/locale states, not the full theme/locale/viewport cross-product, browser zoom, every browser or every preserved business state.
- Producer-supplied Portuguese reasons and raw state/code values remain literal in an English UI. Existing EN/pt-BR UI catalogs were not rewritten.

The final gallery/docs commit does not change the browser-qualified product or test assertions. Requalification is needed only if integration changes product behavior or the tested contracts; the parent coordinates that decision.

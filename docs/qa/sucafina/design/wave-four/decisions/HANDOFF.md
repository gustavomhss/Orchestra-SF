# Decisions handoff

## Integration

Branch: `sf-twenty-decisions`.
Base: `2a68bcb676ed0c159c5c48130c2413e0e5637a00`.

Commits before this handoff:
- `b4d2ef226fb9429a2ea24d6e66bf1463a2c3e434` — eight leaf compositions and scoped CSS.
- `355e65d2fc06f11940c03b3ff3befa2e781a6479` — canonical post-start seed and labels.
- The commit containing this file adds the executable journey, coverage disclosure refinement and durable review notes.

No individual PR is intended. The parent integrates these commits into `sf-design-twenty` and runs the consolidated Actions lane.

## Fixture hook

In `design-support/native-host.ts`, import both `seedWaveFourDecisionsPlanner` and `seedWaveFourDecisions` from `./wave-four-decisions-seed`.

In the Planner transaction, use `seedWaveFourDecisionsPlanner(snapshot, actor, environment, year)` only for `four-decisions`, instead of the larger wave-three/four Planner seeds. It requires an empty Planner and uses only the original domain.execute boundary. The two minimal versions are created first, then each receives one USD service line and a producer-owned closed month.

After `withNativeInstallation(...)` yields `installed`, before publishing browser metadata:

```ts
if (decisionsWave) yield* Effect.promise(() => seedWaveFourDecisions(installed, year))
```

Required shape:

```ts
type Installed = {
  request(pathname: string, init?: RequestInit): Promise<Response>
}
```

Post-start return type is `Promise<void>`. The pre-start hook returns void and creates the version names in `waveFourDecisionsData.plannerBaseline` and `plannerCandidate`. IDs and source digests come from BI01 at runtime. There are no static reference IDs.

Keep `waveFourTest.use({ designWave: "four-decisions" })` in this spec; other journeys run the standard four fixture. The browser discovers case routes from the actual UI33 list, lets the native route decode them, reads the admitted source reference from UI34 and verifies the original case projections.

## Files

Production leaves:
- `decisions/intent/index.tsx`, `sources.tsx`, `request.ts`, `decision.css`
- `decisions/alternatives/index.tsx`
- `decisions/assumptions/index.tsx`
- `decisions/questions/index.tsx`, `cycles.tsx`, `consume.tsx`
- `decisions/choice/index.tsx`
- `decisions/changes/index.tsx`
- `decisions/receipts/index.tsx`
- `decisions/analyses/index.tsx`

Prefix for all above: `packages/app-shell/src/orchestra/chapters/sucafina/`.

Test files:
- `packages/app-shell/e2e/sucafina/design-wave-four-decisions.spec.ts`
- `packages/app-shell/test-browser/sucafina-decision-command.test.ts`
- `packages/app-shell/e2e/sucafina/design-support/wave-four-decisions-data.ts`
- `packages/app-shell/e2e/sucafina/design-support/wave-four-decisions-seed.ts`

Reserved catalogs `sf-u16`, `sf-u17`, `sf-u18`, `sf-u37` are unchanged.

## Required verification

Run root's production Actions fixture with this exact spec and the other wave-four journeys. Inspect console diagnostics and screenshots; run app-shell typecheck, source guards and palette generation in the consolidated lane. No command has been executed locally. Include `test-browser/sucafina-decision-command.test.ts` with the browser condition and the existing Happy DOM preloader. Its five cases use real Solid tracking plus the unchanged native schemas/codecs; ordinary server-mode Solid would not reproduce the metadata regression.

Watch the canonical seed for a producer refusal rather than weakening grants or replacing emitted evidence. UI35 must show the real historical choice on the opaque route. UI41 must issue the choices/list POSTs successfully; a UI-only unavailable placeholder is not proof.

Read `REVIEW.md` for the state matrix and explicit limits. UI39/40 populated apply/receipt paths and UI41 execution/output are preserved but not browser-proven by the current fixture. Do not label them fully qualified without source-backed evidence.

## Decisions6 composition follow-up

The original current-choice GET and question-preparation workbench descriptor lacked native operational observations. Do not replace the existing historical-choice and question assertions with a fabricated unavailable/empty success. The leaf guards now leave loading when their read operation is unadmitted. The native context observer must also be installed.

New files:
- `apps/cli/src/sucafina-product/native-ui/decision-reading-health.ts`
- `apps/cli/test/sucafina-decision-reading-health.test.ts`

The host contract's `nativeReadBinding` union adds exactly `decisions.choice.read` and `decisions.command.sf_question_prepare`. The mounting callback in `local/entry.ts` already returns the original generic product binding; it needs no new route or grant.

Parent-owned `apps/cli/src/sucafina-product/host-context.ts` integration (apply to current root; do not copy the worker's older host file):

```ts
import { observeSfDecisionReadingHealth } from "./native-ui/decision-reading-health.ts"

// Add to the nativeUiContext operational Promise.allSettled:
observeSfDecisionReadingHealth({
  ui: authority.ui, state: authority.state, persistence: authority.host.persistence,
  binding: input.nativeReadBinding,
  source: (operationId) => {
    if (!identity() || services.productHttp !== productHttp || services.dispatch !== nativeSearchDispatch) return undefined
    if (operationId === "decisions.choice.read") {
      if (!currentChoice || !input.currentChoiceFence) return undefined
      return { producer: productHttp,
        dependencies: [currentChoiceHttp, currentChoice, currentChoice.options, business.withCase,
          business.cases, business.cases.read, business.plannerProduct, business.plannerProduct.issueSource,
          business.readSourceFences, input.persistence],
        choice: { fence: input.currentChoiceFence, options: currentChoice.options } }
    }
    return { producer: productHttp,
      dependencies: [services.dispatch, business.collaboration, business.collaboration.authority,
        business.collaboration.authority.sources, business.cases, business.cases.read, input.persistence],
      question: { catalog: descriptors, capabilities: business.collaboration.capabilities, dispatch: nativeSearchDispatch } }
  },
}, request, stamp),
```

The source callback only captures actual installed identities. C08 namespace reads, original UI admission/validation and final revalidation establish infrastructure readiness. Question preparation requires the exact original descriptor in both arrays and cases/threads read authority; choice requires its registered real fence and cases/preferences read authority. No health probe calls options, dispatch, prepare, promote or receipt production. All acquired leases finish exactly once, and the binding is rechecked after finish.

The initial health tests were expanded to 24 cases using the real isolated SQLite driver, UI authority, C08 state reader, source-lifecycle implementation and current-choice fence. They reject denial, missing namespace authority, copied fence/descriptor, dependency replacement, revision drift, source failure, abort, missing snapshot infrastructure and disposal during finish. Gate9 (44963051950) executed all 24 successfully. No test has been executed locally.

## UI41 native catalog and history reads

The follow-up adds `native-ui/analysis-reading-health.ts`, `apps/cli/test/sucafina-analysis-reading-health.test.ts` (19 original-boundary cases), and exactly two binding-union entries: `intelligence.analysis.choices` / `intelligence.analysis.list`. No preparation, start or cancellation readiness is inferred. A successful catalog response may contain no models and keeps preparation blocked.

Parent-owned host callsite:

```ts
import { observeSfAnalysisReadingHealth } from "./native-ui/analysis-reading-health.ts"

// Add to the nativeUiContext operational Promise.allSettled:
observeSfAnalysisReadingHealth({
  ui: authority.ui, state: authority.state, persistence: authority.host.persistence,
  binding: input.nativeReadBinding,
  source: (operationId) => {
    if (!identity() || services.productHttp !== productHttp || services.dispatch !== nativeSearchDispatch ||
      services.analyses !== analyses || services.selected !== selected) return undefined
    if (operationId === "intelligence.analysis.choices") return {
      producer: productHttp,
      dependencies: [analysisHttp, readSfImportAnalysisChoices, services.models, ...(state.models ? [state.models] : []),
        selected, nativeSearchDispatch, business.cases, business.cases.read, authority.human, authority.human.admit, input.persistence],
    }
    return { producer: productHttp,
      dependencies: [analyses, analyses.list, business.cases, business.cases.read,
        authority.human, authority.human.admit, authority.human.authorize, input.persistence] }
  },
}, request, stamp),
```

The original choices producer uses the private `analysis.prepare` action even though choices itself is a read. History uses `analysis.read`. The health observer retains these exact action admissions, verifies Cases/Contributions metadata through the canonical state reader, and never enumerates cases, queries a provider, prepares input or produces a run/output. Original source methods and the mounted product binding remain fenced across awaited reads and final lease disposal.

The UI41 test awaits the actual browser POST status and native view acknowledgement, then compares its visible selectors with a fresh authorized read of that same original endpoint through `page.request`. This API response retains its body independently of Chromium/CDP. Both responses must succeed. There is no intercepted response, fabricated catalog, grant or model. Selection/input preparation assertions remain conditional on actual native availability and the real catalog.

## Original choice-fence proof

The effective registry overrides `decisions.choice.read` to `{mount}/dashboard`; the observer checks this final route. Its two metadata observations now run inside the original registered `CurrentChoiceFence.run` and require its final snapshot publication check. The exact nested persistence transaction/transactionAll/currentSnapshots methods are pinned across awaited reads. The 24 decision health tests now use the real isolated `openLocalStore` SQLite driver, preserving its transaction and snapshot methods; hooks only schedule revocation/corruption. Negative cases remove original snapshot support or replace a nested persistence method and must not publish readiness. The parent CLI gate must run these tests; no execution was performed locally.

UI37 optional cycle/recipient selectors now leave loading when their own operation is unadmitted. The journey records those exact operation states and distinguishes unavailable from the empty response of an admitted producer. These optional Collaboration source paths are not claimed as positively qualified when no operational observation is published. The primary question preparation remains positively asserted through the original producer.

## Consolidated verification after the native-read repairs

Gate9, run [44963051950](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963051950), passed all 12 consolidated checks. Its official job log records all 24 decision-reading-health cases and all 19 analysis-reading-health cases passing, including the real SQLite fence, operation/namespace denials, revocation, dependency replacement and lease finalization. The five browser-condition command codec cases also remain in the passing gate.

The follow-up fixture-only commit `96877de60ddecf1b60ad4eca96353c34ec4080e3` adds exact `Snapshot`/`BlobTransaction` callback annotations and explicitly guards the original SQLite snapshot methods. Full CLI audit5, run [44963827656](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963827656), then returned exactly the seven diagnostics already recorded on dev, with zero new diagnostics after normalizing only locations/timestamps. The full CLI audit itself remains failing on that established baseline; it is not represented as a clean typecheck.

Decisions7, run [44963049158](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963049158), reached the real host with all four new read/preparation observations ready. Both actual current-choice GETs returned HTTP 200 (9,142ms and 9,878ms). UI34 completed its retained draft/review/save/CAS sequence; UI35 proved the authorized empty case and actual historical choice, comparison and 320px reflow. Console and page error collections were empty at failure.

The run stopped in UI36 because an exact getByLabel selector for its nested select included option text and never located the filter. The failure was not a read timeout. The test now targets the named combobox; the existing visible labels explicitly name the selects in UI36, UI37 and UI41. Page actions have a 15-second default timeout, while the explicitly awaited original command/read responses retain a 40-second bound and the overall 780-second limit is unchanged. The source projection also proves no derived missing categories: unresolved migration coverage is an event divergence. The assertion now preserves that distinction by checking the original empty derived array, its empty message and the actual coverage divergence.

The four successful official previews were visually inspected: UI34 desktop editor and 390px review, UI35 desktop empty choice and 320px comparison. The source-reference disclosure is compact, action targets and focus are readable, and no horizontal overflow is present. These four states are approved within the captured dark-theme scope. UI36 onward and the complete theme/locale matrix await the next journey; the eight-surface visual review is not complete.

## Decisions8: closed analysis inputs require a bound native route

[Run 44964845981](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44964845981) passed the functional steps through UI40: the UI36 combobox/filter and source-detail assertions, the original UI37 question preparation, and the UI38 historical choice all completed. Three actual current-choice GETs returned HTTP 200 (7,411ms, 7,800ms and 3,999ms); the failure diagnostic still reported no console or page errors. UI41 then reached its unavailable state before any choices POST; its explicit 40-second response wait failed.

The A15 inputs in packages/schema/src/sucafina/analyses.ts are closed and contain no surface field. Their effective registry entries still used {mount}/{surface}. F02 only resolves that placeholder from an admitted input.surface, so the otherwise valid choices({}) call failed route construction before HTTP. The original CLI analysis HTTP handler explicitly accepts the dashboard path and closes the choices body to action; the original history handler accepts only action and caseRef. Adding surface to those bodies or relaxing F02 would be incorrect.

The integration agent owns the source-backed registry override for all seven A15 operations to {mount}/dashboard, retaining every original method, effect, query, action discriminator and request limit. This worker follow-up updates the two-read health guard to require that exact effective dashboard route. It must be integrated together with the registry override. It adds no analysis prepare/start/cancel readiness or grant and changes no schema, input or producer. The existing 19 health tests continue to require the real effective registry and original source/authority fences; no test literal needed adjustment. Decisions9 will qualify the combined route repair on the newly incorporated dev composition.

## Visual refinement from the actual Decisions8 captures

The UI36 source-detail capture exposed grid stretching: its short missing-category message was vertically separated from its heading by the much taller divergence column, and the Open status chip filled a grid track like an input. The scoped stylesheet now starts gap-section content at the top and keeps that status badge at its intrinsic width using native line/text tokens.

The UI37 review capture exposed long technical references beside the question and criterion. The visible question, criterion description and recipient remain primary; the complete source references, criterion/recipient IDs and evidence levels now live in the existing localized Source scope disclosure with the actual source count. The journey opens it and asserts every original source reference plus the selected criterion ID before closing it. No source value, preparation input, draft lifecycle or action changes.

The integration branch has since incorporated dev through 3ce1acd0. [Gate12 run 44965223657](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965223657), snapshot dacaec3b11b0dce7244268f7de1ade2a6df0aece on root 331cafc50bee2112f6366ff428658de938c6f58e, passed all 13 checks including the full CLI typecheck. This supersedes the earlier seven-diagnostic baseline limit after the upstream type fixes. The following consolidated gate and Decisions9 will cover the combined A15 route repair and these visual refinements.

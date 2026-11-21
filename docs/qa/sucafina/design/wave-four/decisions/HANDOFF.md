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

Run the 21 new health tests in the parent's CLI gate. They use the real UI authority, C08 state reader, source-lifecycle implementation and current-choice fence over the existing isolated test driver; they reject denial, missing namespace authority, copied fence/descriptor, dependency replacement, revision drift, source failure, abort and disposal during finish. No new test has been executed locally.

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
      services.analyses !== analyses || services.selected !== selected || !state.models) return undefined
    if (operationId === "intelligence.analysis.choices") return {
      producer: productHttp,
      dependencies: [analysisHttp, readSfImportAnalysisChoices, services.models, state.models,
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

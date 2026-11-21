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

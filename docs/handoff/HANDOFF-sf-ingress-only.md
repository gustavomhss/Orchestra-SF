# Handoff — sf-ingress-only

## Qualificação atual pelo integrador — COMPLETE no escopo de ingresso

- Run: [44674117714](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44674117714), attempt1, completed / **success**.
- Snapshot: af21e61bf9cb52a73482cd99eebb61975395fdcc, filho direto de300e5c41ab1f353f491db80bfc93b664960abd38. Acrescenta somente .ci-run.json; os seis blobs de código são idênticos a345cebee e ao checkpoint documental410e2d1.
- Testjob136081747586: **success**; compilação SF E2E original efetivamente executada por bun run typecheck:sf-e2e / tsgo -p tsconfig.sf-e2e.json.
- Os três specs completos: **3 passed (2.0m)**, zero falhas, um worker, zero retries. As duas jornadas antigas preservam todas as assertions.
- Cleanup136083875834: **success**.
- Artefato14602300733: playwright-ubuntu-24.04-1,924306bytes; digest ZIP **f5d57d0a477f6de2b7cdc42a8cd067399d62c7c16584b710069310f33ed35a4e**.
- Este é um recibo de ingresso real/primeiro save, não um baseline da campanha, digest do pacote ou aprovação das jornadas completas de Reports/Decisions/BI.
- O código foi revisado por root e por Reports. Não houve troca de resposta, novo grant, bypass, alteração do runtime/application.ts, ampliação de prazo ou skip.
- Escopo agora elegível: exatamente os seis arquivos de código e este handoff. Os gates globais anteriores Reports0/4 e Decisions2/5 permanecem failure/unbound; os ramos de UI/shards não são promovidos por este resultado.
- O #396 anterior continua sendo proveniência dos três blobs de Reports; o integrador apresentará esta união explícita de ingresso em PR próprio e registrará a relação, sem alegar sucesso da antiga jornada completa.


SHA: 345cebeedb2b04d3e349bd40f0678c82cfaac215 (code; this handoff is a later documentation commit)
Data: 2026-11-20 (UTC)
Estado: COMPLETE — real ingress and original first-save scope qualified by Actions44674117714; business journeys remain unbound

Branch: sf-ingress-only.
Integration parent: aa751dd731ce91f126a00488dfce16022bb8cb2d (sf-join-four).
Explicit second parent: 455f64a689f000cdb4c0ed88fdcd229a4de81992 (coordinator's identity-only TypeScript repair).
Code tree: 92c494ee4aa19cdfae84b07ae0f00f31ea988f03.
Owner: Session 5 ingress integration. All gates, PR state changes and merges remain with the coordinator.

## Cause and bounded change

The current integration still launches the original Reports and Planner CLI fixtures on the prohibited legacy listener. Its production preview also routes the nominal Reports and Decisions selections to that listener. This is executable fixture behavior, not a harmless documentary string.

The candidate contains six code files and no partial feature UI:

- Reports production installation and fixture are the exact blobs from draft PR #396 at 40f935a39f1a686a2b0ac011999632ea37ffa581. They prepare the original installation for the public preview origin, start the real CLI on 127.0.0.1:4174 with its existing public-origin argument, redeem the original one-use enrollment, and call unchanged connectInstalledShell. The real helper checks the issued owner-only Daemon credential, authenticated installation discovery, original context schema and actor stamp, and uses the actual server/project controls.
- Reports capture guards run before enrollment or credential access and require resolved trace, video and screenshot options to be off. The nominal Reports spec already declares those exact values.
- wp03/installation-fixture.ts is the exact be901681fcb383a5e23227f822cee66befa6c192 blob from the earlier Decisions ingress fix. Reservation, CLI binding and teardown probe all use 127.0.0.1:4174. Its original assertions, process ownership, deadlines, preparation, sign-in and cleanup are unchanged.
- The production config changes only the upstream prerequisite predicates. It preserves Playwright's original test selection, channel filters, retries, workers, metadata and web-server composition. Reports and Planner keep their own CLI fixtures; neither starts wp04/host.ts.
- The new reports-ingress.spec.ts exercises the original reportsTest and its actual corpus/CLI/authentication lifecycle. It does not import, duplicate, truncate or replace a Reports business journey.
- import-health.ts uses the coordinator's exact Object.is identity comparison from 455f64a. It resolves the reported TS2367 at line 31 from run 44671315734/job136072705652 without casting interfaces, widening authority or changing object-identity semantics. This dependency is explicit in the commit's second parent.

## Exact upstream consumer inventory

Reports fixture consumers:

1. e2e/sucafina/reports.spec.ts
2. e2e/sucafina/reports-ingress.spec.ts (new original-fixture regression)
3. e2e/sucafina/reports-support/agenda-transport.spec.ts

Planner fixture consumers:

1. e2e/sucafina/decisions.spec.ts
2. e2e/sucafina/decisions-native-authoring.spec.ts
3. e2e/sucafina/wp03/native-ingress.spec.ts
4. e2e/sucafina/wp03/planner-mounted.spec.ts
5. e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts

The fifth Planner consumer directly imports startPlannerInstallation and was missing from the earlier Decisions handoff's four-file inventory. The agenda transport diagnostic also imports reportsTest. Both exact names are included here so moving their shared listener does not leave their preview on the old upstream. These predicates do not select additional tests.

The existing WP04/Operations predicate is preserved. The three final sf-ci UI selections therefore resolve to the permitted upstream. The unrelated legacy fallback and separate C12 recovery fixture remain outside this candidate's selected specs; neither is executed by the proposed request or the nominal final UI matrix.

## New Reports ingress regression and proof limits

The new regression uses the production Reports fixture with the same 180-second test/fixture budgets and 120-second startup budget already declared for Reports. It adds no retries, sleeps, alternate server, fake identity, grant, descriptor, cookie, response, localStorage entry or bypass.

After the fixture's original authenticated discovery and shell selection, the test opens the existing native CAP23 route only to consume the selected owner. It requires the actual browser ctx.context response to return 200, checks the exact three original binding query keys through SfExpectedContextBinding, and makes a separate authorized read of that observed URL. The original SfContextResult must identify the same installation/project/host and the fixture's actual principal, with local-operator authentication.

The separate APIRequestContext read is an independent authority oracle. It never supplies bytes to the browser, fulfills a route, replays a mutation or substitutes for the original response. The browser must independently render a unique ready owner and CAP23 with enabled native access controls.

Reload and Refresh access must preserve the exact binding without another enrollment. The original Sign out action must return 204 and the browser's context read must return 401. The independent original read must return exactly { status: "unauthenticated" }; the provider becomes unauthenticated, CAP23 disappears, Sign out disappears, and a further real Refresh access remains 401 with the same binding.

The new test never enters a Review agenda, preserves a dossier, changes a financial source or exports Office bytes. A successful ingress gate will qualify the fixture/config boundary and the first-save regression below, not the four Reports business journeys, complete Decisions, C12 or release acceptance.

## Original tests and historical evidence

No existing spec, business helper or assertion is changed by this candidate.

- The two original specs wp03/native-ingress.spec.ts and bi-installed/installed-planner-ingress.spec.ts passed in historical run [44607176525](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44607176525), snapshot ba016e0794008ca65b99527e365780f09fcdf7fe, source e67804463bf26f23ffc81701f2c2a3f11917be4f. The run and both job conclusions were read directly. That snapshot used the former listener and is historical context only; its success is not transferred to this candidate.
- The first original spec verifies actual installation/discovery/context, native CAP23, reload, access refresh, logout204, context401 and removed private DOM. The second verifies one real first save, original request/response, independent authorized CAP23 identity/name/year, selection, editing availability and reload, with exactly one save request. Both remain byte-for-byte unchanged.
- Decisions ingress run [44654471102](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654471102), snapshot 1a755bfa542653efb24386348d41022a21d38605, source fba289d484d0c0ff2463cbc26ab587777516a8db, completed failure: 2 passed / 3 failed. Its installed SF E2E typecheck and cleanup passed. The two passed cases were the original durable case lifecycle and lost-creation read recovery at decisions.spec.ts:41 and :97; their helpers are the same blobs present here. The full nominal selection is not qualified.
- First Decisions failure: decisions-support/planner-sources.ts:19 expected one original record-detail element and observed zero. The Procurement journey timed out in its original create-request step; catalog creation later failed at decisions-support/journey.ts:124. These business failures are not removed or converted into expected failures.
- Reports nominal results remain unqualified, including the recorded 0/4 source gates. Draft PR #396 is not merged or marked ready by this work. No assertion, timeout or baseline in reports.spec.ts is changed. A green new ingress regression will not reclassify those nominal results.

## Code identities and preserved boundaries

| Path | Candidate blob |
| --- | --- |
| packages/app-shell/e2e/playwright.production.config.ts | 8f452673bb53810d15b7b722fd2eb2418dfa67ad |
| packages/app-shell/e2e/sucafina/reports-ingress.spec.ts | 6e2d27dc8d3cc2c583d963ec2da3b07b5ff74d75 |
| packages/app-shell/e2e/sucafina/reports-support/fixture.ts | d930f147d9c2211a8598a8c276e5d83c5275329d |
| packages/app-shell/e2e/sucafina/reports-support/production-installation.ts | 49005d72dc095655a0418ebff6d003752a0e6959 |
| packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts | be901681fcb383a5e23227f822cee66befa6c192 |
| apps/cli/src/sucafina-product/native-ui/import-health.ts | 817f50ae7dab6c092d13f342cb0f33edc82c0c53 |

The integration advanced from 82ead34 to aa751dd while preparation was in progress; comparison showed only two existing WP02/WP07 test changes. The candidate was created from aa751dd and preserves them.

Freeze revision 12 is unchanged, including manifest blob 7a8132250131b9d30aaca5a330720bd3e0fa97fa and consumerAcceptance BLOCKED. No source covered by its 38 pins changes. PR #393 is absent: bindings.ts remains the integration blob 4da08551e6f30e9992cd28c57c1e1a6ab39bd876. No UI source, runtime/application.ts, schema, suites.json, workflow, acceptance baseline, coverage or artifact digest changes.

## Proposed single qualification request

The coordinator may run exactly the three complete specs after reviewing this candidate. The canonical runner enforces one worker, zero retries and exact filename selection. No grep, skip or expected-failure filter is added.

~~~json
{
  "package": "app",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": [
    "e2e/sucafina/wp03/native-ingress.spec.ts",
    "e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts",
    "e2e/sucafina/reports-ingress.spec.ts"
  ]
}
~~~

Complete status for this narrow candidate requires the installed SF E2E typecheck plus all three specs and cleanup to succeed on the exact composed source. Record snapshot SHA, run/job IDs, counts and original artifact. A failure remains a failure and must be bound to its first causal file:line before any changed-code gate.

## Verification, merge order and resumption

- GitHub-only source review, exact blob composition and readback performed. Original app/e2e instructions and official Playwright guidance were read. No local shell, tests, typecheck, build or guards.
- Independent static review by the Reports owner examined code 345cebeedb2b04d3e349bd40f0678c82cfaac215, both parents, all six paths and the exact fixture blobs. No static blocker was found: the browser status/query binding remains original, the separate authorized body read is explicit, capture guards precede the credential, and logout follows the installed owner invalidation/reload. This is source review only; Actions qualification is still pending. Its scope is ingress/lifecycle and the original BI first-save proof, not complete Reports, Decisions or BI.
- No gate, PR, merge or ready transition was performed by this owner. No merge order is claimed here. The coordinator integrates this as shared ingress only after the declared scoped success.
- Guards: not run by this owner; final integration guards remain with the coordinator.
- sf-ci: not run by this owner. The unique final run and every job outcome remain pending.
- Artifact/baseline: none produced by this candidate yet; no acceptance baseline invented.
- Package sha256: not produced by this candidate. Factory packaging remains after the frozen integration.
- No GO, deploy or SF_ORCHESTRA_WEB_PACKAGE_VERIFIED claim.

To resume, inspect sf-ingress-only and the six-file code comparison, record the scoped gate, then update only this handoff's observed result. Keep Reports/Decisions business unbound entries distinct. If the gate fails, diagnose its actual first failure without trimming the original specs or increasing their deadlines. Do not run the old listener, rerun an identical failure, or launch sf-ci before the remaining approved integrations are frozen.

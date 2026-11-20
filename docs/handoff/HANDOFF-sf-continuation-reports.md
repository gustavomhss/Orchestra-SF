# Handoff — sf-continuation-reports

SHA: 537b8defbe86606ce3ddb1e9d65e282a6526c9ea (code; this handoff is a later documentation commit)
Data: 2026-11-19 (America/Sao_Paulo)
Estado: partial

Branch: sf-continuation-reports.
Base: f7dd58e32bc834f1485df20b91adbf759b4c4ad0 (sf-join-four).
Owner: Reports continuation only. Integration and every Actions dispatch belong to the Session 5 lead.

## Feito

- Read the original Reports installation, the existing installed-shell helper, server installation discovery, local configuration preparation, native owner admission, CLI serve flags and production Playwright/Vite configuration.
- The original Reports fixture redeemed the local operator enrollment but did not connect the browser to the issued host credential or select the real project. The native chapter fallback can receive an empty directory; enrollment alone does not select that owner.
- Commit 79e30c62e5eef4ca7f85e4de3e9f062cc6b32ed7 uses the original prepareLocalConfiguration(root, installedShellOrigin()) instead of invoking the legacy default-origin CLI preparer.
- The real CLI listens on 127.0.0.1:4174 with its existing --public-origin flag. The public origin remains the built shell's configured origin, normally http://127.0.0.1:3000. The fixture observes that child's original listener event and keeps its original lifetime/cleanup.
- After redeeming the original single-use enrollment, signIn calls the already-existing connectInstalledShell(page, installation). That helper reads this isolated Daemon's owner-only issued credential, calls authenticated location discovery, decodes the original installation/context schemas, compares the real actor stamp, and uses the actual shell server/project controls.
- No identity, grant, descriptor, cookie, localStorage record, response or baseline was manufactured. Project selection is made through the product UI. The helper is reused unchanged.
- The alternative of appending an explicit owner triplet to the Budget URL was rejected: owner-runtime231.tsx:433-436 deliberately refuses losing an explicit owner through the exact triplet-less Reports href required by the UI task. Real shell project selection preserves that navigation contract without changing the guard.
- Commit 537b8defbe86606ce3ddb1e9d65e282a6526c9ea adds fail-closed capture checks in reports-support/fixture.ts before withReportsInstallation can prepare enrollment or read the issued credential. The fixture receives Playwright's resolved trace, video and screenshot options and requires all three to be off. reports.spec.ts:21 already selects off for all three. test-ci.yml appends --trace retain-on-failure; if that overrides the spec's effective value, the new assertion stops before credential entry. No assumption about CLI precedence or unproven tracing.stop lifecycle is required. The real gate still must validate the installed Playwright fixture types and resolved option values.
- Only two code files changed: packages/app-shell/e2e/sucafina/reports-support/production-installation.ts and fixture.ts. The fixture's worker diagnostic now describes the owned listener; the one-worker assertion is unchanged.
- GitHub readback matched all intended code files exactly after both code commits.

## Pendente

- Required shared configuration dependency: packages/app-shell/e2e/playwright.production.config.ts must identify reports.spec.ts and use ORCHESTRA_SF_E2E_UPSTREAM=http://127.0.0.1:4174 for Reports as well as wp04. Reports must not start wp04/host.ts. This file belongs to the integration lead and was not changed here.
- The existing Vite proxy already permits that exact loopback listener. No proxy-origin, CORS, authorization or allowed-host expansion is requested.
- Do not dispatch the Reports gate until that dependency is composed with this code. The two unchanged financial/source helpers and the native UI remain subject to the real gate.
- No Actions run was launched by this agent. Runtime acceptance is pending; this is not a complete or green handoff.
- Current base still declares a record-removal UNBOUND in reports-support/review-flow.ts:27. This first causal fix does not remove that requirement, simulate a control, or claim record-level selection has passed.
- Historical reports15 failures remain evidence only: code f5a25c860e906183bb0456fe38b745d3b73ddbc5 diverged from the assigned base (120 ahead/4 behind). Its first failure at review-flow.ts:253:27 waited for CAP04; its first explicit assertion at :177:29 received HTTP 500 from ?download=json. No large historical branch was transplanted.

## Decisões e justificativas

- Source/financial/preserved-review assertions, one worker, zero retries, test deadlines and startup deadlines are unchanged.
- No edit in runtime/application.ts, suites.json, schemas, any Session 1 file, shared config, workflow, or protected branch.
- No dead console was recreated. The real CLI and built preview remain the existing production composition.
- reviews.export.docx/pptx remain Schema.Never; no code touching export authority or GET ?sf=review-download was changed.
- No GO, deployment or SF_ORCHESTRA_WEB_PACKAGE_VERIFIED claim.
- All changes used GitHub APIs. No shell, local test, local typecheck or local build.

## Evidence before this fix

- Run 44646379209, snapshot 47a498e47becb6a9b6ab551099a114fdd66df4fd, code ffa13012bc0ac2bba113860946930355c0a9a37f: failure, four Reports cases fail at packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:21:30, Reports and backup missing. Job 135989909108; installed SF E2E typecheck success; artifact 14589541312 (playwright-ubuntu-24.04-1), SHA256 e09464962bc2774b6456a85cd18e3cdef5800e335444abf925744733a9b1b2a3.
- Run 44639932900 on PR #394 had the same entry assertion failure at review-flow.ts:22:32. That candidate also lacked the original shell connection/project-selection call.
- These failed runs are not acceptance for this new commit.

## Como retomar

1. Keep this branch isolated; confirm its live head before any later write.
2. Lead composes code 537b8defbe86606ce3ddb1e9d65e282a6526c9ea with the shared Reports upstream selection and the qualified Session 1 UI blobs.
3. Run the one original Reports spec using the supported request below. Record snapshot/code SHA and the first real failure without attributing unrelated historical lines to this tree.
4. If a later native selection/review/export control is missing, coordinate its precise product path with the lead before changing ownership. Preserve the financial, historical, source-count and source-immutability requirements.
5. After a concrete fix, request a new gate from the lead. Never repeat an identical failing gate without code change; lead owns the maximum two simultaneous gates and the single final sf-ci.
6. Update this handoff with the observed gate result and remaining exact file:line. Complete status requires corresponding successful proof.

## Comandos e resultados

GitHub-only source review and readback: performed.
Applicable packages/app-shell/AGENTS.md and packages/app-shell/e2e/AGENTS.md read; no deeper sucafina or reports-support AGENTS.md exists at this head. Local commands/build/tests/guards/typecheck: not run.
Actions gates, sf-ci, PR, merge, package/deploy: not run by this owner.

Smallest supported nominal request (entire Reports file, no grep/skip/relaxed assertion):

```json
{
  "package": "app",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": ["e2e/sucafina/reports.spec.ts"]
}
```

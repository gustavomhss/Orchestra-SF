# Handoff — sf-decisions-ingress

SHA: cc8aa60c5febe2e8e7dbca3d2f2a6edd8ab0edb1 (code; this handoff is a later documentation commit)
Data: 2026-11-20 (UTC)
Estado: partial — ingress fix ready for the lead's Actions qualification

Branch: sf-decisions-ingress.
Exact parent: 042fe208f907c779bc4b65aa5544a4ffb4762dc6 (sf-reports-composed).
Original integration base: f7dd58e32bc834f1485df20b91adbf759b4c4ad0.
Owner: Session 5 ingress integration only. Every gate, PR and merge belongs to the lead.

## Cause and scope

The final sf-ci UI matrix selects CI-UI-DECISIONS (.github/workflows/sf-ci.yml:450) and runs its original decisions.spec.ts through the production config (:504). All five test bodies use decisions-support/journey.ts:37, which calls startPlannerInstallation.

Before this fix, wp03/installation-fixture.ts:24 reserved the forbidden listener, :54 launched the real CLI on that listener, and :129 probed its release. The production configuration sent the exact Decisions spec to that legacy fallback. It was actual network use, not an unused string.

Only two code files change:

1. packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts
   - Reservation, real CLI bind and teardown probe now consistently use 127.0.0.1:4174.
   - The teardown diagnostic reports that same endpoint. Its assertion and all deadlines remain identical.
   - The original preparation, process ownership, cleanup, single-use enrollment, original cookie, issued Daemon credential and connectInstalledShell flow remain intact.
2. packages/app-shell/e2e/playwright.production.config.ts
   - Adds an exact filename selector for the four existing startPlannerInstallation consumers: decisions.spec.ts, decisions-native-authoring.spec.ts, wp03/native-ingress.spec.ts and wp03/planner-mounted.spec.ts.
   - The three additional exact names are necessary because they share the changed listener; omitting them would leave those existing journeys pointing at the former proxy upstream.
   - Uses the same normalization already reviewed for Reports. It changes only upstream selection, not which files/tests execute.
   - These fixtures now share the already permitted 4174 upstream. They do not start wp04/host.ts.

## Origin, authority and C12 boundaries

- installedShellOrigin() already defines the public browser origin, normally http://127.0.0.1:3000.
- wp03/installation-setup.ts:10 already passes that public origin to the original prepareLocalConfiguration.
- The real CLI already receives --public-origin (:55). This change only moves its private listener.
- The original status read and enrollment still use the public origin through the existing preview proxy.
- signIn (:114-116) still installs only the original issued session cookie and calls unchanged connectInstalledShell with the actual private directory, public origin, mount and actor.
- No fabricated identity, grant, header, response, localStorage record, source result or bypass. No origin/CORS/host expansion.
- The complete import chain of the five nominal Decisions journeys was inspected. Their C12 Apply/recovery path uses the same original installed CLI; it does not import or launch c12-installation.ts or c12-host.ts.
- The separate decisions-native-recovery.spec.ts uses those dedicated C12 helpers. They still contain their legacy listener/control origin and were deliberately excluded from this selector. That separate spec is not selected by CI-UI-DECISIONS or the final sf-ci manifest, and it must not be newly launched under this session's no-legacy-listener constraint without its own coordinated ingress fix.
- No C12 UI, producer, protocol, assertions, timeouts, business source or runtime/application.ts was changed.

## Operations composition

The nominal Decisions journeys directly use the Planner, Procurement and Decisions native surfaces. No imported journey in this chain depends on the Operations UI or its upload/retrieval fixture. The separately selected C12 host imports the existing Operations installation factory, but that host is not launched by the five nominal tests.

The lead's Operations branch also changes the production config. Preserve the union of the reviewed exact Reports, Planner/Decisions, WP04 and Operations upstream predicates when composing branches; do not replace one branch's entire config with the other's older blob.

## Merge order and open work

No merge or PR was performed by this owner. This branch is based on the frozen Reports composition, so it includes that candidate's earlier UI/ingress work by ancestry without rewriting it.
All existing Decisions test assertions and the five test bodies remain unchanged. No new baseline or coverage claim.
This handoff stays partial until the lead records a successful Actions gate on the concrete composed candidate.

## Verification and artifacts

- GitHub compare/readback of the code commit confirmed exactly the two intended code paths.
- Applicable root, app-shell and e2e instructions were already read; no wp03/AGENTS.md exists at this parent.
- No shell, local test, build, typecheck or guard execution.
- No Actions dispatch, sf-ci, gate, package, deploy or GO by this owner.
- Guards: not run by this owner.
- sf-ci job results: pending the lead's single final run.
- Baseline/artifact: no artifact produced by this ingress change yet; suites.json is untouched.
- Package sha256: not created by this owner.
- Current runtime failure: none observed on this new candidate; it has not been run.
- The separately selected C12 fixture's legacy endpoint is a known scope boundary, not a current failure in decisions.spec.ts.

## Como retomar

1. Freeze this branch's final head, containing the code SHA above and this documentation commit.
2. Compose any later Reports fix and the lead's Operations config predicate while preserving the exact union described above.
3. Lead may gate the entire original Decisions spec with the supported request below after this concrete ingress fix. Keep its five tests, original assertions, one worker and zero retries.
4. Record exact candidate/snapshot SHA, run/job IDs, first failure file:line or complete success, and artifact. Do not rerun the identical failing candidate without a concrete change.
5. Complete qualification, shared/UI/shard integration order, the one final sf-ci and factory package remain owned by the Session 5 lead.

```json
{
  "package": "app",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": ["e2e/sucafina/decisions.spec.ts"]
}
```

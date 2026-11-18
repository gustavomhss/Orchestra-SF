# Lane ownership

One writer per branch. Do not edit another lane's files. Integrate only into `sf-red-clusters` after the lane's own gate is green.

## Tests and CI

Do not repeat a run that already exists.

- Forbidden for every lane, including the parent: `bun test`, Playwright, e2e, `bun run test:ci`, `gh workflow run`, and any local browser or shard run.
- The only completed evidence for the current red lanes is run `44329483839` on `2e5839eebb`. Read that job log or its artifact. Do not dispatch another `sf-ci` or `test:ci` to re-see it.
- `bun run typecheck` is allowed only on `sf-typecheck`, and only inside `modules/sucafina`.
- A lane that cannot prove a fix without a new test run writes the cause and the proposed patch, then stops. The parent runs one CI after the lanes land.

Base for every new lane: `origin/sf-red-clusters` @ `a26a35f135` or later. Do not use the owner checkout.

## Running

| Branch | Worktree | Owns | Does not own |
| --- | --- | --- | --- |
| `sf-typecheck` | `/tmp/ag-type` | Remaining `modules/sucafina` type errors, including `runtime/procurement.ts`, `runtime/contract.ts`, `product/interface/analysis-http.ts`, `product/ui/contribution-body.ts`, `product/host-binding/state-provider.ts`, `apps/cli/.../native-host.ts`, `apps/cli/.../live-context.ts`, `apps/desktop/.../protocol.ts`, and the test files named in `session-checkpoint.md` | Reports storage, native-phase-bridge fixture, e2e decisions locators, CI logs |
| `sf-toolsafety` | `/tmp/ag-safety` | `modules/sucafina/Sucafinav1/test/product/native-phase-bridge/**` | Production `routine-native-governance.ts` unless a fixture cannot be fixed without a proven production bug |
| `sf-failure-map` | `/tmp/ag-map` | Artifacts `sf-shard-failure-CI-SF-{2,7,8}` from run `44329483839`. Report only: `docs/qa/sucafina/consolidation/failure-map.md` | Product code, other jobs |

## Queued lanes

Each lane reads its own job log from run `44329483839` (head `2e5839eebb`, older than the name-locator and type-batch commits). If the log's cause is already fixed on `sf-red-clusters`, record that and stop. Do not weaken an assertion.

| Branch | Job | Owns |
| --- | --- | --- |
| `sf-reports-stall` | `134890490475` `sf/test-CI-UI-REPORTS` | `product/reports/**`, `product/reviews/capabilities.ts`, `runtime/artifact.ts` |
| `sf-effect4-imports` | parent, proven by jobs `134890490464` and `134890490385` | `portfolio/projects/producer.ts` and `portfolio/scenarios/producer.ts` only. Already pushed at `8b481e98e2`. Do not re-edit. |
| `sf-ui-operations` | `134890490464` `sf/test-CI-UI-OPERATIONS` | Diagnosis only. Cause was the Effect 4 import, now owned above. |
| `sf-app-browser` | `134890490385` `sf/test-CI-APP-BROWSER` | `test/fixture/local-browser.ts` and the app-browser spec the log names |
| `sf-cli-red` | `134890490527` `sf/test-CI-CLI` | Only the CLI spec the log names |
| `sf-procurement-queue` | `134890490309` `sf/procurement-queue-integration` | The integration spec the log names. Not `runtime/procurement.ts` |
| `sf-ui-decisions` | `134890490492` `sf/test-CI-UI-DECISIONS` | Other decisions e2e files still using a wrapping-label locator. `planner-sources.ts` and `procurement-source.ts` are already fixed in `30b8a619e0`; this run does not contain that commit |

Shards 1 and 3–6 of run `44329483839` were cancelled, not green. Do not version `coverageBaseline` from this run.

# CI-SF-7 static-gates timeout

Run `44329483839`, job `134890490891` (`sf/test-CI-SF-7`), head `2e5839eebb`.
Test: `work-reuse package typecheck and repository guards use the canonical commands` in `modules/sucafina/Sucafinav1/test/product/work-split/work-reuse/static-gates.test.ts`.
Failed at 120014.72ms: `this test timed out after 120000ms.` No new test or CI was run for this note.

## Command that had not returned

`bun run check:guards --base origin/dev` (cwd: repo root).
`package.json` maps that to `bun run script/guards/run.ts --base origin/dev`.
The log prints that line only after `AppProcess.run` returns (`WORK_REUSE_GUARDS 1` at 15:18:43.824Z), 10.6s after bun already failed the test (15:18:33.226Z).

The test spawns three commands, in order, each with an inner 90s timeout, under one 120s bun timeout:

1. `bun typecheck` in `modules/sucafina` — returned exit 2 at 15:17:05.210Z (~32.0s). Output is `$ bun --cwd Sucafinav1 typecheck` / `$ tsgo --noEmit`.
2. `git fetch --no-tags origin +refs/heads/dev:refs/remotes/origin/dev` — returned exit 0 at 15:17:44.247Z (~39.0s). `origin/dev` was a new remote ref.
3. `bun run check:guards --base origin/dev` — started then, still running at the 120s mark (~49s in), returned exit 1 at ~59.6s.

## Why it does not exit inside the test

Not a hang in this run. The 90s `AppProcess` timeout had not fired. Bun fails the test at 120s while `Effect.runPromise` is still awaiting command 3, and does not cancel that child. `combineOutput` holds the guards report until process exit, so the test prints nothing from guards before the timeout.

Command 3 is slow because `script/guards/run.ts` synchronously diffs the whole checkout against the just-fetched `origin/dev` (`git diff --raw`, `--numstat`, and the patch, then `cat-file`). That diff is the SF branch versus `dev`, which is why the late report is a long GATE/WARN list and exit 1 (`agent-scratch` on `packages/app-shell/e2e/sucafina/native/fixture/scratch.ts` and `sf-ci-evidence/CI-SF-shard-7/run.log`).

Prior commands had already used ~71s of the 120s budget, so a ~60s guards run cannot return before the test deadline.

Do not raise the 120000ms timeout and do not skip the test. A timeout raise would still fail: typecheck already exited 2. No product patch is proven without a forbidden rerun.

# Capture prerequisite cause

Run `44329483839`, job `sf/test-CI-SF-8` (`134890490924`), head `2e5839eebb859969851b81aaa29f4f71b4c49d71`.
File: `modules/sucafina/Sucafinav1/test/product/mixed-source-contracts/capture-prerequisite.test.ts`.
Assertion at the direct `prepareDomainCommands` call. Expected `{ status: "needs-input", reason: "financial-approval-command-unavailable" }`. Received `{ status: "ok", value: [...] }`.

The received command is `Requests` / `save`, `confirmed: false`, `id: "PR-1"`, `version: 1`, `values.pr.estAmount: 150`, `commandDigest` `17ac3f790d6888087cf2adca1d53a63293251fb098a3e9829f7358ad834a0147`. The HTTP assertion was not reached. No test was rerun for this note.

## Cause

`prepareDomainCommands` (`product/procurement/decision-host.ts`) calls `createProcurementScenarioPreparation` and returns `ok` when that producer returns `ok`. Before returning, it calls `captureSource`. An `ok` result means the original archive write already succeeded.

`3623379830` (`fix(sucafina): compose reviewed C12 draft preparation`) removed the deliberate refusal. The old transaction always returned `needs-input` / `financial-approval-command-unavailable` after `procurementPreparationIssue`. The current function reviews the source, prepares `{ kind: "save-estimate", amount }`, and on a matching explicit draft returns the bound save command. `procurementPreparationIssue` now returns `explicit-draft-command-required` only when `confirmed !== false`; `confirmed: false` is allowed.

That commit is an ancestor of this branch. The producing code is unchanged at `707ce445dc`.

## Why this is not a local fix

The assigned test must keep the refusal. It also requires the archive, snapshots, case, and receipts to stay unchanged. Weakening it is out of scope.

The same producer is now asserted the other way:

- `test/product/procurement-approval-closure/scenario-composition.test.ts` expects `createProcurementScenarioPreparation` to return the draft save.
- `test/product/procurement-decision-producer/preparation.test.ts` expects the same `ok` draft, and expects a legacy command to fail as `explicit-draft-command-required`, not `financial-approval-command-unavailable`.
- `test/product/wp10/integration/scenario-operation-access.test.ts` expects `prepareDomainCommands` status `ok` for a replace of `estAmount` from 100 to 150.

Restoring the refusal makes the assigned test match the CI witness and fails those later assertions. Leaving the draft save keeps this shard red. No third path was proven. No product file was changed.

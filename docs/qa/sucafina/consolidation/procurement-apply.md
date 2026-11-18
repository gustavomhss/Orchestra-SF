# Procurement apply confirmed flag

No production edit. `runtime/procurement.ts` does not mention `confirmed` and was not edited. No test, Playwright, `test:ci`, or `gh workflow run`.

Evidence is run [44329483839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44329483839), job `sf/test-CI-SF-7` (`134890490891`), tested SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`. The files below are unchanged from that SHA through `origin/sf-red-clusters` `707ce445dc`, so the cause is not already fixed.

## What failed

`modules/sucafina/Sucafinav1/test/product/review-fixes/procurement-apply/real-apply.test.ts:12`, both `draft` and `pr_rejected`.

`toEqual` expected:

```
{ page: "Requests", action: "save", id: "PR-1", version, values: { pr: { estAmount: 150 } } }
```

Received the same object plus `"confirmed": false`. The assertion stays. It was introduced in `46cb4dd02f` against a command built without `confirmed`.

## Cause

`createProcurementScenarioPreparation` (`product/procurement/scenario-preparation.ts`) copies `plan.command` into `prepareProcurementMutation`. `approvalPlan` (`product/procurement/decision-preparation.ts`) builds that plan command with `confirmed: false`. That field is what the prepared change stores as `operation.command`.

Before `3623379830` the apply path built `{ page, action, id, version, values }` and did not copy the plan flag. That commit started passing `plan.command` through, and the same commit required `command.confirmed === false` for an estAmount draft in `procurementPreparationIssue` (`prepared.ts`) and `createProcurementPreparedReview` (`prepared-review.ts`).

Those checks are pinned. A command with no `confirmed` is `explicit-draft-command-required` (`financial-policy.test.ts`, `preparation.test.ts`). `confirmed: true` is the same refusal. Review of a restored command without the flag must not issue or project (`preparation.test.ts`). `toMatchObject({ confirmed: false })` on the C12 prepared command is the companion assertion in `preparation.test.ts` and `scenario-composition.test.ts`.

Omitting `confirmed` from the stored apply command makes line 12 pass and then fails this same test at review (`decision-review` expects 200; the review gate rejects a missing flag). Accepting a missing flag there, or in `procurementPreparationIssue`, admits the legacy command those assertions refuse. `resolveMutation` (`c12.ts`) rebuilds through `prepareProcurementMutation`, so Apply has the same gate. `runtime/procurement.ts` `execute` does not read or write `confirmed`.

## Not landed

Do not drop `confirmed: false` from `approvalPlan` while the apply path stores `plan.command`, and do not relax the explicit-draft checks. Either change falsifies an assertion this lane must not weaken. A stored command cannot both equal the object at line 12 and satisfy `command.confirmed === false` on the same object.

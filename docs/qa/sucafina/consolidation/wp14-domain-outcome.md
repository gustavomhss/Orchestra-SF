# WP14 domain outcome

Unproven. No production edit. No assertion change. No `bun test`, Playwright, `bun run test:ci`, or `gh workflow run`.

Evidence is run [44329483839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44329483839), job `sf/test-CI-SF-2` (`134890490763`), tested SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`. The failing file is unchanged from that SHA through `707ce445dc`.

## What failed

`modules/sucafina/Sucafinav1/test/product/wp14/domain-outcome.test.ts:65`

`registry.register` after `session.approved = true` expected `"ok"`, received `"unavailable"`.

Line 62 (register before approval) is not the failure. It expects `"unavailable"` and the log shows the runner reached line 65.

## Cause

`createDecisionCasePort.read` (`product/decisions/case-port.ts:107`) returns `{ status: "stale", reason: "case-changed" }` when `host.requestFor(context) !== source`. `source` is the Request captured at the start of that read. The check is the same request-identity fence used at `case-port.ts:72` and `:136`.

The fixture host mints a new Request on every call:

```ts
requestFor: () => new Request("https://example.test", { headers: { authorization: "finance" } })
```

After the first await inside `read`, the second `requestFor` is a different object, so every C08 read is stale. `createSfOutcomeSelectionRegistry.register` (`product/decision-memory/outcome-selection.ts:35`) maps that non-ok read to `{ status: "unavailable" }` and returns before the choice filter, evidence authorization, preference write, or source fence.

The unapproved register never reaches `cases.read`. `approveSelection` is false first, so line 62 stays `"unavailable"` for the right reason and does not show this.

The product check must stay. Later probes in this file already keep one `probeRequest` and compare it by identity. Other C08 fixtures that call `requestFor` more than once return one Request (`requestFor: () => request`). This host does not.

A constructor trace of the same fixture, outside `bun test`, observed `cases.read` as `{ status: "stale", reason: "case-changed" }` with the stock host. Replacing only `requestFor` with one Request made that read `"ok"`, the planner source fence match, and `register` return `"ok"` with a 64-hex `selectionRef`. The rest of the test was not executed, so that trace does not prove the file.

## Proposed patch, not landed

In `domain-outcome.test.ts`, keep one Request for the shared host. Do not change line 65. Do not remove the identity check in `case-port.ts`.

```ts
const request = new Request("https://example.test", { headers: { authorization: "finance" } })
const host: DomainPortHost = { persistence, authenticate: async (_request, context) => resolve("finance", [...context!.roleMap], (group) => session.active && group === "finance-group"), environment: async () => ({ at: "2028-01-01T00:00:00Z", id: randomUUID, directory: [] }), requestFor: () => request, revalidate: async () => session.active && await store.transaction("planner", async () => ({ commit: false, value: true })) }
```

The race hosts at the `probeRequest` sites already override `requestFor`. They must keep those separate Request objects.

## Not run

No `bun test`, Playwright, `bun run test:ci`, `gh workflow run`, or new CI.

# Dashboard C12 — published producer findings

## Reconciliation and limits

Read-only review on 2026-11-14. GitHub MCP `get_pr_info` returned PR #32 head `5866bcb2ed610f80138aaabc261acac4acf709cd`, branch `astra-compose`, base `sf2-stack@6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`. Every blob below was fetched at that exact head with GitHub MCP. PR prose still names product `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf`; this review uses the current head's files, not that prose or the interface branch's older host baseline.

No product test, browser, typecheck, remote mutation, or run was executed for this review. Findings are code-path deductions requiring a hosted counterproof. They concern Dashboard C12 consumers and producer dependencies; they are not a statement about native execution or the global release.

| Path | Published Git blob |
| --- | --- |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `0ac4c11d4eddb6e4a67c2c41efe40a7ff34fa47e` |
| `modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts` | `9a29a61dca38f723aca5c0bcd416c26a1cc636b1` |
| `apps/cli/src/sucafina-product/business-services.ts` | `34a491f859f7b57b0883a122f816803df43c74c8` |
| `modules/sucafina/Sucafinav1/product/decisions/case-port.ts` | `67203e058f6e08d9e32e0c51e0b1a01e5fadf322` |
| `modules/sucafina/Sucafinav1/product/decisions/apply.ts` | `fed7feb25d9af2fecebba8d2b1d2e2a6b1a3e0ac` |
| `apps/cli/src/sucafina-product/dashboard-decisions.ts` | `2b8aef91bb7f88db3ee467b32f76d4d3911e73c1` |
| `modules/sucafina/Sucafinav1/product/dashboard/sources.ts` | `c32c973c0b4111e4ac7df0c5d934e094277823f6` |
| `modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts` | `dc480a2e1e343e7f2a8844a3c23ec9f06582d5ad` |

## C12-F1: Dashboard receipt evidence is not routed after application

**Observed chain at the published head:**

1. `dashboard-decisions.ts:175–180` classifies the real domain receipt as `kind: "receipt"`, with `target.surface` inherited from the Dashboard receipt.
2. `decisions/apply.ts:83` reconciles the receipt into the case and adds that receipt evidence to `case.sourceRefs`.
3. `case-port.ts:79–80`, `132–143` includes all `sourceRefs` and requires every evidence resolution to be `fresh` or `historical` before returning an authorized case projection.
4. `host-binding/business-context.ts:178,189` routes receipt evidence and its continuity proof only when `target.surface === "procurement"`. The current published producer therefore does have receipt routing, but only for Procurement. Its receipt reader at `232–233` also delegates only to `procurementEvidence`.
5. `business-services.ts:390–394` composes that router. No Dashboard receipt reader is supplied.
6. `dashboard-decisions.ts:197–198` skips a case whose `cases.read` does not return `ok`.

**Deduction:** after successful application and case reconciliation, a subsequent case projection or workbench discovery cannot include that case under this composition: its new Dashboard receipt resolves to `unavailable`. The current interface's reload recovery discovers the change before offering the exact application retry, so this producer gap prevents that path. The durable domain receipt can still exist; the issue is reauthorization and discovery after commit.

**Required producer patch, owned by composition/domain:** add a Dashboard receipt evidence reader, dispatch it for `kind: "receipt" / surface: "dashboard"`, and wire it into the existing composition. It must authenticate current principal/namespace grants, prove the receipt identity and case/change association against C08 and the domain receipt, revalidate before returning, and preserve the original evidence reference/digest. Reuse the domain-owned receipt rather than constructing an optimistic projection from the case selector.

**Hosted proof required:** compose the published real evidence service; perform a reviewed Hot Topic application with real authentication/C08; then call case.read and Dashboard discovery, reload the UI, explicitly retry the exact original application, and assert the same receipt ID and exactly one domain mutation. Also revoke current read access and prove the receipt/private case is not exposed. Do not replace failed evidence with a test callback returning `fresh`.

## C12-F2: Original individual Dashboard record evidence cannot become historical

`source-access.ts:65–88` (`createSfDashboardRecordSourceAccess`) resolves the old record selector and requires its complete evidence digest to match the currently resolved reference. It only emits `fresh` or `unavailable`. `dashboard/sources.ts:78–103` additionally rejects changed scoped versions at line 95. `business-context.ts:262–268`'s Dashboard record continuity proof requires `digestSfValue(original) === digestSfValue(current)`.

A Hot Topic application's source references remain in the case's chosen scenario, prepared change, coverage and source evidence. The command changes that same record. Even if C12-F1 is fixed, the original record reference can then fail case.read's all-evidence accessibility check. This is a second producer gap, not a reason to omit old evidence or relax its checks.

**Required producer patch:** implement authorized historical individual-record resolution with explicit differences and continuity proven against the persisted physical source incarnation, protected original reference and current field/period scope. Replacement/deletion/recreation must not acquire historical authorization through a matching textual record ID. Preserve the distinction between historical evidence and fresh evidence usable for a new write.

**Hosted proof required:** after the real application, the original source is resolved as historical under current authority, its differences are explicit, the current source remains fresh, and both case.read and discovery remain usable. Replacing the source incarnation or revoking access must fail closed. The receipt test above must compose this real producer as well.

## C12-F3: Exact draft retry is denied after an unrelated case version advance

`hot-topic-draft.ts:72–86` reads the durable prior transaction but calls `allowed(current, request.caseRef)` before entering the prior-result branch. `allowed` requires equality with the requested case version. The prior-result branch also calls `readCurrent` with that old caseRef. Thus a committed draft with a lost response cannot recover by exact key/body after the case legitimately advances, even when current discovery still authorizes that draft and its unchanged case scope.

**Required producer patch:** probe the original idempotent transaction under current authenticated authority and return its original receipt only when the original command digest, target incarnation, current case membership/scope, current draft identity and currently authorized source binding remain valid. A prior receipt lookup must not rerun the draft mutation or rebind the original write to another case version. Keep exact-version rules on new mutations.

**Hosted proof required:** commit a draft and lose its HTTP response; advance the case via a real authorized operation that does not replace its scope; retry the original key/body; assert the original draft reference/version and a single draft write. A changed digest, different principal, replaced case incarnation or revoked source remains denied.

## UI handling already assigned separately

The interface owner is correcting first-response 403 handling because `dashboard-http.ts` can revalidate after dispatch, after a durable write. It is also correcting live dirty-draft revalidation so case readability alone does not preserve a source or private draft that disappeared from authorized discovery. Neither change can synthesize the producer evidence missing above.

For a new unsaved draft, the current published DTO exposes scoped source incarnation, not physical continuity. Equality of textual record ID or label must not stand in for producer authorization across an access revision change. A safe additive producer seam would reauthorize the original source selector under the current binding and return a verified continuity result; the UI would retain its original write payload until explicit review, without automatic rebind/replay.

## References

- PR: https://github.com/gustavomhss/Orchestra-SF/pull/32
- Pinned producer: https://github.com/gustavomhss/Orchestra-SF/tree/5866bcb2ed610f80138aaabc261acac4acf709cd
- Router: https://github.com/gustavomhss/Orchestra-SF/blob/5866bcb2ed610f80138aaabc261acac4acf709cd/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts
- Host composition: https://github.com/gustavomhss/Orchestra-SF/blob/5866bcb2ed610f80138aaabc261acac4acf709cd/apps/cli/src/sucafina-product/business-services.ts

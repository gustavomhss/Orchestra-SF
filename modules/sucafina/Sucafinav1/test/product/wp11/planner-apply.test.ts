import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { sfPlannerProjectionSelector, createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { preparePlannerMutation } from "../../../product/planner/prepared.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { projectPlannerSource } from "../../../product/planner/port.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { proposalReviewDigest, receiptProofTransactionKey, receiptReviewBinding, sameApplyRequest } from "../../../product/decisions/receipt-review-binding.ts"
import type { ReviewDigestFor } from "../../../product/decisions/receipt-review-binding.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase, PreparedChange } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("real Planner mutation and case receipt commit atomically across surfaces", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-apply-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2026-11-13T00:00:00Z") })
    await persistence.initializeSources("planner")
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v0", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [100] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: true }
    })
    const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const request = new Request("https://example.test", { headers: { authorization: "finance" } })
    const host: DomainPortHost = { persistence, authenticate: async (http, snapshot) => { const id = http.headers.get("authorization"); return id ? resolve(id, [...snapshot!.roleMap], (group) => id === "finance" && group === "finance-group") : null }, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: () => request, revalidate: async () => true }
    const planner = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "unused" }) })
    const issued = await planner.issueSource("v0", context)
    if (issued.status !== "ok") throw new Error(issued.reason)
    const snapshot = await persistence.transaction("planner", async (value) => ({ commit: false, value: structuredClone(value) }))
    const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
    const environment = { at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }
    const target = { surface: "planner" as const, type: "planner-version", id: "v0", incarnation: issued.value.evidence.target.incarnation, version: issued.value.evidence.target.version, fields: issued.value.evidence.target.fields, period: issued.value.evidence.target.period!, observedAt: environment.at }
    const scope = { principalRef: "finance", accessRevision: "1", policyVersion: "1", recordType: "planner-version", recordId: "v0", selector: sfPlannerProjectionSelector(snapshot, actor) }
    const produced = preparePlannerMutation({ snapshot, actor, environment, context, target, scope, evidence: issued.value.evidence, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 42 } }, operationId: "operation", idempotencyKey: "edit" })
    if (!produced) throw new Error("domain producer unavailable")
    const stale = preparePlannerMutation({ snapshot, actor, environment, context, target, scope, evidence: issued.value.evidence, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 43 } }, operationId: "stale-operation", idempotencyKey: "stale-edit" })
    if (!stale) throw new Error("stale producer unavailable")
    const change = { id: "change", caseId: "case", caseVersion: 1, choiceId: "choice", target, expectedVersion: 0, operation: { id: "operation", target, command: produced.command, idempotencyKey: "edit", commandDigest: produced.mutation.commandDigest, expectedVersion: 0, requiredAuthority: [], preview: {} }, preview: {}, requiredAuthority: [], idempotencyKey: "edit", state: "planned" } as unknown as PreparedChange
    const staleChange = { ...change, id: "stale-change", idempotencyKey: "stale-edit", operation: { ...change.operation, id: "stale-operation", idempotencyKey: "stale-edit", command: stale.command, commandDigest: stale.mutation.commandDigest } }
    const decision = { id: "case", incarnation: "case-inc", version: 1, state: "chosen", participants: ["finance"], choices: [{ id: "choice" }], preparedChanges: [change, staleChange] } as unknown as DecisionCase
    const state = createSfProductState({ persistence, createId: () => "state", resolveTarget: async (_request, _snapshot, namespace) => ({ incarnation: namespace === "cases" ? "case-inc" : target.incarnation }), authorize: async () => ({ principalRef: "finance", policyVersion: "1", accessRevision: "1" }) })
    await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "case-inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })
    const human = { granted: false, nextReceipt: 0 }
    const operation = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, changeId: "change", choiceId: "choice" }
    const forecast = (projection: Record<string, unknown> | undefined): number | null => {
      if (!projection) throw new Error("review projection unavailable")
      const line = rows(projection.lines).find((entry) => entry.id === produced.command.id)
      if (!line) throw new Error("review line unavailable")
      const value = Array.isArray(line.f) ? line.f[0] ?? null : null
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) throw new Error("review forecast invalid")
      return value
    }
    const before = forecast(projectPlannerSource(snapshot, actor, target.id))
    const reviewed = new Map([
      [change.id, [{ field: `${produced.command.id}:f0`, before, after: forecast(produced.preview) }]],
      [staleChange.id, [{ field: `${stale.command.id}:f0`, before, after: forecast(stale.preview) }]],
    ])
    const reviewDigestFor: ReviewDigestFor = (binding, incoming, selected) => {
      const expected = decision.preparedChanges.find((entry) => entry.id === selected.id)
      const fields = reviewed.get(selected.id)
      if (binding !== context || !expected || !fields || !sameApplyRequest(incoming, { ...operation, changeId: selected.id }) || digestSfValue(expected.operation) !== digestSfValue(selected.operation)) return undefined
      return proposalReviewDigest({ caseId: decision.id, caseIncarnation: decision.incarnation, changeCaseVersion: selected.caseVersion, choiceDigest: digestSfValue(decision.choices[0]), change: selected, fields, sourceRefDigest: issued.value.evidence.refDigest })
    }
    const reviewDigest = reviewDigestFor(context, operation, change)
    if (!reviewDigest) throw new Error("real review material unavailable")
    const apply = createSfPreparedApply({ state, host, authorizeCase: async () => true, authorizeLookup: async () => true, authorizeReceipt: async () => true, confirmHuman: async () => human.granted, reviewDigestFor, resolveActor: () => actor, resolveMutation: (_snapshot, selected) => selected.id === "stale-change" ? stale.mutation : produced.mutation, verifyGrant: () => human.granted, receiptVersion: () => 1, environment: () => environment, createId: () => `receipt-${++human.nextReceipt}`, now: () => environment.at })
    expect((await apply.executePrepared(operation, context)).status).toBe("denied")
    human.granted = true
    const result = await apply.executePrepared(operation, context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("first application unavailable")
    const proof = await state.read(request, "receipts", (value) => value.transactions[receiptProofTransactionKey(actor.id, target.id, change.idempotencyKey)])
    expect(proof).toMatchObject({ status: "ok", value: { commandDigest: receiptReviewBinding(change, reviewDigest), value: result.value } })
    human.granted = false
    expect(await apply.executePrepared(operation, context)).toEqual(result)
    human.granted = true
    const changed = await persistence.transaction("planner", async (value) => ({ commit: false, value: value.data.versions }))
    expect((changed as { lines: { f: (number | null)[] }[] }[])[0]!.lines[0]!.f[0]).toBe(42)
    const originalReview = reviewed.get(change.id)
    if (!originalReview) throw new Error("review unavailable")
    reviewed.set(change.id, [{ field: `${produced.command.id}:f0`, before, after: forecast(stale.preview) }])
    expect(reviewDigestFor(context, operation, change)).not.toBe(reviewDigest)
    expect(await apply.executePrepared(operation, context)).toMatchObject({ status: "conflict", reason: "idempotency-content-changed" })
    expect(await persistence.transaction("planner", async (value) => ({ commit: false, value: value.data.versions }))).toEqual(changed)
    expect(await state.read(request, "receipts", (value) => value.transactions[receiptProofTransactionKey(actor.id, target.id, change.idempotencyKey)])).toEqual(proof)
    reviewed.set(change.id, originalReview)
    const rejected = await apply.executePrepared({ ...operation, changeId: "stale-change" }, context)
    expect(rejected).toMatchObject({ status: "ok", value: { result: { ok: false, status: 409 } } })
    const afterRejected = await persistence.transaction("planner", async (value) => ({ commit: false, value: value.data.versions }))
    expect(afterRejected).toEqual(changed)
    const stored = await state.read(request, "receipts", (value) => Object.values(value.receipts))
    if (stored.status !== "ok") throw new Error("receipt unavailable")
    expect(stored.value).toHaveLength(2)
    if (result.status !== "ok") throw new Error("first application unavailable")
    const currentCase = await state.read(request, "cases", (value) => value.cases.case)
    if (currentCase.status !== "ok" || !currentCase.value) throw new Error("case unavailable")
    const receipt = result.value
    await state.transaction(request, { namespace: "cases", expectedStorageVersion: currentCase.storageVersion, targetRef: "case", targetIncarnation: "case-inc", idempotencyKey: "reconcile", commandDigest: "b".repeat(64) }, async (value) => { value.cases.case = { ...currentCase.value!, version: 2, preparedChanges: currentCase.value!.preparedChanges.map((item) => item.id === "change" ? { ...item, state: "applied" as const, receipt } : item) }; return { commit: true, value: true } })
    expect(await apply.executePrepared(operation, context)).toEqual(result)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

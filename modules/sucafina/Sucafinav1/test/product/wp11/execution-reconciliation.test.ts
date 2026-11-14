import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { sfPlannerProjectionSelector, createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { preparePlannerMutation } from "../../../product/planner/prepared.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CommandReceipt } from "../../../product/contracts/context.ts"
import type { PreparedApplyPort } from "../../../product/contracts/ports.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import type { DecisionCase, PreparedChange } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

for (const mode of ["normal", "lost-response", "revoked", "receipt-removed", "receipt-replaced", "receipt-collision", "receipt-removed-late", "receipt-replaced-late", "receipt-collision-late"] as const) test(`real prepared execution reconciles ${mode} without repeating Planner effects`, async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-apply-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const lifetime = { closed: false }
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2026-11-13T00:00:00Z") })
    await persistence.initializeSources("dashboard")
    await persistence.initializeSources("planner")
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v0", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [100] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: true }
    })
    const access = { revoked: false, executions: 0 }
    const receiptFault: { original?: CommandReceipt; calls: number; retry: boolean } = { calls: 0, retry: false }
    const hasReceiptFault = mode.startsWith("receipt-")
    const removeReceipt = mode.startsWith("receipt-removed")
    const collideReceipt = mode.startsWith("receipt-collision")
    const faultAfterCallbacks = mode.endsWith("-late") ? 2 : 1
    const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const request = new Request("https://example.test", { headers: { authorization: "finance" } })
    const host: DomainPortHost = { persistence, authenticate: async (http, snapshot) => { const id = http.headers.get("authorization"); return id ? resolve(id, [...snapshot!.roleMap], (group) => id === "finance" && group === "finance-group") : null }, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: () => request, revalidate: async () => !access.revoked }
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
    const decision = { id: "case", incarnation: "case-inc", version: 1, state: "chosen", participants: ["finance"], choices: [{ id: "choice" }], preparedChanges: [change, staleChange], receipts: [], sourceRefs: [] } as unknown as DecisionCase
    const makeState = (persistence: Parameters<typeof createSfProductState>[0]["persistence"]) => createSfProductState({ persistence, createId: () => "state", resolveTarget: async (_request, _snapshot, namespace) => ({ incarnation: namespace === "cases" ? "case-inc" : target.incarnation }), authorize: async () => access.revoked ? undefined : ({ principalRef: "finance", policyVersion: "1", accessRevision: "1" }) })
    const state = makeState(persistence)
    await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "case-inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })
    const makeProducer = (state: ReturnType<typeof createSfProductState>, host: DomainPortHost) => createSfPreparedApply({ state, host, authorizeCase: async () => !access.revoked, authorizeLookup: async () => !access.revoked, authorizeReceipt: async () => !access.revoked, confirmHuman: async () => !access.revoked, reviewDigestFor: () => "a".repeat(64), resolveActor: () => actor, resolveMutation: (_snapshot, selected) => selected.id === "stale-change" ? stale.mutation : produced.mutation, verifyGrant: () => !access.revoked, receiptVersion: () => 1, environment: () => environment, createId: () => `receipt-${access.executions}`, now: () => environment.at })
    const producer = makeProducer(state, host)
    const apply: PreparedApplyPort = { ...producer, executePrepared: async (operation, binding) => {
      access.executions += 1
      const result = await producer.executePrepared(operation, binding)
      if (result.status === "ok" && access.executions === 1 && (mode === "lost-response" || mode === "revoked")) {
        if (mode === "revoked") access.revoked = true
        throw new Error("transport lost the committed result")
      }
      return result
    } }
    const makeExecutor = (state: ReturnType<typeof createSfProductState>, host: DomainPortHost, apply: PreparedApplyPort) => createPreparedExecution({ state, host, apply, authorizeCase: async () => !access.revoked, authorizeApplication: async () => {
      // Inject both before and after the final canonical receipt lookup. A second
      // phase targets the last callback on an already reconciled receipt replay.
      if (access.executions === 1 && !receiptFault.original && hasReceiptFault && ++receiptFault.calls === (receiptFault.retry ? 2 : faultAfterCallbacks)) {
        const current = await state.read(request, "receipts", (value) => value.receipts["receipt-1"])
        if (current.status !== "ok" || !current.value) throw new Error("Committed receipt unavailable before fault")
        const receipt = structuredClone(current.value)
        receiptFault.original = receipt
        const changed = await state.transaction(request, { namespace: "receipts", expectedStorageVersion: current.storageVersion, targetRef: target.id, targetIncarnation: target.incarnation, idempotencyKey: `fault-${receiptFault.retry ? "reconciled-retry" : "before-reconciliation"}`, commandDigest: digestSfValue({ mode, receipt }) }, async (value) => {
          if (removeReceipt) delete value.receipts[receipt.id]
          else if (collideReceipt) value.receipts["receipt-collision"] = { ...receipt, id: "receipt-collision" }
          else value.receipts[receipt.id] = { ...receipt, at: "2026-11-14T00:00:00Z" }
          return { commit: true, value: true }
        })
        if (changed.status !== "ok") throw new Error("Authoritative receipt fault failed")
      }
      return !access.revoked
    }, confirmApplication: async () => !access.revoked, operationIdentity: () => "apply-command", reviewDigestFor: () => "a".repeat(64), revalidateProducer: async () => ({ status: "ok", value: { reviewDigest: "a".repeat(64) } }), classifyReceipt: async (receipt) => {
      if (access.revoked) return undefined
      const ref: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", kind: "receipt", refId: receipt.id, installationId: "i", projectId: "p", evidenceLevel: "observed", refDigest: "", target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: receipt.result.ok ? "applied" : "conflict", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } }
    } })
    const execute = makeExecutor(state, host, apply)
    const restoreReceipt = async (identity: string) => {
      const current = await state.read(request, "receipts", (value) => ({ receipt: value.receipts["receipt-1"], collision: value.receipts["receipt-collision"] }))
      const receipt = receiptFault.original
      if (current.status !== "ok" || !receipt) throw new Error("Original receipt unavailable for recovery")
      if (removeReceipt) expect(current.value.receipt).toBeUndefined()
      else if (collideReceipt) {
        expect(current.value.receipt).toEqual(receipt)
        expect(current.value.collision).toEqual({ ...receipt, id: "receipt-collision" })
      } else expect(current.value.receipt).toEqual({ ...receipt, at: "2026-11-14T00:00:00Z" })
      const restored = await state.transaction(request, { namespace: "receipts", expectedStorageVersion: current.storageVersion, targetRef: target.id, targetIncarnation: target.incarnation, idempotencyKey: identity, commandDigest: digestSfValue(receipt) }, async (value) => { delete value.receipts["receipt-collision"]; value.receipts[receipt.id] = structuredClone(receipt); return { commit: true, value: true } })
      expect(restored.status).toBe("ok")
      expect(access.executions).toBe(1)
    }
    const operation = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, changeId: "change", choiceId: "choice" }
    access.revoked = true
    expect(await execute(operation, context)).toMatchObject({ status: "denied" })
    expect(access.executions).toBe(0)
    access.revoked = false
    const first = await execute(operation, context)
    expect(first.status).toBe(mode === "normal" ? "ok" : "unavailable")
    expect(access.executions).toBe(1)
    const official = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.versions) }))
    expect((official as { lines: { f: number[] }[] }[])[0]!.lines[0]!.f[0]).toBe(42)
    if (hasReceiptFault) {
      expect(receiptFault.calls).toBe(faultAfterCallbacks)
      expect(first).toEqual({ status: "unavailable", reason: faultAfterCallbacks === 2 ? "case-reconciliation-pending" : collideReceipt ? "receipt-identity-conflict" : "authoritative-receipt-changed" })
      const untouched = await state.read(request, "cases", (value) => value.cases.case)
      if (untouched.status !== "ok") throw new Error("Case unavailable after receipt fault")
      expect(untouched.value).toEqual(decision)
      await restoreReceipt("recover-before-case-reconciliation")
    }
    if (mode === "revoked") {
      expect(await execute(operation, context)).toMatchObject({ status: "denied" })
      expect(access.executions).toBe(1)
      access.revoked = false
    }
    if (mode !== "normal") {
      const current = await state.read(request, "cases", (value) => value.cases.case)
      if (current.status !== "ok" || !current.value) throw new Error("case unavailable")
      expect(current.value.preparedChanges[0]!.receipt).toBeUndefined()
      await state.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: "case", targetIncarnation: "case-inc", idempotencyKey: "unrelated-edit", commandDigest: "e".repeat(64) }, async (value) => {
        value.cases.case = { ...value.cases.case!, version: 2, objective: "Keep this concurrent edit" }
        return { commit: true, value: true }
      })
    }
    const recovered = await execute(operation, context)
    expect(recovered).toMatchObject({ status: "ok", value: { id: "receipt-1", result: { ok: true } } })
    expect(access.executions).toBe(1)
    const persisted = await state.read(request, "cases", (value) => value.cases.case)
    if (persisted.status !== "ok" || !persisted.value) throw new Error("case unavailable")
    expect(persisted.value.preparedChanges[0]).toMatchObject({ state: "applied", receipt: { id: "receipt-1" } })
    expect(persisted.value.receipts).toHaveLength(1)
    expect(persisted.value.state).toBe("partially-applied")
    expect(await execute({ ...operation, changeId: "stale-change" }, context)).toMatchObject({ status: "stale" })
    expect(access.executions).toBe(1)
    if (mode !== "normal") expect(persisted.value.objective).toBe("Keep this concurrent edit")
    if (hasReceiptFault) {
      receiptFault.original = undefined
      receiptFault.calls = 0
      receiptFault.retry = true
      expect(await execute(operation, context)).toEqual({ status: "unavailable", reason: "receipt-authority-changed" })
      expect(receiptFault.calls).toBe(2)
      const unchanged = await state.read(request, "cases", (value) => value.cases.case)
      if (unchanged.status !== "ok") throw new Error("Reconciled case unavailable after retry fault")
      expect(unchanged.value).toEqual(persisted.value)
      await restoreReceipt("recover-reconciled-retry")
      expect(await execute(operation, context)).toEqual(recovered)
      expect(access.executions).toBe(1)
    }
    const pending = { ...operation, caseRef: { ...operation.caseRef, version: persisted.value.version }, changeId: "stale-change" }
    expect(await execute(pending, context)).toMatchObject({ status: "ok", value: { result: { ok: false, status: 409 } } })
    expect(access.executions).toBe(2)
    expect(await execute(operation, context)).toEqual(recovered)
    expect(access.executions).toBe(2)
    expect(await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.versions }))).toEqual(official)
    const partial = await state.read(request, "cases", (value) => value.cases.case)
    if (partial.status !== "ok" || !partial.value) throw new Error("case unavailable")
    expect(partial.value.state).toBe("partially-applied")
    expect(partial.value.receipts.map((receipt) => receipt.id)).toEqual(["receipt-1", "receipt-2"])
    expect(partial.value.preparedChanges.map((item) => item.state)).toEqual(["applied", "conflict"])
    await store.dispose()
    lifetime.closed = true
    const reopened = await openLocalStore(directory)
    try {
      const persistedSources = createSfSourcePersistence({ persistence: reopened, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => environment.at) })
      const reopenedState = makeState(persistedSources)
      const reopenedHost = { ...host, persistence: persistedSources }
      const reopenedProducer = makeProducer(reopenedState, reopenedHost)
      const reopenedExecution = makeExecutor(reopenedState, reopenedHost, { ...reopenedProducer, executePrepared: async (request, context) => { access.executions += 1; return reopenedProducer.executePrepared(request, context) } })
      expect(await reopenedExecution(operation, context)).toEqual(recovered)
      expect(access.executions).toBe(2)
      const preserved = await reopenedState.read(request, "cases", (value) => value.cases.case)
      expect(preserved.status === "ok" && preserved.value).toEqual(partial.value)
    } finally { await reopened.dispose() }
  } finally { if (!lifetime.closed) await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

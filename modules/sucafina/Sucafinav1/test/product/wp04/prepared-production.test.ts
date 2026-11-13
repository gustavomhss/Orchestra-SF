import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { Application } from "../../../runtime/application.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { object } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/procurement.ts"
import type { Actor } from "../../../runtime/contract.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import type { DecisionCase, PreparedChange } from "../../../product/contracts/decisions.ts"
import type { ProductContext, SourceRef } from "../../../product/contracts/context.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createProcurementC12Bridge } from "../../../product/procurement/c12.ts"
import { prepareProcurementMutation, procurementPreparedRevision, procurementPreparedScope, staleProcurementPreparedMutation } from "../../../product/procurement/prepared.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-13T00:00:00Z"
const appliedAt = "2026-11-13T01:00:00Z"
const caseId = "case-procurement-1"
const caseIncarnation = "case-incarnation-1"
const choiceId = "choice-procurement-1"
const changeId = "change-procurement-1"

test("prepared Procurement mutation uses current actor and SQLite revision, and retries by receipt", async () => {
  const fixture = await createFixture()
  try {
    const prepared = await fixture.prepare()
    expect(prepared.mutation.execute(prepared.snapshot, { id: "mallory", canWrite: true, roles: ["requester"], assigned: [], domains: [] }, { at, id: randomUUID, directory: [] })).toMatchObject({
      commit: false,
      value: { status: "denied", reason: "actor-changed" },
    })
    fixture.confirm = false
    expect((await fixture.apply.executePrepared(prepared.request, fixture.context)).status).toBe("denied")
    fixture.confirm = true
    fixture.role = "viewer"
    expect((await fixture.apply.executePrepared(prepared.request, fixture.context)).status).toBe("unavailable")
    fixture.role = "requester"

    const applied = await fixture.apply.executePrepared(prepared.request, fixture.context)
    expect(applied).toMatchObject({ status: "ok", value: { surface: "procurement", result: { ok: true } } })
    if (applied.status !== "ok") throw new Error("prepared Procurement command was not applied")

    const current = await fixture.persistence.transaction("procurement", async (snapshot) => ({
      commit: false,
      value: { snapshot: structuredClone(snapshot), request: structuredClone((snapshot.data.store as { requests: Record<string, { request: Record<string, unknown> }> }).requests["PR-1"]!.request) },
    }))
    expect(current.request).toMatchObject({ pr: { title: "Updated requisition", justification: "Approved scope" } })
    expect(current.request.history).toEqual([expect.objectContaining({ action: "Saved", at: appliedAt, by: "alice" })])
    expect(procurementPreparedRevision(current.snapshot, prepared.command)).toBe(1)

    const retry = await fixture.apply.executePrepared(prepared.request, fixture.context)
    expect(retry).toEqual(applied)
    const retryState = await fixture.persistence.transaction("procurement", async (snapshot) => ({
      commit: false,
      value: { snapshot: structuredClone(snapshot), request: structuredClone((snapshot.data.store as { requests: Record<string, { request: Record<string, unknown> }> }).requests["PR-1"]!.request) },
    }))
    expect(retryState.request.history).toHaveLength(1)
    expect(procurementPreparedRevision(retryState.snapshot, prepared.command)).toBe(1)

    expect(await fixture.apply.readReceipt({
      surface: "procurement",
      targetRef: prepared.target.id,
      targetIncarnation: prepared.target.incarnation,
      idempotencyKey: prepared.idempotencyKey,
      commandDigest: "f".repeat(64),
    }, fixture.context)).toMatchObject({ status: "conflict" })
  } finally {
    await fixture.dispose()
  }
})

test("prepared Procurement mutation records a stale source conflict without changing the domain", async () => {
  const fixture = await createFixture()
  try {
    const prepared = await fixture.prepare()
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      const result = domain.execute(snapshot, { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] }, {
        page: "Requests",
        action: "save",
        id: "PR-1",
        version: 0,
        values: { pr: { title: "Concurrent requisition edit" } },
      }, { at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }] })
      return { commit: result.ok, value: result }
    })

    const denied = await fixture.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: staleProcurementPreparedMutation(snapshot, { id: "mallory", canWrite: true, roles: ["requester"], assigned: [], domains: [] }, fixture.context, prepared.operation) }))
    expect(denied).toBeUndefined()
    const missing = await fixture.persistence.transaction("procurement", async (snapshot) => {
      delete (snapshot.data.store as { requests: Record<string, unknown> }).requests["PR-1"]
      return { commit: false, value: staleProcurementPreparedMutation(snapshot, { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] }, fixture.context, prepared.operation) }
    })
    expect(missing).toBeUndefined()
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      const result = domain.execute(snapshot, { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] }, {
        page: "Requests", action: "save", id: "PR-1", version: 1, values: { pr: { title: "Second concurrent edit" } },
      }, { at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }] })
      return { commit: result.ok, value: result }
    })

    const result = await fixture.apply.executePrepared(prepared.request, fixture.context)
    expect(result).toMatchObject({ status: "ok", value: { result: { ok: false, status: 409 } } })
    const current = await fixture.persistence.transaction("procurement", async (snapshot) => ({
      commit: false,
      value: { snapshot: structuredClone(snapshot), request: structuredClone((snapshot.data.store as { requests: Record<string, { request: Record<string, unknown> }> }).requests["PR-1"]!.request) },
    }))
    expect(current.request).toMatchObject({ pr: { title: "Second concurrent edit", justification: "Original scope" } })
    expect(current.request.history).toHaveLength(2)
    expect(procurementPreparedRevision(current.snapshot, prepared.command)).toBe(2)
  } finally {
    await fixture.dispose()
  }
})

async function createFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-prepared-procurement-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, projectScope: projectProcurementScope, enumerate: enumerateSfSources })
  await persistence.initializeSources("dashboard")
  await persistence.initializeSources("planner")
  await persistence.initializeSources("procurement")
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = {
      requests: { "PR-1": { request: { number: "PR-1", createdBy: "alice", status: "draft", pr: { title: "Original requisition", justification: "Original scope", estAmount: 100 }, history: [] }, version: 1, by: "alice" } },
      suppliers: [],
      settings: { currency: "USD", fxRates: [] },
      issued: { pr: ["PR-1"], po: [] },
    }
    snapshot.versions["requests:PR-1"] = { version: 0, by: "alice" }
    return { commit: true, value: undefined }
  })

  let currentRole: "requester" | "viewer" = "requester"
  let confirm = true
  const authenticate: Application["authenticate"] = async (request, context) => {
    if (request.headers.get("authorization") !== "Bearer alice") return null
    return { id: "alice", canWrite: true, roles: [{ surface: context?.surface ?? "procurement", role: currentRole === "viewer" ? "viewer" : "requester" }] }
  }
  const contextFor = async (binding: TrustedDomainContext) => ({ status: "ok" as const, value: {
    installationId: binding.binding.installationId,
    projectId: binding.binding.projectId,
    principalRef: binding.binding.principalRef,
    accessRevision: binding.binding.accessRevision,
    policyVersion: binding.binding.policyVersion,
    surface: "procurement" as const,
    period,
    currency: "USD",
    sourceRefs: [],
    capabilities: [],
  } satisfies ProductContext })
  const ui = createSfUiAuthority({
    authorize: async (request) => request.headers.get("authorization") === "Bearer alice"
      ? { installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1" }
      : undefined,
    commandIdentity: async () => randomUUID(),
    createId: randomUUID,
    now: Date.now,
  })
  const request = new Request("https://local.invalid/procurement", { headers: { authorization: "Bearer alice" } })
  const operationDigest = digestSfValue({ requestRef: "prepared" })
  const admission = await ui.admit(request, "sf_request_read", operationDigest)
  if (admission.status !== "ok") throw new Error("UI authority admission failed")
  if (!await ui.validate(admission.value, "sf_request_read", operationDigest)) throw new Error("UI authority validation failed")
  const context = admission.value
  const host = {
    persistence,
    authenticate,
    environment: async () => ({ at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }] }),
    requestFor: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.requestFor(binding) : undefined,
    revalidate: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false),
  }
  const sourceResolver = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
  const unavailable = async () => ({ status: "unavailable" as const, reason: "unused" })
  const procurementHost = { ...host, resolveRequestSource: sourceResolver.resolve, resolveSupplierSource: sourceResolver.resolve, isCurrentRequestSource: sourceResolver.isCurrent, isCurrentSupplierSource: sourceResolver.isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, readContractSource: unavailable }
  const bridge = createProcurementC12Bridge({ host: procurementHost, individual: sourceResolver, port: createProcurementPort(procurementHost) })
  const source = await sourceResolver.issue("procurement-request", "PR-1", context)
  if (source.status !== "ok") throw new Error("Procurement source evidence unavailable")
  const evidence = await sourceResolver.resolveForPreparation(source.value, context)
  if (evidence.status !== "ok") throw new Error("Procurement source scope unavailable")
  const actor: Actor = { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] }
  const sourceRef: SourceRef = {
    surface: "procurement",
    type: "procurement-request",
    id: "PR-1",
    incarnation: evidence.value.evidence.target.incarnation,
    version: evidence.value.evidence.target.version,
    fields: evidence.value.evidence.target.fields,
    period,
    observedAt: at,
  }
  const command = { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { title: "Updated requisition", justification: "Approved scope" } } }
  const snapshot = await persistence.transaction("procurement", async (value) => ({ commit: false, value: structuredClone(value) }))
  const prepared = prepareProcurementMutation({
    snapshot,
    actor,
    environment: await host.environment(request),
    context,
    target: sourceRef,
    scope: evidence.value.scope,
    evidence: evidence.value.evidence,
    command,
    operationId: "operation-1",
    idempotencyKey: "prepare-pr-1",
  })
  if (!prepared) throw new Error("Procurement command preparation failed")
  const recoveredScope = procurementPreparedScope(snapshot, sourceRef, context)
  if (!recoveredScope) throw new Error("Procurement scope could not be recovered")
  const reconstructed = prepareProcurementMutation({ snapshot, actor, environment: await host.environment(request), context, target: sourceRef, scope: recoveredScope, evidence: evidence.value.evidence, command, operationId: "operation-1", idempotencyKey: "prepare-pr-1" })
  expect(reconstructed?.mutation.commandDigest).toBe(prepared.mutation.commandDigest)

  const change = {
    id: changeId,
    caseId,
    caseVersion: 1,
    choiceId,
    target: prepared.target,
    expectedVersion: prepared.command.expectedVersion,
    operation: prepared.command,
    preview: {},
    requiredAuthority: prepared.command.requiredAuthority,
    idempotencyKey: prepared.command.idempotencyKey,
    state: "planned",
  } as unknown as PreparedChange
  const decision = {
    id: caseId,
    incarnation: caseIncarnation,
    version: 1,
    state: "chosen",
    objective: "Update a requisition",
    horizon: period,
    currency: "USD",
    criteria: [],
    participants: [actor.id],
    sourceRefs: [prepared.targetEvidence],
    alternatives: [],
    costCoverageBases: [],
    assumptions: [],
    questions: [],
    choices: [{ id: choiceId }],
    preparedChanges: [change],
    receipts: [],
    ledger: [],
  } as unknown as DecisionCase
  const productState = createSfProductState({
    persistence,
    createId: randomUUID,
    authorize: async (current, _snapshot, _namespace, mode) => {
      if (mode === "write" && currentRole !== "requester") return undefined
      const principal = await authenticate(current)
      return principal?.id === context.binding.principalRef ? { principalRef: principal.id, policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision } : undefined
    },
    resolveTarget: async (_current, _snapshot, namespace, targetRef) => namespace === "cases" && targetRef === caseId
      ? { incarnation: caseIncarnation }
      : namespace === "receipts" && targetRef === sourceRef.id ? { incarnation: sourceRef.incarnation } : undefined,
  })
  const caseSeed = await productState.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "a".repeat(64), targetRef: caseId, targetIncarnation: caseIncarnation }, async (state) => {
    state.cases[caseId] = decision
    return { commit: true, value: true }
  })
  if (caseSeed.status !== "ok") throw new Error("C08 case seed failed")
  const scopes = new Map([[sourceRef.id, { scope: evidence.value.scope, evidence: evidence.value.evidence, target: sourceRef }]])
  const apply = createSfPreparedApply({
    state: productState,
    host: { requestFor: host.requestFor, revalidate: host.revalidate },
    authorizeCase: async (value, binding) => value.participants.includes(binding.binding.principalRef) && await ui.revalidate(binding as TrustedUiContext),
    authorizeLookup: async (lookup, binding) => lookup.surface === "procurement" && lookup.targetRef === sourceRef.id && await ui.revalidate(binding as TrustedUiContext),
    authorizeReceipt: async (receipt, lookup, binding) => receipt.principalRef === binding.binding.principalRef && receipt.surface === lookup.surface && receipt.idempotencyKey === lookup.idempotencyKey && await ui.revalidate(binding as TrustedUiContext),
    confirmHuman: async (_incoming, _change, binding) => confirm && await ui.revalidate(binding as TrustedUiContext),
    resolveActor: (_domainSnapshot, binding) => binding.binding.principalRef === actor.id && currentRole === "requester" ? actor : undefined,
    resolveMutation: (domainSnapshot, selected, currentActor, binding) => {
      const held = scopes.get(selected.target.id)
      if (!held || binding.binding.principalRef !== currentActor.id) return undefined
      if (digestSfValue(selected.operation) !== digestSfValue(prepared.command)) return undefined
      return bridge.resolveMutation(domainSnapshot, selected, currentActor, binding)
    },
    verifyGrant: (domainSnapshot, _incoming, selected, currentActor, binding) => {
      const held = scopes.get(selected.target.id)
      return !!held && currentActor.id === binding.binding.principalRef && currentActor.canWrite && currentActor.roles.includes("requester") && digestSfValue(roleMap(domainSnapshot, "procurement")) === object(held.scope.selector).roleMapDigest
    },
    receiptVersion: (domainSnapshot, selected) => bridge.receiptVersion(domainSnapshot, selected),
    environment: () => ({ at: appliedAt, id: randomUUID, directory: [{ id: "alice", name: "Alice" }] }),
    createId: randomUUID,
    now: () => appliedAt,
  })
  return {
    apply,
    context,
    persistence,
    get confirm() { return confirm },
    set confirm(value: boolean) { confirm = value },
    get role() { return currentRole },
    set role(value: "requester" | "viewer") { currentRole = value },
    prepare: async () => ({
      target: sourceRef,
      command: prepared.command.command,
      operation: prepared.command,
      idempotencyKey: prepared.command.idempotencyKey,
      mutation: prepared.mutation,
      snapshot,
      request: { caseRef: { id: caseId, incarnation: caseIncarnation, version: 1 }, changeId, choiceId },
    }),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

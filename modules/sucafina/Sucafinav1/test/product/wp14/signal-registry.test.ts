import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createSfWorkRefIssuer, createSfWorkSignalList } from "../../../product/decision-memory/signal-work.ts"
import { createSfAuthorizedSignalList } from "../../../product/decision-memory/signal-list.ts"
import { createSfMaterialityAccess } from "../../../product/decision-memory/materiality.ts"
import { createSfSignalRegistry, SF_SIGNAL_REGISTRY_PREFIX } from "../../../product/decision-memory/signal-registry.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDecisionCasePort, encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const at = "2026-11-13T00:00:00Z"
const period = { start: "2026-11-13", end: "2026-11-13" }
const call: TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "alice", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease }

test("C08 signal binding and state are host-owned and reauthorized against current source", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-signal-registry-"))
  const store = await openLocalStore(directory, { lockTimeoutMs: 500 })
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.hotTopics = [{ id: "topic", status: "open" }]; return { commit: true, value: undefined } })
    const session = { active: true, approved: true }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => request.headers.get("authorization") === "alice" ? resolve("alice", [...context!.roleMap], (group) => session.active && group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test", { headers: { authorization: "alice" } }), revalidate: async () => session.active && await store.transaction("dashboard", async () => ({ commit: false, value: true })) }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const issued = await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["status"], period }, call)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const projection = await records.read(issued.value.refId, call)
    expect(projection.status).toBe("ok")
    if (projection.status !== "ok") return
    const source = projection.value.context.sourceRefs[0]!
    const signalRegistryWrites = new WeakSet<object>()
    const state = createSfProductState({ ...{ signalRegistryWrites }, persistence, createId: randomUUID, authorize: async (request, snapshot) => { const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }); return principal && session.active ? { principalRef: principal.id, accessRevision: "1", policyVersion: "1" } : undefined }, resolveTarget: async (request, snapshot, _namespace, ref) => { if (ref === "seed") return { incarnation: "seed" }; const parsed = parseCaseRef(ref); const value = parsed && (snapshot.data.__sfProductV1 as { cases?: Record<string, DecisionCase> } | undefined)?.cases?.[parsed.id]; return value && value.participants.includes(request.headers.get("authorization") ?? "") ? { incarnation: value.incarnation } : undefined } })
    const sourceAccess = createSfDashboardRecordSourceAccess({ host, records })
    const evidence: BusinessContextService = { resolve: sourceAccess, context: async ({ refs }, context) => Promise.all(refs.map((ref) => sourceAccess(ref, context))), recall: async () => [], emitFromLedger: async () => { throw new Error("not used") } }
    const cases = createDecisionCasePort({ ...{ verifyScenarioOperations: async (value: DecisionCase) => value.alternatives.every((item) => item.scenario.operations.length === 0) && value.choices.every((item) => item.scenario.operations.length === 0) && value.preparedChanges.length === 0 }, state, host, creationTarget: { ref: "seed", incarnation: "seed" }, operationIdentity: () => "fixture", authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), evidence, createId: randomUUID, now: () => at })
    const coverage = { basisId: "b", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [issued.value], coverageState: "complete", entries: [], derivedMissingCategoryIds: [] } as const
    const result = { id: "result", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [issued.value], unresolvedConditions: [], restrictions: [], comparisonStatus: "complete", costCoverage: coverage, knownSubtotal: 100, total: 100 } as const
    const comparison = { comparisonStatus: "complete", knownDifference: 1, completeDifference: 1, baselineResultRef: "base", alternativeResultRef: "result", costCoverageRefs: [], criterionResults: [{ criterionId: "cost", state: "satisfied", reason: "within bound" }], unresolvedConditions: [] } as const
    const choice = { id: "choice", alternativeId: "a", alternativeVersion: 1, basisVersion: 1, criteria: ["cost"], values: [], evidenceRefs: [issued.value], principalRef: "alice", reason: "review", at, scenario: { baseRef: "base", operations: [], assumptions: [] }, result, comparison, comparisonStatus: "complete", costCoverage: coverage } as const
    const decision: DecisionCase = { id: "case", incarnation: "inc", version: 1, state: "chosen", objective: "Review", horizon: period, currency: "USD", criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["alice"], sourceRefs: [issued.value], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await state.transaction(host.requestFor(call)!, { namespace: "cases", expectedStorageVersion: 0, targetRef: "seed", targetIncarnation: "seed", idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })
    expect(seed.status).toBe("ok")
    const registry = createSfSignalRegistry({ state, host, cases, signalRegistryWrites, createId: randomUUID, operationIdentity: () => "human-selection", approveSelection: async () => session.approved, authorizeSelection: async (value, context) => { const current = await records.resolve(value.evidence.refId, context); return current.status === "ok" && digestSfValue(current.value) === digestSfValue(value.evidence) }, approveReconcile: async () => session.active, checkSourceFence: async (snapshot, value) => { const scoped = Object.values(snapshot.sfSources?.scopes ?? {}).find((item) => item.incarnation === value.source.incarnation); const physical = snapshot.sfSources?.records[JSON.stringify([value.source.type, value.source.id])]; return !!scoped && !!physical?.alive && scoped.alive && scoped.version === value.source.version && scoped.sourceIncarnation === physical.incarnation && scoped.inputDigest === value.evidence.target.projectionDigest } })
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const selection = { caseRef, choiceId: "choice", scenarioRefs: ["base", "result"] as const, source, evidence: issued.value, fields: ["status"], period, criterionId: "cost", recipientRef: "alice", destination: "case-work", label: "Review cost" }
    session.approved = false
    expect((await registry.register(selection, call)).status).toBe("unavailable")
    session.approved = true
    expect((await registry.register({ ...selection, recipientRef: "other" }, call)).status).toBe("unavailable")
    expect((await registry.register(selection, call)).status).toBe("ok")
    const listed = await registry.list(caseRef, call)
    expect(listed.status).toBe("ok")
    if (listed.status !== "ok" || !listed.records[0]) return
    const record = listed.records[0]
    const preferences = await state.read(host.requestFor(call)!, "preferences", () => null)
    expect(preferences.status).toBe("ok")
    if (preferences.status !== "ok") return
    const forged = await state.transaction(host.requestFor(call)!, { namespace: "preferences", expectedStorageVersion: preferences.storageVersion, targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation, idempotencyKey: "unauthorized-binding", commandDigest: digestSfValue("forged") }, async (value) => { value.preferences[`${SF_SIGNAL_REGISTRY_PREFIX}${record.id}`] = { ...record, selection: { ...record.selection, recipientRef: "other" } }; return { commit: true, value: true } })
    expect(forged.status).toBe("denied")
    const next = { conditionId: record.id, correlationKey: "change", seenKeys: ["change"], status: "open" as const }
    expect((await registry.reconcile(record, next, call)).status).toBe("ok")
    const again = await registry.list(caseRef, call)
    expect(again.status).toBe("ok")
    if (again.status === "ok") expect(again.records[0]?.signalState).toEqual(next)
    // The comparison is a fixture; C08, the case, source reads and the list producer are real.
    const materiality = createSfMaterialityAccess({ load: async (id, context) => {
      const bindings = await registry.list(caseRef, context)
      const found = bindings.status === "ok" ? bindings.records.find((item) => item.id === id) : undefined
      if (!found) return undefined
      return { condition: { id, source: found.selection.source, fields: found.selection.fields, period: found.selection.period, criterionId: found.selection.criterionId, choice }, change: { source, fields: ["status"], period, before: [issued.value], after: [issued.value], availability: "available" as const, comparison: { before: comparison, after: { ...comparison, criterionResults: [{ criterionId: "cost", state: "failed" as const, reason: "changed" }] }, resultBefore: result, resultAfter: result } } }
    }, authorizeEvidence: async (refs, context) => (await Promise.all(refs.map((ref) => sourceAccess(ref, context)))).every((item) => item.state === "fresh"), revalidate: host.revalidate })
    const listSignals = createSfAuthorizedSignalList({ host, cases, registry, materiality })
    const output = await listSignals(caseRef, call)
    expect(output.status).toBe("ok")
    if (output.status === "ok") { expect(output.signals).toHaveLength(1); expect(Object.keys(output.signals[0]!).sort()).toEqual(["action", "impact", "label"]) }
    const repeated = await listSignals(caseRef, call)
    if (repeated.status === "ok") expect(repeated.signals[0]?.action).toBe("none")
    // C16 selection is a fixture; source and C08 state remain real.
    const issueWorkRef = createSfWorkRefIssuer({ key: new Uint8Array(32).fill(7), revalidate: host.revalidate })
    expect(await issueWorkRef(record, { ...call, binding: { ...call.binding, principalRef: "other" } })).toBeUndefined()
    const work = createSfWorkSignalList({ host, cases, registry, materiality, issueWorkRef, resolveSelection: async (ref) => ref === "selected-work" ? { status: "ok", caseRef } : { status: "unavailable" }, authorizeBinding: async (item, _projection, refs, context) => item.selection.recipientRef === context.binding.principalRef && (await Promise.all(refs.map((ref) => sourceAccess(ref, context)))).every((value) => value.state === "fresh") })
    const workResult = await work("selected-work", period, call)
    expect(workResult.status).toBe("ok")
    if (workResult.status === "ok") { expect(workResult.signals).toHaveLength(1); expect(workResult.signals[0]?.destination).toBe("case-work"); expect(JSON.stringify(workResult)).not.toContain(record.id) }
    expect((await work("unselected-work", period, call)).status).toBe("unavailable")
    const outside = await work("selected-work", { start: "2027-01-01", end: "2027-01-31" }, call)
    expect(outside).toEqual({ status: "ok", signals: [] })
    const caseState = await state.read(host.requestFor(call)!, "cases", () => null)
    expect(caseState.status).toBe("ok")
    if (caseState.status !== "ok") return
    const advanced = await state.transaction(host.requestFor(call)!, { namespace: "cases", expectedStorageVersion: caseState.storageVersion, targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation, idempotencyKey: "advance", commandDigest: digestSfValue("advance") }, async (product) => { product.cases.case = { ...product.cases.case!, version: 2 }; return { commit: true, value: true } })
    expect(advanced.status).toBe("ok")
    const afterAdvance = await registry.list({ ...caseRef, version: 2 }, call)
    expect(afterAdvance.status).toBe("ok")
    if (afterAdvance.status === "ok") {
      expect(afterAdvance.records).toHaveLength(1)
      const old = afterAdvance.records[0]!
      expect((await registry.revise(old, { ...selection, caseRef: { ...caseRef, version: 2 }, scenarioRefs: ["new-base", "new-result"] }, call)).status).toBe("ok")
      const revised = await registry.list({ ...caseRef, version: 2 }, call)
      expect(revised.status).toBe("ok")
      if (revised.status === "ok") { expect(revised.records[0]?.id).toBe(old.id); expect(revised.records[0]?.signalState).toEqual(old.signalState); expect(revised.records[0]?.selection.scenarioRefs).toEqual(["new-base", "new-result"]) }
    }
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { status: string }[])[0]!.status = "closed"; return { commit: true, value: undefined } })
    expect((await registry.list({ ...caseRef, version: 2 }, call)).status).toBe("unavailable")
    session.active = false
    expect((await registry.reconcile(record, next, call)).status).toBe("unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

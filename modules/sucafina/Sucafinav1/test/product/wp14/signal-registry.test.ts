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
import type { SfSignalSelection } from "../../../product/decision-memory/signal-registry.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDecisionCasePort, encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedCallLease, TrustedDomainContext, TrustedExecutionBinding, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

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
    const emptyDecision: DecisionCase = { ...decision, id: "empty-case", incarnation: "empty-inc" }
    const seed = await state.transaction(host.requestFor(call)!, { namespace: "cases", expectedStorageVersion: 0, targetRef: "seed", targetIncarnation: "seed", idempotencyKey: "seed", commandDigest: digestSfValue([decision, emptyDecision]) }, async (value) => { value.cases.case = decision; value.cases[emptyDecision.id] = emptyDecision; return { commit: true, value: true } })
    expect(seed.status).toBe("ok")
    const registryInput: Parameters<typeof createSfSignalRegistry>[0] = { state, host, cases, signalRegistryWrites, createId: randomUUID, operationIdentity: () => "human-selection", approveSelection: async () => session.approved, authorizeSelection: async (value, context) => { const current = await records.resolve(value.evidence.refId, context); return current.status === "ok" && digestSfValue(current.value) === digestSfValue(value.evidence) }, approveReconcile: async () => session.active, checkSourceFence: async (snapshot, value) => { const scoped = Object.values(snapshot.sfSources?.scopes ?? {}).find((item) => item.incarnation === value.source.incarnation); const physical = snapshot.sfSources?.records[JSON.stringify([value.source.type, value.source.id])]; return !!scoped && !!physical?.alive && scoped.alive && scoped.version === value.source.version && scoped.sourceIncarnation === physical.incarnation && scoped.inputDigest === value.evidence.target.projectionDigest } }
    const registry = createSfSignalRegistry(registryInput)
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const selection = { caseRef, choiceId: "choice", scenarioRefs: ["base", "result"] as const, source, evidence: issued.value, fields: ["status"], period, criterionId: "cost", recipientRef: "alice", destination: "case-work", label: "Review cost" }
    session.approved = false
    expect((await registry.register(selection, call)).status).toBe("unavailable")
    session.approved = true
    expect((await registry.register({ ...selection, recipientRef: "other" }, call)).status).toBe("unavailable")
    // Approval and source-fence callbacks may not rewrite the selection being committed.
    const mutatingApproval = createSfSignalRegistry({ ...registryInput, approveSelection: async (value) => { value.label = "Unapproved label"; return true } })
    expect((await mutatingApproval.register(selection, call)).status).toBe("unavailable")
    const fenceCalls = { count: 0 }
    const mutatingFence = createSfSignalRegistry({ ...registryInput, checkSourceFence: async (snapshot, value, authority) => {
      const authorized = await registryInput.checkSourceFence(snapshot, value, authority)
      fenceCalls.count += 1
      value.destination = "unapproved-destination"
      return authorized
    } })
    expect((await mutatingFence.register(selection, call)).status).toBe("unavailable")
    expect(fenceCalls.count).toBe(1)
    const rejected = await state.read(host.requestFor(call)!, "preferences", (value) => Object.keys(value.preferences).filter((key) => key.startsWith(SF_SIGNAL_REGISTRY_PREFIX)))
    expect(rejected.status).toBe("ok")
    if (rejected.status === "ok") expect(rejected.value).toEqual([])
    expect((await registry.register(selection, call)).status).toBe("ok")
    const listed = await registry.list(caseRef, call)
    expect(listed.status).toBe("ok")
    if (listed.status !== "ok" || !listed.records[0]) return
    const record = listed.records[0]
    expect((await mutatingApproval.revise(record, selection, call)).status).toBe("unavailable")
    // The wrapper counts only registry revalidations; C08 and Dashboard use the real host.
    for (const mutation of ["authority", "request", "approval"] as const) {
      const probeCall = structuredClone(call)
      const wanted = structuredClone(caseRef)
      const retained: { selection?: SfSignalSelection } = {}
      const race = finalRevalidation(host, 3, () => {
        if (mutation === "authority") Object.assign(probeCall.binding, { accessRevision: "changed" })
        if (mutation === "request") wanted.version += 1
        if (mutation === "approval" && retained.selection) retained.selection.label = "Changed at egress"
      })
      const probe = createSfSignalRegistry({ ...registryInput, host: race.host, authorizeSelection: async (value, context) => {
        retained.selection = value
        return registryInput.authorizeSelection(value, context)
      } })
      expect((await probe.list(wanted, probeCall)).status).toBe("unavailable")
      expect(race.progress.checks).toBe(3)
    }
    // B is a divergent alias from a delegated real C08 read; restoring that
    // alias during the final authority await must not erase the observed change.
    const restoration: { reads: number; checks: number; restored: boolean; original?: AuthorizedCaseProjection["case"]; latest?: AuthorizedCaseProjection } = { reads: 0, checks: 0, restored: false }
    const restoringList = createSfSignalRegistry({ ...registryInput,
      cases: { ...cases, read: async (request, context) => {
        const value = await cases.read(request, context)
        if (value.status !== "ok") return value
        restoration.reads += 1
        const detached = structuredClone(value.value)
        if (restoration.reads === 1) restoration.original = structuredClone(detached.case)
        if (restoration.reads === 2) {
          expect(detached.case.choices.some((item) => item.id === selection.choiceId)).toBe(true)
          detached.case.choices = []
          restoration.latest = detached
          expect(digestSfValue(detached.case)).not.toBe(digestSfValue(restoration.original))
        }
        return { status: "ok", value: detached }
      } },
      host: { ...host, revalidate: async (context) => {
        const authorized = await host.revalidate(context)
        restoration.checks += 1
        if (restoration.checks === 3) {
          expect(restoration.reads).toBe(2)
          if (!restoration.latest || !restoration.original) throw new Error("Final signal registry read was not reached")
          expect(restoration.latest.case.choices).toEqual([])
          Object.assign(restoration.latest.case, structuredClone(restoration.original))
          restoration.restored = true
          expect(digestSfValue(restoration.latest.case)).toBe(digestSfValue(restoration.original))
        }
        return authorized
      } },
    })
    expect(await restoringList.list(caseRef, structuredClone(call))).toEqual({ status: "unavailable" })
    expect({ reads: restoration.reads, checks: restoration.checks, restored: restoration.restored }).toEqual({ reads: 2, checks: 3, restored: true })
    const durableAfterRestoration = await state.read(host.requestFor(call)!, "cases", (value) => value.cases[caseRef.id]?.choices)
    expect(durableAfterRestoration.status).toBe("ok")
    if (durableAfterRestoration.status === "ok") expect(durableAfterRestoration.value).toEqual(restoration.original?.choices)
    expect(await registry.list(caseRef, call)).toEqual({ status: "ok", records: [record] })
    const registerCall = structuredClone(call)
    const registerRace = finalRevalidation(host, 3, () => Object.assign(registerCall.binding, { accessRevision: "changed" }))
    // A retry preserves the existing durable record even when its result loses authority.
    expect((await createSfSignalRegistry({ ...registryInput, host: registerRace.host }).register(selection, registerCall)).status).toBe("unavailable")
    expect(registerRace.progress.checks).toBe(3)
    const afterRaces = await registry.list(caseRef, call)
    expect(afterRaces.status).toBe("ok")
    if (afterRaces.status === "ok") expect(afterRaces.records).toEqual([record])
    const preferences = await state.read(host.requestFor(call)!, "preferences", () => null)
    expect(preferences.status).toBe("ok")
    if (preferences.status !== "ok") return
    const forged = await state.transaction(host.requestFor(call)!, { namespace: "preferences", expectedStorageVersion: preferences.storageVersion, targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation, idempotencyKey: "unauthorized-binding", commandDigest: digestSfValue("forged") }, async (value) => { value.preferences[`${SF_SIGNAL_REGISTRY_PREFIX}${record.id}`] = { ...record, selection: { ...record.selection, recipientRef: "other" } }; return { commit: true, value: true } })
    expect(forged.status).toBe("denied")
    const next = { conditionId: record.id, correlationKey: "change", seenKeys: ["change"], status: "open" as const }
    const mutatingReconcile = createSfSignalRegistry({ ...registryInput, approveReconcile: async (_record, candidate) => { candidate.status = "resolved"; return true } })
    expect((await mutatingReconcile.reconcile(record, next, call)).status).toBe("unavailable")
    expect((await registry.reconcile(record, next, call)).status).toBe("ok")
    const again = await registry.list(caseRef, call)
    expect(again.status).toBe("ok")
    if (again.status === "ok") {
      expect(again.records[0]?.signalState).toEqual(next)
      const current = again.records[0]!
      const probeCall = structuredClone(call)
      const race = finalRevalidation(host, 2, () => Object.assign(probeCall.binding, { accessRevision: "changed" }))
      expect((await createSfSignalRegistry({ ...registryInput, host: race.host }).reconcile(current, next, probeCall)).status).toBe("unavailable")
      expect(race.progress.checks).toBe(2)
    }
    // The comparison is a fixture; C08, the case, source reads and the list producer are real.
    // Each reread advances observedAt, which must not become a different material event.
    const clock: { reads: number; rewindAfter?: number } = { reads: 0 }
    const materiality = createSfMaterialityAccess({ load: async (id, context) => {
      clock.reads += 1
      const bindings = await registry.list(caseRef, context)
      const found = bindings.status === "ok" ? bindings.records.find((item) => item.id === id) : undefined
      if (!found) return undefined
      return { condition: { id, source: found.selection.source, fields: found.selection.fields, period: found.selection.period, criterionId: found.selection.criterionId, choice }, change: { source: { ...source, observedAt: new Date(Date.parse(at) + clock.reads * 1000 - (clock.rewindAfter !== undefined && clock.reads > clock.rewindAfter ? 60_000 : 0)).toISOString() }, fields: ["status"], period, before: [issued.value], after: [issued.value], availability: "available" as const, comparison: { before: comparison, after: { ...comparison, criterionResults: [{ criterionId: "cost", state: "failed" as const, reason: "changed" }] }, resultBefore: result, resultAfter: result } } }
    }, authorizeEvidence: async (refs, context) => (await Promise.all(refs.map((ref) => sourceAccess(ref, context)))).every((item) => item.state === "fresh"), revalidate: host.revalidate })
    const listSignals = createSfAuthorizedSignalList({ host, cases, registry, materiality })
    const output = await listSignals(caseRef, call)
    expect(output.status).toBe("ok")
    if (output.status === "ok") { expect(output.signals).toHaveLength(1); expect(Object.keys(output.signals[0]!).sort()).toEqual(["action", "impact", "label"]) }
    const repeated = await listSignals(caseRef, call)
    expect(repeated.status).toBe("ok")
    if (repeated.status === "ok") expect(repeated.signals[0]?.action).toBe("none")
    // C16 selection is a fixture; source and C08 state remain real.
    const issueWorkRef = createSfWorkRefIssuer({ key: new Uint8Array(32).fill(7), revalidate: host.revalidate })
    expect(await issueWorkRef(record, { ...call, binding: { ...call.binding, principalRef: "other" } })).toBeUndefined()
    const workInput: Parameters<typeof createSfWorkSignalList>[0] = { host, cases, registry, materiality, issueWorkRef, resolveSelection: async (ref) => ref === "selected-work" ? { status: "ok", caseRef } : { status: "unavailable" }, authorizeBinding: async (item, _projection, refs, context) => item.selection.recipientRef === context.binding.principalRef && (await Promise.all(refs.map((ref) => sourceAccess(ref, context)))).every((value) => value.state === "fresh") }
    const work = createSfWorkSignalList(workInput)
    const workResult = await work("selected-work", period, call)
    expect(workResult.status).toBe("ok")
    expect(clock.reads).toBeGreaterThanOrEqual(12)
    if (workResult.status === "ok") { expect(workResult.signals).toHaveLength(1); expect(workResult.signals[0]?.destination).toBe("case-work"); expect(JSON.stringify(workResult)).not.toContain(record.id) }
    // Final consumer callbacks must not release results under a changed binding or request.
    const listCall = structuredClone(call)
    const listRace = finalRevalidation(host, 5, () => Object.assign(listCall.binding, { accessRevision: "changed" }))
    expect((await createSfAuthorizedSignalList({ host: listRace.host, cases, registry, materiality })(caseRef, listCall)).status).toBe("unavailable")
    expect(listRace.progress.checks).toBe(5)
    const materialityCall = structuredClone(call)
    const materialityReads = { count: 0 }
    const finalMateriality = createSfAuthorizedSignalList({ host, cases, registry, materiality: async (id, context) => {
      const value = await materiality(id, context)
      materialityReads.count += 1
      if (materialityReads.count === 2) Object.assign(context.binding, { accessRevision: "changed" })
      return value
    } })
    expect((await finalMateriality(caseRef, materialityCall)).status).toBe("unavailable")
    expect(materialityReads.count).toBe(2)
    for (const mutation of ["cancel", "period"] as const) {
      const controller = new AbortController()
      const wantedPeriod = structuredClone(period)
      const requestHost = { ...host, requestFor: () => new Request("https://example.test", { headers: { authorization: "alice" }, signal: controller.signal }) }
      const race = finalRevalidation(requestHost, 5, () => {
        if (mutation === "cancel") controller.abort()
        if (mutation === "period") wantedPeriod.end = "2026-11-14"
      })
      expect((await createSfWorkSignalList({ ...workInput, host: race.host })("selected-work", wantedPeriod, structuredClone(call))).status).toBe("unavailable")
      expect(race.progress.checks).toBe(5)
    }
    const authorizationCalls = { count: 0 }
    const finalAuthorization = createSfWorkSignalList({ ...workInput, authorizeBinding: async (item, projection, refs, context) => {
      const authorized = await workInput.authorizeBinding(item, projection, refs, context)
      authorizationCalls.count += 1
      if (authorizationCalls.count === 2) item.selection.destination = "Changed after authorization"
      return authorized
    } })
    expect((await finalAuthorization("selected-work", period, call)).status).toBe("unavailable")
    expect(authorizationCalls.count).toBe(2)
    const issueCalls = { count: 0 }
    const finalIssue = createSfWorkSignalList({ ...workInput, issueWorkRef: async (item, context) => {
      const reference = await issueWorkRef(item, context)
      issueCalls.count += 1
      if (issueCalls.count === 2) Object.assign(context.binding, { accessRevision: "changed" })
      return reference
    } })
    expect((await finalIssue("selected-work", period, structuredClone(call))).status).toBe("unavailable")
    expect(issueCalls.count).toBe(2)
    const issuerCall = structuredClone(call)
    const issuerRace = finalRevalidation(host, 2, () => Object.assign(issuerCall.binding, { principalRef: "other" }))
    expect(await createSfWorkRefIssuer({ key: new Uint8Array(32).fill(7), revalidate: issuerRace.host.revalidate })(record, issuerCall)).toBeUndefined()
    expect(issuerRace.progress.checks).toBe(2)
    expect((await work("selected-work", period, call)).status).toBe("ok")
    clock.rewindAfter = clock.reads + 2
    expect((await listSignals(caseRef, call)).status).toBe("unavailable")
    clock.rewindAfter = undefined
    clock.rewindAfter = clock.reads + 2
    expect((await work("selected-work", period, call)).status).toBe("unavailable")
    clock.rewindAfter = undefined
    expect((await work("unselected-work", period, call)).status).toBe("unavailable")
    const outside = await work("selected-work", { start: "2027-01-01", end: "2027-01-31" }, call)
    expect(outside).toEqual({ status: "ok", signals: [] })
    // These race injections still delegate each authority check to the SQLite
    // host and use the real case, source, C08 registry and materiality ports.
    // The native call shape isolates binding fences; it is not a session bootstrap proof.
    const nativeCall = (selected: typeof caseRef): TrustedDomainContext => ({ kind: "native", binding: {
      installationId: "i", projectId: "p", principalRef: "alice", hostId: "host", locationId: "location",
      nativeSessionId: "session", runId: "run", caseId: selected.id, caseIncarnation: selected.incarnation, caseVersion: selected.version,
      profileId: "sf_finance", profileVersion: "1", manifestDigest: "manifest", skillReceipts: [], providerGeneration: 1,
      accessRevision: "1", policyVersion: "1", expiresAt: "2099-01-01T00:00:00Z", entryMode: "interactive",
    } as TrustedExecutionBinding, lease: {} as TrustedCallLease })
    const invokeList = async (consumer: "case" | "work", selected: typeof caseRef, context: TrustedDomainContext, authority: Pick<DomainPortHost, "requestFor" | "revalidate">) => {
      if (consumer === "case") return createSfAuthorizedSignalList({ host: authority, cases, registry, materiality })(selected, context)
      return createSfWorkSignalList({ host: authority, cases, registry, materiality, issueWorkRef,
        resolveSelection: async (ref) => ref === "selected-work" ? { status: "ok", caseRef: selected } : { status: "unavailable" },
        authorizeBinding: async (item, _projection, refs, current) => item.selection.recipientRef === current.binding.principalRef && (await Promise.all(refs.map((ref) => sourceAccess(ref, current)))).every((value) => value.state === "fresh"),
      })("selected-work", period, context)
    }
    for (const consumer of ["case", "work"] as const) {
      for (const selected of [caseRef, { id: emptyDecision.id, incarnation: emptyDecision.incarnation, version: emptyDecision.version }]) {
        const expectedSignals = selected.id === caseRef.id ? 1 : 0
        const finalCheck = expectedSignals ? 5 : 4
        let controls = 0
        const control = await invokeList(consumer, selected, nativeCall(selected), { ...host, revalidate: async (context) => { controls += 1; return host.revalidate(context) } })
        expect(control.status).toBe("ok")
        if (control.status === "ok") expect(control.signals).toHaveLength(expectedSignals)
        expect(controls).toBe(finalCheck)
        for (const mutation of ["principal", "access-revision", "provider-generation", "abort"] as const) {
          const racedCall = nativeCall(selected)
          const controller = new AbortController()
          const request = new Request(host.requestFor(racedCall)!, { signal: controller.signal })
          let checks = 0
          const racedHost = { ...host, requestFor: () => request, revalidate: async (context: TrustedDomainContext) => {
            checks += 1
            const authorized = await host.revalidate(context)
            if (checks === finalCheck) {
              if (mutation === "principal") Object.assign(context.binding, { principalRef: "other" })
              if (mutation === "access-revision") Object.assign(context.binding, { accessRevision: "2" })
              if (mutation === "provider-generation") Object.assign(context.binding, { providerGeneration: 2 })
              if (mutation === "abort") controller.abort()
            }
            return authorized
          } }
          expect(await invokeList(consumer, selected, racedCall, racedHost)).toEqual({ status: "unavailable" })
          expect(checks).toBe(finalCheck)
        }
      }
    }
    const issuerControl = await issueWorkRef(record, nativeCall(caseRef))
    expect(issuerControl).toMatch(/^work-v1-[a-f0-9]{64}$/)
    for (const mutationAt of [1, 2]) {
      for (const mutation of ["principal", "access-revision", "provider-generation", "record"] as const) {
        const racedCall = nativeCall(caseRef)
        const racedRecord = structuredClone(record)
        let checks = 0
        const issuer = createSfWorkRefIssuer({ key: new Uint8Array(32).fill(7), revalidate: async (context) => {
          checks += 1
          const authorized = await host.revalidate(context)
          if (checks === mutationAt) {
            if (mutation === "principal") Object.assign(context.binding, { principalRef: "other" })
            if (mutation === "access-revision") Object.assign(context.binding, { accessRevision: "2" })
            if (mutation === "provider-generation") Object.assign(context.binding, { providerGeneration: 2 })
            if (mutation === "record") racedRecord.selection.caseRef.id = "changed-case"
          }
          return authorized
        } })
        expect(await issuer(racedRecord, racedCall)).toBeUndefined()
        expect(checks).toBe(mutationAt)
      }
    }
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

function finalRevalidation(host: Pick<DomainPortHost, "requestFor" | "revalidate">, finalCheck: number, mutate: () => void) {
  const progress = { checks: 0 }
  return { progress, host: { requestFor: host.requestFor, revalidate: async (context: TrustedDomainContext) => {
    const authorized = await host.revalidate(context)
    progress.checks += 1
    if (progress.checks === finalCheck) mutate()
    return authorized
  } } }
}

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
import { createSfSourceScopeProjector, projectSfSourceScope } from "../../../product/integration/source-projections.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createPlannerObservedProjection } from "../../../product/planner/observed.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDecisionCasePort, encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfOutcomeSelectionRegistry, SF_OUTCOME_SELECTION_PREFIX } from "../../../product/decision-memory/outcome-selection.ts"
import { createSfDomainOutcomeAccess } from "../../../product/decision-memory/domain-outcome.ts"
import type { SfOutcomeSelection } from "../../../product/decision-memory/domain-outcome.ts"
import { createSfReviewOutcomeAdapter } from "../../../product/decision-memory/outcome-review.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const period = { start: "2027-01-01", end: "2027-01-31" }
const call: TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease }

test("review outcome reads the actual closed Planner month and rechecks its C08 choice", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-observed-domain-"))
  const store = await openLocalStore(directory, { lockTimeoutMs: 500 })
  try {
    await store.transaction("planner", async (snapshot) => { snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]; snapshot.data.versions = [{ id: "v0", year: 2027, closed: 1, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [45000, ...Array(11).fill(0)], a: [40000, ...Array(11).fill(null)], f: Array(12).fill(null) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]; return { commit: true, value: true } })
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2028-01-01T00:00:00Z") })
    // C08 selection writes fence all three persisted surfaces, including an otherwise empty one.
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const session = { active: true, approved: false }
    const host: DomainPortHost = { persistence, authenticate: async (_request, context) => resolve("finance", [...context!.roleMap], (group) => session.active && group === "finance-group"), environment: async () => ({ at: "2028-01-01T00:00:00Z", id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test", { headers: { authorization: "finance" } }), revalidate: async () => session.active && await store.transaction("planner", async () => ({ commit: false, value: true })) }
    const planner = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "fixture has no forecast coverage" }) })
    const issued = await planner.issueSource("v0", call)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const ref = issued.value.evidence
    const resolveEvidence = async (evidenceRef: BusinessEvidenceRef, context: TrustedDomainContext): Promise<BusinessEvidenceResolution> => { const current = await planner.sources.resolveForecastSource(evidenceRef.refId, context); return { ref: evidenceRef, state: current.status === "ok" && digestSfValue(current.value.evidence) === digestSfValue(evidenceRef) ? "fresh" : "unavailable", accessRevision: context.binding.accessRevision, checkedAt: "2028-01-01T00:00:00Z" } }
    const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, context) => Promise.all(refs.map((item) => resolveEvidence(item, context))), recall: async () => [], emitFromLedger: async () => { throw new Error("not used") } }
    const signalRegistryWrites = new WeakSet<object>()
    const state = createSfProductState({ ...{ signalRegistryWrites }, persistence, createId: randomUUID, authorize: async () => session.active ? { principalRef: "finance", accessRevision: "1", policyVersion: "1" } : undefined, resolveTarget: async (_request, snapshot, _namespace, target) => { if (target === "seed") return { incarnation: "seed" }; const parsed = parseCaseRef(target); const value = parsed && (snapshot.data.__sfProductV1 as { cases?: Record<string, DecisionCase> } | undefined)?.cases?.[parsed.id]; return value?.participants.includes("finance") ? { incarnation: value.incarnation } : undefined } })
    const coverage = { basisId: "b", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [ref], coverageState: "complete", entries: [], derivedMissingCategoryIds: [] } as const
    const result = { id: "result", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [ref], unresolvedConditions: [], restrictions: [], comparisonStatus: "complete", costCoverage: coverage, knownSubtotal: 45000, total: 45000 } as const
    const comparison = { comparisonStatus: "complete", knownDifference: 0, completeDifference: 0, baselineResultRef: "base", alternativeResultRef: "result", costCoverageRefs: [], criterionResults: [], unresolvedConditions: [] } as const
    const choice = { id: "choice", alternativeId: "a", alternativeVersion: 1, basisVersion: 1, criteria: ["cost"], values: [{ criterionRef: "cost", value: 45000, unit: "USD", currency: "USD", horizon: period }], evidenceRefs: [ref], principalRef: "finance", reason: "baseline", at: "2026-01-01T00:00:00Z", scenario: { baseRef: "base", operations: [], assumptions: [] }, result, comparison, comparisonStatus: "complete", costCoverage: coverage } as const
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const decision: DecisionCase = { ...caseRef, state: "chosen", objective: "Review", horizon: period, currency: "USD", criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["finance"], sourceRefs: [ref], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await state.transaction(host.requestFor(call)!, { namespace: "cases", expectedStorageVersion: 0, targetRef: "seed", targetIncarnation: "seed", idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })
    expect(seed.status).toBe("ok")
    const cases = createDecisionCasePort({ ...{ verifyScenarioOperations: async (value: DecisionCase) => value.alternatives.every((item) => item.scenario.operations.length === 0) && value.choices.every((item) => item.scenario.operations.length === 0) && value.preparedChanges.length === 0 }, state, host, creationTarget: { ref: "seed", incarnation: "seed" }, operationIdentity: () => "fixture", authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), evidence, createId: randomUUID, now: () => "2028-01-01T00:00:00Z" })
    // The human approval callback is a fixture; the C08 selection and source fence are real.
    const registryInput: Parameters<typeof createSfOutcomeSelectionRegistry>[0] = { state, host, cases, signalRegistryWrites, operationIdentity: () => "human-outcome", approveSelection: async () => session.active && session.approved, authorizeSelection: async (selection, context) => (await Promise.all(selection.evidenceRefs.map((item) => resolveEvidence(item, context)))).every((item) => item.state === "fresh"), checkSourceFence: async (snapshot, selection) => { const selected = selection.evidenceRefs[0]; if (!selected || selected.kind !== "record") return false; const scope = Object.values(snapshot.sfSources?.scopes ?? {}).find((item) => item.incarnation === selected.target.incarnation); const physical = snapshot.sfSources?.records[JSON.stringify([selected.target.recordType, selected.target.recordId])]; return !!scope && !!physical?.alive && scope.alive && scope.version === selected.target.version && scope.sourceIncarnation === physical.incarnation && scope.inputDigest === digestSfValue(projectSfSourceScope("planner", snapshot, scope.scope, "2028-01-01T00:00:00Z")) && selected.target.projectionDigest === digestSfValue({ versionId: selected.target.recordId, projection: projectSfSourceScope("planner", snapshot, scope.scope, "2028-01-01T00:00:00Z") }) } }
    const registry = createSfOutcomeSelectionRegistry(registryInput)
    const selection = { caseRef, choiceId: "choice", criterionRef: "cost", valueId: "line:1:actual-usd", period, evidenceRefs: [ref] }
    expect((await registry.register(selection, call)).status).toBe("unavailable")
    session.approved = true
    expect((await registry.register(selection, call)).status).toBe("ok")
    const preferences = await state.read(host.requestFor(call)!, "preferences", (value) => Object.keys(value.preferences).filter((key) => key.startsWith(SF_OUTCOME_SELECTION_PREFIX)))
    expect(preferences.status).toBe("ok")
    if (preferences.status !== "ok" || !preferences.value[0]) return
    const forged = await state.transaction(host.requestFor(call)!, { namespace: "preferences", expectedStorageVersion: preferences.storageVersion, targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation, idempotencyKey: "forged-outcome", commandDigest: digestSfValue("forged") }, async (value) => { delete value.preferences[preferences.value[0]!]; return { commit: true, value: true } })
    expect(forged.status).toBe("denied")
    for (const mutation of ["binding", "abort", "request", "alias"] as const) {
      const probeCall = structuredClone(call)
      const wanted = { caseRef: structuredClone(caseRef), choiceId: "choice" }
      const controller = new AbortController()
      const probeRequest = new Request("https://example.test", { headers: { authorization: "finance" }, signal: controller.signal })
      const checks = { count: 0 }
      const captured: { selection?: SfOutcomeSelection } = {}
      const scoped = createSfOutcomeSelectionRegistry({ ...registryInput, host: { requestFor: () => probeRequest, revalidate: async (context) => {
        checks.count += 1
        const allowed = await host.revalidate(context)
        if (checks.count === 3) {
          if (mutation === "binding") Object.assign(probeCall.binding, { accessRevision: "changed" })
          if (mutation === "abort") controller.abort()
          if (mutation === "request") wanted.caseRef.version += 1
          if (mutation === "alias" && captured.selection) captured.selection.valueId = "changed-during-final-selection-authorization"
        }
        return allowed
      } }, authorizeSelection: async (selected, context) => {
        captured.selection = selected
        return registryInput.authorizeSelection(selected, context)
      } })
      expect(await scoped.select(wanted, probeCall)).toBeUndefined()
      expect(checks.count).toBe(3)
      expect(await registry.select({ caseRef, choiceId: "choice" }, call)).toEqual(selection)
    }
    for (const mutation of ["approval", "final-alias"] as const) {
      const checks = { count: 0 }
      const captured: { selection?: SfOutcomeSelection } = {}
      const scoped = createSfOutcomeSelectionRegistry({ ...registryInput, operationIdentity: () => `race-register-${mutation}`, host: { ...host, revalidate: async (context) => {
        checks.count += 1
        const allowed = await host.revalidate(context)
        if (checks.count === 3 && mutation === "final-alias" && captured.selection) captured.selection.valueId = "changed-during-final-register-authorization"
        return allowed
      } }, approveSelection: async (selected, context) => {
        captured.selection ??= selected
        const allowed = await registryInput.approveSelection(selected, context)
        if (mutation === "approval") selected.valueId = "changed-by-approval-callback"
        return allowed
      } })
      expect(await scoped.register(structuredClone(selection), call)).toEqual({ status: "unavailable" })
      expect(checks.count).toBe(mutation === "approval" ? 1 : 3)
      // A valid append may precede late revocation. Only the unchanged selection
      // may be durable; the hook's changed value must never reach C08.
      expect(await registry.select({ caseRef, choiceId: "choice" }, call)).toEqual(selection)
    }
    const observe = createPlannerObservedProjection({ host, planner: planner.planner, sources: planner.sources })
    const access = createSfDomainOutcomeAccess({ host, cases, select: registry.select, readProjection: observe, authorizeEvidence: async (refs, context) => (await Promise.all(refs.map((item) => resolveEvidence(item, context)))).every((item) => item.state === "fresh") })
    const review = createSfReviewOutcomeAdapter(access)
    const outcome = await review({ caseRef, choiceId: "choice" }, call)
    expect(outcome.status).toBe("ready")
    if (outcome.status === "ready") { expect(outcome.observation.observed).toBe(40000); expect(outcome.comparison.delta).toBe(-5000); expect(outcome.observation.cutoff).toBe("2027-01-31T23:59:59.999Z") }
    const authorized = await cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
    expect(authorized.status).toBe("ok")
    if (authorized.status !== "ok") return
    const reused = structuredClone(authorized.value)
    // A producer alias must not rewrite the baseline already inspected by the adapter.
    // Source resolution, Planner observation and durable selection remain the real paths.
    const racing = createSfDomainOutcomeAccess({ host, cases: { read: async () => ({ status: "ok", value: reused }) }, select: registry.select, readProjection: async (selected, context) => {
      const observed = await observe(selected, context)
      reused.case.choices[0]!.reason = "Changed after the authorized case read"
      return observed
    }, authorizeEvidence: async (refs, context) => (await Promise.all(refs.map((item) => resolveEvidence(item, context)))).every((item) => item.state === "fresh") })
    expect(await racing({ caseRef, choiceId: "choice" }, call)).toEqual({ status: "unavailable" })
    expect((await review({ caseRef, choiceId: "choice" }, call)).status).toBe("ready")
    for (const mutation of ["binding", "abort", "projection", "case", "selection", "selection-argument"] as const) {
      const probeCall = structuredClone(call)
      const controller = new AbortController()
      const probeRequest = new Request("https://example.test", { headers: { authorization: "finance" }, signal: controller.signal })
      const checks = { count: 0 }
      const captured: { projection?: Awaited<ReturnType<typeof observe>>; decision?: typeof authorized.value; selection?: SfOutcomeSelection; argument?: SfOutcomeSelection } = {}
      // The wrapper observes only this adapter's authority awaits. Planner,
      // selection registry and C08 readers retain the original real host.
      const raceHost = { ...host, requestFor: () => probeRequest, revalidate: async (context: TrustedDomainContext) => {
        checks.count += 1
        const allowed = await host.revalidate(context)
        // The sixth await is the second domain load's final authority check;
        // no later domain read can accidentally mask this regression.
        if (checks.count === 6) {
          if (mutation === "binding") Object.assign(probeCall.binding, { accessRevision: "changed" })
          if (mutation === "abort") controller.abort()
          if (mutation === "projection" && captured.projection) captured.projection.projection.values[0]!.value = "changed-after-read"
          if (mutation === "case" && captured.decision) captured.decision.case.choices[0]!.reason = "changed-after-case-read"
          if (mutation === "selection" && captured.selection) captured.selection.valueId = "changed-after-selection-read"
          if (mutation === "selection-argument" && captured.argument) captured.argument.valueId = "changed-after-projection-input"
        }
        return allowed
      } }
      const fenced = createSfDomainOutcomeAccess({ host: raceHost,
        cases: { read: async (request, context) => {
          const value = await cases.read(request, context)
          if (value.status !== "ok") return value
          captured.decision = structuredClone(value.value)
          return { status: "ok", value: captured.decision }
        } },
        select: async (request, context) => {
          const value = await registry.select(request, context)
          captured.selection = value && structuredClone(value)
          return captured.selection
        },
        readProjection: async (selected, context) => {
          captured.argument = selected
          const value = await observe(selected, context)
          captured.projection = value && structuredClone(value)
          return captured.projection
        },
        authorizeEvidence: async (refs, context) => (await Promise.all(refs.map((item) => resolveEvidence(item, context)))).every((item) => item.state === "fresh"),
      })
      expect(await fenced({ caseRef, choiceId: "choice" }, probeCall)).toEqual({ status: "unavailable" })
      expect(checks.count).toBe(6)
    }
    expect((await review({ caseRef, choiceId: "choice" }, call)).status).toBe("ready")
    await persistence.transaction("planner", async (snapshot) => { const versions = snapshot.data.versions as { lines: { a: (number | null)[] }[] }[]; versions[0]!.lines[0]!.a[0] = 41000; return { commit: true, value: true } })
    expect((await review({ caseRef, choiceId: "choice" }, call)).status).toBe("unavailable")
    session.active = false
    expect((await review({ caseRef, choiceId: "choice" }, call)).status).toBe("unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

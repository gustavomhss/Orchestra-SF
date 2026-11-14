import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createDecisionCasePort } from "../../../../product/decisions/case-port.ts"
import { createPlannerProduct } from "../../../../product/planner/product.ts"
import type { PlannerScenarioHost } from "../../../../product/planner/scenario-comparison-port.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { sfRunSourceFence } from "../../../../product/ai/run-store.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { ChoiceRecord, CostCoverageAssessment, CostCoverageBasis, DecisionCase, ScenarioComparison, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { BusinessContextService, BusinessEvidenceResolution } from "../../../../product/contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { SfSignalSelection } from "../../../../product/decision-memory/signal-registry.ts"
import { createSfMemoryServices } from "../../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { createSfMemoryHttp } from "../../../../../../../apps/cli/src/sucafina-product/memory-http.ts"

export const memoryPeriod = { start: "2027-01-01", end: "2027-01-31" }
export const memoryCase = { id: "case", incarnation: "case-incarnation", version: 1 }

/** SQLite/C08, source lifecycle, Planner calculations and UI authority are real.
 * Scenario records and criterion rules are explicit upstream fixtures, never native/global evidence. */
export async function memoryFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-memory-composition-"))
  const store = await openLocalStore(directory)
  const at = "2027-02-02T00:00:00Z"
  const origin = "https://example.test"
  const access = { allowed: true }
  const request = (intention = randomUUID()) => new Request(`${origin}/dashboard`, { method: "POST", headers: { origin, authorization: "person", intention } })
  const identity = (request: Request) => access.allowed && request.headers.get("authorization") === "person"
    ? { installationId: "installation", projectId: "project", principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined
  const ui = createSfUiAuthority({ authorize: async (request) => identity(request), commandIdentity: async (request, operation, digest) => `${request.headers.get("intention")}:${operation}:${digest}`,
    createId: randomUUID, now: () => Date.parse(at), privateCommands: ["decisions.condition.record", "decisions.outcome.select", "analysis.prepare", "analysis.start", "analysis.read"].map((action) => `sf-human:${action}`) })
  const human = createSfHumanAuthority({ origin, ui })
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { roleMap: [{ surface: "planner", role: "finance", entra: "finance", version: 1, by: "person" }],
      versions: [{ id: "v0", name: "January actual", year: 2027, closed: 1, lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
  const host: DomainPortHost = { persistence, environment: async () => ({ at, id: randomUUID, directory: [] }),
    authenticate: async (request, options) => identity(request) && options ? { id: "person", canWrite: true, roles: [{ surface: options.surface, role: "finance" }] } : null,
    requestFor: (call) => call.kind === "ui" ? ui.requestFor(call) : undefined,
    revalidate: (call) => call.kind === "ui" ? ui.revalidate(call) : Promise.resolve(false) }
  const signalRegistryWrites = new WeakSet<object>()
  const state = createSfProductState({ persistence, signalRegistryWrites, createId: randomUUID,
    authorize: async (request) => { const actor = identity(request); return actor ? { principalRef: actor.principalRef, accessRevision: actor.accessRevision, policyVersion: actor.policyVersion } : undefined },
    resolveTarget: async () => ({ incarnation: memoryCase.incarnation }) })
  const admit = async (action: SfHumanAction, payload: unknown) => {
    const admitted = await human.admit(request(), action, payload)
    if (admitted.status !== "ok") throw new Error(`Memory fixture admission failed: ${admitted.reason}`)
    return admitted.value
  }
  const context = await admit("analysis.read", { read: "fixture" })
  const scenarioRecords = new Map<string, Extract<Awaited<ReturnType<PlannerScenarioHost["resolve"]>>, { status: "ok" }>["value"]>()
  const coverageRecords = new Map<string, Extract<Awaited<ReturnType<PlannerSourceHost["resolveForecastCoverage"]>>, { status: "ok" }>["value"]>()
  const scenarios: PlannerScenarioHost = { resolve: async (ref, call) => {
    const value = scenarioRecords.get(ref)
    if (!value || !await host.revalidate(call)) return { status: "unavailable", reason: "fixture-scenario-unavailable" }
    const source = await product.sources.resolveForecastSource(value.source.refId, call)
    return source.status === "ok" && source.value.evidence.refDigest === value.source.refDigest
      ? { status: "ok", value: structuredClone(value) } : { status: "unavailable", reason: "fixture-source-changed" }
  } }
  const product = createPlannerProduct({ host, scopedSources: persistence, scenarios,
    coverageFor: async (ref, call) => coverageRecords.has(ref) && await host.revalidate(call)
      ? { status: "ok", value: structuredClone(coverageRecords.get(ref)!) } : { status: "unavailable", reason: "fixture-coverage-unavailable" },
    criteria: { evaluate: async (selected, call) => await host.revalidate(call) && ["cost", "quality"].includes(selected.criterionId)
      ? { status: "ok", value: { criterionId: selected.criterionId, state: selected.criterionId === "cost" ? "failed" : "satisfied", reason: "Versioned criterion fixture", evidenceRefs: [source] } }
      : { status: "unavailable", reason: "fixture-criterion-unavailable" } },
  })
  const issued = await product.issueSource("v0", context)
  if (issued.status !== "ok") throw new Error(`Memory source missing: ${issued.reason}`)
  const source = issued.value.evidence
  const forecast = await product.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: memoryPeriod, currency: "USD" }, context)
  if (forecast.status !== "ok") throw new Error(`Memory projection missing: ${forecast.reason}`)
  const projection = forecast.value.baseline
  const basis: CostCoverageBasis = { id: "coverage", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [source] }
  const coverage: Extract<CostCoverageAssessment, { coverageState: "complete" }> = { basisId: basis.id, basisVersion: 1, alternativeId: "baseline", alternativeVersion: 1,
    currency: "USD", horizon: memoryPeriod, issues: [], evaluatedSourceRefs: [source], coverageState: "complete", derivedMissingCategoryIds: [],
    entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
      ? { status: "included", categoryId, componentRefs: projection.components.map((component) => component.id), evidenceRefs: [source], scopeNote: "January confirmed service" }
      : { status: "not-applicable", categoryId, evidenceRefs: [source], justification: "Explicit upstream fixture coverage" }) }
  const result: ScenarioResult = { id: "baseline", version: 1, components: projection.components, currency: "USD", horizon: memoryPeriod, sourceRefs: [source],
    unresolvedConditions: [], restrictions: [], comparisonStatus: "complete", costCoverage: coverage, knownSubtotal: 100, total: 100 }
  for (const id of ["baseline", "candidate"]) {
    const assessment = { ...coverage, alternativeId: id }
    coverageRecords.set(`coverage:${id}`, { coverageRef: `coverage:${id}`, basis, assessment })
    scenarioRecords.set(id, { result: { ...result, id, costCoverage: assessment }, coverageRef: `coverage:${id}`, basis, projection, source })
  }
  coverageRecords.set(source.refId, { coverageRef: "coverage:baseline", basis, assessment: coverage })
  const comparison: ScenarioComparison = { baselineResultRef: "baseline", alternativeResultRef: "candidate", costCoverageRefs: ["coverage:baseline", "coverage:candidate"],
    criterionResults: ["cost", "quality"].map((criterionId) => ({ criterionId, state: "satisfied", reason: "Original preserved choice" })),
    unresolvedConditions: [], comparisonStatus: "complete", knownDifference: 0, completeDifference: 0 }
  const choice: ChoiceRecord = { id: "choice", alternativeId: "baseline", alternativeVersion: 1, basisVersion: 1, criteria: ["cost", "quality"],
    values: [{ criterionRef: "cost", value: 120, unit: "USD", currency: "USD", horizon: memoryPeriod }], evidenceRefs: [source], principalRef: "person", reason: "Preserved decision",
    at, scenario: { baseRef: source.refId, operations: [], assumptions: [] }, result, comparison, comparisonStatus: "complete", costCoverage: coverage }
  const decision: DecisionCase = { ...memoryCase, state: "chosen", objective: "Track this preserved commitment", horizon: memoryPeriod, currency: "USD",
    participants: ["person"], criteria: ["cost", "quality"].map((id) => ({ id, description: id, required: true })), sourceRefs: [source], alternatives: [],
    costCoverageBases: [basis], assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }
  const saved = await state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0, targetRef: memoryCase.id, targetIncarnation: memoryCase.incarnation,
    idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (value) => {
      value.cases[decision.id] = decision
      value.decisionResults = Object.fromEntries([...scenarioRecords].map(([ref, entry]) => [ref, { schema: "sf-decision-result-v1" as const, kind: "scenario" as const,
        resultRef: ref, caseRef: memoryCase, principalRef: "person", accessRevision: "access", policyVersion: "policy", createdAt: at,
        requestDigest: digestSfValue(choice.scenario), resultDigest: digestSfValue(entry.result), sourceRefs: [source], result: entry.result }]))
      return { commit: true, value: true }
    })
  if (saved.status !== "ok") throw new Error("Memory fixture state missing")
  const resolve: BusinessContextService["resolve"] = async (ref, call): Promise<BusinessEvidenceResolution> => {
    const unavailable: BusinessEvidenceResolution = { state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: at }
    if (ref.refDigest !== source.refDigest || !await host.revalidate(call)) return unavailable
    const read = await product.sources.resolveForecastSource(ref.refId, call)
    if (read.status !== "ok" || read.value.evidence.refDigest !== ref.refDigest) return unavailable
    const projected = await product.planner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, period: memoryPeriod, currency: "USD" }, call)
    return projected.status === "ok" ? { ...unavailable, state: "fresh", currentRef: read.value.evidence, authorizedProjection: projected.value.baseline } : unavailable
  }
  const evidence: BusinessContextService = { resolve, context: (request, call) => Promise.all(request.refs.map((ref) => resolve(ref, call))),
    recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" } }) }
  const cases = createDecisionCasePort({ state, host, creationTarget: { ref: memoryCase.id, incarnation: memoryCase.incarnation }, operationIdentity: (call) => call.kind === "ui" ? ui.operationIdentity(call) : undefined,
    authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call), evidence,
    verifyScenarioOperations: async (value) => value.choices.every((entry) => entry.scenario.operations.length === 0) && value.alternatives.every((entry) => entry.scenario.operations.length === 0),
    createId: randomUUID, now: () => at })
  const fence = (snapshots: Record<"dashboard" | "planner" | "procurement", Snapshot>) => ({ dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) })
  const controls: { beforeTransaction?: () => Promise<void> } = {}
  const guardedState = { ...state, transaction: async <T>(...args: Parameters<typeof state.transaction<T>>) => {
    const hook = controls.beforeTransaction
    controls.beforeTransaction = undefined
    await hook?.()
    return state.transaction<T>(...args)
  } }
  const memory = createSfMemoryServices({ authority: { host, state: guardedState, human }, signalRegistryWrites,
    business: { cases, context: evidence, planner: product.planner, plannerSources: product.sources, plannerProduct: product,
      resolveCase: async (call) => await host.revalidate(call) ? { status: "ok", value: memoryCase } : { status: "denied", reason: "fixture-case-unavailable" },
      operationIdentity: (call) => call.kind === "ui" ? ui.operationIdentity(call) : undefined,
      readSourceFences: async (call) => await host.revalidate(call) ? persistence.transactionAll!(async (snapshots) => ({ commit: false, value: fence(snapshots) })) : undefined,
      lockedSourceFences: () => { const snapshots = persistence.currentSnapshots?.(); return snapshots ? fence(snapshots) : undefined },
    } })
  const signal: SfSignalSelection = { caseRef: memoryCase, choiceId: choice.id, scenarioRefs: ["baseline", "candidate"], source: projection.context.sourceRefs[0]!, evidence: source,
    fields: ["lines"], period: memoryPeriod, criterionId: "cost", recipientRef: "person", destination: "case", label: "Reconsider service commitment" }
  const register = async (selection = signal) => {
    const call = await admit("decisions.condition.record", selection)
    try { return await memory.registry.register(selection, call) } finally { human.finish(call) }
  }
  const editSource = () => persistence.transaction("planner", async (snapshot) => {
    snapshot.data.actualChanged = "real snapshot mutation"
    return { commit: true, value: undefined }
  })
  const replaceActual = () => persistence.transaction("planner", async (snapshot) => {
    const versions = snapshot.data.versions as { lines: { a: (number | null)[] }[] }[]
    versions[0]!.lines[0]!.a[0] = 90
    return { commit: true, value: undefined }
  })
  const http = createSfMemoryHttp({ origin, authority: { ui, human, host }, memory,
    // Explicit case-bound fixture only; the product host injects business.withCase.
    withCase: async (call, selected, _options, work) => call.kind === "ui" && digestSfValue(selected) === digestSfValue(memoryCase) && await host.revalidate(call)
      ? work() : { status: "denied", reason: "fixture-case-unavailable" },
  })
  return { memory, http, context, state, decision, choice, signal, source, projection, access, controls, admit, register, editSource, replaceActual, request, ui, human,
    readState: () => state.read(request(), "preferences", (value) => value),
    setCase: (value: DecisionCase) => persistence.transaction("dashboard", async (snapshot) => {
      const product = snapshot.data.__sfProductV1 as SfProductState
      product.cases[value.id] = value
      product.versions.cases++
      return { commit: true, value: undefined }
    }),
    dispose: async () => { ui.finish(context); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

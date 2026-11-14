import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, CostCoverageEntry, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { assessCostCoverage, reassessScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import type { CoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, type Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"

const horizon = { start: "2027-01-01", end: "2027-12-31" }
const at = "2026-11-14T00:00:00Z"
type Fault = "entries" | "source" | "case" | "authority" | "abort"
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Real Planner, coverage classification/reassessment and C08. The human grant and
 * exact-result proof callback are synthetic host boundaries, not installed authorization. */
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-source-promotion-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const control = { allowed: true, human: true, operation: "source-promotion", entries: 0, commits: 0, fault: undefined as Fault | undefined }
  const abort = new AbortController()
  const request = new Request("https://example.test/promotion", { headers: { "x-fixture": "promotion" }, signal: abort.signal })
  const observer = new Request("https://example.test/read", { headers: { "x-fixture": "promotion" } })
  const identity = { installationId: "install", projectId: "project", principalRef: "finance", policyVersion: "policy", accessRevision: "access" }
  const authorize = async (incoming: Request) => control.allowed && !incoming.signal.aborted && incoming.headers.get("x-fixture") === "promotion" ? identity : undefined
  const ui = createSfUiAuthority({ authorize, commandIdentity: async () => "source-promotion-ui", createId: () => "source-promotion-ui", now: () => Date.parse(at) })
  const observation: ScenarioRequest = { baseRef: "alpha", operations: [], assumptions: [] }
  const admitted = await ui.admit(request, "sf_scenario_simulate", digestSfValue(observation))
  if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_scenario_simulate", digestSfValue(observation))) throw new Error("Fixture UI admission unavailable")
  const context = admitted.value
  const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
  const host: DomainPortHost = {
    persistence: store, requestFor: (call) => call.kind === "ui" ? ui.requestFor(call) : undefined,
    revalidate: (call) => call.kind === "ui" ? ui.revalidate(call) : Promise.resolve(false),
    authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"),
    environment: async () => ({ at, id: () => "unused", directory: [] }),
  }
  const cleanup = async () => { ui.finish(context); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
  try {
    const version = (id: string, amount: number) => ({ id, year: 2027, closed: 0,
      lines: [{ id: "service", sec: "opex", el: "licenses", cur: "USD", b: Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0), a: Array(12).fill(null), f: Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })
    await store.transaction("planner", async (snapshot) => {
      snapshot.data = { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [version("alpha", 100), version("beta", 200)] }
      return { commit: true, value: true }
    })
    const sourceRefs = await store.transaction("planner", async (snapshot) => ({ commit: false, value: ["alpha", "beta"].map((id): RecordEvidence => {
      const projection = projectPlannerSource(snapshot, actor, id)
      if (!projection) throw new Error(`Missing fixture source ${id}`)
      const unsigned: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId: id, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `planner-${id}`, version: 1, fields: Object.keys(projection), period: horizon, projectionDigest: digestSfValue({ versionId: id, projection }) } }
      return { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
    }) }))
    const basis: CostCoverageBasis = { id: "source-promotion-basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs }
    const caseRef = { id: "promotion-case", incarnation: "promotion-case-inc", version: 1 }
    const state = createSfProductState({ persistence: store, authorize, createId: () => "promotion-state-inc", resolveTarget: async () => ({ incarnation: caseRef.incarnation }) })
    const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "Compare two explicitly classified source bundles", currency: "USD", horizon, criteria: [], participants: [identity.principalRef], sourceRefs, alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(observer, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Fixture C08 seed unavailable")
    const assessments = new Map<string, CostCoverageAssessment>()
    const classifications = new Map<string, CoverageClassification>()
    const sourceFence = (snapshot: Snapshot) => sourceRefs.every((ref) => digestSfValue({ versionId: ref.target.recordId, projection: projectPlannerSource(snapshot, actor, ref.target.recordId) }) === ref.target.projectionDigest)
    const currentSources = () => store.transaction("planner", async (snapshot) => ({ commit: false, value: sourceFence(snapshot) }))
    const evidence = async (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext): Promise<readonly BusinessEvidenceResolution[]> => {
      const fresh = await host.revalidate(call) && await currentSources()
      return refs.map((ref) => ({ state: fresh && sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref)) ? "fresh" : "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: at }))
    }
    const supports = (entry: Exclude<CostCoverageEntry, { status: "pending" }>, resolutions: readonly BusinessEvidenceResolution[]) => {
      const classification = classifications.get(entry.evidenceRefs[0]!.refId)
      return !!classification && supportsCoverageClassification(classification, entry, resolutions)
    }
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference) => {
        const source = sourceRefs.find((ref) => ref.refId === reference)
        return source && await currentSources() ? { status: "ok", value: { versionId: reference, evidence: source } } : { status: "unavailable", reason: "source-unavailable" }
      },
      resolveForecastCoverage: async (reference) => {
        if (!sourceRefs.some((ref) => ref.refId === reference)) return { status: "unavailable", reason: "coverage-unavailable" }
        const assessment = assessments.get(reference) ?? { basisId: basis.id, basisVersion: basis.version, alternativeId: reference, alternativeVersion: 1, currency: "USD", horizon, evaluatedSourceRefs: sourceRefs, coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], issues: [] }
        return { status: "ok", value: { coverageRef: reference, basis, assessment } }
      },
    }
    const planner = createPlannerPort({ host, sources })
    for (const source of sourceRefs) {
      const projected = await planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: horizon, currency: "USD" }, context)
      if (projected.status !== "ok") throw new Error(`Fixture projection: ${JSON.stringify(projected)}`)
      const components = projected.value.candidate.components
      const entries: CostCoverageEntry[] = RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "included", componentRefs: components.map((component) => component.id), evidenceRefs: [source], scopeNote: `Synthetic all-inclusive bundle expressly includes ${categoryId}; shared components are priced once.` }))
      const classification = classifyCoverage({ caseRef, source, basis, entries, expectedVersion: 0 }, projected.value.candidate, 1)
      classifications.set(source.refId, classification)
      // Source-first order differs from basis order for beta, as in real source classification.
      const ordered = [source, ...sourceRefs.filter((ref) => ref.refId !== source.refId)]
      assessments.set(source.refId, assessCostCoverage({ basis, alternativeId: source.refId, alternativeVersion: 1, currency: "USD", horizon, entries, components, evidence: await evidence(ordered, context), supports }))
    }
    let proof: ScenarioResult | undefined
    let sequence = 0
    const inspect = async () => {
      const read = await state.read(observer, "cases", (value) => ({ decision: value.cases[caseRef.id]!, results: value.decisionResults ?? {} }))
      if (read.status !== "ok") throw new Error(`Fixture state read: ${JSON.stringify(read)}`)
      return read
    }
    const mutateAfterEvidence = async () => {
      const fault = control.fault
      control.fault = undefined
      if (fault === "authority") control.allowed = false
      if (fault === "abort") abort.abort()
      if (fault === "source") await store.transaction("planner", async (snapshot) => {
        const versions = snapshot.data.versions
        if (!Array.isArray(versions)) throw new Error("Missing source versions")
        const lines = object(versions[0]).lines
        if (!Array.isArray(lines)) throw new Error("Missing source line")
        const forecast = object(lines[0]).f
        if (!Array.isArray(forecast)) throw new Error("Missing source forecast")
        forecast[10] = 101
        return { commit: true, value: true }
      })
      if (fault === "case") {
        const before = await inspect()
        const changed = await state.transaction(observer, { namespace: "cases", expectedStorageVersion: before.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "concurrent-case", commandDigest: digestSfValue({ objective: "Concurrent revision" }) }, async (value) => {
          value.cases[caseRef.id] = { ...value.cases[caseRef.id]!, version: 2, objective: "Concurrent revision" }
          return { commit: true, value: true }
        })
        if (changed.status !== "ok") throw new Error("Concurrent case edit unavailable")
      }
    }
    const mutations = createDecisionMutations({ state, host, planner, sources,
      authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call),
      authorizeMutation: async () => { proof = undefined; return control.human }, verifyMutation: () => control.human,
      operationIdentity: () => control.operation, confirmChoice: async () => false, confirmAnswer: async () => false,
      resolveQuestion: async () => ({ status: "unavailable", reason: "not-requested" }), resolveAnswer: async () => ({ status: "unavailable", reason: "not-requested" }),
      resolveChoiceValues: async () => ({ status: "unavailable", reason: "not-requested" }), prepareDomainCommands: async () => ({ status: "unavailable", reason: "not-requested" }),
      coverageEvidence: {
        entries: async (scenario, baseline, call) => {
          control.entries++
          if (control.fault === "entries") return { status: "unavailable", reason: "producer-proof-unavailable" }
          const entries = structuredClone(baseline.entries)
          proof = await reassessScenarioCoverage({ scenario, basis, baseline, entries, resolveEvidence: (refs) => evidence(refs, call), supports })
          return proof ? { status: "ok", value: entries } : { status: "unavailable", reason: "producer-proof-unavailable" }
        },
        resolve: async (refs, call) => { const values = await evidence(refs, call); await mutateAfterEvidence(); return values }, supports,
        verifySnapshot: (snapshot, result, candidateBasis) => { control.commits++; return !!proof && control.allowed && !request.signal.aborted && digestSfValue(result) === digestSfValue(proof) && digestSfValue(candidateBasis) === digestSfValue(basis) && sourceFence(snapshot) },
      },
      createId: () => `promoted-${++sequence}`, now: () => at,
    })
    return { directory, store, state, context, host, request, observer, control, caseRef, sourceRefs, planner, assessments, mutations, inspect, cleanup }
  } catch (error) { await cleanup(); throw error }
}

test("source-only promotions prepare the exact coverage proof for both source orders and persist without creating a choice or applying commands", async () => {
  const f = await fixture()
  try {
    const before = await f.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    let caseRef = f.caseRef
    for (const baseRef of ["alpha", "beta"]) {
      const scenario: ScenarioRequest = { baseRef, operations: [], assumptions: [] }
      const observed = await f.planner.simulateScenario(scenario, f.context)
      if (observed.status !== "ok") throw new Error(`Source observation: ${JSON.stringify(observed)}`)
      expect(observed.value.comparisonStatus).toBe("complete")
      expect(observed.value.costCoverage).toEqual(f.assessments.get(baseRef)!)
      expect(observed.value.costCoverage.evaluatedSourceRefs[0]!.refId).toBe(baseRef)
      f.control.operation = `promote-${baseRef}`
      const input = { caseRef, title: baseRef, scenario, coverageRef: baseRef }
      const promoted = await f.mutations.addAlternative(input, f.context)
      if (promoted.status !== "ok") throw new Error(`Source promotion: ${JSON.stringify(promoted)}`)
      const saved = (await f.inspect()).value
      const alternative = saved.decision.alternatives.find((item) => item.title === baseRef)!
      expect(alternative.result).toMatchObject({ comparisonStatus: "complete", currency: "USD", horizon, knownSubtotal: observed.value.knownSubtotal, total: observed.value.total })
      expect(alternative.result.components).toEqual(observed.value.components)
      expect(alternative.result.costCoverage.evaluatedSourceRefs).toEqual(f.sourceRefs)
      expect(saved.results[promoted.value.resultRef!]?.result).toEqual(alternative.result)
      expect(saved.decision.choices).toEqual([])
      expect(saved.decision.preparedChanges).toEqual([])
      expect(saved.decision.receipts).toEqual([])
      const calls = f.control.entries
      expect(await f.mutations.addAlternative(input, f.context)).toEqual(promoted)
      expect(f.control.entries).toBe(calls)
      caseRef = promoted.value.caseRef
    }
    expect(f.control.entries).toBe(2)
    expect(f.control.commits).toBe(2)
    expect(await f.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(before)
  } finally { await f.cleanup() }
}, 60000)

test("a changed scenario still consumes coverage proof without upgrading hypothetical total", async () => {
  const f = await fixture()
  try {
    const scenario: ScenarioRequest = { baseRef: "alpha", operations: [{ kind: "replace", targetRef: "service:11", amount: 75, currency: "USD", period: { start: "2027-11-01", end: "2027-11-30" } }], assumptions: [] }
    const promoted = await f.mutations.addAlternative({ caseRef: f.caseRef, title: "Changed", scenario, coverageRef: "alpha" }, f.context)
    if (promoted.status !== "ok") throw new Error(`Changed promotion: ${JSON.stringify(promoted)}`)
    const saved = (await f.inspect()).value.decision.alternatives[0]!
    expect(saved.result).toMatchObject({ comparisonStatus: "conditioned", knownSubtotal: 75, total: null })
    expect(saved.result.components.find((component) => component.id === "service:11")?.evidenceState).toBe("hypothetical")
    expect(f.control.entries).toBe(1)
    expect(f.control.commits).toBe(1)
  } finally { await f.cleanup() }
}, 60000)

for (const fault of ["entries", "source", "case", "authority", "abort"] as const) test(`source promotion rejects ${fault} changes before commit without a partial alternative or result`, async () => {
  const f = await fixture()
  try {
    f.control.fault = fault
    const promoted = await f.mutations.addAlternative({ caseRef: f.caseRef, title: "Blocked", scenario: { baseRef: "alpha", operations: [], assumptions: [] }, coverageRef: "alpha" }, f.context)
    expect(promoted.status).not.toBe("ok")
    expect(f.control.entries).toBe(1)
    f.control.allowed = true
    const saved = (await f.inspect()).value
    expect(saved.decision.alternatives).toEqual([])
    expect(saved.results).toEqual({})
    expect(saved.decision.version).toBe(fault === "case" ? 2 : 1)
    if (fault === "source") expect(f.control.commits).toBe(1)
  } finally { await f.cleanup() }
}, 60000)

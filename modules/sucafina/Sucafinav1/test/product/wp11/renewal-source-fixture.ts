import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/planner.ts"
import { resolve } from "../../../src/identity.ts"
import { wp05Horizon } from "../wp05/engine-fixture.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
const now = () => "2026-11-13T00:00:00Z"
const november = { start: "2027-11-01", end: "2027-11-30" }
const reader = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }

/** The published WP05 renewal inputs and explicit synthetic source boundary, without
 * its unrelated sensitivity/bootstrap results. SQLite, UI admission and every
 * financial projection/simulation still use the production implementations.
 */
export async function createRenewalSourceFixture(training: "omitted" | "bundled") {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-wp11-renewal-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const access = { allowed: true, revokedSources: new Set<string>(), disposed: false }
  const request = new Request("https://example.test/wp11-renewal", { headers: { authorization: "wp11-renewal-fixture" } })
  const identity = { installationId: "install", projectId: "project", principalRef: "finance", policyVersion: "policy", accessRevision: "access" }
  const authorize = async (incoming: Request) => access.allowed && incoming === request && incoming.headers.get("authorization") === "wp11-renewal-fixture" ? identity : undefined
  const ui = createSfUiAuthority({ authorize, commandIdentity: async () => "wp11-renewal-command", createId: () => "wp11-renewal-request", now: () => Date.parse(now()) })
  const intent = { viewId: "BI11", selectionRef: "authorized-selection", period: wp05Horizon }
  const admitted = await ui.admit(request, "sf_bi_view", digestSfValue(intent))
  if (admitted.status !== "ok") throw new Error("Renewal UI admission unavailable")
  const context = admitted.value
  if (!await ui.validate(context, "sf_bi_view", digestSfValue(intent))) throw new Error("Renewal UI admission was not consumed")
  const closeStore = async () => {
    ui.finish(context)
    if (!access.disposed) { await store.dispose(); access.disposed = true }
  }
  const cleanup = async () => { await closeStore(); await rm(directory, { recursive: true, force: true }) }
  try {
    const line = (id: string, amount: number) => ({ id, sec: "opex", el: "licenses", cur: "USD", b: Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0), a: Array(12).fill(null), f: Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0) })
    const version = (id: string, lines: ReturnType<typeof line>[]) => ({ id, year: 2027, closed: 0, lines, fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })
    const snapshot: Snapshot = { data: { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [version("renewal", [line("renewal", 240000)]), version(`transition-${training}`, [line("bridge", 60000), line("implementation", 45000), line("new-service", 105000)])] }, versions: {}, sequences: {}, audit: [], notices: [] }
    await store.transaction("planner", async (current) => { Object.assign(current, snapshot); return { commit: true, value: true } })
    const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
    const sourceRefs = [`transition-${training}`, "renewal"].map((id): RecordEvidence => {
      const projection = projectPlannerSource(snapshot, reader, id)
      if (!projection) throw new Error(`Planner source unavailable:${id}`)
      const unsigned: RecordEvidence = { schema: "sf-evidence-v1", refId: id, installationId: identity.installationId, projectId: identity.projectId, refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `planner-${id}`, version: 1, fields: Object.keys(projection), period: wp05Horizon, projectionDigest: digestSfValue({ versionId: id, projection }) } }
      return { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
    })
    const sourceMatches = (ref: BusinessEvidenceRef) => access.allowed && !access.revokedSources.has(ref.refId) && sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref))
    const basis: CostCoverageBasis = { id: "renewal-transition", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs }
    const host: DomainPortHost = { persistence: store, authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: now(), id: () => "unused", directory: [] }), requestFor: (trusted) => trusted.kind === "ui" ? ui.requestFor(trusted) : undefined, revalidate: (trusted) => trusted.kind === "ui" ? ui.revalidate(trusted) : Promise.resolve(false) }
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference) => {
        const evidence = sourceRefs.find((ref) => ref.refId === reference)
        return evidence && sourceMatches(evidence) ? { status: "ok", value: { versionId: reference, evidence } } : { status: "unavailable", reason: "planner-source-unavailable" }
      },
      resolveForecastCoverage: async (reference) => {
        const source = sourceRefs.find((ref) => ref.refId === reference)
        if (!source || !sourceMatches(source)) return { status: "unavailable", reason: "planner-coverage-unavailable" }
        return { status: "ok", value: { coverageRef: `source-coverage:${reference}`, basis, assessment: pending(basis, reference) } }
      },
    }
    const planner = createPlannerPort({ host, sources })
    const state = createSfProductState({ persistence: store, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async (incoming) => await authorize(incoming) ? identity : undefined })
    const evidence: BusinessContextService = { resolve: async (ref) => ({ state: sourceMatches(ref) ? "fresh" : "revoked", ref, accessRevision: identity.accessRevision, checkedAt: now() }), context: renewalEvidenceContext((ref, trusted) => evidence.resolve(ref, trusted)), recall: async () => [], emitFromLedger: async () => { throw new Error("No memory publication in renewal source fixture") } }
    const scenario: ScenarioRequest = { baseRef: `transition-${training}`, operations: [{ kind: "replace", targetRef: "implementation:11", amount: 45000, currency: "USD", period: november }, { kind: "replace", targetRef: "bridge:11", amount: 60000, currency: "USD", period: november }, { kind: "replace", targetRef: "new-service:11", amount: 105000, currency: "USD", period: november }], assumptions: [] }
    const baselineScenario: ScenarioRequest = { baseRef: "renewal", operations: [{ kind: "replace", targetRef: "renewal:11", amount: 240000, currency: "USD", period: november }], assumptions: [] }
    const selectedPreview = await planner.simulateScenario(scenario, context)
    const baselinePreview = await planner.simulateScenario(baselineScenario, context)
    if (selectedPreview.status !== "ok" || baselinePreview.status !== "ok" || selectedPreview.value.comparisonStatus !== "conditioned" || baselinePreview.value.comparisonStatus !== "conditioned") throw new Error("Canonical conditioned renewal previews unavailable")
    const selectedResult: ScenarioResult = { ...selectedPreview.value, costCoverage: { ...selectedPreview.value.costCoverage, alternativeId: "selected", alternativeVersion: 1 } }
    const baselineResult: ScenarioResult = { ...baselinePreview.value, costCoverage: { ...baselinePreview.value.costCoverage, alternativeId: "baseline", alternativeVersion: 1 } }
    // The second participant is an explicit fixture membership, not an inferred grant.
    const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "renewal", currency: "USD", horizon: wp05Horizon, criteria: [{ id: "renewal-difference", description: "Explicit known subtotal criterion", required: true }], participants: ["finance", "collaborator"], sourceRefs, alternatives: [{ id: "selected", version: 1, title: "Transition", scenario, result: selectedResult }, { id: "baseline", version: 1, title: "Renewal", scenario: baselineScenario, result: baselineResult }], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "wp11-renewal-seed", commandDigest: digestSfValue(decision), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok" || !seeded.value) throw new Error("Renewal case seed unavailable")
    return { context, host, ui, state, store, directory, request, decision, planner, sources, sourceRefs, basis, caseRef, scenario, baselineScenario, selectedResult, baselineResult, evidence, closeStore, cleanup }
  } catch (error) { await cleanup(); throw error }
}

/** A new synthetic quote is authored into a copied real version through Planner CAS.
 * This helper does not create sensitivity results or supply calculated totals.
 */
export async function createRenewalQuoteRevision(fixture: Awaited<ReturnType<typeof createRenewalSourceFixture>>, kind: "training" | "implementation") {
  const versionId = kind === "training" ? "transition-confirmed" : "transition-implementation70000"
  const amount = kind === "training" ? 40000 : 70000
  const author = { ...reader, id: "fixture-source-author", roles: ["admin"] }
  let allocated = 0
  const environment = { at: now(), id: () => ++allocated === 1 ? versionId : `wp11-${kind}-revision-${allocated}`, directory: [] }
  const source = await fixture.store.transaction("planner", async (snapshot) => {
    const previous = projectPlannerSource(snapshot, reader, fixture.scenario.baseRef)
    if (!previous) throw new Error("Original source unavailable")
    const originalDigest = digestSfValue(previous)
    const copied = domain.execute(snapshot, author, { page: "Versions", action: "copy", id: fixture.scenario.baseRef, version: snapshot.versions[`versions:${fixture.scenario.baseRef}`]?.version ?? 0, values: { name: `Confirmed ${kind} quote` } }, environment)
    if (!copied.ok || copied.value !== versionId) throw new Error("Canonical source copy rejected")
    // This synthetic annual quote explicitly charges November and confirms zero
    // forecast in every other month; annual is the budget, not forecast evidence.
    const values = kind === "training"
      ? { versionId, el: "licenses", cur: "USD", annual: 0, f0: 0, f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, f7: 0, f8: 0, f9: 0, f10: amount, f11: 0 }
      : { versionId, f10: amount }
    const saved = domain.execute(snapshot, author, { page: "OPEX", action: "save", id: kind, version: snapshot.versions[`${versionId}:lines:${kind}`]?.version ?? 0, values }, environment)
    if (!saved.ok || digestSfValue(projectPlannerSource(snapshot, reader, fixture.scenario.baseRef)) !== originalDigest) throw new Error("Canonical quote revision changed its original source")
    const projection = projectPlannerSource(snapshot, reader, versionId)
    if (!projection) throw new Error("Revised source unavailable")
    const unsigned: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId: versionId, installationId: fixture.context.binding.installationId, projectId: fixture.context.binding.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: versionId, incarnation: `planner-${versionId}`, version: snapshot.versions[`versions:${versionId}`]?.version ?? 1, fields: Object.keys(projection), period: wp05Horizon, projectionDigest: digestSfValue({ versionId, projection }) } }
    return { commit: true, value: { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) } }
  })
  const sourceRefs = [...structuredClone(fixture.sourceRefs), source]
  const basis: CostCoverageBasis = { ...structuredClone(fixture.basis), version: fixture.basis.version + 1, sourceRefs }
  const currentSource = async (ref: BusinessEvidenceRef, context: TrustedDomainContext) => {
    if (!await fixture.host.revalidate(context)) return false
    if (digestSfValue(ref) !== digestSfValue(source)) return (await fixture.evidence.resolve(ref, context)).state === "fresh"
    const projection = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: projectPlannerSource(snapshot, reader, versionId) }))
    return !!projection && digestSfValue({ versionId, projection }) === source.target.projectionDigest
  }
  const sources: PlannerSourceHost = {
    resolveForecastSource: async (reference, context) => reference === source.refId ? await currentSource(source, context) ? { status: "ok", value: { versionId, evidence: source } } : { status: "unavailable", reason: "planner-source-unavailable" } : fixture.sources.resolveForecastSource(reference, context),
    resolveForecastCoverage: async (reference, context) => {
      const selected = sourceRefs.find((ref) => ref.refId === reference)
      return selected && await currentSource(selected, context) ? { status: "ok", value: { coverageRef: `revised-source-coverage:${reference}`, basis, assessment: pending(basis, reference) } } : { status: "unavailable", reason: "planner-coverage-unavailable" }
    },
  }
  const evidence: BusinessContextService = { resolve: async (ref, context) => ({ state: await currentSource(ref, context) ? "fresh" : "revoked", ref, accessRevision: context.binding.accessRevision, checkedAt: now() }), context: renewalEvidenceContext((ref, trusted) => evidence.resolve(ref, trusted)), recall: async () => [], emitFromLedger: async () => { throw new Error("No memory publication in quote revision fixture") } }
  return { source, sourceRefs, basis, sources, evidence }
}

function pending(basis: CostCoverageBasis, alternativeId: string): CostCoverageAssessment {
  return { basisId: basis.id, basisVersion: basis.version, alternativeId, alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, issues: [], evaluatedSourceRefs: basis.sourceRefs, coverageState: "pending", entries: basis.categoryIds.map((categoryId) => ({ categoryId, status: "pending", reason: "missing-category" })), derivedMissingCategoryIds: [...basis.categoryIds] }
}

/** One observation per distinct reference in the SAME context call. Each later
 * call resolves again; no authority, projection or result survives this batch.
 */
export function renewalEvidenceContext(resolve: BusinessContextService["resolve"]): BusinessContextService["context"] {
  return async ({ refs }, context) => {
    const observations = new Map<string, ReturnType<BusinessContextService["resolve"]>>()
    const values = await Promise.all(refs.map((ref) => {
      const key = digestSfValue(ref)
      const previous = observations.get(key)
      if (previous) return previous
      const observed = resolve(ref, context)
      observations.set(key, observed)
      return observed
    }))
    return structuredClone(values)
  }
}

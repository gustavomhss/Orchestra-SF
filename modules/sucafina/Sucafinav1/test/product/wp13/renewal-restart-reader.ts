import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createDecisionBaselineCoverage } from "../../../product/decisions/baseline-coverage.ts"
import { createCriterionResultBindings, createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createPlannerScenarioInputs } from "../../../product/planner/scenario-inputs.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPersistentSensitivityPort } from "../../../product/portfolio/sensitivity-store.ts"
import { createPortfolioProofVerifier } from "../../../product/portfolio/verification.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { object } from "../../../runtime/contract.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"

const [directory, resultRef, permission] = process.argv.slice(2)
if (!directory || !resultRef || !["allowed", "revoked", "revoked-during-proof"].includes(permission ?? "")) throw new Error("reader arguments required")
const stage = (name: string) => process.stderr.write(`SF_WP13_RESTART_STAGE:${name}\n`)
stage("store-open-start")
const store = await openLocalStore(directory)
stage("store-open-ready")
let allowed = permission !== "revoked"
const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "finance", requestId: "restart-read", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
const request = new Request("https://example.test/restart")
const now = () => "2026-11-13T00:00:00Z"
const neverAllocate = () => { throw new Error("restart reader cannot allocate state or result IDs") }
const host: DomainPortHost = { persistence: store, requestFor: () => request, revalidate: async () => allowed, authenticate: async (_request, input) => allowed ? resolve("finance", [...input!.roleMap], (group) => group === "finance-group") : null, environment: async () => ({ at: now(), id: neverAllocate, directory: [] }) }
const state = createSfProductState({ persistence: store, createId: neverAllocate, resolveTarget: async () => undefined, authorize: async () => allowed ? { principalRef: "finance", policyVersion: "policy", accessRevision: "access" } : undefined })
const verifyRefs = (refs: readonly BusinessEvidenceRef[]) => store.transaction("planner", async (snapshot) => ({ commit: false, value: allowed && refs.length > 0 && refs.every((ref) => {
  if (ref.kind !== "record" || ref.refDigest !== digestSfEvidenceRef(ref) || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId) return false
  const projection = projectPlannerSource(snapshot, { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }, ref.target.recordId)
  return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
}) }))
const results = createSfDecisionResultStore({ state, host, authorizeCase: async (decision) => allowed && decision.participants.includes(context.binding.principalRef), verifySources: (_value, refs) => verifyRefs(refs), createId: neverAllocate, now })
const evidence: BusinessContextService = {
  resolve: async (ref) => ({ ref, state: !allowed ? "revoked" : await verifyRefs([ref]) ? "fresh" : "stale", accessRevision: "access", checkedAt: now() }),
  context: async ({ refs }) => Promise.all(refs.map((ref) => evidence.resolve(ref, context))),
  recall: async () => [], emitFromLedger: async () => { throw new Error("reader cannot emit memory") },
}

async function readBound() {
  stage("c08-read-start")
  const stored = await results.read({ kind: "sensitivity", resultRef: resultRef! }, context)
  stage(`c08-read-${stored.status}`)
  if (stored.status !== "ok") return stored
  if (stored.value.kind !== "sensitivity") throw new Error("unexpected result kind")
  const caseRef = stored.value.caseRef
  const source = stored.value.sourceRefs.find((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
  if (!source) throw new Error("recorded Planner source is required")
  const proposalCoverageWrites = new WeakSet<object>()
  const baselineCoverage = createDecisionBaselineCoverage({ state, host, resolveCase: async () => ({ status: "ok", value: caseRef }), authorizeCase: async (decision) => allowed && decision.participants.includes(context.binding.principalRef), authorizeCoverage: async () => false, projectForecast: async () => ({ status: "unavailable", reason: "reader-does-not-register-coverage" }), resolveEvidence: (refs, trusted) => evidence.context({ refs }, trusted), supports: () => false, verifySnapshot: () => false, operationIdentity: () => undefined, proposalCoverageWrites, now })
  const caseCoverage = createDecisionCoverageAccess({ state, host, authorizeCase: async (decision) => allowed && decision.participants.includes(context.binding.principalRef), verifyEvidence: (basis, assessment) => verifyRefs([...basis.sourceRefs, ...assessment.evaluatedSourceRefs, ...assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]) })
  const sources: PlannerSourceHost = { resolveForecastSource: async (ref) => ref === source.refId && await verifyRefs([source]) ? { status: "ok", value: { versionId: source.target.recordId, evidence: source } } : { status: "unavailable", reason: "current-source-unavailable" }, resolveForecastCoverage: (ref, trusted) => ref === source.refId || ref.startsWith("baseline-coverage:") ? baselineCoverage.resolveForecastCoverage(ref, trusted) : caseCoverage(ref, trusted) }
  const planner = createPlannerPort({ host, sources })
  const verifyOperations = createPlannerOperationVerifier({ host, planner, sources, scenarioInputs: createPlannerScenarioInputs({ planner, sources }) })
  const transactionAll = store.transactionAll
  if (!transactionAll) throw new Error("cross-surface replay required")
  // Local to this read-only probe. Every hit still authenticates and reads ALL current
  // snapshots, including __sfProductV1; no time-based or source-only cache is accepted.
  const operationProofs = new Map<string, Promise<boolean>>()
  let operationVerifications = 0
  let operationProofHits = 0
  let revocationInjected = false
  const operationFence = async (decision: DecisionCase, trusted: TrustedDomainContext) => {
    if (!await host.revalidate(trusted) || request.signal.aborted) return undefined
    return transactionAll(async (snapshots) => {
      const principal = await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshots.planner, "planner") })
      if (!principal || principal.id !== trusted.binding.principalRef) return { commit: false, value: undefined }
      const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
      const access = object(object(snapshots.planner.data.access)[principal.id])
      const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      return { commit: false, value: await host.revalidate(trusted) && !request.signal.aborted ? digestSfValue({ snapshots, decision, actor, binding: trusted.binding }) : undefined }
    })
  }
  const verifyCaseOperations = async (incoming: DecisionCase, trusted: TrustedDomainContext) => {
    const decision = structuredClone(incoming)
    const before = await operationFence(decision, trusted)
    if (!before) return false
    let proof = operationProofs.get(before)
    if (proof) operationProofHits++
    else {
      operationVerifications++
      proof = Promise.all(decision.alternatives.map((alternative) => verifyOperations(alternative.scenario, trusted))).then((checks) => checks.every(Boolean))
      operationProofs.set(before, proof)
    }
    const valid = await proof
    if (permission === "revoked-during-proof" && operationProofHits > 0) { revocationInjected = true; allowed = false }
    const after = await operationFence(decision, trusted)
    if (!valid || after !== before) { operationProofs.delete(before); return false }
    return true
  }
  const cases = createDecisionCasePort({ state, host, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity: () => undefined, authorizeCase: async (decision) => allowed && decision.participants.includes(context.binding.principalRef), verifyScenarioOperations: verifyCaseOperations, evidence, createId: neverAllocate, now })
  const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
  const rules = createCriterionRuleRegistry({ state, host, authorizeCase: async (decision) => allowed && decision.participants.includes(context.binding.principalRef), authorizeRule: async () => false, verifyEvidence: (rule) => verifyRefs(rule.evidenceRefs), verifySnapshot: () => false, readMetric: async () => ({ status: "unavailable", reason: "reader-does-not-register-criteria" }), verifyMetric: async () => false, operationIdentity: () => undefined, proposalCoverageWrites, now })
  const units = createPlannerSensitivityUnits({ host, cases, scenarios, store: results, evidence, rules })
  const preview = (request: Parameters<typeof comparePlannerPreview>[1], trusted: Parameters<typeof comparePlannerPreview>[2]) => comparePlannerPreview({ host, sources, scenarios, planner }, request, trusted)
  const exact = createPlannerExactThreshold({ units, preview })
  const fence = (snapshots: Record<"dashboard" | "planner" | "procurement", Snapshot>) => ({ dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) })
  const verifier = createPortfolioProofVerifier({ cases, planner, sources, evidence, results, revalidate: host.revalidate, readSourceFences: async () => allowed ? transactionAll(async (snapshots) => ({ commit: false, value: fence(snapshots) })) : undefined, lockedSourceFences: () => { const snapshots = store.currentSnapshots?.(); return snapshots ? fence(snapshots) : undefined }, caseFor: async () => ({ status: "ok", value: caseRef }), idempotencyKey: async () => undefined, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "reader-does-not-prepare" }) }, createReceipt: async () => undefined, candidateCoverageRefFor: async () => ({ status: "unavailable", reason: "unused-by-sensitivity-replay" }), revalidateAnalysis: async () => false, units, sensitivityPreview: preview, exactThreshold: (request, binding, trusted) => exact(request, binding.baselineRef, trusted) })
  const bindings = createCriterionResultBindings({ state, host, rules, results, authorizeCase: async (decision) => allowed && decision.participants.includes(context.binding.principalRef), verifyBinding: async (binding, _rule, stored, trusted) => { stage("binding-replay-start"); const valid = await verifier.verifySensitivity(binding, stored, trusted); stage(`binding-replay-${valid}`); return valid }, verifySnapshot: () => false, operationIdentity: () => undefined, proposalCoverageWrites, now })
  const persistent = createPersistentSensitivityPort({ portfolio: { evaluate: async () => ({ status: "unavailable", reason: "read-only" }), sensitivity: async () => ({ status: "unavailable", reason: "read-only" }) }, bindings, resolveBinding: units.resolve, results, idempotencyKey: async () => undefined })
  stage("bound-read-start")
  const result = await persistent.read(resultRef!, context)
  stage(`bound-read-${result.status}${result.status === "ok" ? "" : `:${result.reason}`}:operation-verifications=${operationVerifications}:proof-hits=${operationProofHits}`)
  if (result.status !== "ok") return { ...result, revocationInjected, operationProofHits, operationVerifications }
  return { status: "ok", pid: process.pid, proof: "bound-reader-and-current-producer-replay", resultRef: result.value.sensitivityResultRef, resultDigest: digestSfValue(result.value.sensitivity), comparisonStatus: result.value.sensitivity.comparisonStatus, thresholdEvidence: result.value.sensitivity.thresholdEvidence, threshold: result.value.sensitivity.threshold, evaluated: result.value.sensitivity.evaluated }
}

try { process.stdout.write(`SF_WP13_RESTART_PROBE:${JSON.stringify(await readBound())}\n`) }
finally { await store.dispose() }

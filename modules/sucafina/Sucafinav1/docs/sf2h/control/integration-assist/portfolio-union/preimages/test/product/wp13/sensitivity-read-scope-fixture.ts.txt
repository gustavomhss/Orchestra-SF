import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createCriterionResultBindings } from "../../../product/decisions/criterion-rules.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPortfolioCoveragePreview } from "../../../product/portfolio/coverage-preview.ts"
import { createPlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"
import { createPersistentSensitivityPort } from "../../../product/portfolio/sensitivity-store.ts"
import { createPortfolioProofVerifier } from "../../../product/portfolio/verification.ts"
import type { createPortfolioCoverageFixture } from "./coverage-preview-fixture.ts"

/** Real Planner/C08/rule composition shared by the full replay and scope counterexamples.
 * The private scope uses this fixture's actual LocalStore; grants and evidence stay fresh. */
export async function persistedServices(fixture: Awaited<ReturnType<typeof createPortfolioCoverageFixture>>, training: string, options: { readScopeHost?: NonNullable<Parameters<typeof createPortfolioProofVerifier>[0]["sensitivityReadScope"]> } = {}) {
  const writes = new WeakSet<object>()
  const identity = { installationId: fixture.context.binding.installationId, projectId: fixture.context.binding.projectId, principalRef: fixture.context.binding.principalRef, policyVersion: fixture.context.binding.policyVersion, accessRevision: fixture.context.binding.accessRevision }
  const state = createSfProductState({ persistence: fixture.store, proposalCoverageWrites: writes, createId: () => "wp13-coverage-state", resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }), authorize: async (request) => request === fixture.request && await fixture.host.revalidate(fixture.context) ? identity : undefined })
  const sequence = { value: 0 }
  const results = createSfDecisionResultStore({ state, host: fixture.host, authorizeCase: async (decision, context) => decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation && decision.participants.includes(context.binding.principalRef) && await fixture.host.revalidate(context), verifySources: async (_value, refs, context) => {
    const evidence = await fixture.coverageEvidence(refs, context)
    return !!evidence && refs.every((ref) => evidence.some((item) => item.state === "fresh" && item.accessRevision === context.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(ref)))
  }, createId: () => `wp13-certified-${training}-${++sequence.value}`, now: () => "2026-11-13T00:00:00Z" })
  const coveragePreview = createPortfolioCoveragePreview({ units: fixture.issuer, preview: fixture.preview, resolveAuthority: fixture.resolveAuthority })
  const exactThreshold: NonNullable<Parameters<typeof createPlannerSensitivity>[0]["exactThreshold"]> = (request, binding, context) => fixture.exact(request, binding.baselineRef, context)
  const sensitivity = createPlannerSensitivity({ results, resolve: fixture.issuer.resolve, revalidate: fixture.issuer.revalidate, preview: fixture.preview, coveragePreview, exactThreshold, idempotencyKey: async (digest) => `wp13-certified-samples:${training}:${digest}` })
  const transactionAll = fixture.store.transactionAll?.bind(fixture.store)
  if (!transactionAll) throw new Error("The C08 fixture requires durable multi-surface transaction support")
  const sourceFences = (snapshots: Readonly<Record<"dashboard" | "planner" | "procurement", Snapshot>>) => ({ dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) })
  const readSourceFences = async (context: TrustedDomainContext) => {
    if (!await fixture.host.revalidate(context)) return undefined
    const current = fixture.store.currentSnapshots?.()
    return current ? sourceFences(current) : transactionAll(async (snapshots) => ({ commit: false, value: sourceFences(snapshots) }))
  }
  const readScopeHost = options.readScopeHost ?? fixture.host
  if (readScopeHost.persistence !== fixture.store) throw new Error("The sensitivity read scope must use the same real LocalStore")
  const verifier = createPortfolioProofVerifier({ cases: fixture.cases, planner: fixture.plannerWithCriteria, sources: fixture.sources, evidence: fixture.evidence, results, revalidate: fixture.host.revalidate, readSourceFences, lockedSourceFences: () => {
    const snapshots = fixture.store.currentSnapshots?.()
    return snapshots ? sourceFences(snapshots) : undefined
  }, caseFor: async () => ({ status: "ok", value: fixture.caseRef }), idempotencyKey: async (digest) => `wp13-certified:${training}:${digest}`, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "human-choice-required" }) }, createReceipt: async () => undefined, candidateCoverageRefFor: async () => ({ status: "unavailable", reason: "portfolio-candidates-not-requested" }), revalidateAnalysis: async () => false, units: fixture.issuer, sensitivityPreview: fixture.preview, coveragePreview, exactThreshold, sensitivityReadScope: readScopeHost })
  const bindings = createCriterionResultBindings({ state, host: fixture.host, rules: fixture.rules, results, authorizeCase: async (decision, context) => decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation && await fixture.host.revalidate(context), verifyBinding: (binding, _rule, result, context) => verifier.verifySensitivity(binding, result, context), verifySnapshot: (snapshot, binding, _rule, context) => verifier.verifySnapshot(snapshot, binding, context), operationIdentity: () => `wp13-certified-binding:${training}`, proposalCoverageWrites: writes, now: () => "2026-11-13T00:00:00Z" })
  const persistent = createPersistentSensitivityPort({ portfolio: { evaluate: async () => ({ status: "unavailable", reason: "portfolio-not-requested" }), sensitivity }, results, bindings, resolveBinding: fixture.issuer.resolve, idempotencyKey: async (digest) => `wp13-certified-result:${training}:${digest}` })
  return { state, results, bindings, verifier, sensitivity, persistent, readScopeHost }
}

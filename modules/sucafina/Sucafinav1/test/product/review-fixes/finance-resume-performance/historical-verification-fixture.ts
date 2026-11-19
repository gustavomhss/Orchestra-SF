import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { sfRunSourceFence } from "../../../../product/ai/run-store.ts"
import { createSfDecisionResultStore } from "../../../../product/decisions/result-store.ts"
import type { StoredDecisionResult } from "../../../../product/decisions/result-store.ts"
import { createPortfolioCoveragePreview } from "../../../../product/portfolio/coverage-preview.ts"
import { createPlannerSensitivity } from "../../../../product/portfolio/planner-sensitivity.ts"
import { createPortfolioProofVerifier } from "../../../../product/portfolio/verification.ts"
import { createPortfolioCoverageFixture } from "../../wp13/coverage-preview-fixture.ts"
import { persistedServices } from "../../wp13/sensitivity-read-scope-fixture.ts"

const training = "finance-historical-pairs"

/** All financial anchors and the binding are produced and reopened by the real
 * persistent flow. The tests retain historical inputs, never a replay grant. */
export async function historicalPairAnchor() {
  const fixture = await createPortfolioCoverageFixture("omitted")
  try {
    const services = await persistedServices(fixture, training)
    const request: SensitivityRequest = { ...fixture.sensitivityRequest,
      parameterBounds: { ...fixture.sensitivityRequest.parameterBounds, steps: 1 } }
    const evaluated = await services.persistent.evaluateAndStore(request, fixture.caseRef, fixture.context)
    if (evaluated.status !== "ok") throw new Error("Real persistent sensitivity unavailable: " + JSON.stringify(evaluated))
    const resultRef = evaluated.value.sensitivityResultRef
    const binding = await services.bindings.read({ caseRef: fixture.caseRef, resultRef }, fixture.context)
    const stored = await services.results.read({ kind: "sensitivity", resultRef }, fixture.context)
    if (binding.status !== "ok" || stored.status !== "ok" || stored.value.kind !== "sensitivity")
      throw new Error("Real sensitivity binding/result unavailable")
    if (binding.value.resultDigest !== stored.value.resultDigest || binding.value.requestDigest !== digestSfValue(request))
      throw new Error("Real sensitivity binding/result mismatch")
    return { fixture, services, request, binding: structuredClone(binding.value), stored: structuredClone(stored.value) }
  } catch (error) { await fixture.cleanup(); throw error }
}

export type HistoricalPairAnchor = Awaited<ReturnType<typeof historicalPairAnchor>>
export type PairSite = "verifier-initial" | "verifier-final" | "sensitivity-final"
type HistoricalResult = PortResult<StoredDecisionResult>
type SnapshotObservation = { kind: "batch" | "scalar"; ordinal: number; references: readonly string[] }

/** This probe wraps actual C08 reads after setup. Units and preview use the
 * fixture's separate state facade and are intentionally outside these counts. */
export function historicalPairProbe(anchor: HistoricalPairAnchor, mode: "canonical" | "wrapper") {
  const { fixture, services, request, binding, stored } = anchor
  const references = [request.scenarioRef, fixture.baselineRef]
  const callbacks = { authorizeCase: 0, verifySources: 0, revalidate: 0 }
  const scalarCalls: string[] = []
  const snapshots: SnapshotObservation[] = []
  const hooks: {
    afterSnapshot?: (observation: SnapshotObservation) => void | Promise<void>
    afterScalar?: (reference: string, ordinal: number, result: HistoricalResult) => HistoricalResult | undefined | Promise<HistoricalResult | undefined>
  } = {}
  let batchSnapshots = 0, scalarSnapshots = 0

  const observedReference = (value: unknown): string | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
    const pair = value as { stored?: { resultRef?: unknown }; current?: unknown }
    return pair.current && typeof pair.stored?.resultRef === "string" && references.includes(pair.stored.resultRef)
      ? pair.stored.resultRef : undefined
  }
  const read = services.state.read
  const observedRead: typeof read = async (transport, namespace, select) => {
    // Preserve the exact selector, including C08's private selective-reader
    // identity. Inspect only its successful detached return value.
    const found = await read(transport, namespace, select)
    if (namespace === "cases" && found.status === "ok") {
      const value: unknown = found.value
      let observation: SnapshotObservation | undefined
      if (Array.isArray(value) && value.length === 2 &&
        value.every((entry, index) => observedReference(entry) === references[index])) {
        observation = { kind: "batch", ordinal: ++batchSnapshots, references: [...references] }
      } else {
        const reference = observedReference(value)
        if (reference) observation = { kind: "scalar", ordinal: ++scalarSnapshots, references: [reference] }
      }
      if (observation) {
        snapshots.push(observation)
        await hooks.afterSnapshot?.(observation)
      }
    }
    return found
  }
  services.state.read = observedRead

  // The same authorization/source callbacks as persistedServices, with counters.
  // Only this real store's historical function is borrowed; all writes and other
  // result operations still use services.results on the same SQLite state.
  const historical = createSfDecisionResultStore({
    state: services.state,
    host: { ...fixture.host, revalidate: async (context) => {
      callbacks.revalidate++
      return fixture.host.revalidate(context)
    } },
    authorizeCase: async (decision, context) => {
      callbacks.authorizeCase++
      return decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation &&
        decision.participants.includes(context.binding.principalRef) && await fixture.host.revalidate(context)
    },
    verifySources: async (_value, refs, context) => {
      callbacks.verifySources++
      const evidence = await fixture.coverageEvidence(refs, context)
      return !!evidence && refs.every((ref) => evidence.some((item) => item.state === "fresh" &&
        item.accessRevision === context.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(ref)))
    },
    createId: () => { throw new Error("The historical observation store must not write") },
    now: () => "2026-11-13T00:00:00Z",
  })
  const scalar = historical.readHistoricalScenario
  const results: typeof services.results = {
    ...services.results,
    readHistoricalScenario: mode === "canonical" ? scalar : async (input, context) => {
      const ordinal = scalarCalls.push(input.resultRef)
      const found = await scalar(input, context)
      return await hooks.afterScalar?.(input.resultRef, ordinal, found) ?? found
    },
  }
  const coveragePreview = createPortfolioCoveragePreview({ units: fixture.issuer, preview: fixture.preview, resolveAuthority: fixture.resolveAuthority })
  const exactThreshold: NonNullable<Parameters<typeof createPlannerSensitivity>[0]["exactThreshold"]> =
    (input, current, context) => fixture.exact(input, current.baselineRef, context)
  const sensitivityInput: Parameters<typeof createPlannerSensitivity>[0] = {
    results, resolve: fixture.issuer.resolve, revalidate: fixture.issuer.revalidate, preview: fixture.preview,
    coveragePreview, exactThreshold, idempotencyKey: async (digest) => "wp13-certified-samples:" + training + ":" + digest,
  }
  const sensitivity = createPlannerSensitivity(sensitivityInput)
  const transactionAll = fixture.store.transactionAll?.bind(fixture.store)
  if (!transactionAll) throw new Error("The real Finance fixture requires multi-surface transactions")
  const sourceFences = (current: Readonly<Record<"dashboard" | "planner" | "procurement", Snapshot>>) => ({
    dashboard: sfRunSourceFence(current.dashboard), planner: sfRunSourceFence(current.planner), procurement: sfRunSourceFence(current.procurement),
  })
  const readSourceFences = async (context: TrustedDomainContext) => {
    if (!await fixture.host.revalidate(context)) return undefined
    const current = fixture.store.currentSnapshots?.()
    return current ? sourceFences(current) : transactionAll(async (snapshots) => ({ commit: false, value: sourceFences(snapshots) }))
  }
  const verifierInput: Parameters<typeof createPortfolioProofVerifier>[0] = {
    cases: fixture.cases, planner: fixture.plannerWithCriteria, sources: fixture.sources, evidence: fixture.evidence,
    results, revalidate: fixture.host.revalidate, readSourceFences,
    lockedSourceFences: () => {
      const current = fixture.store.currentSnapshots?.()
      return current ? sourceFences(current) : undefined
    },
    caseFor: async () => ({ status: "ok", value: fixture.caseRef }),
    idempotencyKey: async (digest) => "wp13-certified:" + training + ":" + digest,
    decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "human-choice-required" }) },
    createReceipt: async () => undefined,
    candidateCoverageRefFor: async () => ({ status: "unavailable", reason: "portfolio-candidates-not-requested" }),
    revalidateAnalysis: async () => false, units: fixture.issuer, sensitivityPreview: fixture.preview,
    coveragePreview, exactThreshold, sensitivityReadScope: fixture.host,
  }
  const verifier = createPortfolioProofVerifier(verifierInput)
  const verify = () => verifier.verifySensitivity(structuredClone(binding), structuredClone(stored), fixture.context)
  const evaluate = () => sensitivity(structuredClone(request), fixture.context)
  return {
    hooks, verify, evaluate,
    run: async (site: PairSite) => site === "sensitivity-final" ? (await evaluate()).status === "ok" : verify(),
    swapOwner: (site: PairSite) => {
      if (site === "sensitivity-final") sensitivityInput.results = { ...sensitivityInput.results }
      else verifierInput.results = { ...verifierInput.results }
    },
    fence: () => fixture.store.transaction("planner", async (snapshot) =>
      ({ commit: false, value: verifier.verifySnapshot(snapshot, binding, fixture.context) })),
    stats: () => structuredClone({ batchSnapshots, scalarSnapshots, scalarCalls, callbacks, snapshots }),
    close: () => { if (services.state.read === observedRead) services.state.read = read },
  }
}

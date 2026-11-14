import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { CostCoverageEntry, ScenarioResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { createDecisionMutations } from "../../../../modules/sucafina/Sucafinav1/product/decisions/mutations.ts"
import { reassessScenarioCoverage } from "../../../../modules/sucafina/Sucafinav1/product/decisions/cost-coverage.ts"
import { supportsCoverageClassification } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import type { CoverageClassification } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type MutationInput = Parameters<typeof createDecisionMutations>[0]
type Promotion = Parameters<ReturnType<typeof createDecisionMutations>["addAlternative"]>[0]
type Evidence = NonNullable<MutationInput["coverageEvidence"]>
type PromotionRun = { incoming: Promotion; inputDigest: string; call: TrustedDomainContext; source: Request;
  binding: string; open: boolean; allocated: boolean; identity?: { id: string; version: number } }
const same = (a: unknown, b: unknown) => digestSfValue(a) === digestSfValue(b)
const unavailable = () => ({ status: "unavailable" as const, reason: "promotion-coverage-authority-unavailable" })

/** Reassess the actual scenario using the human classification, then fence the same proof at C08 commit. */
export function createSfPortfolioCoverage(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  verifyIntent: MutationInput["verifyMutation"]
}) {
  const { authority, business } = input
  const host = authority.host
  const execution = new AsyncLocalStorage<PromotionRun>()
  const running = new WeakMap<TrustedDomainContext, PromotionRun>()
  let active = true
  let selections = new WeakMap<TrustedDomainContext, { value: Promotion; source: Request; binding: string }>()
  let classifications = new WeakMap<object, CoverageClassification>()
  let proofs = new WeakMap<TrustedDomainContext, { selection: Promotion; source: Request; binding: string; state: string;
    sources: NonNullable<Awaited<ReturnType<typeof business.readSourceFences>>>; expected: ScenarioResult; basis: CoverageClassification["basis"]; run?: PromotionRun }>()
  const binding = (call: TrustedDomainContext) => digestSfValue([call.kind, call.binding])
  const currentRun = (run: PromotionRun) => active && run.open && execution.getStore() === run && running.get(run.call) === run &&
    host.requestFor(run.call) === run.source && !run.source.signal.aborted && run.binding === binding(run.call) &&
    run.inputDigest === digestSfValue(run.incoming)
  const remember = (value: unknown, call: TrustedDomainContext) => {
    if (!active || call.kind !== "ui" || !value || typeof value !== "object" || Array.isArray(value)) return false
    const fields = value as Record<string, unknown>
    const ref = fields.caseRef
    const selected = decodeSfOperationInput("sf_scenario_simulate", fields.scenario)
    if (!ref || typeof ref !== "object" || Array.isArray(ref) || !selected.ok || typeof fields.title !== "string" || !fields.title.trim() ||
      typeof fields.coverageRef !== "string" || !fields.coverageRef.trim()) return false
    const item = ref as Record<string, unknown>
    if (typeof item.id !== "string" || !item.id.trim() || typeof item.incarnation !== "string" || !item.incarnation.trim() ||
      typeof item.version !== "number" || !Number.isSafeInteger(item.version) || item.version < 1) return false
    let alternativeRef: Promotion["alternativeRef"]
    if (fields.alternativeRef !== undefined) {
      if (!fields.alternativeRef || typeof fields.alternativeRef !== "object" || Array.isArray(fields.alternativeRef)) return false
      const alternative = fields.alternativeRef as Record<string, unknown>
      if (typeof alternative.id !== "string" || !alternative.id.trim() || typeof alternative.version !== "number" || !Number.isSafeInteger(alternative.version) || alternative.version < 1) return false
      alternativeRef = { id: alternative.id, version: alternative.version }
    }
    const source = host.requestFor(call)
    const copy: Promotion = { caseRef: { id: item.id, incarnation: item.incarnation, version: item.version }, title: fields.title,
      scenario: selected.value, coverageRef: fields.coverageRef, ...(alternativeRef ? { alternativeRef } : {}) }
    if (!source || source.signal.aborted || !same(copy, value)) return false
    selections.set(call, { value: structuredClone(copy), source, binding: binding(call) })
    proofs.delete(call)
    return true
  }
  const readState = async (selection: Promotion, call: TrustedDomainContext) => {
    const source = host.requestFor(call)
    if (!source || source.signal.aborted || !await host.revalidate(call)) return undefined
    const actorMatches = (actor: { principalRef: string; accessRevision: string; policyVersion: string }) =>
      actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
    const current = await authority.state.read(source, "cases", (state, actor) => actorMatches(actor) ? state.cases[selection.caseRef.id] : undefined)
    const preferences = await authority.state.read(source, "preferences", (state, actor) => actorMatches(actor) ? state.preferences : undefined)
    if (current.status !== "ok" || !current.value || !current.value.participants.includes(call.binding.principalRef) ||
      !same({ id: current.value.id, incarnation: current.value.incarnation, version: current.value.version }, selection.caseRef) || preferences.status !== "ok" || !preferences.value) return undefined
    return digestSfValue({ case: current.value, preferences: preferences.value })
  }
  const refsFor = (scenario: ScenarioResult, classification: CoverageClassification, entries: readonly CostCoverageEntry[]) =>
    [...classification.basis.sourceRefs, ...scenario.sourceRefs, ...entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      .filter((ref, index, refs) => refs.findIndex((other) => same(other, ref)) === index)
  const fresh = async (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) => {
    const values = await business.context.context({ refs }, call)
    return values.length === refs.length && values.every((value, index) => value.state === "fresh" && !!value.currentRef && !!value.authorizedProjection &&
      value.accessRevision === call.binding.accessRevision && same(value.ref, refs[index]) && same(value.currentRef, value.ref)) && await host.revalidate(call) ? values : undefined
  }
  const evidence: Evidence = {
    entries: async (scenario, baseline, call) => {
      const held = selections.get(call)
      const run = execution.getStore()
      if (!active || !held || held.source !== host.requestFor(call) || held.source.signal.aborted || held.binding !== binding(call) ||
        run && (run.call !== call || !currentRun(run)) || !await host.revalidate(call)) return unavailable()
      const before = await readState(held.value, call)
      const sources = await business.readSourceFences(call)
      const coverage = await business.plannerSources.resolveForecastCoverage(held.value.coverageRef, call)
      const classification = await business.baselineCoverage.readClassification(held.value.scenario.baseRef, call)
      if (!before || !sources || coverage.status !== "ok" || classification.status !== "ok" || !same(coverage.value.assessment, baseline) ||
        !same(coverage.value.basis, classification.value.basis) || classification.value.source.refId !== held.value.scenario.baseRef ||
        baseline.entries.some((entry) => entry.status === "not-applicable") || baseline.entries.some((entry) => entry.status === "included" &&
          !classification.value.mappings.some((mapping) => same(mapping.entry, entry)))) return unavailable()
      const entries: readonly CostCoverageEntry[] = structuredClone(baseline.entries)
      for (const entry of entries) if (entry.status !== "pending") classifications.set(entry, classification.value)
      const refs = refsFor(scenario, classification.value, entries)
      const resolved = await fresh(refs, call)
      if (!resolved) return unavailable()
      const expected = await reassessScenarioCoverage({ scenario, basis: coverage.value.basis, baseline, entries,
        resolveEvidence: async (wanted) => same(wanted, refs) ? resolved : [], supports: evidence.supports })
      const after = await readState(held.value, call)
      const latest = await business.readSourceFences(call)
      if (!expected || before !== after || !same(sources, latest) || selections.get(call) !== held || held.binding !== binding(call) ||
        held.source.signal.aborted || !await host.revalidate(call)) return unavailable()
      proofs.set(call, { selection: held.value, source: held.source, binding: held.binding, state: before, sources, expected, basis: coverage.value.basis,
        ...(run ? { run } : {}) })
      return { status: "ok", value: entries }
    },
    resolve: async (refs, call) => {
      const proof = proofs.get(call)
      if (!active || !proof || proof.source !== host.requestFor(call) || proof.source.signal.aborted || proof.binding !== binding(call) ||
        proof.run && !currentRun(proof.run) ||
        await readState(proof.selection, call) !== proof.state || !same(await business.readSourceFences(call), proof.sources)) return []
      return await fresh(refs, call) ?? []
    },
    supports: (entry, resolutions) => {
      const classification = classifications.get(entry)
      return !!classification && supportsCoverageClassification(classification, entry, resolutions)
    },
    verifySnapshot: (snapshot, result, basis, call) => {
      const proof = proofs.get(call)
      return active && !!proof && proof.source === host.requestFor(call) && !proof.source.signal.aborted && proof.binding === binding(call) &&
        (!proof.run || currentRun(proof.run)) &&
        same(result, proof.expected) && same(basis, proof.basis) && business.lockedDecisionStateDigest(proof.selection.caseRef.id) === proof.state &&
        same(business.lockedSourceFences(), proof.sources) && sfRunSourceFence(snapshot) === proof.sources.planner &&
        input.verifyIntent(snapshot, "add-alternative", proof.selection, call)
    },
  }
  const prepareNoop = async (request: ScenarioRequest, observed: PortResult<ScenarioResult>, call: TrustedDomainContext): Promise<PortResult<ScenarioResult>> => {
    if (observed.status !== "ok" || request.operations.length || request.assumptions.length) return observed
    const run = execution.getStore(), held = selections.get(call)
    if (!run || run.call !== call || !currentRun(run) || !run.identity || !held || held.source !== run.source || held.binding !== run.binding ||
      !same(held.value, run.incoming) || !same(request, held.value.scenario)) return unavailable()
    const result = structuredClone(observed)
    const coverage = await business.plannerSources.resolveForecastCoverage(held.value.coverageRef, call)
    if (coverage.status !== "ok") return coverage
    if (!same(result.value.costCoverage, coverage.value.assessment)) return result
    // The foreign mutator allocates this exact identity before asking Planner.
    // Reassess its otherwise unchanged result before C08, without altering the
    // source scenario or allowing verifySnapshot to ignore any identity field.
    const identity = run.identity
    const attributed: ScenarioResult = result.value.comparisonStatus === "complete"
      ? { ...result.value, costCoverage: { ...result.value.costCoverage, alternativeId: identity.id, alternativeVersion: identity.version } }
      : { ...result.value, costCoverage: { ...result.value.costCoverage, alternativeId: identity.id, alternativeVersion: identity.version } }
    const entries = await evidence.entries(attributed, coverage.value.assessment, call)
    if (entries.status !== "ok") return entries
    const proof = proofs.get(call)
    if (!currentRun(run) || !proof || !same(proof.expected, attributed) || !same(proof.basis, coverage.value.basis) ||
      selections.get(call) !== held || !await host.revalidate(call) || !currentRun(run)) return unavailable()
    return structuredClone(result)
  }
  const createMutationId = () => {
    const id = randomUUID(), run = execution.getStore()
    if (run && currentRun(run) && selections.has(run.call) && !run.incoming.alternativeRef && !run.allocated) {
      run.identity = { id, version: 1 }
      run.allocated = true
    }
    return id
  }
  const runPromotion = async <Value>(incoming: Promotion, call: TrustedDomainContext, work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
    const source = host.requestFor(call)
    if (call.kind !== "ui" || !source || source.signal.aborted) return { status: "denied", reason: "human-promotion-required" }
    if (!active || running.has(call)) return unavailable()
    const run: PromotionRun = { incoming, inputDigest: digestSfValue(incoming), call, source, binding: binding(call), open: true, allocated: false,
      ...(incoming.alternativeRef ? { identity: { id: incoming.alternativeRef.id, version: incoming.alternativeRef.version + 1 } } : {}) }
    running.set(call, run)
    return execution.run(run, async () => {
      try {
        const result = await work()
        return currentRun(run) ? result : unavailable()
      } finally {
        run.open = false
        if (running.get(call) === run) running.delete(call)
        selections.delete(call)
        proofs.delete(call)
      }
    })
  }
  return { remember, evidence, prepareNoop, createMutationId, runPromotion,
    dispose: () => { active = false; selections = new WeakMap(); proofs = new WeakMap(); classifications = new WeakMap() } }
}

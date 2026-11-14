import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { CostCoverageEntry, ScenarioResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
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
  let active = true
  let selections = new WeakMap<TrustedDomainContext, { value: Promotion; source: Request; binding: string }>()
  let classifications = new WeakMap<object, CoverageClassification>()
  let proofs = new WeakMap<TrustedDomainContext, { selection: Promotion; source: Request; binding: string; state: string;
    sources: NonNullable<Awaited<ReturnType<typeof business.readSourceFences>>>; expected: ScenarioResult; basis: CoverageClassification["basis"] }>()
  const binding = (call: TrustedDomainContext) => digestSfValue([call.kind, call.binding])
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
      if (!active || !held || held.source !== host.requestFor(call) || held.source.signal.aborted || held.binding !== binding(call) || !await host.revalidate(call)) return unavailable()
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
      proofs.set(call, { selection: held.value, source: held.source, binding: held.binding, state: before, sources, expected, basis: coverage.value.basis })
      return { status: "ok", value: entries }
    },
    resolve: async (refs, call) => {
      const proof = proofs.get(call)
      if (!active || !proof || proof.source !== host.requestFor(call) || proof.source.signal.aborted || proof.binding !== binding(call) ||
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
        same(result, proof.expected) && same(basis, proof.basis) && business.lockedDecisionStateDigest(proof.selection.caseRef.id) === proof.state &&
        same(business.lockedSourceFences(), proof.sources) && sfRunSourceFence(snapshot) === proof.sources.planner &&
        input.verifyIntent(snapshot, "add-alternative", proof.selection, call)
    },
  }
  return { remember, evidence, dispose: () => { active = false; selections = new WeakMap(); proofs = new WeakMap(); classifications = new WeakMap() } }
}

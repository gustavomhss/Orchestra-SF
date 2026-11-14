import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfStoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { ChoiceRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { PortfolioBinding } from "../../../../modules/sucafina/Sucafinav1/product/decisions/portfolio-bindings.ts"
import { createDecisionCandidateResolver } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/candidates.ts"
import { createPortfolioCandidateHistoryReader } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/proof.ts"
import { createPortfolioHistoricalProvenance } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/history-provenance.ts"
import type { PortfolioCandidate } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/port.ts"
import type { PortfolioReconciliationHost, PortfolioReconciliationRequest } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/reconciliation.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioAuthority } from "./portfolio-authority.ts"

type CaseRef = PortfolioReconciliationRequest["caseRef"]
type StoredPortfolio = Extract<SfStoredDecisionResult, { kind: "portfolio" }>
export type SfPortfolioReconciliationChoice = { request: PortfolioReconciliationRequest; label: string; originalCaseVersion: number }
type Catalog = { choices: readonly SfPortfolioReconciliationChoice[]; unavailable: number }

/** Private C08 readers supply provenance; browser identifiers never supply a binding or candidate proof. */
export function createSfPortfolioReconciliationServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  registries: Pick<ReturnType<typeof createSfPortfolioAuthority>, "portfolioBindings" | "selection">
}) {
  const { authority, business, registries } = input
  const host = authority.host
  const candidate = createDecisionCandidateResolver(business.cases)
  const historicalCandidate = createPortfolioCandidateHistoryReader({ state: authority.state, cases: business.cases,
    results: business.results, evidence: business.context, host })
  const readPortfolio: PortfolioReconciliationHost["readPortfolio"] = async (incoming, call) => {
    try {
      const request = structuredClone(incoming), expected = digestSfValue(request)
      const source = host.requestFor(call), binding = digestSfValue([call.kind, call.binding])
      const transport = source && requestDigest(source)
      const intact = () => !!source && host.requestFor(call) === source && !source.signal.aborted && requestDigest(source) === transport &&
        binding === digestSfValue([call.kind, call.binding]) && expected === digestSfValue(incoming) && expected === digestSfValue(request)
      const denied = (): PortResult<never> => ({ status: "denied", reason: "portfolio-reconciliation-authority-changed" })
      if (!source || !intact() || !await host.revalidate(call) || !intact()) return denied()
      const selected = await business.resolveCase(call)
      if (selected.status !== "ok" || digestSfValue(selected.value) !== digestSfValue(request.caseRef)) return denied()
      const load = () => authority.state.read(source, "cases", (state, actor) => {
        const decision = state.cases[request.caseRef.id]
        const stored = state.decisionResults?.[request.resultRef]
        return intact() && actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision &&
          actor.policyVersion === call.binding.policyVersion && decision && decision.incarnation === request.caseRef.incarnation &&
          decision.version === request.caseRef.version && decision.participants.includes(actor.principalRef) && stored?.kind === "portfolio"
          ? structuredClone({ decision, stored }) : undefined
      })
      const first = await load()
      if (first.status !== "ok" || !first.value || !intact()) return denied()
      const stored = first.value.stored
      if (stored.schema !== "sf-decision-result-v1" || stored.resultRef !== request.resultRef || stored.caseRef.id !== request.caseRef.id ||
        stored.caseRef.incarnation !== request.caseRef.incarnation || !Number.isSafeInteger(stored.caseRef.version) || stored.caseRef.version < 1 ||
        stored.caseRef.version > request.caseRef.version || stored.resultDigest !== digestSfValue(stored.result) ||
        !/^[a-f0-9]{64}$/.test(stored.requestDigest) || !stored.sourceRefs.length || !decodeSfOperationOutput("sf_portfolio_evaluate", stored.result).ok)
        return { status: "unavailable", reason: "portfolio-reconciliation-origin-invalid" }
      const fresh = stored.caseRef.version === request.caseRef.version
      const readBinding = async (scope: { caseRef: CaseRef; resultRef: string }, context: TrustedDomainContext): Promise<PortResult<{ binding: PortfolioBinding; selection: unknown }>> => {
        if (context !== call || !intact() || digestSfValue(scope.caseRef) !== digestSfValue(request.caseRef) || scope.resultRef !== request.resultRef) return denied()
        // Source history at owner version N/N is deliberately not admitted by
        // weakening a historical reader. The current producer must still agree.
        if (!fresh) return registries.portfolioBindings.readHistoricalBinding(scope, call)
        const found = await registries.portfolioBindings.read(scope, call)
        if (found.status !== "ok") return found
        const selection = await registries.selection.read({ caseRef: scope.caseRef }, call)
        if (selection.status !== "ok") return selection
        return intact() && selection.value.selectionDigest === found.value.proof.selectionDigest
          ? { status: "ok", value: { binding: found.value, selection: selection.value } } : denied()
      }
      const bound = await readBinding(request, call)
      if (bound.status !== "ok") return bound
      const proof = createPortfolioHistoricalProvenance({ readHistoricalBinding: readBinding,
        readHistoricalCandidate: historicalCandidate, cases: business.cases, evidence: business.context, host,
        caseFor: async (context) => context === call && intact() ? business.resolveCase(context) : denied() })
      if (!await proof(stored, call) || !intact()) return { status: "unavailable", reason: "portfolio-reconciliation-provenance-unavailable" }
      const bindingValue = bound.value.binding
      if (bindingValue.request.candidateRefs.length > 64 || bindingValue.proof.candidates.length !== bindingValue.request.candidateRefs.length ||
        new Set(bindingValue.request.candidateRefs).size !== bindingValue.request.candidateRefs.length)
        return { status: "unavailable", reason: "portfolio-reconciliation-candidates-invalid" }
      const resolved = await Promise.all(bindingValue.request.candidateRefs.map(async (ref, index): Promise<PortResult<PortfolioCandidate>> => {
        const proof = bindingValue.proof.candidates[index]
        if (!proof || proof.ref !== ref || !/^[a-f0-9]{64}$/.test(proof.digest)) return { status: "unavailable", reason: "portfolio-reconciliation-candidate-unbound" }
        const found = fresh ? await candidate(ref, call) : await historicalCandidate({ ref, candidateDigest: proof.digest }, call)
        if (found.status !== "ok") return found
        const value = "candidate" in found.value ? found.value.candidate : found.value
        return value.ref === ref && digestSfValue(value) === proof.digest && digestSfValue(value.operations) === digestSfValue(value.scenario.operations)
          ? { status: "ok", value: structuredClone(value) } : { status: "unavailable", reason: "portfolio-reconciliation-candidate-changed" }
      }))
      const failure = resolved.find((result) => result.status !== "ok")
      if (failure && failure.status !== "ok") return failure
      const all = resolved.flatMap((result) => result.status === "ok" ? [result.value] : [])
      const candidates = selectedCandidates(bindingValue, stored, all, request.combinationId)
      if (!candidates) return { status: "unavailable", reason: "portfolio-reconciliation-combination-unbound" }
      const again = await readBinding(request, call)
      const scope = await business.resolveCase(call)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(bound.value) || scope.status !== "ok" ||
        digestSfValue(scope.value) !== digestSfValue(request.caseRef) || !await host.revalidate(call) || !intact()) return denied()
      const last = await load()
      if (last.status !== "ok" || !last.value || digestSfValue(last.value) !== digestSfValue(first.value) || !intact())
        return { status: "stale", reason: "portfolio-reconciliation-origin-changed" }
      return { status: "ok", value: { stored: structuredClone(stored), binding: structuredClone(bindingValue), candidates } }
    } catch { return { status: "unavailable", reason: "portfolio-reconciliation-origin-unavailable" } }
  }
  const list = async (caseRef: CaseRef, call: TrustedDomainContext): Promise<PortResult<Catalog>> => {
    const source = host.requestFor(call), binding = digestSfValue([call.kind, call.binding]), expected = digestSfValue(caseRef)
    const transport = source && requestDigest(source)
    const intact = () => !!source && host.requestFor(call) === source && !source.signal.aborted && requestDigest(source) === transport &&
      binding === digestSfValue([call.kind, call.binding]) && expected === digestSfValue(caseRef)
    if (!source || !intact() || !await host.revalidate(call)) return { status: "denied", reason: "portfolio-reconciliation-authority-changed" }
    const load = () => authority.state.read(source, "cases", (state, actor) => {
      const decision = state.cases[caseRef.id]
      return intact() && actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision &&
        actor.policyVersion === call.binding.policyVersion && decision && decision.incarnation === caseRef.incarnation && decision.version === caseRef.version &&
        decision.participants.includes(actor.principalRef) ? structuredClone({ decision, portfolios: Object.values(state.decisionResults ?? {})
          .filter((record): record is StoredPortfolio => record.kind === "portfolio" && record.caseRef.id === caseRef.id && record.caseRef.incarnation === caseRef.incarnation && record.caseRef.version <= caseRef.version) }) : undefined
    })
    const first = await load()
    if (first.status !== "ok" || !first.value || !intact()) return { status: "denied", reason: "portfolio-reconciliation-case-unavailable" }
    if (first.value.portfolios.length > 32 || first.value.decision.choices.length > 128) return { status: "needs-input", reason: "portfolio-reconciliation-catalog-limit" }
    if (first.value.portfolios.reduce((count, stored) => count + stored.result.combinations.length, 0) > 256)
      return { status: "needs-input", reason: "portfolio-reconciliation-catalog-limit" }
    const plans: { stored: StoredPortfolio; combination: StoredPortfolio["result"]["combinations"][number]; choice: ChoiceRecord }[] = []
    for (const stored of first.value.portfolios) for (const combination of stored.result.combinations) for (const choice of first.value.decision.choices) {
      if (!combination.analysis || choice.comparison.alternativeResultRef !== combination.analysis.scenarioResultRef ||
        digestSfValue(choice.comparison) !== digestSfValue(combination.analysis.comparison) || digestSfValue(choice.result) !== digestSfValue(combination.analysis.scenario)) continue
      if (plans.length >= 64) return { status: "needs-input", reason: "portfolio-reconciliation-catalog-limit" }
      plans.push({ stored, combination, choice })
    }
    const choices: SfPortfolioReconciliationChoice[] = []
    let unavailable = 0
    for (const { stored, combination, choice } of plans) {
      const found = await readPortfolio({ caseRef, resultRef: stored.resultRef, combinationId: combination.id }, call)
      if (found.status === "denied") return found
      if (found.status !== "ok") { unavailable++; continue }
      choices.push({ request: { caseRef: structuredClone(caseRef), portfolioResultRef: stored.resultRef, combinationId: combination.id, choiceId: choice.id },
        label: `Escolha de ${choice.at} · composição registrada em ${stored.createdAt}`, originalCaseVersion: stored.caseRef.version })
    }
    if (!await host.revalidate(call) || !intact()) return { status: "denied", reason: "portfolio-reconciliation-authority-changed" }
    const last = await load()
    if (last.status !== "ok" || !last.value || digestSfValue(last.value) !== digestSfValue(first.value) || !intact()) return { status: "stale", reason: "portfolio-reconciliation-catalog-changed" }
    return { status: "ok", value: { choices, unavailable } }
  }
  // No materiality value is invented here. Until a registered condition can be
  // mapped to real Planner before/after components, the producer returns unknown.
  return { readPortfolio, list }
}

/** Reconstruct only the producer's bounded combination identities, never financial results. */
function selectedCandidates(binding: PortfolioBinding, stored: StoredPortfolio, candidates: readonly PortfolioCandidate[], combinationId: string) {
  const limit = binding.request.explorationLimit
  if (!candidates.length || candidates.length > 64 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1024 ||
    stored.result.combinations.length > limit || stored.result.combinations.filter((item) => item.id === combinationId).length !== 1 ||
    new Set(stored.result.combinations.map((item) => item.id)).size !== stored.result.combinations.length ||
    candidates.some((candidate, index) => candidate.ref !== binding.request.candidateRefs[index])) return undefined
  const queue: number[][] = candidates.map((_, index) => [index])
  const matches: PortfolioCandidate[][] = []
  for (let position = 0; position < stored.result.combinations.length; position++) {
    const indexes = queue.shift()
    if (!indexes) return undefined
    const selected = indexes.map((index) => candidates[index]!)
    const operations = [...binding.request.operations, ...selected.flatMap((candidate) => candidate.operations)]
    const id = digestSfValue({ candidates: selected.map((candidate) => candidate.ref), operations })
    if (stored.result.combinations[position]!.id !== id) return undefined
    if (id === combinationId) matches.push(structuredClone(selected))
    for (let index = indexes[indexes.length - 1]! + 1; index < candidates.length; index++) queue.push([...indexes, index])
  }
  return matches.length === 1 ? matches[0] : undefined
}

function requestDigest(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers.entries()] }) }

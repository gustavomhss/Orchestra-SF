import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfStoredDecisionResult } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { parseCaseRef } from "../decisions/case-port.ts"
import type { PortfolioBinding } from "../decisions/portfolio-bindings.ts"

export function createPortfolioHistoricalProvenance(input: {
  readHistoricalBinding: (request: { caseRef: { id: string; incarnation: string; version: number }; resultRef: string }, context: TrustedDomainContext) => Promise<PortResult<{ binding: PortfolioBinding; selection: unknown }>>
  caseFor: (context: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>>
  cases: DecisionCasePort
  evidence: BusinessContextService
  host: Pick<DomainPortHost, "revalidate">
}) {
  return async (incoming: SfStoredDecisionResult, context: TrustedDomainContext) => {
    const stored = structuredClone(incoming)
    if (stored.kind !== "portfolio" || !stored.resultRef.trim() || !stored.requestDigest.trim() || !stored.resultDigest.trim() || !stored.sourceRefs.length) return false
    const inspect = async () => {
      const current = structuredClone(await input.caseFor(context).catch(() => undefined))
      if (!current || current.status !== "ok" || current.value.id !== stored.caseRef.id || current.value.incarnation !== stored.caseRef.incarnation || current.value.version < stored.caseRef.version) return undefined
      const bindingResult = structuredClone(await input.readHistoricalBinding({ caseRef: structuredClone(current.value), resultRef: stored.resultRef }, context).catch(() => undefined))
      if (!bindingResult || bindingResult.status !== "ok" || !bindingResult.value) return undefined
      const binding = structuredClone(bindingResult.value.binding)
      const bindingDigest = digestSfValue(Object.fromEntries(Object.entries(binding).filter(([name]) => name !== "bindingDigest")))
      if (binding.schema !== "sf-portfolio-binding-v1" || binding.bindingDigest !== bindingDigest || binding.resultRef !== stored.resultRef || binding.resultDigest !== stored.resultDigest || binding.requestDigest !== stored.requestDigest || binding.requestDigest !== digestSfValue(binding.request) || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(binding.caseRef) !== digestSfValue(stored.caseRef) || !bindingResult.value.selection || typeof bindingResult.value.selection !== "object" || !("selectionDigest" in bindingResult.value.selection) || bindingResult.value.selection.selectionDigest !== binding.proof.selectionDigest) return undefined
      const candidateRefs = binding.request.candidateRefs
      if (!candidateRefs.length || new Set(candidateRefs).size !== candidateRefs.length || binding.proof.candidates.length !== candidateRefs.length || binding.proof.candidates.some((candidate, index) => candidate.ref !== candidateRefs[index] || !/^[a-f0-9]{64}$/.test(candidate.digest)) || !binding.proof.selectionDigest.trim()) return undefined
      const candidates = await Promise.all(candidateRefs.map(async (ref, index) => {
        const match = /^portfolio-candidate:([^:]+):([1-9]\d*):([^:]+):([1-9]\d*)$/.exec(ref)
        if (!match) return undefined
        let caseRef: string
        let alternativeId: string
        try {
          caseRef = decodeURIComponent(match[1]!)
          alternativeId = decodeURIComponent(match[3]!)
        } catch { return undefined }
        if (!alternativeId || encodeURIComponent(caseRef) !== match[1] || encodeURIComponent(alternativeId) !== match[3] || !Number.isSafeInteger(Number(match[2])) || !Number.isSafeInteger(Number(match[4]))) return undefined
        const parsed = parseCaseRef(caseRef)
        if (!parsed) return undefined
        const result = await input.cases.read({ caseRef }, context).catch(() => undefined)
        if (!result || result.status !== "ok" || result.value.case.id !== parsed.id || result.value.case.incarnation !== parsed.incarnation || result.value.case.version < Number(match[2])) return undefined
        const alternatives = result.value.case.alternatives.filter((alternative) => alternative.id === alternativeId && alternative.version === Number(match[4]))
        if (alternatives.length !== 1) return undefined
        const alternative = alternatives[0]!
        const candidate = { ref, caseRef, operations: alternative.scenario.operations, scenario: alternative.scenario, result: alternative.result }
        if (digestSfValue(candidate) !== binding.proof.candidates[index]!.digest) return undefined
        return { ref, case: structuredClone(result.value.case), candidateDigest: digestSfValue(candidate) }
      }))
      if (candidates.some((candidate) => !candidate)) return undefined
      const resolutions = structuredClone(await input.evidence.context({ refs: structuredClone(stored.sourceRefs) }, context).catch(() => undefined))
      if (!resolutions || resolutions.length !== stored.sourceRefs.length || digestSfValue(resolutions.map((item) => digestSfValue(item.ref)).sort()) !== digestSfValue(stored.sourceRefs.map(digestSfValue).sort()) || resolutions.some((item) => item.accessRevision !== context.binding.accessRevision || (item.state !== "fresh" && item.state !== "historical"))) return undefined
      if (!await input.host.revalidate(context).catch(() => false)) return undefined
      return structuredClone({ binding, current: current.value, candidates, resolutions: resolutions.map((item) => ({ ref: item.ref, state: item.state, accessRevision: item.accessRevision })) })
    }
    const first = await inspect()
    if (!first) return false
    const second = await inspect()
    return !!second && digestSfValue(first) === digestSfValue(second) && await input.host.revalidate(context).catch(() => false)
  }
}

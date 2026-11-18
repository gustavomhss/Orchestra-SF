import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { ChoiceRecord, DecisionCase } from "../contracts/decisions.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort } from "../contracts/state.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { parseCaseRef } from "../decisions/case-port.ts"
import { portfolioCandidateRef } from "./candidates.ts"
import type { PortfolioCandidate } from "./port.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type HistoricalCandidate = { candidate: PortfolioCandidate; originalCaseRef: CaseRef; currentCaseRef: CaseRef; scenarioResultRef: string; provenanceDigest: string }

/** The expected digest must come from an authenticated portfolio binding or campaign, never transport input. */
export function createPortfolioCandidateHistoryReader(input: {
  state: SfProductStatePort
  cases: Pick<DecisionCasePort, "read">
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "readHistoricalScenario">
  evidence: BusinessContextService
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
}) {
  return async (incoming: { ref: string; candidateDigest: string }, context: TrustedDomainContext): Promise<PortResult<HistoricalCandidate>> => {
    try {
      const request = structuredClone(incoming)
      const selected = selector(request.ref)
      if (!selected || !/^[a-f0-9]{64}$/.test(request.candidateDigest)) return { status: "needs-input", reason: "portfolio-history-candidate-reference-invalid" }
      const source = input.host.requestFor(context)
      if (!source || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "portfolio-history-candidate-access-unavailable" }
      const inspect = async () => {
        const authorized = structuredClone(await input.cases.read({ caseRef: selected.caseRef }, context))
        if (authorized.status !== "ok") return authorized
        const decision = authorized.value.case
        if (decision.id !== selected.originalCaseRef.id || decision.incarnation !== selected.originalCaseRef.incarnation || decision.version < selected.originalCaseRef.version) return { status: "stale", reason: "portfolio-history-candidate-case-changed" } as const
        const loaded = structuredClone(await input.state.read(source, "cases", (state, authority) => {
          if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return undefined
          const current = state.cases[decision.id]
          if (!current || current.incarnation !== decision.incarnation || current.version !== decision.version || digestSfValue({ alternatives: current.alternatives, choices: current.choices, ledger: current.ledger }) !== digestSfValue({ alternatives: decision.alternatives, choices: decision.choices, ledger: decision.ledger })) return undefined
          const transactions = Object.entries(state.transactions).flatMap(([key, transaction]) => {
            if (!transactionSnapshot(key, transaction, state, selected.originalCaseRef)) return []
            const alternatives = transaction.value.alternatives.filter((alternative) => alternative.id === selected.alternativeId && alternative.version === selected.alternativeVersion)
            if (!alternatives.length) return []
            return [{ key, transaction, alternatives }]
          })
          return { currentCaseRef: { id: current.id, incarnation: current.incarnation, version: current.version }, transactions, results: Object.values(state.decisionResults ?? {}).filter((record) => record.kind === "scenario" && record.caseRef.id === selected.originalCaseRef.id && record.caseRef.incarnation === selected.originalCaseRef.incarnation && record.caseRef.version <= selected.originalCaseRef.version) }
        }))
        if (loaded.status !== "ok" || !loaded.value) return { status: "unavailable", reason: "portfolio-history-candidate-provenance-unavailable" } as const
        const candidateFrom = (value: Pick<DecisionCase["alternatives"][number], "scenario" | "result">): PortfolioCandidate => ({ ref: request.ref, caseRef: selected.caseRef, operations: value.scenario.operations, scenario: value.scenario, result: value.result })
        const matches = (candidate: PortfolioCandidate) => !!candidate.result && decodeSfOperationInput("sf_scenario_simulate", candidate.scenario).ok && decodeSfOperationOutput("sf_scenario_simulate", candidate.result).ok && candidate.result.costCoverage.alternativeId === selected.alternativeId && candidate.result.costCoverage.alternativeVersion === selected.alternativeVersion && digestSfValue(candidate) === request.candidateDigest
        if (loaded.value.transactions.some((entry) => entry.alternatives.length !== 1 || !matches(candidateFrom(entry.alternatives[0]!)))) return { status: "stale", reason: "portfolio-history-candidate-snapshot-changed" } as const
        const transaction = loaded.value.transactions[0]
        const choices = decision.choices.filter((choice) => choice.alternativeId === selected.alternativeId && choice.alternativeVersion === selected.alternativeVersion)
        const witnessed = choices.flatMap((choice) => {
          const candidate = candidateFrom(choice)
          const events = decision.ledger.filter((event) => choiceEvent(event, choice, decision))
          return matches(candidate) && events.length === 1 ? [{ choice, event: events[0]!, candidate }] : []
        })
        const candidate = transaction ? candidateFrom(transaction.alternatives[0]!) : witnessed[0]?.candidate
        if (!candidate?.result) return { status: "unavailable", reason: "portfolio-history-candidate-snapshot-unavailable" } as const
        const requestDigest = digestSfValue(candidate.scenario)
        const resultDigest = digestSfValue(candidate.result)
        const records = loaded.value.results.filter((record) => record.requestDigest === requestDigest && record.resultDigest === resultDigest && digestSfValue(record.result) === resultDigest)
        // A witnessed human choice names the original C08. Equivalent writes with a
        // different idempotency key must not replace that authenticated ancestry.
        const choiceRecords = records.filter((record) => witnessed.some(({ choice, event }) => choice.comparison.alternativeResultRef === record.resultRef && record.caseRef.version <= event.caseRef.version))
        if (witnessed.length && !choiceRecords.length) return { status: "unavailable", reason: "portfolio-history-choice-scenario-unbound" } as const
        const newest = records.length ? Math.max(...records.map((record) => record.caseRef.version)) : -1
        const latest = witnessed.length ? choiceRecords : records.filter((record) => record.caseRef.version === newest)
        if (latest.length !== 1) return { status: latest.length > 1 ? "conflict" : "unavailable", reason: latest.length > 1 ? "portfolio-history-scenario-ambiguous" : "portfolio-history-scenario-unavailable" } as const
        const record = latest[0]!
        const verified = structuredClone(await input.results.readHistoricalScenario({ resultRef: record.resultRef }, context))
        if (verified.status !== "ok") return verified
        if (verified.value.kind !== "scenario" || digestSfValue(verified.value) !== digestSfValue(record) || verified.value.caseRef.id !== selected.originalCaseRef.id || verified.value.caseRef.incarnation !== selected.originalCaseRef.incarnation || verified.value.caseRef.version > selected.originalCaseRef.version || verified.value.requestDigest !== requestDigest || verified.value.resultDigest !== resultDigest) return { status: "stale", reason: "portfolio-history-scenario-changed" } as const
        if (!transaction && !witnessed.some(({ choice, event }) => choice.comparison.alternativeResultRef === record.resultRef && record.caseRef.version <= event.caseRef.version)) return { status: "unavailable", reason: "portfolio-history-choice-scenario-unbound" } as const
        const refs = [...record.sourceRefs, ...candidate.result.sourceRefs, ...candidate.result.costCoverage.evaluatedSourceRefs, ...candidate.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...candidate.scenario.assumptions.flatMap((assumption) => assumption.evidenceRefs)].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
        if (!refs.length || refs.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref))) return { status: "unavailable", reason: "portfolio-history-candidate-evidence-invalid" } as const
        const resolutions = structuredClone(await input.evidence.context({ refs: structuredClone(refs) }, context))
        if (resolutions.length !== refs.length || digestSfValue(resolutions.map((item) => digestSfValue(item.ref)).sort()) !== digestSfValue(refs.map(digestSfValue).sort()) || resolutions.some((item) => item.accessRevision !== context.binding.accessRevision || item.state !== "fresh" && item.state !== "historical")) return { status: "denied", reason: "portfolio-history-candidate-evidence-unavailable" } as const
        if (source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "portfolio-history-candidate-access-unavailable" } as const
        const provenance = { transactions: loaded.value.transactions, choices: witnessed, scenario: record, evidence: resolutions.map((item) => ({ ref: item.ref, state: item.state, accessRevision: item.accessRevision })) }
        return { status: "ok", value: { candidate: structuredClone(candidate), originalCaseRef: selected.originalCaseRef, currentCaseRef: loaded.value.currentCaseRef, scenarioResultRef: record.resultRef, provenanceDigest: digestSfValue(provenance) } } as const
      }
      const first = await inspect()
      if (first.status !== "ok") return first
      const second = await inspect()
      if (second.status !== "ok") return second
      if (digestSfValue(first.value) !== digestSfValue(second.value) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "portfolio-history-candidate-changed" }
      return { status: "ok", value: structuredClone(second.value) }
    } catch { return { status: "unavailable", reason: "portfolio-history-candidate-unavailable" } }
  }
}

function selector(ref: string) {
  const match = /^portfolio-candidate:([^:]+):([1-9]\d*):([^:]+):([1-9]\d*)$/.exec(ref)
  if (!match) return undefined
  try {
    const caseRef = decodeURIComponent(match[1]!)
    const alternativeId = decodeURIComponent(match[3]!)
    const version = Number(match[2])
    const alternativeVersion = Number(match[4])
    const parsed = parseCaseRef(caseRef)
    if (!parsed || !alternativeId.trim() || !Number.isSafeInteger(version) || !Number.isSafeInteger(alternativeVersion) || portfolioCandidateRef({ caseRef, caseVersion: version, alternativeId, alternativeVersion }) !== ref) return undefined
    return { caseRef, originalCaseRef: { ...parsed, version }, alternativeId, alternativeVersion }
  } catch { return undefined }
}

function transactionSnapshot(key: string, transaction: SfProductState["transactions"][string], state: Readonly<SfProductState>, ref: CaseRef): transaction is SfProductState["transactions"][string] & { value: DecisionCase } {
  if (transaction.namespace !== "cases" || transaction.targetRef !== ref.id || transaction.targetIncarnation !== ref.incarnation || transaction.incarnation !== state.incarnation || !transaction.principalRef.trim() || !/^[a-f0-9]{64}$/.test(transaction.commandDigest) || !/^[a-f0-9]{64}$/.test(transaction.scopeDigest) || !Number.isSafeInteger(transaction.storageVersion) || transaction.storageVersion < 1 || transaction.storageVersion > state.versions.cases || !Number.isSafeInteger(transaction.aggregateRevision) || transaction.aggregateRevision < 1 || transaction.aggregateRevision > state.revision) return false
  try {
    const identity: unknown = JSON.parse(key)
    if (!Array.isArray(identity) || identity.length !== 4 || identity[0] !== transaction.principalRef || identity[1] !== "cases" || identity[2] !== ref.id || typeof identity[3] !== "string" || !identity[3].trim()) return false
  } catch { return false }
  const value = transaction.value as Partial<DecisionCase> | null
  return !!value && typeof value === "object" && value.id === ref.id && value.incarnation === ref.incarnation && value.version === ref.version && Array.isArray(value.alternatives)
}

function choiceEvent(event: DecisionCase["ledger"][number], choice: ChoiceRecord, decision: Pick<DecisionCase, "id" | "incarnation" | "version">) {
  return event.kind === "choice-recorded" && event.caseRef.id === decision.id && event.caseRef.incarnation === decision.incarnation && Number.isSafeInteger(event.caseRef.version) && event.caseRef.version > 0 && event.caseRef.version <= decision.version && event.outputDigest === digestSfValue(choice) && event.principalRef === choice.principalRef && event.at === choice.at && event.rationale === choice.reason && event.consideredActions.includes(choice.alternativeId)
}

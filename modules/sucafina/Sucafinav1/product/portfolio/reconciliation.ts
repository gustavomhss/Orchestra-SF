import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ProjectionComponent, SourceRef } from "../contracts/context.ts"
import type { DecisionCasePort, PortResult } from "../contracts/ports.ts"
import type { SfStoredDecisionResult } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { PortfolioBinding } from "../decisions/portfolio-bindings.ts"
import { classifySfMaterialChange } from "../decision-memory/materiality.ts"
import type { MaterialChangeEvent, MaterialCondition } from "../decision-memory/materiality.ts"
import { plannerComponentDigest } from "../planner/comparison.ts"
import type { PortfolioCandidate } from "./port.ts"
import { readPortfolioSnapshot } from "./read-snapshot.ts"
import type { PortfolioReadHost } from "./read-snapshot.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type PortfolioReconciliationRequest = { caseRef: CaseRef; portfolioResultRef: string; combinationId: string; choiceId: string }
type StoredPortfolio = Extract<SfStoredDecisionResult, { kind: "portfolio" }>
type Condition = Omit<MaterialCondition, "choice"> & { componentId: string; choiceId: string; choiceDigest: string; evidenceRefs: readonly BusinessEvidenceRef[] }
export type PortfolioMaterialChange = MaterialChangeEvent & { componentScope?: { componentId: string; beforeDigest: string; afterDigest: string } }
export type PortfolioReconciliationHost = {
  /** This private reader must authenticate historical C08/binding/selection and every candidate under current access. */
  readPortfolio: (request: { caseRef: CaseRef; resultRef: string; combinationId: string }, context: TrustedDomainContext) => Promise<PortResult<{ stored: StoredPortfolio; binding: PortfolioBinding; candidates: readonly PortfolioCandidate[] }>>
  /** Compose a domain materiality producer; never accept a numeric answer or a source alias from transport input. */
  readMaterialChange?: (request: { condition: MaterialCondition; component: ProjectionComponent; caseRef: CaseRef }, context: TrustedDomainContext) => Promise<PortResult<PortfolioMaterialChange>>
}

/** A read-only correlation of the original composition with WP11 state and WP14's materiality classifier. */
export function createPortfolioReconciliation(input: PortfolioReconciliationHost & {
  cases: Pick<DecisionCasePort, "read">
  evidence: Pick<BusinessContextService, "context">
  host: PortfolioReadHost
  caseFor: (context: TrustedDomainContext) => Promise<PortResult<CaseRef>>
}) {
  const read = async (incoming: PortfolioReconciliationRequest, context: TrustedDomainContext) => {
    try {
      const authorityDigest = digestSfValue({ kind: context.kind, binding: context.binding })
      const authorityUnchanged = () => digestSfValue({ kind: context.kind, binding: context.binding }) === authorityDigest
      const request = structuredClone(incoming)
      if (!request.caseRef?.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version) || request.caseRef.version < 1 || !request.portfolioResultRef.trim() || !request.combinationId.trim() || !request.choiceId.trim()) return { status: "needs-input", reason: "portfolio-reconciliation-reference-invalid" } as const
      const inspect = async () => {
        const current = structuredClone(await input.caseFor(context))
        if (current.status !== "ok") return current
        if (digestSfValue(current.value) !== digestSfValue(request.caseRef) || !await input.host.revalidate(context) || !authorityUnchanged()) return { status: "denied", reason: "portfolio-reconciliation-access-unavailable" } as const
        const authorized = structuredClone(await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context))
        if (authorized.status !== "ok") return authorized
        const decision = authorized.value.case
        if (decision.id !== request.caseRef.id || decision.incarnation !== request.caseRef.incarnation || decision.version !== request.caseRef.version || !sameAuthority(authorized.value.context, context) || !authorityUnchanged()) return { status: "stale", reason: "portfolio-reconciliation-case-changed" } as const
        const loaded = structuredClone(await input.readPortfolio({ caseRef: structuredClone(request.caseRef), resultRef: request.portfolioResultRef, combinationId: request.combinationId }, context))
        if (loaded.status !== "ok") return loaded
        const { stored, binding, candidates } = loaded.value
        if (stored.kind !== "portfolio" || stored.resultRef !== request.portfolioResultRef || stored.resultDigest !== digestSfValue(stored.result) || stored.caseRef.id !== decision.id || stored.caseRef.incarnation !== decision.incarnation || stored.caseRef.version > decision.version || binding.schema !== "sf-portfolio-binding-v1" || binding.resultRef !== stored.resultRef || binding.resultDigest !== stored.resultDigest || binding.requestDigest !== stored.requestDigest || binding.requestDigest !== digestSfValue(binding.request) || digestSfValue(binding.caseRef) !== digestSfValue(stored.caseRef) || binding.bindingDigest !== digestSfValue(Object.fromEntries(Object.entries(binding).filter(([key]) => key !== "bindingDigest")))) return { status: "unavailable", reason: "portfolio-reconciliation-origin-invalid" } as const
        const combinations = stored.result.combinations.filter((item) => item.id === request.combinationId)
        const choices = decision.choices.filter((item) => item.id === request.choiceId)
        const combination = combinations[0]
        const choice = choices[0]
        if (combinations.length !== 1 || choices.length !== 1 || !combination?.analysis || !choice || !choice.criteria.length || combination.eligibility === "ineligible" || combination.eligibility === "unavailable" || combination.analysis.scenarioResultRef !== choice.comparison.alternativeResultRef || digestSfValue(combination.analysis.comparison) !== digestSfValue(choice.comparison) || digestSfValue(combination.analysis.scenario) !== digestSfValue(choice.result) || plannerComponentDigest(combination.components) !== plannerComponentDigest(choice.result.components) || choice.result.currency !== binding.request.scope.currency || digestSfValue(choice.result.horizon) !== digestSfValue(binding.request.scope.horizon) || binding.request.constraints.some((id) => !choice.criteria.includes(id))) return { status: "conflict", reason: "portfolio-reconciliation-choice-mismatch" } as const
        const operations = [...binding.request.operations, ...candidates.flatMap((candidate) => candidate.operations)]
        if (!candidates.length || new Set(candidates.map((candidate) => candidate.ref)).size !== candidates.length || candidates.some((candidate) => !binding.request.candidateRefs.includes(candidate.ref) || binding.proof.candidates.filter((proof) => proof.ref === candidate.ref && proof.digest === digestSfValue(candidate)).length !== 1 || digestSfValue(candidate.operations) !== digestSfValue(candidate.scenario.operations) || candidate.scenario.baseRef !== choice.scenario.baseRef || candidate.scenario.assumptions.some((assumption) => !choice.scenario.assumptions.some((item) => digestSfValue(item) === digestSfValue(assumption)))) || digestSfValue({ candidates: candidates.map((candidate) => candidate.ref), operations }) !== combination.id || digestSfValue(operations) !== digestSfValue(choice.scenario.operations)) return { status: "conflict", reason: "portfolio-reconciliation-composition-mismatch" } as const
        const choiceDigest = digestSfValue(choice)
        const events = decision.ledger.filter((event) => event.kind === "choice-recorded" && event.caseRef.id === decision.id && event.caseRef.incarnation === decision.incarnation && event.caseRef.version >= stored.caseRef.version && event.caseRef.version <= decision.version && event.outputDigest === choiceDigest && event.principalRef === choice.principalRef && event.at === choice.at && event.rationale === choice.reason && event.consideredActions.includes(choice.alternativeId))
        if (events.length !== 1 || new Set(combination.components.map((component) => component.id)).size !== combination.components.length || combination.components.length > 4096) return { status: "unavailable", reason: "portfolio-reconciliation-choice-unbound" } as const
        const changes = decision.preparedChanges.filter((change) => change.choiceId === choice.id)
        // The domain command's CAS revision and the evidence source revision are independent.
        if (new Set(changes.map((change) => change.id)).size !== changes.length || new Set(changes.map((change) => change.idempotencyKey)).size !== changes.length || new Set(changes.flatMap((change) => change.receiptRef ? [change.receiptRef] : [])).size !== changes.filter((change) => change.receiptRef).length || changes.some((change) => change.caseId !== decision.id || change.caseVersion < events[0]!.caseRef.version || change.caseVersion > decision.version || !change.operationRef.trim() || !change.idempotencyKey.trim() || !Number.isSafeInteger(change.expectedVersion) || change.expectedVersion < 0 || !Number.isSafeInteger(change.target.version) || change.target.version < 0)) return { status: "unavailable", reason: "portfolio-reconciliation-change-invalid" } as const
        const receipts = changes.map((change) => ({ change, receipt: change.receiptRef ? decision.receipts.filter((receipt) => receipt.id === change.receiptRef) : [] }))
        if (receipts.some(({ change, receipt }) => receipt.length > 1 || (change.receiptRef && receipt.length !== 1) || (change.state === "applied" && !change.receiptRef) || receipt.some((item) => item.surface !== change.target.surface || item.targetIncarnation !== change.target.incarnation || item.idempotencyKey !== change.idempotencyKey || item.status !== change.state || !authorized.value.evidenceRefs.some((ref) => ref.kind === "receipt" && ref.target.receiptId === item.id && ref.target.surface === item.surface && ref.target.version === item.version && ref.target.idempotencyKey === item.idempotencyKey && ref.target.targetIncarnation === item.targetIncarnation && ref.target.commandDigest === item.commandDigest)))) return { status: "unavailable", reason: "portfolio-reconciliation-receipt-unbound" } as const
        const refs = uniqueRefs([...stored.sourceRefs, ...stored.result.evidenceRefs, ...choice.evidenceRefs, ...choice.result.sourceRefs, ...choice.costCoverage.evaluatedSourceRefs, ...choice.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...authorized.value.evidenceRefs])
        if (!await readable(input.evidence, refs, context, true)) return { status: "denied", reason: "portfolio-reconciliation-evidence-unavailable" } as const
        const components = []
        for (const component of combination.components) {
          if (!component.sourceRefs.length || new Set(component.sourceRefs.map(digestSfValue)).size !== component.sourceRefs.length) return { status: "unavailable", reason: "portfolio-reconciliation-component-unbound" } as const
          const effects = receipts.filter(({ change }) => choice.scenario.operations.some((operation) => operation.targetRef === component.id) && component.sourceRefs.some((source) => sameSource(source, change.target) && source.version === change.target.version && overlaps(source.period, change.target.period) && source.fields.some((field) => change.target.fields.includes(field))) && change.preview.components.some((item) => plannerComponentDigest([item]) === plannerComponentDigest([component])))
          const conditions = []
          for (const source of component.sourceRefs) {
            const evidenceRefs = refs.filter((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id && ref.target.incarnation === source.incarnation && ref.target.version === source.version && !!ref.target.period && ref.target.period.start <= component.period.start && ref.target.period.end >= component.period.end && source.fields.every((field) => ref.target.fields.includes(field)))
            if (!evidenceRefs.length) return { status: "unavailable", reason: "portfolio-reconciliation-component-unbound" } as const
            for (const criterionId of choice.criteria) {
              const condition: Condition = { id: `portfolio-condition:${digestSfValue([stored.resultRef, combination.id, choiceDigest, component.id, { ...source, observedAt: "" }, criterionId])}`, componentId: component.id, choiceId: choice.id, choiceDigest, source, fields: source.fields, period: component.period, criterionId, evidenceRefs }
              const material: MaterialCondition = { id: condition.id, source, fields: condition.fields, period: condition.period, criterionId, choice }
              const payload = structuredClone({ condition: material, component, caseRef: request.caseRef })
              const expected = digestSfValue(payload)
              const observed = input.readMaterialChange ? structuredClone(await input.readMaterialChange(payload, context)) : { status: "unavailable" as const, reason: "materiality-producer-unavailable" }
              if (digestSfValue(payload) !== expected) return { status: "stale", reason: "portfolio-reconciliation-condition-mutated" } as const
              if (observed.status !== "ok" && observed.status !== "unavailable") return observed
              const change: MaterialChangeEvent = observed.status === "ok" && observed.value.availability === "available" ? { source: observed.value.source, fields: observed.value.fields, period: observed.value.period, availability: observed.value.availability, before: observed.value.before, after: observed.value.after, ...(observed.value.comparison ? { comparison: observed.value.comparison } : {}) } : { source, fields: condition.fields, period: condition.period, availability: "unavailable", before: [], after: [] }
              if (change.availability === "available" && (!sameSource(change.source, source, false) || change.fields.some((field) => !change.source.fields.includes(field)) || !change.comparison || digestSfValue(change.comparison.before) !== digestSfValue(choice.comparison) || digestSfValue(change.comparison.resultBefore) !== digestSfValue(choice.result) || !change.before.some((ref) => evidenceRefs.some((original) => digestSfValue(ref) === digestSfValue(original))) || !change.after.some((ref) => ref.kind === "record" && ref.target.surface === change.source.surface && ref.target.recordType === change.source.type && ref.target.recordId === change.source.id && ref.target.incarnation === change.source.incarnation && ref.target.version === change.source.version) || !await readable(input.evidence, change.before, context, true) || !await readable(input.evidence, change.after, context, false))) return { status: "unavailable", reason: "portfolio-reconciliation-materiality-unbound" } as const
              const componentScope = observed.status === "ok" ? observed.value.componentScope : undefined
              const after = change.comparison?.resultAfter.components.filter((item) => item.id === component.id)
              if (componentScope && (componentScope.componentId !== component.id || componentScope.beforeDigest !== portfolioComponentConditionDigest(component) || after?.length !== 1 || componentScope.afterDigest !== portfolioComponentConditionDigest(after[0]!) || !after[0]!.sourceRefs.some((reference) => sameSource(reference, change.source) && reference.version === change.source.version))) return { status: "unavailable", reason: "portfolio-reconciliation-component-scope-invalid" } as const
              // A global criterion change is not evidence that every component changed.
              // Keep the canonical event intact, and give WP14 an unavailable observation
              // when the producer has not proved this component's affected scope.
              const scopeReason = change.availability !== "available" ? "materiality-producer-unavailable" : !componentScope ? "component-scope-unproven" : componentScope.beforeDigest === componentScope.afterDigest && digestSfValue(change.comparison?.before) !== digestSfValue(change.comparison?.after) && condition.fields.some((field) => change.fields.includes(field)) ? "component-unchanged-comparison-changed" : "component-scope-bound"
              const classification = scopeReason === "component-scope-bound" ? change : { source, fields: condition.fields, period: condition.period, availability: "unavailable" as const, before: [], after: [] }
              conditions.push({ condition, observation: change, ...(componentScope ? { componentScope } : {}), scopeReason, ...classifySfMaterialChange(material, classification) })
            }
          }
          components.push({ original: component, correlation: effects.length === 1 ? "bound" as const : effects.length > 1 ? "ambiguous" as const : "not-prepared" as const, effects: effects.map(({ change, receipt }) => ({ change: structuredClone(change), ...(receipt[0] ? { receipt: structuredClone(receipt[0]) } : {}) })), conditions })
        }
        const mapped = new Set(components.flatMap((component) => component.effects.map((effect) => effect.change.id)))
        const projection = { schema: "sf-portfolio-reconciliation-v1" as const, caseRef: request.caseRef, originalCaseRef: stored.caseRef, portfolioResultRef: stored.resultRef, portfolioResultDigest: stored.resultDigest, portfolioBindingDigest: binding.bindingDigest, combinationId: combination.id, originalCombination: combination, choiceId: choice.id, choiceDigest, originalChoice: choice, choiceLedgerRef: events[0]!.id, applicationState: decision.state, components, unmappedChanges: changes.filter((change) => !mapped.has(change.id)), restrictions: ["read-only-reconciliation", "domain-receipts-do-not-prove-global-transaction", "original-choice-preserved"] }
        const latestCase = structuredClone(await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context))
        const latestScope = structuredClone(await input.caseFor(context))
        if (latestCase.status !== "ok") return latestCase
        if (latestScope.status !== "ok") return latestScope
        if (!sameAuthority(latestCase.value.context, context) || digestSfValue(latestCase.value.case) !== digestSfValue(decision) || digestSfValue(latestScope.value) !== digestSfValue(request.caseRef) || !authorityUnchanged()) return { status: "stale", reason: "portfolio-reconciliation-changed" } as const
        if (!await input.host.revalidate(context) || !authorityUnchanged()) return { status: "denied", reason: "portfolio-reconciliation-access-unavailable" } as const
        return { status: "ok", value: structuredClone({ ...projection, reconciliationDigest: digestSfValue(projection) }) } as const
      }
      const first = await inspect()
      if (first.status !== "ok") return first
      const second = await inspect()
      if (second.status !== "ok") return second
      if (digestSfValue(first.value) !== digestSfValue(second.value) || !await input.host.revalidate(context) || !authorityUnchanged()) return { status: "stale", reason: "portfolio-reconciliation-changed" } as const
      return { status: "ok", value: structuredClone(second.value) } as const
    } catch { return { status: "unavailable", reason: "portfolio-reconciliation-unavailable" } as const }
  }
  return (incoming: PortfolioReconciliationRequest, context: TrustedDomainContext) => readPortfolioSnapshot<Awaited<ReturnType<typeof read>>>(input.host, context, incoming, () => read(incoming, context), { status: "unavailable", reason: "portfolio-reconciliation-snapshot-unavailable" })
}

/** Fingerprint the domain-produced component value, never recompute a monetary effect.
 * Full versioned evidence remains in the condition/observation and is authorized above.
 * A record revision alone cannot attribute another component's change to this value.
 */
export function portfolioComponentConditionDigest(component: ProjectionComponent) {
  return digestSfValue({ id: component.id, amount: component.amount, currency: component.currency, period: component.period, evidenceState: component.evidenceState, sources: component.sourceRefs.map((source) => ({ surface: source.surface, type: source.type, id: source.id, incarnation: source.incarnation, fields: source.fields, period: source.period })) })
}

function sameAuthority(value: AuthorizedCaseProjection["context"], context: TrustedDomainContext) {
  return value.installationId === context.binding.installationId && value.projectId === context.binding.projectId && value.principalRef === context.binding.principalRef && value.accessRevision === context.binding.accessRevision && value.policyVersion === context.binding.policyVersion && value.kind === context.kind && (context.kind !== "native" || value.kind === "native" && value.profileId === context.binding.profileId)
}

function sameSource(left: SourceRef, right: SourceRef, incarnation = true) {
  return left.surface === right.surface && left.type === right.type && left.id === right.id && (!incarnation || left.incarnation === right.incarnation)
}

function overlaps(left: SourceRef["period"], right: SourceRef["period"]) {
  return left.start <= right.end && right.start <= left.end
}

function uniqueRefs(refs: readonly BusinessEvidenceRef[]) {
  return refs.filter((ref, index) => refs.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
}

async function readable(evidence: Pick<BusinessContextService, "context">, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext, historical: boolean) {
  if (!refs.length || refs.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref))) return false
  const requested = structuredClone(uniqueRefs(refs))
  const expected = digestSfValue(requested)
  const found = structuredClone(await evidence.context({ refs: requested }, context))
  return digestSfValue(requested) === expected && found.length === requested.length && digestSfValue(found.map((item) => digestSfValue(item.ref)).sort()) === digestSfValue(requested.map(digestSfValue).sort()) && found.every((item) => item.accessRevision === context.binding.accessRevision && (item.state === "fresh" || historical && item.state === "historical"))
}

import { digestSfValue } from "../contracts/canonical.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import type { BusinessContextService, BusinessEvidenceRef, AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { DecisionCase, PreparedChangeView } from "../contracts/decisions.ts"
import type { CommandReceipt, CommandReceiptView } from "../contracts/context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort, SfStateResult } from "../contracts/state.ts"
import { selectSfCase, selectSfCaseWithOwner, sfTransactionLookup } from "../host-binding/state-provider.ts"

export function encodeCaseRef(value: Pick<DecisionCase, "id" | "incarnation">) {
  return `case:${encodeURIComponent(value.id)}:${encodeURIComponent(value.incarnation)}`
}


/**
 * An authenticated view of the original C08 transaction, not a new create.
 * 'missing' is deliberately inconclusive while an earlier POST may be in flight.
 */
export type CaseCreationRecovery =
  | { state: "missing" }
  | { state: "committed"; caseRef: string; receipt: {
      commandDigest: string; storageVersion: number; aggregateRevision: number; incarnation: string
    } }

export function createDecisionCasePort(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  creationTarget: { ref: string; incarnation: string }
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifyScenarioOperations: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  evidence: BusinessContextService
  createId: () => string
  now: () => string
}) {
  const port: DecisionCasePort = {
    draft: async (request, context) => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-case-creation-required" }
      const parsed = decodeSfOperationInput("sf_case_draft", request)
      if (!parsed.ok || !request.objective.trim() || !request.criteria.length || !request.criteria.every((criterion) => criterion.trim()) || new Set(request.criteria.map((criterion) => criterion.trim())).size !== request.criteria.length) return { status: "needs-input", reason: "invalid-case-draft" }
      const source = input.host.requestFor(context)
      const operation = input.operationIdentity(context)
      if (!source || !operation || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
      if (!await accessible(input.evidence, request.sourceRefs, context)) return { status: "unavailable", reason: "case-evidence-unavailable" }
      const before = await input.state.read(source, "cases", () => null).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
      if (before.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
      if (before.status !== "ok" && !(before.status === "unavailable" && before.reason === "product-state-uninitialized")) return failure(before)
      const value: DecisionCase = {
        id: input.createId(), incarnation: input.createId(), version: 1, state: "draft", objective: request.objective,
        horizon: request.horizon, currency: request.currency,
        criteria: request.criteria.map((description) => ({ id: input.createId(), description, required: true })),
        participants: [context.binding.principalRef], sourceRefs: request.sourceRefs, alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [],
      }
      if (!value.id || !value.incarnation || !await input.authorizeCase(value, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
      const saved = await input.state.transaction(source, {
        namespace: "cases", expectedStorageVersion: before.status === "ok" ? before.storageVersion : 0,
        idempotencyKey: operation, commandDigest: digestSfValue(parsed.value), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation,
      }, async (state, authority) => {
        if ((authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) || state.cases[value.id]) return { commit: false, value: null }
        state.cases[value.id] = value
        return { commit: true, value }
      }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
      if (saved.status !== "ok") return saved.status === "preview" ? { status: "conflict", reason: "case-identity-conflict" } : failure(saved)
      if (!saved.value) return { status: "conflict", reason: "case-identity-conflict" }
      const savedCase = saved.value
      const savedDigest = digestSfValue(savedCase)
      if (!savedCase.participants.includes(context.binding.principalRef) || !await input.authorizeCase(savedCase, context) || !await accessible(input.evidence, savedCase.sourceRefs, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
      const current = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[savedCase.id] : undefined).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
      if (current.status !== "ok") return failure(current)
      if (!current.value || current.value.incarnation !== savedCase.incarnation || !current.value.participants.includes(context.binding.principalRef)) return { status: "denied", reason: "case-access-unavailable" }
      if (digestSfValue(current.value) !== savedDigest || digestSfValue(savedCase) !== savedDigest || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "stale", reason: "case-changed" }
      return { status: "ok", value: current.value }
    },
    prepareIntent: async (request, context) => {
      if (context.kind !== "native") return { status: "denied", reason: "native-binding-required" }
      return prepareIntentForCase(request, { id: context.binding.caseId, incarnation: context.binding.caseIncarnation, version: context.binding.caseVersion }, context)
    },
    read: async (request, context) => {
      try {
        const parsed = decodeSfOperationInput("sf_case_read", request)
        if (!parsed.ok) return { status: "needs-input", reason: "invalid-case-reference" }
        const ref = parseCaseRef(parsed.value.caseRef)
        const source = input.host.requestFor(context)
        if (!ref) return { status: "needs-input", reason: "invalid-case-reference" }
        if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
        if (context.kind === "native" && (context.binding.caseId !== ref.id || context.binding.caseIncarnation !== ref.incarnation)) return { status: "denied", reason: "case-access-unavailable" }
        const read = await input.state.read(source, "cases", selectSfCase(ref.id, context)).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
        if (read.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
        if (read.status !== "ok") return failure(read)
        const value = read.value
        if (!value || value.incarnation !== ref.incarnation || (context.kind === "native" && context.binding.caseVersion !== value.version) || !value.participants.includes(context.binding.principalRef)) return { status: "denied", reason: "case-access-unavailable" }
        const caseDigest = digestSfValue(value)
        if (!await input.authorizeCase(value, context)) return { status: "denied", reason: "case-access-unavailable" }
        const refs = evidenceReferences(value)
        const refsDigest = digestSfValue(refs)
        if (!sourcesCovered(value, refs) || !await accessible(input.evidence, refs, context) || !await input.verifyScenarioOperations(value, context)) return { status: "unavailable", reason: "case-evidence-unavailable" }
        if (!await input.authorizeCase(value, context) || !await accessible(input.evidence, refs, context) || !await input.verifyScenarioOperations(value, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
        const checkedAt = input.now()
        // All external checks may await while C08 changes. Keep the second
        // observation after them and release only the same complete case.
        const again = await input.state.read(source, "cases", selectSfCaseWithOwner(ref.id, context)).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
        if (again.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
        if (again.status !== "ok") return failure(again)
        // Namespace authorization may await after the state callback. Check
        // the live lease synchronously with the complete final snapshot.
        if (!again.value.value || digestSfValue(again.value.value) !== caseDigest || digestSfValue(value) !== caseDigest || digestSfValue(refs) !== refsDigest || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "stale", reason: "case-changed" }
        const final = again.value.value
        const projection: AuthorizedCaseProjection = {
          context: { ...(again.value.owner ? { owner: again.value.owner } : {}), installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision, ...(context.kind === "native" ? { kind: "native" as const, profileId: context.binding.profileId } : { kind: "ui" as const }) },
          case: { ...final, preparedChanges: final.preparedChanges.map(changeView), receipts: final.receipts.map((receipt) => receiptView(receipt, final.preparedChanges)) },
          events: final.ledger, evidenceRefs: refs, checkedAt,
        }
        return { status: "ok", value: projection }
      } catch {
        return { status: "unavailable", reason: "case-state-unavailable" }
      }
    },
  }
  const prepareIntentForCase = async (request: Parameters<DecisionCasePort["prepareIntent"]>[0], ref: { id: string; incarnation: string; version: number }, context: TrustedDomainContext): ReturnType<DecisionCasePort["prepareIntent"]> => {
    const parsed = decodeSfOperationInput("sf_case_draft", request)
    if (!parsed.ok || !parsed.value.objective.trim() || !parsed.value.criteria.length || !parsed.value.criteria.every((criterion) => criterion.trim()) || new Set(parsed.value.criteria.map((criterion) => criterion.trim())).size !== parsed.value.criteria.length) return { status: "needs-input", reason: "invalid-case-draft" }
    const source = input.host.requestFor(context)
    if (!source) return { status: "denied", reason: "invalid-authority" }
    const caseRef = encodeCaseRef(ref)
    const current = await port.read({ caseRef }, context)
    if (current.status !== "ok") return current
    if (current.value.case.version !== ref.version) return { status: "stale", reason: "case-changed" }
    const caseDigest = digestSfValue(current.value.case)
    const intentDigest = digestSfValue(parsed.value)
    if (parsed.value.sourceRefs.some((item) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(item)))) return { status: "denied", reason: "source-outside-case-scope" }
    if (!await accessible(input.evidence, parsed.value.sourceRefs, context)) return { status: "unavailable", reason: "case-evidence-unavailable" }
    if (!await input.host.revalidate(context)) return { status: "stale", reason: "case-changed" }
    const again = await port.read({ caseRef }, context)
    if (again.status !== "ok") return again
    if (again.value.case.version !== ref.version || digestSfValue(again.value.case) !== caseDigest || digestSfValue(current.value.case) !== caseDigest || digestSfValue(parsed.value) !== intentDigest || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "stale", reason: "case-changed" }
    return { status: "ok", value: { objective: parsed.value.objective, horizon: parsed.value.horizon, currency: parsed.value.currency, criteria: parsed.value.criteria.map((description, index) => again.value.case.criteria.find((criterion) => criterion.description === description) ?? { id: `intent:${digestSfValue({ caseRef, index, description })}`, description, required: true }), sourceRefs: parsed.value.sourceRefs, gaps: [], domainApplied: false, analysisBasis: "domain" } }
  }

  const recoverCreation = async (key: string, context: TrustedDomainContext): Promise<PortResult<CaseCreationRecovery>> => {
    // The sole durable correlation is the host's original operation identity,
    // derived from the same Idempotency-Key admitted by ui-authority/host-context.
    if (context.kind !== "ui") return { status: "denied", reason: "human-case-recovery-required" }
    if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return { status: "needs-input", reason: "invalid-creation-key" }
    const source = input.host.requestFor(context)
    if (!source || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
    const operation = digestSfValue({ operation: "sf_case_draft", key })
    type Observed = { kind: "missing" } | { kind: "changed" } | { kind: "committed"; caseRef: string; caseDigest: string;
      receipt: Extract<CaseCreationRecovery, { state: "committed" }>["receipt"] }
    const observe = () => input.state.read<Observed>(source, "cases", (state, authority): Observed => {
      if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion ||
        authority.accessRevision !== context.binding.accessRevision) return { kind: "changed" }
      const lookup = sfTransactionLookup(state, authority, { namespace: "cases", targetRef: input.creationTarget.ref, idempotencyKey: operation })
      if (lookup.status === "ambiguous") return { kind: "changed" }
      if (lookup.status === "missing") return { kind: "missing" }
      const transaction = lookup.receipt
      if (transaction.namespace !== "cases" || transaction.principalRef !== authority.principalRef ||
        transaction.targetRef !== input.creationTarget.ref || transaction.targetIncarnation !== input.creationTarget.incarnation ||
        !/^[a-f0-9]{64}$/.test(transaction.commandDigest) || transaction.incarnation !== state.incarnation ||
        !Number.isSafeInteger(transaction.storageVersion) || !Number.isSafeInteger(transaction.aggregateRevision))
        return { kind: "changed" }
      const created = transaction.value
      if (!created || typeof created !== "object" || Array.isArray(created)) return { kind: "changed" }
      const original = created as Partial<DecisionCase>
      if (typeof original.id !== "string" || !original.id || typeof original.incarnation !== "string" || !original.incarnation ||
        !Array.isArray(original.participants) || !original.participants.includes(authority.principalRef)) return { kind: "changed" }
      const current = state.cases[original.id]
      if (!current || current.incarnation !== original.incarnation || !current.participants.includes(authority.principalRef))
        return { kind: "changed" }
      return {
        kind: "committed", caseRef: encodeCaseRef(current), caseDigest: digestSfValue(current),
        receipt: { commandDigest: transaction.commandDigest, storageVersion: transaction.storageVersion,
          aggregateRevision: transaction.aggregateRevision, incarnation: transaction.incarnation },
      }
    })
    try {
      const initial = await observe()
      if (initial.status === "unavailable" && initial.reason === "product-state-uninitialized")
        return await input.host.revalidate(context) && !source.signal.aborted && input.host.requestFor(context) === source
          ? { status: "ok", value: { state: "missing" } }
          : { status: "denied", reason: "case-recovery-authority-changed" }
      if (initial.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
      if (initial.status !== "ok") return failure(initial)
      if (initial.value.kind === "changed") return { status: "denied", reason: "creation-correlation-unavailable" }
      if (initial.value.kind === "missing") {
        return await input.host.revalidate(context) && !source.signal.aborted && input.host.requestFor(context) === source
          ? { status: "ok", value: { state: "missing" } }
          : { status: "denied", reason: "case-recovery-authority-changed" }
      }
      // Never return the serialized transaction without fully reopening the
      // live case, all its evidence and scenario-operation fences.
      const opened = await port.read({ caseRef: initial.value.caseRef }, context)
      if (opened.status !== "ok") return { status: opened.status, reason: "case-recovery-unavailable" }
      const final = await observe()
      if (final.status !== "ok" || final.value.kind !== "committed" ||
        final.value.caseRef !== initial.value.caseRef || final.value.caseDigest !== initial.value.caseDigest ||
        digestSfValue(final.value.receipt) !== digestSfValue(initial.value.receipt) ||
        source.signal.aborted || input.host.requestFor(context) !== source || !await input.host.revalidate(context))
        return { status: "stale", reason: "case-recovery-changed" }
      return { status: "ok", value: { state: "committed", caseRef: final.value.caseRef, receipt: final.value.receipt } }
    } catch {
      return { status: "unavailable", reason: "case-recovery-unavailable" }
    }
  }
  return { ...port, prepareIntentForCase, recoverCreation }
}

export function parseCaseRef(ref: string): { id: string; incarnation: string } | undefined {
  const match = /^case:([^:]+):([^:]+)$/.exec(ref)
  if (!match) return undefined
  try {
    const id = decodeURIComponent(match[1]!)
    const incarnation = decodeURIComponent(match[2]!)
    if (!id.trim() || !incarnation.trim() || encodeCaseRef({ id, incarnation }) !== ref) return undefined
    return { id, incarnation }
  } catch {
    return undefined
  }
}

function failure(value: SfStateResult<unknown>): PortResult<never> {
  if ("reason" in value) return { status: value.status, reason: value.reason }
  return { status: "unavailable", reason: "unexpected-state-result" }
}

async function accessible(service: BusinessContextService, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) {
  if (!refs.length) return true
  try {
    const results = await service.context({ refs }, context)
    return results.length === refs.length && results.every((result) => result.state === "fresh" || result.state === "historical") && JSON.stringify(results.map((result) => digestSfValue(result.ref)).sort()) === JSON.stringify(refs.map(digestSfValue).sort())
  } catch {
    return false
  }
}

function evidenceReferences(value: DecisionCase): BusinessEvidenceRef[] {
  const refs = [ ...value.sourceRefs, ...value.costCoverageBases.flatMap((basis) => basis.sourceRefs), ...value.assumptions.flatMap((item) => item.evidenceRefs), ...value.choices.flatMap((item) => [...item.evidenceRefs, ...item.scenario.assumptions.flatMap((assumption) => assumption.evidenceRefs), ...item.costCoverage.evaluatedSourceRefs, ...item.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...item.result.sourceRefs, ...item.result.costCoverage.evaluatedSourceRefs, ...item.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]), ...value.preparedChanges.flatMap((item) => [...item.preview.sourceRefs, ...item.preview.costCoverage.evaluatedSourceRefs, ...item.preview.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]), ...value.ledger.flatMap((item) => item.evidenceRefs), ...value.alternatives.flatMap((item) => [...item.scenario.assumptions.flatMap((assumption) => assumption.evidenceRefs), ...item.result.sourceRefs, ...item.result.costCoverage.evaluatedSourceRefs, ...item.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]) ]
  return refs.filter((ref, index) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index)
}

function sourcesCovered(value: DecisionCase, refs: readonly BusinessEvidenceRef[]) {
  const sources = [ ...value.alternatives.flatMap((item) => item.result.components.flatMap((component) => component.sourceRefs)), ...value.choices.flatMap((item) => item.result.components.flatMap((component) => component.sourceRefs)), ...value.preparedChanges.flatMap((item) => [item.target, ...item.preview.components.flatMap((component) => component.sourceRefs)]) ]
  return sources.every((source) => refs.some((ref) => ref.kind === "record" && ref.target.surface === source.surface && ref.target.recordType === source.type && ref.target.recordId === source.id && ref.target.incarnation === source.incarnation && ref.target.version === source.version && ref.target.period !== undefined && ref.target.period.start <= source.period.start && ref.target.period.end >= source.period.end && source.fields.every((field) => ref.kind === "record" && ref.target.fields.includes(field)))) && [...value.receipts, ...value.preparedChanges.flatMap((change) => change.receipt ? [change.receipt] : [])].every((receipt) => refs.some((ref) => ref.kind === "receipt" && ref.target.receiptId === receipt.id && ref.target.surface === receipt.surface && ref.target.version === receipt.version && ref.target.idempotencyKey === receipt.idempotencyKey && ref.target.targetIncarnation === receipt.targetIncarnation && ref.target.commandDigest === receipt.commandDigest))
}

function changeView(change: DecisionCase["preparedChanges"][number]): PreparedChangeView {
  const { operation, receipt, ...view } = change
  return { ...view, operationRef: operation.id, ...(receipt ? { receiptRef: receipt.id } : {}) }
}

function receiptView(receipt: CommandReceipt, changes: DecisionCase["preparedChanges"]): CommandReceiptView {
  const { result, ...view } = receipt
  const change = changes.find((item) => item.receipt?.id === receipt.id && item.receipt.surface === receipt.surface && item.receipt.commandDigest === receipt.commandDigest && item.receipt.idempotencyKey === receipt.idempotencyKey && item.receipt.targetIncarnation === receipt.targetIncarnation)
  const status = change && change.state !== "planned" ? change.state : result.ok ? "applied" : result.status === 409 ? "conflict" : "failed"
  return { ...view, status, errors: result.ok ? [] : [result.status === 409 ? "domain-conflict" : "domain-command-failed"] }
}


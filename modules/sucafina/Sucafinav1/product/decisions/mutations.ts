import { digestSfValue } from "../contracts/canonical.ts"
import { validateScenarioCoverage } from "./cost-coverage.ts"
import { enqueueSfLedgerEvent } from "../integration/ledger-outbox.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { DecisionCase, ChoiceRecord, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest, ScenarioCompareRequest, ScenarioOperation } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort, SfStateResult } from "../contracts/state.ts"
import { createChoiceSnapshot } from "./choice.ts"
import { prepareDomainChange } from "./prepared-change.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type MutationReceipt = { caseRef: CaseRef }
type MutationHost = {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  planner: PlannerPort
  sources: PlannerSourceHost
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  confirmChoice: (caseRef: CaseRef, alternativeId: string, context: TrustedDomainContext) => Promise<boolean>
  resolveQuestion: (questionRef: string, context: TrustedDomainContext) => Promise<PortResult<{ id: string; text: string; evidenceRefs: readonly BusinessEvidenceRef[] }>>
  resolveAnswer: (answerRef: string, context: TrustedDomainContext) => Promise<PortResult<BusinessEvidenceRef>>
  confirmAnswer: (caseRef: CaseRef, questionId: string, answerRef: string, context: TrustedDomainContext) => Promise<boolean>
  resolveChoiceValues: (caseRef: CaseRef, comparison: ScenarioCompareRequest, context: TrustedDomainContext) => Promise<PortResult<ChoiceRecord["values"]>>
  prepareDomainCommands: (caseRef: CaseRef, choiceId: string, operations: readonly ScenarioOperation[], context: TrustedDomainContext) => Promise<PortResult<readonly { command: PreparedCommand; preview: ScenarioResult; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }> }[]>>
  createId: () => string
  now: () => string
}

export function createDecisionMutations(input: MutationHost) {
  return {
    addAlternative: async (request: { caseRef: CaseRef; title: string; scenario: ScenarioRequest; coverageRef: string }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-promotion-required" }
      const replay = await replayMutation(input, request.caseRef, context, "add-alternative", request)
      if (replay) return replay
      if (!request.title.trim() || !request.coverageRef.trim()) return { status: "needs-input", reason: "alternative-input-required" }
      const loaded = await loadCase(input, request.caseRef, context)
      if (loaded.status !== "ok") return loaded
      const scenario = await callMutationPort(() => input.planner.simulateScenario(request.scenario, context))
      if (scenario.status !== "ok") return scenario
      const coverage = await callMutationPort(() => input.sources.resolveForecastCoverage(request.coverageRef, context))
      if (coverage.status !== "ok") return coverage
      if (coverage.value.coverageRef !== request.coverageRef) return { status: "conflict", reason: "coverage-reference-mismatch" }
      if (scenario.value.currency !== loaded.value.case.currency || scenario.value.horizon.start !== loaded.value.case.horizon.start || scenario.value.horizon.end !== loaded.value.case.horizon.end) return { status: "conflict", reason: "alternative-basis-mismatch" }
      const coverageError = validateScenarioCoverage(scenario.value, coverage.value.basis, coverage.value.assessment)
      if (coverageError) return { status: "conflict", reason: coverageError }
      const existingBasis = loaded.value.case.costCoverageBases.find((basis) => basis.id === coverage.value.basis.id && basis.version === coverage.value.basis.version)
      if (existingBasis && digestSfValue(existingBasis) !== digestSfValue(coverage.value.basis)) return { status: "conflict", reason: "coverage-inventory-version-conflict" }
      const alternative = { id: scenario.value.costCoverage.alternativeId, version: scenario.value.costCoverage.alternativeVersion, title: request.title, scenario: request.scenario, result: scenario.value }
      const previous = loaded.value.case.alternatives.find((item) => item.id === alternative.id)
      if (!alternative.id.trim() || !Number.isSafeInteger(alternative.version) || alternative.version !== (previous?.version ?? 0) + 1 || loaded.value.case.alternatives.some((item) => item.result.id === alternative.result.id)) return { status: "conflict", reason: "alternative-identity-conflict" }
      return saveCase(input, loaded.value, context, "add-alternative", request, (value) => ({ ...value, state: value.choices.length ? "reconsidering" : "comparing", alternatives: [...value.alternatives.filter((item) => item.id !== alternative.id), alternative], costCoverageBases: value.costCoverageBases.some((basis) => basis.id === coverage.value.basis.id && basis.version === coverage.value.basis.version) ? value.costCoverageBases : [...value.costCoverageBases, coverage.value.basis] }))
    },
    prepareChanges: async (request: { caseRef: CaseRef; choiceId: string; operations: readonly ScenarioOperation[] }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-promotion-required" }
      const replay = await replayMutation(input, request.caseRef, context, "prepare-changes", request)
      if (replay) return replay
      if (!request.operations.length) return { status: "needs-input", reason: "change-operations-required" }
      const loaded = await loadCase(input, request.caseRef, context)
      if (loaded.status !== "ok") return loaded
      if (!loaded.value.case.choices.some((choice) => choice.id === request.choiceId)) return { status: "conflict", reason: "choice-unavailable" }
      const prepared = await callMutationPort(() => input.prepareDomainCommands(request.caseRef, request.choiceId, request.operations, context))
      if (prepared.status !== "ok") return prepared
      if (!prepared.value.length) return { status: "unavailable", reason: "domain-commands-unavailable" }
      if (prepared.value.some((item) => item.targetEvidence.installationId !== context.binding.installationId || item.targetEvidence.projectId !== context.binding.projectId || item.targetEvidence.target.surface !== item.command.target.surface || item.targetEvidence.target.recordType !== item.command.target.type || item.targetEvidence.target.recordId !== item.command.target.id || item.targetEvidence.target.incarnation !== item.command.target.incarnation || item.targetEvidence.target.version !== item.command.target.version || !item.targetEvidence.target.period || item.targetEvidence.target.period.start > item.command.target.period.start || item.targetEvidence.target.period.end < item.command.target.period.end || item.command.target.fields.some((field) => !item.targetEvidence.target.fields.includes(field)))) return { status: "conflict", reason: "change-evidence-mismatch" }
      const changes = prepared.value.map((item) => prepareDomainChange({ case: loaded.value.case, expectedCaseVersion: request.caseRef.version, choiceId: request.choiceId, command: item.command, preview: item.preview, id: input.createId() }))
      const failed = changes.find((change) => change.status !== "ok")
      if (failed) return failed
      const admitted = changes.flatMap((change) => change.status === "ok" ? [change.change] : [])
      if (new Set(admitted.map((change) => change.id)).size !== admitted.length || new Set(admitted.map((change) => change.idempotencyKey)).size !== admitted.length || admitted.some((change) => loaded.value.case.preparedChanges.some((existing) => existing.id === change.id || existing.idempotencyKey === change.idempotencyKey))) return { status: "conflict", reason: "change-identity-conflict" }
      return saveCase(input, loaded.value, context, "prepare-changes", request, (value) => ({ ...value, preparedChanges: [...value.preparedChanges, ...admitted], sourceRefs: [...value.sourceRefs, ...prepared.value.flatMap((item) => [item.targetEvidence, ...item.preview.sourceRefs, ...item.preview.costCoverage.evaluatedSourceRefs, ...item.preview.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)])].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index) }))
    },
    addQuestion: async (request: { caseRef: CaseRef; questionRef: string }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-promotion-required" }
      const replay = await replayMutation(input, request.caseRef, context, "add-question", request)
      if (replay) return replay
      if (!request.questionRef.trim()) return { status: "needs-input", reason: "question-required" }
      const loaded = await loadCase(input, request.caseRef, context)
      if (loaded.status !== "ok") return loaded
      const question = await callMutationPort(() => input.resolveQuestion(request.questionRef, context))
      if (question.status !== "ok") return question
      if (question.value.id !== request.questionRef || !question.value.id.trim() || !question.value.text.trim() || !question.value.evidenceRefs.length || loaded.value.case.questions.some((item) => item.id === question.value.id)) return { status: "conflict", reason: "question-identity-conflict" }
      return saveCase(input, loaded.value, context, "add-question", request, (value) => ({ ...value, questions: [...value.questions, { id: question.value.id, text: question.value.text, state: "open" }], sourceRefs: [...value.sourceRefs, ...question.value.evidenceRefs].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index) }))
    },
    answerQuestion: async (request: { caseRef: CaseRef; questionId: string; answerRef: string }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      const replay = await replayMutation(input, request.caseRef, context, "answer-question", request)
      if (replay) return replay
      if (context.kind !== "ui" || !await input.confirmAnswer(request.caseRef, request.questionId, request.answerRef, context).catch(() => false)) return { status: "denied", reason: "human-answer-required" }
      const loaded = await loadCase(input, request.caseRef, context)
      if (loaded.status !== "ok") return loaded
      if (!loaded.value.case.questions.some((question) => question.id === request.questionId && question.state === "open")) return { status: "conflict", reason: "question-not-open" }
      const evidence = await callMutationPort(() => input.resolveAnswer(request.answerRef, context))
      if (evidence.status !== "ok") return evidence
      return saveCase(input, loaded.value, context, "answer-question", request, (value) => ({ ...value, questions: value.questions.map((question) => question.id === request.questionId ? { ...question, state: "answered" as const, answerRef: request.answerRef } : question), sourceRefs: [...value.sourceRefs, evidence.value].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index) }))
    },
    recordChoice: async (request: { caseRef: CaseRef; alternativeId: string; alternativeVersion: number; comparison: ScenarioCompareRequest; criteria: readonly string[]; reason: string }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      const replay = await replayMutation(input, request.caseRef, context, "record-choice", request)
      if (replay) return replay
      if (context.kind !== "ui" || !await input.confirmChoice(request.caseRef, request.alternativeId, context).catch(() => false)) return { status: "denied", reason: "human-choice-required" }
      const loaded = await loadCase(input, request.caseRef, context)
      if (loaded.status !== "ok") return loaded
      if (new Set(request.comparison.criteria).size !== request.criteria.length || request.criteria.some((criterion) => !request.comparison.criteria.includes(criterion))) return { status: "conflict", reason: "comparison-criteria-mismatch" }
      const comparison = await callMutationPort(() => input.planner.compareScenarios(request.comparison, context))
      if (comparison.status !== "ok") return comparison
      const values = await callMutationPort(() => input.resolveChoiceValues(request.caseRef, request.comparison, context))
      if (values.status !== "ok") return values
      const choice = createChoiceSnapshot({ case: loaded.value.case, alternativeId: request.alternativeId, alternativeVersion: request.alternativeVersion, comparison: comparison.value, criteria: request.criteria, values: values.value, evidenceRefs: loaded.value.case.sourceRefs, id: input.createId(), principalRef: context.binding.principalRef, reason: request.reason, at: input.now() })
      if (choice.status !== "ok") return choice
      return saveCase(input, loaded.value, context, "record-choice", request, (value) => {
        const version = value.version + 1
        return { ...value, state: "chosen", choices: [...value.choices, choice.choice], ledger: [...value.ledger, { id: input.createId(), caseRef: { id: value.id, incarnation: value.incarnation, version }, kind: "choice-recorded", principalRef: context.binding.principalRef, at: choice.choice.at, consideredActions: value.alternatives.map((alternative) => alternative.id), factualGaps: choice.choice.result.unresolvedConditions, lifecycleState: "chosen", rationale: choice.choice.reason, evidenceRefs: choice.choice.evidenceRefs, outputDigest: digestSfValue(choice.choice) }] }
      })
    },
  }
}

type LoadedCase = { case: DecisionCase; source: Request; storageVersion: number; identity: string }
async function loadCase(input: MutationHost, ref: CaseRef, context: TrustedDomainContext): Promise<PortResult<LoadedCase>> {
  const source = input.host.requestFor(context)
  const identity = input.operationIdentity(context)
  if (!source || !identity || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
  const result = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[ref.id] : undefined).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
  if (result.status !== "ok") return failure(result)
  const value = result.value
  if (!value || value.incarnation !== ref.incarnation || !value.participants.includes(context.binding.principalRef) || !await input.authorizeCase(value, context)) return { status: "denied", reason: "case-access-unavailable" }
  if (value.version !== ref.version || (context.kind === "native" && (context.binding.caseId !== value.id || context.binding.caseIncarnation !== value.incarnation || context.binding.caseVersion !== value.version))) return { status: "stale", reason: "case-changed" }
  return { status: "ok", value: { case: value, source, storageVersion: result.storageVersion, identity } }
}

async function replayMutation(input: MutationHost, ref: CaseRef, context: TrustedDomainContext, operation: string, request: unknown): Promise<PortResult<MutationReceipt> | undefined> {
  const source = input.host.requestFor(context)
  const identity = input.operationIdentity(context)
  if (!source || !identity || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
  const result = await input.state.read(source, "cases", (state, authority) => {
    if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return undefined
    return { current: state.cases[ref.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", ref.id, `${identity}:${operation}`])] }
  }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
  if (result.status !== "ok") return failure(result)
  if (!result.value?.prior) return undefined
  const current = result.value.current
  const prior = result.value.prior
  if (!current || current.incarnation !== ref.incarnation || !current.participants.includes(context.binding.principalRef) || !await input.authorizeCase(current, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
  if (prior.commandDigest !== digestSfValue(request) || prior.targetIncarnation !== ref.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
  const saved = prior.value
  if (!saved || typeof saved !== "object" || !("id" in saved) || !("incarnation" in saved) || !("version" in saved) || saved.id !== ref.id || saved.incarnation !== ref.incarnation || !Number.isSafeInteger(saved.version)) return { status: "unavailable", reason: "invalid-mutation-receipt" }
  return { status: "ok", value: { caseRef: { id: ref.id, incarnation: ref.incarnation, version: Number(saved.version) } } }
}

async function saveCase(input: MutationHost, loaded: LoadedCase, context: TrustedDomainContext, operation: string, request: unknown, update: (value: DecisionCase) => DecisionCase): Promise<PortResult<MutationReceipt>> {
  const nextValue = { ...update(loaded.case), version: loaded.case.version + 1 }
  if (!await input.authorizeCase(loaded.case, context) || !await input.authorizeCase(nextValue, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
  const outbox = operation === "record-choice" ? await input.state.read(loaded.source, "outbox", (_state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" })) : undefined
  if (outbox && outbox.status !== "ok") return failure(outbox)
  if (outbox && !outbox.value) return { status: "denied", reason: "outbox-access-unavailable" }
  const saved = await input.state.transaction(loaded.source, { namespace: "cases", expectedStorageVersion: loaded.storageVersion, ...(outbox ? { additionalNamespaces: [{ namespace: "outbox" as const, expectedStorageVersion: outbox.storageVersion }] } : {}), targetRef: loaded.case.id, targetIncarnation: loaded.case.incarnation, idempotencyKey: `${loaded.identity}:${operation}`, commandDigest: digestSfValue(request) }, async (state, authority) => {
    const actual = state.cases[loaded.case.id]
    if (!actual || actual.version !== loaded.case.version || actual.incarnation !== loaded.case.incarnation || authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return { commit: false, value: null }
    state.cases[actual.id] = nextValue
    if (outbox) {
      const event = nextValue.ledger.at(-1)
      if (!event || event.kind !== "choice-recorded" || enqueueSfLedgerEvent(state, event, { installationId: context.binding.installationId, projectId: context.binding.projectId, authority }).status !== "ok") return { commit: false, value: null }
    }
    return { commit: true, value: nextValue }
  }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
  if (saved.status !== "ok") return failure(saved)
  if (!saved.value || !await input.authorizeCase(saved.value, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
  return { status: "ok", value: { caseRef: { id: saved.value.id, incarnation: saved.value.incarnation, version: saved.value.version } } }
}

async function callMutationPort<T>(work: () => Promise<PortResult<T>>): Promise<PortResult<T>> {
  try {
    return await work()
  } catch {
    return { status: "unavailable", reason: "domain-source-unavailable" }
  }
}

function failure(value: SfStateResult<unknown>): PortResult<never> {
  if ("reason" in value) return { status: value.status, reason: value.reason }
  return { status: "conflict", reason: "case-changed" }
}

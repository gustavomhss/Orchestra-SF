import { digestSfValue } from "../contracts/canonical.ts"
import { reassessScenarioCoverage, validateScenarioCoverage } from "./cost-coverage.ts"
import { enqueueSfLedgerEvent } from "../integration/ledger-outbox.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { DecisionCase, ChoiceRecord, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest, ScenarioCompareRequest, ScenarioOperation } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort, SfStateResult } from "../contracts/state.ts"
import { createChoiceSnapshot } from "./choice.ts"
import { verifyHotTopicDraftBinding } from "./hot-topic-draft.ts"
import type { HotTopicDraft } from "./hot-topic-draft.ts"
import { prepareDomainChange } from "./prepared-change.ts"

export type DecisionMutationOperation = "add-alternative" | "prepare-changes" | "add-question" | "answer-question" | "record-choice"
type CaseRef = { id: string; incarnation: string; version: number }
type MutationReceipt = { caseRef: CaseRef; resultRef?: string }
type MutationHost = {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  planner: PlannerPort
  sources: PlannerSourceHost
  coverageEvidence?: { entries: (scenario: ScenarioResult, baseline: import("../contracts/decisions.ts").CostCoverageAssessment, context: TrustedDomainContext) => Promise<PortResult<readonly import("../contracts/decisions.ts").CostCoverageEntry[]>>; resolve: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<readonly import("../contracts/business-context.ts").BusinessEvidenceResolution[]>; supports: Parameters<typeof reassessScenarioCoverage>[0]["supports"]; verifySnapshot: (snapshot: import("../../runtime/contract.ts").Snapshot, result: ScenarioResult, basis: import("../contracts/decisions.ts").CostCoverageBasis, context: TrustedDomainContext) => boolean }
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeMutation: (operation: DecisionMutationOperation, request: unknown, context: TrustedDomainContext) => Promise<boolean>
  verifyMutation: (snapshot: import("../../runtime/contract.ts").Snapshot, operation: DecisionMutationOperation, request: unknown, context: TrustedDomainContext) => boolean
  portfolioParent?: (operation: DecisionMutationOperation, request: unknown, context: TrustedDomainContext) => unknown | undefined
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  confirmChoice: (caseRef: CaseRef, alternativeId: string, context: TrustedDomainContext) => Promise<boolean>
  resolveQuestion: (questionRef: string, context: TrustedDomainContext) => Promise<PortResult<{ id: string; text: string; evidenceRefs: readonly BusinessEvidenceRef[] }>>
  resolveAnswer: (answerRef: string, context: TrustedDomainContext) => Promise<PortResult<BusinessEvidenceRef>>
  confirmAnswer: (caseRef: CaseRef, questionId: string, answerRef: string, context: TrustedDomainContext) => Promise<boolean>
  resolveChoiceValues: (caseRef: CaseRef, comparison: ScenarioCompareRequest, context: TrustedDomainContext) => Promise<PortResult<ChoiceRecord["values"]>>
  readScenarioResult?: (resultRef: string, context: TrustedDomainContext) => Promise<PortResult<import("./result-store.ts").StoredDecisionResult>>
  resolveHotTopicDraft?: (request: { caseRef: CaseRef; draftRef: string }, context: TrustedDomainContext) => Promise<PortResult<HotTopicDraft>>
  prepareDomainCommands: (caseRef: CaseRef, choiceId: string, operations: readonly ScenarioOperation[], context: TrustedDomainContext) => Promise<PortResult<readonly { command: PreparedCommand; preview: ScenarioResult; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }> }[]>>
  createId: () => string
  now: () => string
}

export function createDecisionMutations(input: MutationHost) {
  return {
    replayPortfolio: async (incoming: { caseRef: CaseRef; operation: "add-alternative" | "prepare-changes"; payload: unknown }, context: TrustedDomainContext): Promise<PortResult<{ state: "found"; receipt: MutationReceipt } | { state: "not-found" }>> => {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      const identity = input.operationIdentity(context)
      if (context.kind !== "ui" || !source || !identity || !await input.host.revalidate(context)) return { status: "denied", reason: "portfolio-replay-access-unavailable" }
      const read = () => input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? { current: state.cases[request.caseRef.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `${identity}:${request.operation}`])], results: state.decisionResults } : undefined)
      const loaded = await read()
      if (loaded.status !== "ok" || !loaded.value?.current || loaded.value.current.incarnation !== request.caseRef.incarnation || !loaded.value.current.participants.includes(context.binding.principalRef) || !await input.authorizeCase(loaded.value.current, context)) return { status: "denied", reason: "portfolio-replay-access-unavailable" }
      if (!loaded.value.prior) return { status: "ok", value: { state: "not-found" } }
      const prior = loaded.value.prior
      const saved = prior.value
      if (!saved || typeof saved !== "object" || !("portfolioReplay" in saved) || !saved.portfolioReplay || typeof saved.portfolioReplay !== "object" || !("parentDigest" in saved.portfolioReplay) || !("child" in saved.portfolioReplay) || saved.portfolioReplay.parentDigest !== digestSfValue(request.payload) || prior.targetIncarnation !== request.caseRef.incarnation || prior.commandDigest !== digestSfValue(saved.portfolioReplay.child)) return { status: "conflict", reason: "idempotency-content-changed" }
      const parent = input.portfolioParent?.(request.operation, saved.portfolioReplay.child, context)
      if (parent === undefined || digestSfValue(parent) !== digestSfValue(request.payload) || !await input.authorizeMutation(request.operation, saved.portfolioReplay.child, context)) return { status: "denied", reason: "portfolio-replay-access-unavailable" }
      if (!("id" in saved) || saved.id !== request.caseRef.id || !("incarnation" in saved) || saved.incarnation !== request.caseRef.incarnation || !("version" in saved) || !Number.isSafeInteger(saved.version)) return { status: "unavailable", reason: "invalid-mutation-receipt" }
      const caseRef = { id: request.caseRef.id, incarnation: request.caseRef.incarnation, version: Number(saved.version) }
      const child = saved.portfolioReplay.child
      const resultRef = request.operation === "add-alternative" && child && typeof child === "object" && "scenario" in child ? decisionScenarioResultRef(caseRef, digestSfValue(child.scenario)) : undefined
      if (resultRef) {
        const result = loaded.value.results?.[resultRef]
        if (!result || result.kind !== "scenario" || result.resultDigest !== digestSfValue(result.result) || digestSfValue(result.caseRef) !== digestSfValue(caseRef)) return { status: "unavailable", reason: "portfolio-replay-result-unavailable" }
      }
      const again = await read()
      if (again.status !== "ok" || !again.value?.current || digestSfValue(again.value.current) !== digestSfValue(loaded.value.current) || digestSfValue(again.value.prior) !== digestSfValue(prior) || !await input.authorizeCase(again.value.current, context) || !await input.host.revalidate(context)) return { status: "stale", reason: "portfolio-replay-changed" }
      return { status: "ok", value: { state: "found", receipt: { caseRef, ...(resultRef ? { resultRef } : {}) } } }
    },
    addAlternative: async (incoming: { caseRef: CaseRef; title: string; scenario: ScenarioRequest; coverageRef: string; alternativeRef?: { id: string; version: number } }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      const request = structuredClone(incoming)
      if (context.kind !== "ui" || !await input.authorizeMutation("add-alternative", request, context).catch(() => false)) return { status: "denied", reason: "human-promotion-required" }
      const replay = await replayMutation(input, request.caseRef, context, "add-alternative", request)
      if (replay) return replay
      if (!request.title.trim() || !request.coverageRef.trim()) return { status: "needs-input", reason: "alternative-input-required" }
      const loaded = await loadCase(input, request.caseRef, context)
      if (loaded.status !== "ok") return loaded
      const previous = request.alternativeRef ? loaded.value.case.alternatives.find((item) => item.id === request.alternativeRef!.id) : undefined
      if (request.alternativeRef && (!previous || previous.version !== request.alternativeRef.version)) return { status: "stale", reason: "alternative-changed" }
      const identity = { id: previous?.id ?? input.createId(), version: previous ? previous.version + 1 : 1 }
      if (!identity.id.trim() || (!previous && loaded.value.case.alternatives.some((item) => item.id === identity.id))) return { status: "conflict", reason: "alternative-identity-conflict" }
      const scenario = await callMutationPort(() => input.planner.simulateScenario(request.scenario, context))
      if (scenario.status !== "ok") return scenario
      const coverage = await callMutationPort(() => input.sources.resolveForecastCoverage(request.coverageRef, context))
      if (coverage.status !== "ok") return coverage
      if (coverage.value.coverageRef !== request.coverageRef) return { status: "conflict", reason: "coverage-reference-mismatch" }
      if (scenario.value.currency !== loaded.value.case.currency || scenario.value.horizon.start !== loaded.value.case.horizon.start || scenario.value.horizon.end !== loaded.value.case.horizon.end) return { status: "conflict", reason: "alternative-basis-mismatch" }
      if (scenario.value.costCoverage.basisId !== coverage.value.basis.id || scenario.value.costCoverage.basisVersion !== coverage.value.basis.version) return { status: "conflict", reason: "alternative-basis-mismatch" }
      const attributed: ScenarioResult = scenario.value.comparisonStatus === "complete" ? { ...scenario.value, costCoverage: { ...scenario.value.costCoverage, alternativeId: identity.id, alternativeVersion: identity.version } } : { ...scenario.value, costCoverage: { ...scenario.value.costCoverage, alternativeId: identity.id, alternativeVersion: identity.version } }
      const basis = coverage.value.basis
      const reassessed = digestSfValue(scenario.value.costCoverage) !== digestSfValue(coverage.value.assessment)
      const entries = reassessed && input.coverageEvidence ? await callMutationPort(() => input.coverageEvidence!.entries(attributed, coverage.value.assessment, context)) : undefined
      if (entries && entries.status !== "ok") return entries
      const result = !reassessed ? attributed : input.coverageEvidence && entries?.status === "ok" ? await reassessScenarioCoverage({ scenario: attributed, basis: coverage.value.basis, baseline: coverage.value.assessment, entries: entries.value, resolveEvidence: (refs) => input.coverageEvidence!.resolve(refs, context), supports: input.coverageEvidence.supports }) : undefined
      if (!result) return { status: "unavailable", reason: "scenario-coverage-reassessment-unavailable" }
      const coverageError = validateScenarioCoverage(result, coverage.value.basis, result.costCoverage)
      if (coverageError) return { status: "conflict", reason: coverageError }
      if (result.comparisonStatus === "complete" && !input.coverageEvidence) return { status: "unavailable", reason: "scenario-source-fence-unavailable" }
      const existingBasis = loaded.value.case.costCoverageBases.find((basis) => basis.id === coverage.value.basis.id && basis.version === coverage.value.basis.version)
      if (existingBasis && digestSfValue(existingBasis) !== digestSfValue(coverage.value.basis)) return { status: "conflict", reason: "coverage-inventory-version-conflict" }
      const alternative = { id: result.costCoverage.alternativeId, version: result.costCoverage.alternativeVersion, title: request.title, scenario: request.scenario, result }
      if (!alternative.id.trim() || !Number.isSafeInteger(alternative.version)) return { status: "conflict", reason: "alternative-identity-conflict" }
      return saveCase(input, loaded.value, context, "add-alternative", request, (value) => ({ ...value, state: value.choices.length ? "reconsidering" : "comparing", alternatives: [...value.alternatives.filter((item) => item.id !== alternative.id), alternative], costCoverageBases: value.costCoverageBases.some((basis) => basis.id === coverage.value.basis.id && basis.version === coverage.value.basis.version) ? value.costCoverageBases : [...value.costCoverageBases, coverage.value.basis] }), { request: request.scenario, result, ...(input.coverageEvidence ? { sourceFence: (snapshot: import("../../runtime/contract.ts").Snapshot) => input.coverageEvidence!.verifySnapshot(snapshot, result, basis, context) } : {}) })
    },
    prepareChanges: async (incoming: { caseRef: CaseRef; choiceId: string; operations: readonly ScenarioOperation[] }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      const request = structuredClone(incoming)
      if (context.kind !== "ui" || !await input.authorizeMutation("prepare-changes", request, context).catch(() => false)) return { status: "denied", reason: "human-promotion-required" }
      const replay = await replayMutation(input, request.caseRef, context, "prepare-changes", request)
      if (replay) return replay
      if (!request.operations.length) return { status: "needs-input", reason: "change-operations-required" }
      const loaded = await loadCase(input, request.caseRef, context)
      if (loaded.status !== "ok") return loaded
      const choices = loaded.value.case.choices.filter((choice) => choice.id === request.choiceId)
      if (choices.length !== 1) return { status: "conflict", reason: "choice-unavailable" }
      if (new Set(request.operations.map(digestSfValue)).size !== request.operations.length || request.operations.some((operation) => choices[0]!.scenario.operations.filter((item) => digestSfValue(item) === digestSfValue(operation)).length !== 1)) return { status: "conflict", reason: "operation-not-in-choice" }
      const hotTopics = request.operations.filter((operation) => operation.replacementRef?.startsWith("hot-topic-draft:"))
      if (hotTopics.length && !input.resolveHotTopicDraft) return { status: "unavailable", reason: "hot-topic-draft-unavailable" }
      const drafts = await Promise.all(hotTopics.map((operation) => callMutationPort(() => input.resolveHotTopicDraft!({ caseRef: request.caseRef, draftRef: operation.replacementRef! }, context))))
      const failedDraft = drafts.find((item) => item.status !== "ok")
      if (failedDraft) return failedDraft
      const prepared = await callMutationPort(() => input.prepareDomainCommands(request.caseRef, request.choiceId, request.operations, context))
      if (prepared.status !== "ok") return prepared
      if (!prepared.value.length) return { status: "unavailable", reason: "domain-commands-unavailable" }
      if (prepared.value.some((item) => item.targetEvidence.installationId !== context.binding.installationId || item.targetEvidence.projectId !== context.binding.projectId || item.targetEvidence.target.surface !== item.command.target.surface || item.targetEvidence.target.recordType !== item.command.target.type || item.targetEvidence.target.recordId !== item.command.target.id || item.targetEvidence.target.incarnation !== item.command.target.incarnation || item.targetEvidence.target.version !== item.command.target.version || !item.targetEvidence.target.period || item.targetEvidence.target.period.start > item.command.target.period.start || item.targetEvidence.target.period.end < item.command.target.period.end || item.command.target.fields.some((field) => !item.targetEvidence.target.fields.includes(field)))) return { status: "conflict", reason: "change-evidence-mismatch" }
      const changes = prepared.value.map((item) => prepareDomainChange({ case: loaded.value.case, expectedCaseVersion: request.caseRef.version, choiceId: request.choiceId, command: item.command, preview: item.preview, id: input.createId() }))
      const failed = changes.find((change) => change.status !== "ok")
      if (failed) return failed
      const admitted = changes.flatMap((change) => change.status === "ok" ? [change.change] : [])
      if (new Set(admitted.map((change) => change.id)).size !== admitted.length || new Set(admitted.map((change) => change.idempotencyKey)).size !== admitted.length || admitted.some((change) => loaded.value.case.preparedChanges.some((existing) => existing.id === change.id || existing.idempotencyKey === change.idempotencyKey))) return { status: "conflict", reason: "change-identity-conflict" }
      return saveCase(input, loaded.value, context, "prepare-changes", request, (value) => ({ ...value, preparedChanges: [...value.preparedChanges, ...admitted], sourceRefs: [...value.sourceRefs, ...prepared.value.flatMap((item) => [item.targetEvidence, ...item.preview.sourceRefs, ...item.preview.costCoverage.evaluatedSourceRefs, ...item.preview.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)])].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index) }), undefined, (state) => hotTopics.every((operation, index) => { const draft = drafts[index]; return draft?.status === "ok" && verifyHotTopicDraftBinding(state, request.caseRef, request.choiceId, operation, draft.value) }))
    },
    addQuestion: async (incoming: { caseRef: CaseRef; questionRef: string }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      const request = structuredClone(incoming)
      if (context.kind !== "ui" || !await input.authorizeMutation("add-question", request, context).catch(() => false)) return { status: "denied", reason: "human-promotion-required" }
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
    answerQuestion: async (incoming: { caseRef: CaseRef; questionId: string; answerRef: string }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      const request = structuredClone(incoming)
      if (context.kind !== "ui" || !await input.authorizeMutation("answer-question", request, context).catch(() => false)) return { status: "denied", reason: "human-authority-required" }
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
    recordChoice: async (incoming: { caseRef: CaseRef; alternativeId: string; alternativeVersion: number; comparison: ScenarioCompareRequest; criteria: readonly string[]; reason: string }, context: TrustedDomainContext): Promise<PortResult<MutationReceipt>> => {
      const request = structuredClone(incoming)
      if (context.kind !== "ui" || !await input.authorizeMutation("record-choice", request, context).catch(() => false)) return { status: "denied", reason: "human-authority-required" }
      const replay = await replayMutation(input, request.caseRef, context, "record-choice", request)
      if (replay) return replay
      if (context.kind !== "ui" || !await input.confirmChoice(request.caseRef, request.alternativeId, context).catch(() => false)) return { status: "denied", reason: "human-choice-required" }
      const loaded = await loadCase(input, request.caseRef, context)
      if (loaded.status !== "ok") return loaded
      if (new Set(request.comparison.criteria).size !== request.criteria.length || request.criteria.some((criterion) => !request.comparison.criteria.includes(criterion))) return { status: "conflict", reason: "comparison-criteria-mismatch" }
      const comparison = await callMutationPort(() => input.planner.compareScenarios(request.comparison, context))
      if (comparison.status !== "ok") return comparison
      if (request.comparison.scenarioRefs.length !== 2 || comparison.value.baselineResultRef !== request.comparison.scenarioRefs[0] || comparison.value.alternativeResultRef !== request.comparison.scenarioRefs[1]) return { status: "conflict", reason: "comparison-reference-mismatch" }
      const alternative = loaded.value.case.alternatives.find((item) => item.id === request.alternativeId && item.version === request.alternativeVersion)
      if (!alternative) return { status: "conflict", reason: "alternative-unavailable" }
      if (comparison.value.alternativeResultRef !== alternative.result.id) {
        if (!input.readScenarioResult) return { status: "unavailable", reason: "scenario-result-unavailable" }
        const stored = await callMutationPort(() => input.readScenarioResult!(comparison.value.alternativeResultRef, context))
        if (stored.status !== "ok") return stored
        if (stored.value.kind !== "scenario" || stored.value.caseRef.id !== loaded.value.case.id || stored.value.caseRef.incarnation !== loaded.value.case.incarnation || stored.value.caseRef.version > loaded.value.case.version || stored.value.requestDigest !== digestSfValue(alternative.scenario) || stored.value.resultDigest !== digestSfValue(alternative.result)) return { status: "conflict", reason: "comparison-alternative-mismatch" }
        const baseline = await callMutationPort(() => input.readScenarioResult!(comparison.value.baselineResultRef, context))
        if (baseline.status !== "ok") return baseline
        const baselineValue = baseline.value
        if (baselineValue.kind !== "scenario" || baselineValue.caseRef.id !== loaded.value.case.id || baselineValue.caseRef.incarnation !== loaded.value.case.incarnation || baselineValue.caseRef.version > loaded.value.case.version || baselineValue.result.costCoverage.basisId !== alternative.result.costCoverage.basisId || baselineValue.result.costCoverage.basisVersion !== alternative.result.costCoverage.basisVersion || loaded.value.case.alternatives.filter((item) => item.id !== alternative.id && digestSfValue(item.scenario) === baselineValue.requestDigest && digestSfValue(item.result) === baselineValue.resultDigest).length !== 1) return { status: "conflict", reason: "comparison-baseline-mismatch" }
      }
      const values = await callMutationPort(() => input.resolveChoiceValues(request.caseRef, request.comparison, context))
      if (values.status !== "ok") return values
      const choice = createChoiceSnapshot({ case: loaded.value.case, alternativeId: request.alternativeId, alternativeVersion: request.alternativeVersion, comparison: comparison.value, alternativeResultRef: comparison.value.alternativeResultRef, criteria: request.criteria, values: values.value, evidenceRefs: [...loaded.value.case.sourceRefs, ...loaded.value.case.costCoverageBases.flatMap((basis) => basis.sourceRefs), ...loaded.value.case.alternatives.flatMap((item) => [...item.scenario.assumptions.flatMap((assumption) => assumption.evidenceRefs), ...item.result.sourceRefs, ...item.result.costCoverage.evaluatedSourceRefs, ...item.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)])], id: input.createId(), principalRef: context.binding.principalRef, reason: request.reason, at: input.now() })
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
    return { current: state.cases[ref.id], prior: state.transactions[JSON.stringify([authority.principalRef, "cases", ref.id, `${identity}:${operation}`])], results: state.decisionResults }
  }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
  if (result.status !== "ok") return failure(result)
  if (!result.value?.prior) return undefined
  const current = result.value.current
  const prior = result.value.prior
  if (!current || current.incarnation !== ref.incarnation || !current.participants.includes(context.binding.principalRef) || !await input.authorizeCase(current, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
  if (prior.commandDigest !== digestSfValue(request) || prior.targetIncarnation !== ref.incarnation) return { status: "conflict", reason: "idempotency-content-changed" }
  const saved = prior.value
  if (!saved || typeof saved !== "object" || !("id" in saved) || !("incarnation" in saved) || !("version" in saved) || saved.id !== ref.id || saved.incarnation !== ref.incarnation || !Number.isSafeInteger(saved.version)) return { status: "unavailable", reason: "invalid-mutation-receipt" }
  const caseRef = { id: ref.id, incarnation: ref.incarnation, version: Number(saved.version) }
  if (operation === "add-alternative" && request && typeof request === "object" && "scenario" in request) {
    const resultRef = decisionScenarioResultRef(caseRef, digestSfValue(request.scenario))
    const stored = result.value.results?.[resultRef]
    if (stored?.kind === "scenario" && stored.requestDigest === digestSfValue(request.scenario) && digestSfValue(stored.caseRef) === digestSfValue(caseRef)) return { status: "ok", value: { caseRef, resultRef } }
  }
  return { status: "ok", value: { caseRef } }
}

async function saveCase(input: MutationHost, loaded: LoadedCase, context: TrustedDomainContext, operation: DecisionMutationOperation, request: unknown, update: (value: DecisionCase) => DecisionCase, scenario?: { request: ScenarioRequest; result: ScenarioResult; sourceFence?: (snapshot: import("../../runtime/contract.ts").Snapshot) => boolean }, verifyState?: (state: import("../contracts/state.ts").SfProductState) => boolean): Promise<PortResult<MutationReceipt>> {
  const nextValue = { ...update(loaded.case), version: loaded.case.version + 1 }
  const caseRef = { id: nextValue.id, incarnation: nextValue.incarnation, version: nextValue.version }
  const resultRef = scenario ? decisionScenarioResultRef(caseRef, digestSfValue(scenario.request)) : undefined
  const parent = operation === "add-alternative" || operation === "prepare-changes" ? input.portfolioParent?.(operation, request, context) : undefined
  if (!await input.authorizeCase(loaded.case, context) || !await input.authorizeCase(nextValue, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
  const outbox = operation === "record-choice" ? await input.state.read(loaded.source, "outbox", (_state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" })) : undefined
  if (outbox && outbox.status !== "ok") return failure(outbox)
  if (outbox && !outbox.value) return { status: "denied", reason: "outbox-access-unavailable" }
  const saved = await input.state.transaction(loaded.source, { namespace: "cases", domainSurface: "planner", expectedStorageVersion: loaded.storageVersion, ...(outbox ? { additionalNamespaces: [{ namespace: "outbox" as const, expectedStorageVersion: outbox.storageVersion }] } : {}), targetRef: loaded.case.id, targetIncarnation: loaded.case.incarnation, idempotencyKey: `${loaded.identity}:${operation}`, commandDigest: digestSfValue(request) }, async (state, authority, snapshot) => {
    if (!input.verifyMutation(snapshot, operation, request, context) || (verifyState && !verifyState(state))) return { commit: false, value: null }
    if (scenario?.sourceFence && !scenario.sourceFence(snapshot)) return { commit: false, value: null }
    const actual = state.cases[loaded.case.id]
    if (!actual || actual.version !== loaded.case.version || actual.incarnation !== loaded.case.incarnation || authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return { commit: false, value: null }
    state.cases[actual.id] = nextValue
    if (scenario && resultRef) {
      const records = state.decisionResults ??= {}
      if (records[resultRef]) return { commit: false, value: null }
      const refs = [...scenario.result.sourceRefs, ...scenario.result.costCoverage.evaluatedSourceRefs].filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
      records[resultRef] = { schema: "sf-decision-result-v1", kind: "scenario", resultRef, caseRef, principalRef: authority.principalRef, accessRevision: authority.accessRevision, policyVersion: authority.policyVersion, requestDigest: digestSfValue(scenario.request), resultDigest: digestSfValue(scenario.result), sourceRefs: refs, createdAt: input.now(), result: scenario.result }
    }
    if (outbox) {
      const event = nextValue.ledger.at(-1)
      if (!event || event.kind !== "choice-recorded" || enqueueSfLedgerEvent(state, event, { installationId: context.binding.installationId, projectId: context.binding.projectId, authority }).status !== "ok") return { commit: false, value: null }
    }
    return { commit: true, value: parent === undefined ? nextValue : { ...nextValue, portfolioReplay: { parentDigest: digestSfValue(parent), child: structuredClone(request) } } }
  }).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
  if (saved.status !== "ok") return failure(saved)
  if (!saved.value || !await input.authorizeCase(saved.value, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
  return { status: "ok", value: { caseRef: { id: saved.value.id, incarnation: saved.value.incarnation, version: saved.value.version }, ...(resultRef ? { resultRef } : {}) } }
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

export function decisionScenarioResultRef(caseRef: CaseRef, requestDigest: string) {
  return `decision-result:${digestSfValue({ caseRef, requestDigest })}`
}

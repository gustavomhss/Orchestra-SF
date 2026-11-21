import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfSelectedRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { sfDocumentLimits } from "../../../../modules/sucafina/Sucafinav1/product/documents/limits.ts"
import { createSfAnalysisRegistry } from "./analysis-registry.ts"
import type { SfAnalysisSelectionScope } from "./analysis-selection-scope.ts"
import { createSfScenarioComparisonInput } from "./analysis-inputs.ts"
import type { SfScenarioComparisonSelection } from "./analysis-inputs.ts"
import type { SfAnalysisDependencies, SfAnalysisProof, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"
import { createSfIntentInputProducer } from "./input-producer-intent.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"
import { createSfIntentVerifier } from "./analysis-verifier-intent.ts"
import { createSfExecutiveInputProducer } from "./input-producer-executive.ts"
import { createSfQuestionInputProducer } from "./input-producer-question.ts"
import { createSfExtractionInputProducer } from "./input-producer-extraction.ts"
import { createSfBiInputProducer } from "./input-producer-bi.ts"
import { createSfBiVerifier } from "./analysis-verifier-bi.ts"
import { createSfMeetingInputProducer } from "./input-producer-meeting.ts"
import { createSfMeetingVerifier, createSfExecutiveReviewVerifier } from "./analysis-verifier-routines.ts"
import { createSfMemoryInputProducer } from "./input-producer-memory.ts"
import { createSfDecisionMemoryVerifier } from "./analysis-verifier-memory.ts"
import { createSfScenarioVerifier } from "./analysis-verifier-scenarios.ts"
import { createSfSensitivityInputProducer } from "./input-producer-sensitivity.ts"
import { createSfSensitivityVerifier } from "./analysis-verifier-sensitivity.ts"
import { createSfSourcingInput, createSfSourcingVerifier } from "./analysis-verifier-procurement.ts"
import { createSfContractInputProducer } from "./input-producer-contract.ts"
import { createSfPurchaseInputProducer } from "./input-producer-purchase.ts"
import { createSfDocumentExtractionVerifier, createSfContractReviewVerifier, createSfPurchasePreparationVerifier } from "./analysis-verifier-documents.ts"
import { createSfDependencyInputProducer } from "./input-producer-dependency.ts"
import { createSfPortfolioInputProducer } from "./input-producer-portfolio.ts"
import { createSfPortfolioVerifier } from "./analysis-verifier-portfolio.ts"
import { createSfReevaluationInputProducer } from "./input-producer-reevaluation.ts"
import { createSfQuestionVerifier, createSfDependencyVerifier, createSfCommitmentReevaluationVerifier } from "./analysis-verifier-collaboration.ts"
import { createSfCritiqueInputProducer } from "./input-producer-critique.ts"
import { createSfEvidenceReviewInputProducer } from "./input-producer-evidence-review.ts"
import { createSfDecisionCritiqueVerifier, createSfEvidenceReviewVerifier } from "./analysis-verifier-review.ts"

type Bindings<T> = Omit<T, keyof SfAnalysisDependencies>
export type SfAnalysisPair = { producer: SfInputProducer; verifier: SfAnalysisVerifier }
export type SfAnalysisPreparation = { request: SfAnalysisRequest; selection: unknown }

/** The extraction skill uses the parser's approved formats and the same installed bounds. */
export const sfAnalysisDocumentLimits = Object.freeze({
  formats: Object.freeze(["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const),
  maxBytes: sfDocumentLimits.maxBytes, maxPages: sfDocumentLimits.maxPages, maxTextLength: sfDocumentLimits.maxTextLength,
  maxXmlBytes: sfDocumentLimits.maxXmlBytes, maxZipEntries: sfDocumentLimits.maxZipEntries, timeoutMs: sfDocumentLimits.timeoutMs,
})

/** These functions belong to the authenticated host. None are populated from model input. */
export type SfAnalysisServiceBindings = {
  intent?: Bindings<Parameters<typeof createSfIntentInputProducer>[0]> & Bindings<Parameters<typeof createSfIntentVerifier>[0]>
  documents?: Bindings<Parameters<typeof createSfExtractionInputProducer>[0]> & Bindings<Parameters<typeof createSfEvidenceReviewVerifier>[0]>
  reviews?: Bindings<Parameters<typeof createSfExecutiveReviewVerifier>[0]> & {
    meeting?: Omit<Bindings<Parameters<typeof createSfMeetingVerifier>[0]>, "reviews">
  }
  collaboration?: Bindings<Parameters<typeof createSfQuestionVerifier>[0]>
  bi?: Bindings<Parameters<typeof createSfBiInputProducer>[0]>
  memory?: Bindings<Parameters<typeof createSfDecisionMemoryVerifier>[0]>
  forecast?: SfAnalysisPair
  scenarios?: Pick<Parameters<typeof createSfScenarioComparisonInput>[0], "scenarioLookup">
  sensitivity?: Bindings<Parameters<typeof createSfSensitivityInputProducer>[0]>
  sourcing?: Bindings<Parameters<typeof createSfSourcingVerifier>[0]>
  purchase?: Bindings<Parameters<typeof createSfPurchasePreparationVerifier>[0]>
  portfolio?: Bindings<Parameters<typeof createSfPortfolioVerifier>[0]>
  reevaluation?: Pick<Parameters<typeof createSfCommitmentReevaluationVerifier>[0], "selectedMaterialChanges">
  critique?: Bindings<Parameters<typeof createSfCritiqueInputProducer>[0]>
}

/** One producer and one verifier travel together. Missing host readers leave a skill unavailable. */
export function createSfAnalysisServices(input: {
  dependencies: SfAnalysisDependencies
  selected: readonly SfSelectedRuntime[]
  bindings: SfAnalysisServiceBindings
  pairs?: readonly SfAnalysisPair[]
  selectionScope?: SfAnalysisSelectionScope
  authorizeSelection: (call: TrustedUiContext, input: SfAnalysisPreparation) => Promise<boolean>
}) {
  const selected = structuredClone(input.selected)
  const base = input.dependencies
  const bound = input.bindings
  const pairs: SfAnalysisPair[] = [...input.pairs ?? []]
  if (bound.intent) pairs.push({ producer: createSfIntentInputProducer({ ...base, ...bound.intent }), verifier: createSfIntentVerifier({ ...base, ...bound.intent }) })
  if (bound.documents) {
    pairs.push({ producer: createSfExtractionInputProducer({ ...base, ...bound.documents }), verifier: createSfDocumentExtractionVerifier({ ...base, ...bound.documents }) })
    pairs.push({ producer: createSfContractInputProducer({ ...base, ...bound.documents }), verifier: createSfContractReviewVerifier({ ...base, ...bound.documents }) })
    pairs.push({ producer: createSfEvidenceReviewInputProducer({ ...base, ...bound.documents }), verifier: createSfEvidenceReviewVerifier({ ...base, ...bound.documents }) })
  }
  if (bound.reviews) {
    pairs.push({ producer: createSfExecutiveInputProducer({ ...base, ...bound.reviews }), verifier: createSfExecutiveReviewVerifier({ ...base, ...bound.reviews }) })
    if (bound.reviews.meeting) pairs.push({ producer: createSfMeetingInputProducer({ ...base, ...bound.reviews, ...bound.reviews.meeting }), verifier: createSfMeetingVerifier({ ...base, ...bound.reviews, ...bound.reviews.meeting }) })
  }
  if (bound.collaboration) {
    pairs.push({ producer: createSfQuestionInputProducer({ ...base, ...bound.collaboration }), verifier: createSfQuestionVerifier({ ...base, ...bound.collaboration }) })
    pairs.push({ producer: createSfDependencyInputProducer({ ...base, ...bound.collaboration }), verifier: createSfDependencyVerifier({ ...base, ...bound.collaboration }) })
    if (bound.reevaluation) pairs.push({ producer: createSfReevaluationInputProducer({ ...base, ...bound.collaboration, ...bound.reevaluation }), verifier: createSfCommitmentReevaluationVerifier({ ...base, ...bound.collaboration, ...bound.reevaluation }) })
  }
  if (bound.bi) pairs.push({ producer: createSfBiInputProducer({ ...base, ...bound.bi }), verifier: createSfBiVerifier({ ...base, readBiSelection: bound.bi.biSelection }) })
  if (bound.memory) pairs.push({ producer: createSfMemoryInputProducer({ ...base, ...bound.memory }), verifier: createSfDecisionMemoryVerifier({ ...base, ...bound.memory }) })
  if (bound.forecast) {
    if (bound.forecast.producer.skillIds.length !== 1 || bound.forecast.producer.skillIds[0] !== "sf-explicar-forecast" || bound.forecast.verifier.skillIds.length !== 1 || bound.forecast.verifier.skillIds[0] !== "sf-explicar-forecast") throw new Error("SF_FORECAST_ANALYSIS_PAIR_INVALID")
    pairs.push(bound.forecast)
  }
  if (bound.scenarios) {
    const lookup = bound.scenarios.scenarioLookup
    const producer: SfInputProducer = { skillIds: ["sf-comparar-cenarios"], prepare: async (raw, request, call) => {
      const selection = scenarioSelection(raw)
      if (!selection || digestSfValue(selection.caseRef) !== digestSfValue(request.caseRef)) return { status: "needs-input", reason: "scenario-selection-invalid" }
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      return createSfScenarioComparisonInput({ cases: base.cases, planner: base.planner, context: base.context, revalidate: base.host.revalidate, scenarioLookup: lookup,
        authorizeSelection: async (current, value) => current.kind === "ui" && digestSfValue(value) === digestSfValue(selection) && await input.authorizeSelection(current, { request, selection: raw }),
      }).prepare(call, selection)
    } }
    const verifier = createSfScenarioVerifier({ ...base, scenarioRef: async (caseRef, alternative, call) => {
      const result = await lookup({ caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version }, call)
      return result.status === "ok" ? { status: "ok", value: result.value.resultRef } : result
    } })
    pairs.push({ producer, verifier })
  }
  if (bound.sensitivity) pairs.push({ producer: createSfSensitivityInputProducer({ ...base, ...bound.sensitivity }), verifier: createSfSensitivityVerifier({ ...base, ...bound.sensitivity }) })
  if (bound.sourcing) {
    const prepare = createSfSourcingInput(bound.sourcing)
    pairs.push({ producer: { skillIds: ["sf-comparar-sourcing"], prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      if (!selection || typeof selection !== "object" || Array.isArray(selection)) return { status: "needs-input", reason: "sourcing-selection-invalid" }
      const fields = Object.entries(selection)
      const reference = fields.find(([key]) => key === "requestRef")?.[1]
      const caseRef = fields.find(([key]) => key === "caseRef")?.[1]
      if (fields.some(([key]) => key !== "requestRef" && key !== "caseRef") || typeof reference !== "string" || !reference.trim() || (caseRef !== undefined && digestSfValue(caseRef) !== digestSfValue(request.caseRef))) return { status: "needs-input", reason: "sourcing-selection-invalid" }
      return prepare(reference, call)
    } }, verifier: createSfSourcingVerifier({ ...base, ...bound.sourcing }) })
  }
  if (bound.purchase) pairs.push({ producer: createSfPurchaseInputProducer(base), verifier: createSfPurchasePreparationVerifier({ ...base, ...bound.purchase }) })
  if (bound.portfolio) pairs.push({ producer: createSfPortfolioInputProducer(base), verifier: createSfPortfolioVerifier({ ...base, ...bound.portfolio }) })
  if (bound.critique) pairs.push({ producer: createSfCritiqueInputProducer({ ...base, ...bound.critique }), verifier: createSfDecisionCritiqueVerifier({ ...base, ...bound.critique }) })

  const expected = [...new Set(selected.flatMap((profile) => profile.skills.map((skill) => skill.id)))]
  const ids = pairs.flatMap((pair) => pair.producer.skillIds)
  if (new Set(ids).size !== ids.length || pairs.some((pair) => !pair.producer.skillIds.length || digestSfValue([...pair.producer.skillIds].sort()) !== digestSfValue([...pair.verifier.skillIds].sort())) || ids.some((id) => !expected.includes(id))) throw new Error("SF_ANALYSIS_REGISTRATION_INVALID")

  const validRequest = (request: SfAnalysisRequest, call: TrustedDomainContext) => {
    const profile = selected.find((value) => value.profile.id === request.profileId && value.profile.version === request.profileVersion && value.manifestDigest === request.manifestDigest)
    const skill = profile?.skills.find((value) => value.id === request.skillId && value.version === request.skillVersion)
    if (!profile || !skill || !request.objective.trim() || request.outputSchemaVersion !== "sf-contribution-v1" || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version) || request.caseRef.version < 1 ||
      new Set(request.requestedOperationScope).size !== request.requestedOperationScope.length || request.requestedOperationScope.some((operation) => !skill.allowedOperations.includes(operation) || !profile.operationIds.includes(operation))) return false
    return call.kind === "ui" || call.binding.caseId === request.caseRef.id && call.binding.caseIncarnation === request.caseRef.incarnation && call.binding.caseVersion === request.caseRef.version &&
      call.binding.profileId === request.profileId && call.binding.profileVersion === request.profileVersion && call.binding.manifestDigest === request.manifestDigest && call.binding.skillReceipts.filter((receipt) => receipt.skillId === request.skillId && receipt.skillVersion === request.skillVersion).length === 1
  }
  const currentCase = async (request: SfAnalysisRequest, call: TrustedDomainContext) => {
    if (!validRequest(request, call) || !await base.host.revalidate(call)) return undefined
    const current = await base.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
    return current.status === "ok" && current.value.case.id === request.caseRef.id && current.value.case.incarnation === request.caseRef.incarnation && current.value.case.version === request.caseRef.version && current.value.case.participants.includes(call.binding.principalRef) && await base.host.revalidate(call) ? current.value.case : undefined
  }
  const verifiers: SfAnalysisVerifier[] = pairs.map((pair) => ({ skillIds: [...pair.verifier.skillIds], verify: async (value, request, call): Promise<PortResult<SfAnalysisProof>> => {
    const captured = structuredClone({ value, request })
    const digest = digestSfValue(captured)
    const binding = analysisAuthority(call)
    const before = await currentCase(captured.request, call)
    if (!before) return { status: "unavailable", reason: "analysis-case-unavailable" }
    const verify = () => pair.verifier.verify(captured.value, captured.request, call)
    const proof = input.selectionScope ? await input.selectionScope.verify(captured.value, captured.request, call, verify) : await verify()
    if (proof.status !== "ok") return proof
    const after = await currentCase(captured.request, call)
    if (digestSfValue(captured) !== digest || analysisAuthority(call) !== binding || digestSfValue(proof.value.input) !== digestSfValue(captured.value) || !after || digestSfValue(before) !== digestSfValue(after) || digestSfValue(proof.value.current) !== digestSfValue(after)) return { status: "unavailable", reason: "analysis-source-or-authority-changed" }
    return { status: "ok", value: { ...proof.value, acceptsOutput: async (output, currentCall) => {
      if (analysisAuthority(currentCall) !== binding || !await currentCase(captured.request, currentCall)) return { status: "unavailable", reason: "analysis-output-authority-unavailable" }
      const wanted = structuredClone(output)
      const outputDigest = digestSfValue(wanted)
      const accept = () => proof.value.acceptsOutput(wanted, currentCall)
      const result = input.selectionScope ? await input.selectionScope.verify(captured.value, captured.request, currentCall, accept) : await accept()
      if (result.status !== "ok") return result
      return digestSfValue(wanted) === outputDigest && analysisAuthority(currentCall) === binding && await currentCase(captured.request, currentCall)
        ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-authority-unavailable" }
    } } }
  } }))
  const registry = createSfAnalysisRegistry({ producers: pairs.map((pair) => pair.producer), verifiers })
  return {
    verifiers,
    /** Private discovery does not claim runtime execution or downstream consumption. */
    discovery: () => expected.map((skillId) => ({ skillId, status: ids.includes(skillId) ? "bound" as const : "unavailable" as const })),
    prepare: async (call: TrustedUiContext, incoming: SfAnalysisPreparation): Promise<PortResult<unknown>> => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const captured = structuredClone(incoming)
      const digest = digestSfValue(captured)
      const binding = analysisAuthority(call)
      if (!await input.authorizeSelection(call, captured)) return { status: "denied", reason: "analysis-input-authority-unavailable" }
      if (!ids.includes(captured.request.skillId)) return { status: "unavailable", reason: "analysis-skill-binding-unavailable" }
      if (!await currentCase(captured.request, call)) return { status: "unavailable", reason: "analysis-case-unavailable" }
      const prepare = () => registry.prepare(captured.selection, captured.request, call)
      const result = input.selectionScope ? await input.selectionScope.prepare(captured, call, prepare) : await prepare()
      if (result.status !== "ok") return result
      return digestSfValue(captured) === digest && analysisAuthority(call) === binding && await currentCase(captured.request, call) && await input.authorizeSelection(call, captured)
        ? result : { status: "unavailable", reason: "analysis-source-or-authority-changed" }
    },
    verify: registry.verify,
  }
}

function analysisAuthority(call: TrustedDomainContext) {
  return digestSfValue({ installationId: call.binding.installationId, projectId: call.binding.projectId, principalRef: call.binding.principalRef, policyVersion: call.binding.policyVersion, accessRevision: call.binding.accessRevision })
}

function scenarioSelection(value: unknown): SfScenarioComparisonSelection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 2 || entries.some(([key]) => key !== "caseRef" && key !== "alternatives")) return undefined
  const caseRef = entries.find(([key]) => key === "caseRef")?.[1]
  const alternatives = entries.find(([key]) => key === "alternatives")?.[1]
  if (!caseRef || typeof caseRef !== "object" || Array.isArray(caseRef) || !Array.isArray(alternatives) || alternatives.length !== 2) return undefined
  const identity = Object.entries(caseRef)
  const id = identity.find(([key]) => key === "id")?.[1]
  const incarnation = identity.find(([key]) => key === "incarnation")?.[1]
  const version = identity.find(([key]) => key === "version")?.[1]
  if (identity.length !== 3 || identity.some(([key]) => !["id", "incarnation", "version"].includes(key)) || typeof id !== "string" || !id.trim() || typeof incarnation !== "string" || !incarnation.trim() || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) return undefined
  const parse = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
    const entries = Object.entries(value)
    const id = entries.find(([key]) => key === "id")?.[1]
    const version = entries.find(([key]) => key === "version")?.[1]
    return entries.length === 2 && entries.every(([key]) => key === "id" || key === "version") && typeof id === "string" && !!id.trim() && typeof version === "number" && Number.isSafeInteger(version) && version >= 1 ? { id, version } : undefined
  }
  const first = parse(alternatives[0])
  const second = parse(alternatives[1])
  return first && second && first.id !== second.id ? { caseRef: { id, incarnation, version }, alternatives: [first, second] } : undefined
}

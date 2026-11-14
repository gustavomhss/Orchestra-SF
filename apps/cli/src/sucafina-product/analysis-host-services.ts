import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfDocumentServices } from "./document-services.ts"
import type { createSfImportServices } from "./import-services.ts"
import { createSfAnalysisServices } from "./analysis-services.ts"
import { createSfAnalysisSelectionScope } from "./analysis-selection-scope.ts"
import { createSfAnalysisConfirmationReader } from "./analysis-confirmation-readers.ts"
import { createSfAnalysisBiBindings } from "./analysis-bi-bindings.ts"
import { createSfAnalysisAuthorReader, createSfAnalysisReviewTargetVerifier } from "./analysis-author.ts"
import { withoutObservationTimes } from "./analysis-verifier.ts"
import type { BiPresentationPort } from "../../../../modules/sucafina/Sucafinav1/product/analytics/capabilities.ts"
import type { SfSelectedRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"
import { createSfAnalysisSelectionReaders } from "./analysis-services-readers.ts"
import { createSfAnalysisBusinessInputs } from "./analysis-services-inputs.ts"
import { createSfAnalysisReviewServices } from "./analysis-services-review.ts"
import type { SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"
import { createSfIntentInputProducer } from "./input-producer-intent.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"
import { createSfIntentVerifier } from "./analysis-verifier-intent.ts"
import { createSfImportIntentAnalysis } from "./import-intent.ts"
import { createSfDocumentAnalysisInput, sfDocumentAnalysisLimits } from "./document-analysis.ts"
import { createSfQuestionInputProducer } from "./input-producer-question.ts"
import { createSfDependencyInputProducer } from "./input-producer-dependency.ts"
import { createSfReevaluationInputProducer } from "./input-producer-reevaluation.ts"
import { createSfQuestionVerifier, createSfDependencyVerifier, createSfCommitmentReevaluationVerifier } from "./analysis-verifier-collaboration.ts"
import { createSfEvidenceReviewInputProducer } from "./input-producer-evidence-review.ts"
import { createSfEvidenceReviewVerifier } from "./analysis-verifier-review.ts"
import { createSfContractInputProducer } from "./input-producer-contract.ts"
import { createSfPurchaseInputProducer } from "./input-producer-purchase.ts"
import { createSfDocumentExtractionVerifier, createSfContractReviewVerifier, createSfPurchasePreparationVerifier } from "./analysis-verifier-documents.ts"
import { createSfExecutiveInputProducer } from "./input-producer-executive.ts"
import { createSfMeetingInputProducer } from "./input-producer-meeting.ts"
import { createSfExecutiveReviewVerifier, createSfMeetingVerifier } from "./analysis-verifier-routines.ts"
import { createSfBiInputProducer } from "./input-producer-bi.ts"
import { createSfBiVerifier } from "./analysis-verifier-bi.ts"
import { createSfPortfolioInputProducer } from "./input-producer-portfolio.ts"
import { createSfPortfolioVerifier } from "./analysis-verifier-portfolio.ts"
import { createSfSensitivityInputProducer } from "./input-producer-sensitivity.ts"
import { createSfSensitivityVerifier } from "./analysis-verifier-sensitivity.ts"
import { createSfMemoryInputProducer } from "./input-producer-memory.ts"
import { createSfDecisionMemoryVerifier } from "./analysis-verifier-memory.ts"

/** Optional services must be real host ports. A missing port omits its pair from the registry. */
export type SfAnalysisHostBindings = {
  reviews?: Parameters<typeof createSfExecutiveReviewVerifier>[0]["reviews"]
  artifacts?: Parameters<typeof createSfMeetingVerifier>[0]["artifacts"]
  changeProposals?: Parameters<typeof createSfPurchasePreparationVerifier>[0]["changeProposals"]
  biSelection?: Parameters<typeof createSfBiInputProducer>[0]["biSelection"]
  biSource?: BiPresentationPort
  selectedSensitivity?: Parameters<typeof createSfSensitivityVerifier>[0]["selectedSensitivity"]
  portfolioProof?: Parameters<typeof createSfPortfolioVerifier>[0]["portfolioProof"] & Parameters<typeof createSfSensitivityVerifier>[0]["portfolioProof"]
  units?: Parameters<typeof createSfSensitivityVerifier>[0]["units"]
  selectedMaterialChanges?: Parameters<typeof createSfCommitmentReevaluationVerifier>[0]["selectedMaterialChanges"]
  readAlternativeCapture?: Parameters<typeof createSfPortfolioVerifier>[0]["readAlternativeCapture"]
  replayAlternative?: Parameters<typeof createSfPortfolioVerifier>[0]["replayAlternative"]
  caseRecall?: ReturnType<typeof createSfCaseRecall>
}

export const sfAnalysisSkillIds = [
  "sf-enquadrar-decisao", "sf-preparar-revisao-executiva", "sf-coordenar-perguntas", "sf-explicar-forecast", "sf-comparar-cenarios",
  "sf-avaliar-sensibilidade", "sf-comparar-sourcing", "sf-revisar-condicoes-contratuais", "sf-preparar-compra", "sf-revisar-dependencias",
  "sf-compor-portfolio", "sf-reavaliar-compromissos", "sf-contestar-decisao", "sf-revisar-evidencias", "sf-extrair-evidencias",
  "sf-produzir-bi-contextual", "sf-produzir-material-reuniao", "sf-consultar-memoria-decisoria",
] as const

/** Compose every published producer/verifier pair for which this installation has the required ports. */
export function createSfAnalysisHostServices(input: {
  business: ReturnType<typeof createSfBusinessServices>
  selected: readonly SfSelectedRuntime[]
  authority: ReturnType<typeof createSfProductAuthority>
  analysisSelectionWrites: WeakSet<object>
  documents?: ReturnType<typeof createSfDocumentServices>
  imports?: ReturnType<typeof createSfImportServices>
  bindings?: SfAnalysisHostBindings
}) {
  const { business, authority } = input
  const bindings = input.bindings ?? {}
  const dependencies = { cases: business.cases, planner: business.planner, procurement: business.procurement, context: business.context, host: authority.host }
  const sourceReaders = createSfAnalysisSelectionReaders(input)
  const verifyReviewTarget = createSfAnalysisReviewTargetVerifier(authority)
  const authorReader = createSfAnalysisAuthorReader({ authority, context: business.context, resolveCase: business.resolveCase })
  const readAuthorForCase: typeof sourceReaders.readAuthorForCase = async (...args) => {
    const result = await sourceReaders.readAuthorForCase(...args)
    return result.status !== "ok" || await verifyReviewTarget(result.value, args[2], args[3])
      ? result : { status: "denied", reason: "author-review-target-unavailable" }
  }
  const readers: typeof sourceReaders = { ...sourceReaders, readAuthorForCase,
    readAuthorAnalysis: async (runRef, outputDigest, call) => {
      const selected = await business.resolveCase(call)
      if (selected.status !== "ok") return selected
      const result = await authorReader(runRef, outputDigest, call)
      return result.status !== "ok" || await verifyReviewTarget(result.value, selected.value, call)
        ? result : { status: "denied", reason: "author-review-target-unavailable" }
    },
    readHistoricalAuthor: (runRef, outputDigest, selection, call) => readAuthorForCase(runRef, outputDigest, selection.caseRef, call, { responseRef: selection.responseRef }),
  }
  const scoped = createSfAnalysisSelectionScope({ authority, cases: business.cases, selectionWrites: input.analysisSelectionWrites, skills: sfAnalysisSkillIds,
    prepareMaterial: async (incoming, call): Promise<PortResult<Readonly<Record<string, unknown>>>> => {
      if (incoming.request.skillId === "sf-produzir-bi-contextual") {
        if (Object.hasOwn(object(incoming.selection), "dashboardSelection")) return bi
          ? bi.prepare(incoming, call) : { status: "unavailable", reason: "bi-direct-source-unavailable" }
        if (!explicitSelectionKey(incoming.selection, "bi") || !bindings.biSelection) return { status: "needs-input", reason: "bi-human-selection-required" }
        const selected = await bindings.biSelection(incoming.request.caseRef, call)
        return selected.status === "ok" ? { status: "ok", value: { selectionKey: "bi", selectionDigest: digestSfValue(withoutObservationTimes(selected.value)) } } : selected
      }
      if (incoming.request.skillId === "sf-avaliar-sensibilidade" && bindings.selectedSensitivity) {
        const selected = await bindings.selectedSensitivity(incoming.request.caseRef, call)
        return selected.status === "ok" ? { status: "ok", value: { selectionKey: "sensitivity", selectionDigest: digestSfValue(selected.value) } } : selected
      }
      return { status: "ok", value: {} }
    } })
  const bi = bindings.biSource ? createSfAnalysisBiBindings({ authority, business, workspace: { bi: { source: bindings.biSource } }, selection: scoped.read }) : undefined
  const confirmations = createSfAnalysisConfirmationReader({ host: authority.host, state: authority.state, confirmation: business.collaboration.confirmation })
  const readBiSelection: NonNullable<SfAnalysisHostBindings["biSelection"]> = async (caseRef, call) => {
    const selected = await scoped.read(caseRef, "sf-produzir-bi-contextual", call)
    if (selected.status !== "ok") return selected
    if (Object.hasOwn(object(selected.value.selection), "dashboardSelection")) return bi
      ? bi.binding.biSelection(caseRef, call) : { status: "unavailable", reason: "bi-direct-source-unavailable" }
    if (!explicitSelectionKey(selected.value.selection, "bi") || selected.value.material.selectionKey !== "bi" || !bindings.biSelection)
      return { status: "unavailable", reason: "bi-human-selection-unavailable" }
    const current = await bindings.biSelection(caseRef, call)
    return current.status !== "ok" || digestSfValue(withoutObservationTimes(current.value)) === selected.value.material.selectionDigest
      ? current : { status: "stale", reason: "bi-human-selection-changed" }
  }
  const readSensitivity: NonNullable<SfAnalysisHostBindings["selectedSensitivity"]> = async (caseRef, call) => {
    const selected = await scoped.read(caseRef, "sf-avaliar-sensibilidade", call)
    if (selected.status !== "ok") return selected
    if (selected.value.material.selectionKey !== "sensitivity" || !bindings.selectedSensitivity) return { status: "unavailable", reason: "sensitivity-human-selection-unavailable" }
    const current = await bindings.selectedSensitivity(caseRef, call)
    return current.status !== "ok" || digestSfValue(current.value) === selected.value.material.selectionDigest
      ? current : { status: "stale", reason: "sensitivity-human-selection-changed" }
  }
  const review = createSfAnalysisReviewServices({ business, authority, readers })
  const base = createSfAnalysisBusinessInputs(input)
  const producers: SfInputProducer[] = [...base.producers]
  const verifiers: SfAnalysisVerifier[] = [...base.verifiers]
  const missing = new Map<string, readonly string[]>()
  const add = (producer: SfInputProducer, verifier: SfAnalysisVerifier) => {
    producers.push(producer)
    verifiers.push(verifier)
  }
  const absent = (skills: readonly string[], ports: readonly string[]) => skills.forEach((skill) => missing.set(skill, ports))
  add(review.producer, review.verifier)
  add(createSfQuestionInputProducer({ ...dependencies, collaboration: business.collaboration }), createSfQuestionVerifier({ ...dependencies, collaboration: business.collaboration }))
  add(createSfDependencyInputProducer({ ...dependencies, collaboration: business.collaboration, dashboard: business.dashboard, readHumanSelection: scoped.read }),
    createSfDependencyVerifier({ ...dependencies, collaboration: business.collaboration, dashboard: business.dashboard, readHumanSelection: scoped.read }))

  {
    const imports = input.imports?.imports
    const imported = imports ? (request?: SfAnalysisRequest, selection?: unknown) => createSfImportIntentAnalysis({ ...dependencies,
      replayIntent: business.cases.prepareIntentForCase, imports, state: authority.state,
      operationIdentity: (call) => call.kind === "ui" ? authority.ui.operationIdentity(call) : undefined,
      authorize: (call, wanted) => request && selection !== undefined && digestSfValue(wanted) === digestSfValue(selection)
        ? authority.human.authorize(call, "analysis.prepare", { request, selection }) : Promise.resolve(false),
    }) : undefined
    add({ skillIds: ["sf-enquadrar-decisao"], prepare: async (raw, request, call) => {
      const fields = object(raw)
      if (Object.hasOwn(fields, "previewRef") || Object.hasOwn(fields, "importRequest")) {
        if (!imported) return { status: "unavailable", reason: "import-analysis-reader-unavailable" }
        const preview = decodeSfOperationInput("sf_import_preview", fields.importRequest)
        if (Object.keys(fields).length !== 4 || Object.keys(fields).some((key) => !["caseRef", "previewRef", "importRequest", "intentText"].includes(key)) ||
          digestSfValue(fields.caseRef) !== digestSfValue(request.caseRef) || typeof fields.previewRef !== "string" || !fields.previewRef.trim() ||
          typeof fields.intentText !== "string" || !fields.intentText.trim() || !preview.ok) return { status: "needs-input", reason: "intent-preview-selection-invalid" }
        const wanted = { caseRef: request.caseRef, previewRef: fields.previewRef, importRequest: preview.value, intentText: fields.intentText }
        if (digestSfValue(wanted) !== digestSfValue(raw)) return { status: "needs-input", reason: "intent-preview-selection-invalid" }
        return imported(request, raw).prepare(call, wanted)
      }
      const current = raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(fields).length === 0 ? await readers.current(request.caseRef, call) : undefined
      // The old UI submits an empty selection after the user has selected a case. Its saved sources remain the selection.
      const selection = current ? { evidenceRefIds: current.case.sourceRefs.map((ref) => ref.refId) } : raw
      return createSfIntentInputProducer({ ...dependencies, imports, readSelectionContext: readers.readSelectionContext,
        selectedPreviewRef: readers.previewSelection(object(selection).importPreview) }).prepare(selection, request, call)
    } }, { skillIds: ["sf-enquadrar-decisao"], verify: async (value, request, call) => {
      const parsed = decodeSfSkillInput("DecisionIntentInput", value)
      if (!parsed.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const selected = await scoped.read(request.caseRef, "sf-enquadrar-decisao", call)
      if (selected.status !== "ok") return selected
      if (Object.hasOwn(object(selected.value.selection), "previewRef") || Object.hasOwn(object(selected.value.selection), "importRequest"))
        return imported ? imported().verifier.verify(value, request, call) : { status: "unavailable", reason: "import-analysis-reader-unavailable" }
      return createSfIntentVerifier({ ...dependencies, imports, replayIntent: business.cases.prepareIntentForCase,
        selectedPreviewRef: readers.previewSelection(parsed.value.importPreview) }).verify(value, request, call)
    } })
  }

  if (input.documents) {
    const documentHost = input.documents.documents.evidenceHost
    const documentLimits = sfDocumentAnalysisLimits
    add({ skillIds: ["sf-extrair-evidencias"], prepare: async (raw, request, call) => {
      const fields = object(raw)
      const publicSelection = Object.hasOwn(fields, "documentRef") || Object.hasOwn(fields, "caseRef")
      const allowed = publicSelection ? ["caseRef", "documentRef", "fieldSchemaRef"] : ["authorizedFileRef", "fieldSchemaRef", "limits"]
      const documentRef = publicSelection ? fields.documentRef : fields.authorizedFileRef
      if (Object.keys(fields).length !== 3 || Object.keys(fields).some((key) => !allowed.includes(key)) ||
        typeof documentRef !== "string" || !documentRef.trim() || typeof fields.fieldSchemaRef !== "string" || !fields.fieldSchemaRef.trim() ||
        (publicSelection ? digestSfValue(fields.caseRef) !== digestSfValue(request.caseRef) : digestSfValue(fields.limits) !== digestSfValue(documentLimits)))
        return { status: "needs-input", reason: "document-analysis-selection-invalid" }
      return createSfDocumentAnalysisInput({ cases: business.cases, host: authority.host, documents: documentHost,
        authorize: (context) => authority.human.authorize(context, "analysis.prepare", { request, selection: raw })
      })(call, { caseRef: request.caseRef, documentRef, fieldSchemaRef: fields.fieldSchemaRef })
    } }, createSfDocumentExtractionVerifier({ ...dependencies, documentHost, documentLimits }))
    add(createSfContractInputProducer({ ...dependencies, documentHost }), createSfContractReviewVerifier({ ...dependencies, documentHost }))
    add(createSfEvidenceReviewInputProducer({ ...dependencies, documentHost }), createSfEvidenceReviewVerifier({ ...dependencies, documentHost,
      readCurrentClaimBindings: readers.readCurrentClaimBindings, dashboardRecord: business.dashboardRecords }))
  } else absent(["sf-extrair-evidencias", "sf-revisar-condicoes-contratuais", "sf-revisar-evidencias"], ["documents.evidenceHost"])

  if (bindings.changeProposals) add(createSfPurchaseInputProducer(dependencies), createSfPurchasePreparationVerifier({ ...dependencies, changeProposals: bindings.changeProposals }))
  else absent(["sf-preparar-compra"], ["decisions.changeStore.readSet"])
  if (bindings.reviews) {
    add(createSfExecutiveInputProducer({ ...dependencies, reviews: bindings.reviews, confirmations, readHumanSelection: scoped.read }),
      createSfExecutiveReviewVerifier({ ...dependencies, reviews: bindings.reviews, confirmations, readHumanSelection: scoped.read }))
    if (bindings.artifacts) add(createSfMeetingInputProducer({ ...dependencies, reviews: bindings.reviews, results: business.results }),
      createSfMeetingVerifier({ ...dependencies, reviews: bindings.reviews, artifacts: bindings.artifacts, results: business.results }))
    else absent(["sf-produzir-material-reuniao"], ["reviews.artifacts.inclusion"])
  } else absent(["sf-preparar-revisao-executiva", "sf-produzir-material-reuniao"], ["reviews.reviews"])
  if (bindings.biSelection || bi) {
    const producer = createSfBiInputProducer({ ...dependencies, biSelection: readBiSelection })
    add({ skillIds: producer.skillIds, prepare: async (raw, request, call) => {
      if (Object.hasOwn(object(raw), "dashboardSelection")) return producer.prepare(raw, request, call)
      if (!explicitSelectionKey(raw, "bi")) return { status: "needs-input", reason: "bi-human-selection-required" }
      const selected = await readBiSelection(request.caseRef, call)
      if (selected.status !== "ok") return selected
      const views = selected.value.approvedViews.filter((view) => view.id === selected.value.viewId)
      if (views.length !== 1) return { status: "unavailable", reason: "bi-approved-view-ambiguous" }
      return producer.prepare({ viewId: selected.value.viewId, version: views[0]!.version, filters: selected.value.authorizedFilters,
        dashboardSelection: selected.value.dashboardSelection }, request, call)
    } }, createSfBiVerifier({ ...dependencies, readBiSelection }))
  }
  else absent(["sf-produzir-bi-contextual"], ["bi.durableHumanSelection", "bi.artifacts.read"])
  if (bindings.portfolioProof) {
    add(createSfPortfolioInputProducer(dependencies), createSfPortfolioVerifier({ ...dependencies, portfolioProof: bindings.portfolioProof,
      readAlternativeCapture: bindings.readAlternativeCapture, replayAlternative: bindings.replayAlternative }))
    if (bindings.selectedSensitivity && bindings.units) {
      const sensitivity = { ...dependencies, selectedSensitivity: readSensitivity, portfolioProof: bindings.portfolioProof, units: bindings.units }
      const producer = createSfSensitivityInputProducer(sensitivity)
      add({ skillIds: producer.skillIds, prepare: async (raw, request, call) => {
        const fields = object(raw)
        if (!Object.hasOwn(fields, "selectionKey")) return producer.prepare(raw, request, call)
        if (fields.selectionKey !== "sensitivity") return { status: "needs-input", reason: "sensitivity-human-selection-required" }
        return producer.prepare(Object.fromEntries(Object.entries(fields).filter(([key]) => key !== "selectionKey")), request, call)
      } }, createSfSensitivityVerifier(sensitivity))
    } else absent(["sf-avaliar-sensibilidade"], [!bindings.selectedSensitivity ? "portfolio.selectedSensitivity" : "", !bindings.units ? "portfolio.units.resolve" : ""].filter(Boolean))
  } else absent(["sf-compor-portfolio", "sf-avaliar-sensibilidade"], ["portfolio.proof"])
  if (bindings.selectedMaterialChanges) {
    const materiality = { ...dependencies, collaboration: business.collaboration, selectedMaterialChanges: bindings.selectedMaterialChanges }
    add(createSfReevaluationInputProducer(materiality), createSfCommitmentReevaluationVerifier(materiality))
  } else absent(["sf-reavaliar-compromissos"], ["memory.materiality.selectedChanges"])
  const caseRecall = bindings.caseRecall ?? business.caseRecall
  add(createSfMemoryInputProducer({ ...dependencies, caseRecall }), { skillIds: ["sf-consultar-memoria-decisoria"], verify: async (value, request, call) => {
    const parsed = decodeSfSkillInput("DecisionRecallInput", value)
    if (!parsed.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
    return createSfDecisionMemoryVerifier({ ...dependencies, caseRecall, readRecallSelection: readers.recallSelection(parsed.value) }).verify(value, request, call)
  } })

  const bound = createSfAnalysisServices({ dependencies, selected: input.selected, bindings: {}, selectionScope: scoped.selectionScope,
    pairs: producers.map((producer) => {
      const matching = verifiers.filter((verifier) => digestSfValue([...verifier.skillIds].sort()) === digestSfValue([...producer.skillIds].sort()))
      if (matching.length !== 1) throw new Error("SF_ANALYSIS_PAIR_MISSING")
      return { producer, verifier: matching[0]! }
    }), authorizeSelection: (call, captured) => authority.human.authorize(call, "analysis.prepare", captured) })
  const prepare = async (selection: unknown, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<PortResult<unknown>> => {
    const captured = structuredClone({ request, selection })
    const digest = digestSfValue(captured)
    if (call.kind !== "ui" || !await authority.human.authorize(call, "analysis.prepare", captured) || !await authority.host.revalidate(call))
      return { status: "denied", reason: "analysis-input-authority-unavailable" }
    return business.withCase(call, captured.request.caseRef, {}, async () => {
      const result = await bound.prepare(call, captured)
      if (!await authority.human.authorize(call, "analysis.prepare", captured) || !await authority.host.revalidate(call) || digestSfValue(captured) !== digest)
        return { status: "denied", reason: "analysis-input-authority-changed" }
      return result
    })
  }
  const availability = sfAnalysisSkillIds.map((skillId) => {
    const count = (values: readonly { skillIds: readonly string[] }[]) => values.flatMap((value) => value.skillIds.filter((id) => id === skillId)).length
    const producerCount = count(producers), verifierCount = count(verifiers)
    const limitations = [
      ...(skillId === "sf-compor-portfolio" && (!bindings.readAlternativeCapture || !bindings.replayAlternative) ? ["alternative-output-capture-and-replay-unavailable"] : []),
      ...(skillId === "sf-produzir-material-reuniao" ? ["factual-routine-results-unavailable-without-public-C07-adapter"] : []),
      ...(skillId === "sf-preparar-revisao-executiva" ? ["routine-results-and-admitted-runs-unavailable-without-public-C07-adapter"] : []),
      ...(skillId === "sf-revisar-dependencias" ? ["human-declared-constraints-remain-unverified-no-free-capacity-inference"] : []),
    ]
    return { skillId, registered: producerCount === 1 && verifierCount === 1, producerCount, verifierCount, missing: missing.get(skillId) ?? [], limitations }
  })
  return { registry: { prepare, verify: bound.verify }, producers, verifiers: bound.verifiers, availability, readers, readAuthorAnalysis: readers.readAuthorAnalysis,
    readHistoricalAuthor: readers.readHistoricalAuthor, resolveReviewTarget: review.resolveReviewTarget }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function explicitSelectionKey(value: unknown, key: "bi" | "sensitivity") {
  const fields = object(value)
  return Object.keys(fields).length === 1 && fields.selectionKey === key
}

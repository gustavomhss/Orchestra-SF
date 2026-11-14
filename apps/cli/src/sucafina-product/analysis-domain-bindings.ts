import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput, decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createCriterionResultBindings } from "../../../../modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import { createSfPlannerMaterialityAccess } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/planner-materiality.ts"
import { rankSfAtlasRecall } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createSfAnalysisSelectionScope } from "./analysis-selection-scope.ts"
import { createSfAnalysisBiBindings } from "./analysis-bi-bindings.ts"
import type { SfAnalysisPreparation, SfAnalysisServiceBindings } from "./analysis-services.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Compose registered domain producers over one installation, case store and human-selection authority. */
export function createSfAnalysisDomainBindings(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  workspace: Parameters<typeof createSfAnalysisBiBindings>[0]["workspace"]
  selectionWrites: WeakSet<object>
  readAuthorAnalysis: NonNullable<SfAnalysisServiceBindings["critique"]>["readAuthorAnalysis"]
  changeProposals?: NonNullable<SfAnalysisServiceBindings["purchase"]>["changeProposals"]
  portfolio?: SfAnalysisServiceBindings["portfolio"]
  sensitivity?: Pick<NonNullable<SfAnalysisServiceBindings["sensitivity"]>, "portfolioProof" | "units"> & {
    bindings: Pick<ReturnType<typeof createCriterionResultBindings>, "read">
  }
  materiality?: Pick<Parameters<typeof createSfPlannerMaterialityAccess>[0], "registry" | "produce">
}) {
  const host = input.authority.host
  const skills = ["sf-produzir-bi-contextual", "sf-consultar-memoria-decisoria", "sf-contestar-decisao",
    ...(input.sensitivity ? ["sf-avaliar-sensibilidade"] : []), ...(input.materiality ? ["sf-reavaliar-compromissos"] : [])]
  const scoped = createSfAnalysisSelectionScope({ authority: input.authority, cases: input.business.cases, selectionWrites: input.selectionWrites, skills,
    prepareMaterial: async (incoming, call): Promise<PortResult<Readonly<Record<string, unknown>>>> => incoming.request.skillId === "sf-produzir-bi-contextual"
      ? bi.prepare(incoming, call) : { status: "ok", value: {} } })
  const bi = createSfAnalysisBiBindings({ authority: input.authority, business: input.business, workspace: input.workspace, selection: scoped.read })
  const readRecallSelection: NonNullable<SfAnalysisServiceBindings["memory"]>["readRecallSelection"] = async (caseRef, call) => {
    const selected = await scoped.read(caseRef, "sf-consultar-memoria-decisoria", call)
    if (selected.status !== "ok") return selected
    const decoded = decodeSfSkillInput("DecisionRecallInput", selected.value.selection)
    return decoded.ok && same(decoded.value.currentCase, caseRef) && !decoded.value.recallScope.includeHistorical && decoded.value.recallScope.cases.length > 0
      ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "memory-human-selection-unavailable" }
  }
  const caseRecall: ReturnType<typeof createSfCaseRecall> = async (request, call) => {
    const atlas = input.business.atlasRecall()
    if (!atlas) return { status: "unavailable" }
    const currentRef = request.caseRef
    if (!Number.isSafeInteger(currentRef.version) || !currentRef.version) return { status: "unavailable" }
    const selected = await readRecallSelection({ id: currentRef.id, incarnation: currentRef.incarnation, version: currentRef.version }, call)
    if (selected.status !== "ok" || !same(request.scope, { query: selected.value.query, recallScope: selected.value.recallScope })) return { status: "unavailable" }
    const recalled = await createSfCaseRecall({ host, cases: input.business.cases, ...atlas, rank: rankSfAtlasRecall,
      selectCandidates: async (source, binding, scope) => {
        const choice = await readRecallSelection({ id: source.case.id, incarnation: source.case.incarnation, version: source.case.version }, binding)
        return choice.status === "ok" && same(scope, { query: choice.value.query, recallScope: choice.value.recallScope }) && same(choice.value.recallScope.period, source.case.horizon)
          ? choice.value.recallScope.cases.map((ref) => ({ id: ref.id, incarnation: ref.incarnation })) : undefined
      } })(request, call)
    const again = await readRecallSelection({ id: currentRef.id, incarnation: currentRef.incarnation, version: currentRef.version }, call)
    return input.business.atlasRecall() === atlas && again.status === "ok" && same(again.value, selected.value) && await host.revalidate(call) ? recalled : { status: "unavailable" }
  }
  const bindings: SfAnalysisServiceBindings = {
    intent: {
      replayIntent: input.business.cases.prepareIntentForCase,
      readSelectionContext: async (caseRef, selection, call) => {
        const current = await input.business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
        if (current.status !== "ok" || !same({ id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }, caseRef) || !selection.evidenceRefIds.length) return { status: "needs-input", reason: "intent-record-context-required" }
        const refs = selection.evidenceRefIds.flatMap((id) => current.value.evidenceRefs.filter((ref) => ref.refId === id))
        if (refs.length !== selection.evidenceRefIds.length || new Set(refs.map((ref) => ref.refDigest)).size !== refs.length) return { status: "unavailable", reason: "intent-evidence-selection-unavailable" }
        const sources = await input.business.context.context({ refs }, call)
        if (sources.length !== refs.length || sources.some((value, index) => value.state !== "fresh" || !value.currentRef || !value.authorizedProjection || !same(value.ref, refs[index]) || !same(value.currentRef, value.ref))) return { status: "unavailable", reason: "intent-evidence-selection-unavailable" }
        const records = refs.flatMap((ref, index) => ref.kind === "record" ? [{ ref, checkedAt: sources[index]!.checkedAt }] : [])
        const surface = records[0]?.ref.target.surface
        if (!surface || records.some(({ ref, checkedAt }) => ref.target.surface !== surface || !same(ref.target.period, current.value.case.horizon) || !ref.target.fields.length || !Number.isFinite(Date.parse(checkedAt)))) return { status: "needs-input", reason: "intent-homogeneous-record-context-required" }
        const sourceRefs: SourceRef[] = records.map(({ ref, checkedAt }) => ({ surface: ref.target.surface, type: ref.target.recordType, id: ref.target.recordId,
          incarnation: ref.target.incarnation, version: ref.target.version, fields: [...ref.target.fields], period: structuredClone(ref.target.period!), observedAt: checkedAt }))
        const again = await input.business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
        if (again.status !== "ok" || !same(again.value.case, current.value.case) || !await host.revalidate(call)) return { status: "unavailable", reason: "intent-selection-changed" }
        return { status: "ok", value: { surface, period: current.value.case.horizon, currency: current.value.case.currency, sourceRefs } }
      },
    },
    bi: bi.binding,
    memory: { caseRecall, readRecallSelection },
    purchase: input.changeProposals ? { changeProposals: input.changeProposals } : {},
    critique: { readAuthorAnalysis: input.readAuthorAnalysis,
      readAnswerEffectSelection: async (caseRef, call) => {
        const selected = await scoped.read(caseRef, "sf-contestar-decisao", call)
        if (selected.status !== "ok") return selected
        const choice = object(selected.value.selection)
        if (Object.keys(choice).some((key) => !["authorRunRef", "outputDigest", "choiceRefs", "alternativeRefs", "evidenceRefIds", "responseRef"].includes(key)) ||
          typeof choice.authorRunRef !== "string" || typeof choice.outputDigest !== "string" || !Array.isArray(choice.choiceRefs) || !choice.choiceRefs.length || !Array.isArray(choice.alternativeRefs) || !choice.alternativeRefs.length || !Array.isArray(choice.evidenceRefIds)) return { status: "unavailable", reason: "critique-human-selection-unavailable" }
        if (Object.hasOwn(choice, "responseRef")) return { status: "unavailable", reason: "historical-answer-effect-unavailable" }
        const author = await input.readAuthorAnalysis(choice.authorRunRef, choice.outputDigest, call)
        return author.status === "ok" && same(author.value.run.caseRef, caseRef) && await host.revalidate(call)
          ? { status: "ok", value: { state: "none" } } : { status: "unavailable", reason: "current-author-analysis-unavailable" }
      } },
    ...(input.portfolio ? { portfolio: input.portfolio } : {}),
  }
  if (input.sensitivity) {
    const sensitivity = input.sensitivity
    bindings.sensitivity = { portfolioProof: sensitivity.portfolioProof, units: sensitivity.units,
      selectedSensitivity: async (caseRef, call) => {
        const selected = await scoped.read(caseRef, "sf-avaliar-sensibilidade", call)
        if (selected.status !== "ok") return selected
        const parsed = decodeSfOperationInput("sf_sensitivity_evaluate", object(selected.value.selection).request)
        const request = host.requestFor(call)
        if (!parsed.ok || !request) return { status: "unavailable", reason: "sensitivity-human-selection-unavailable" }
        const matched = await input.authority.state.read(request, "cases", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
          ? Object.values(state.decisionResults ?? {}).filter((result) => result.kind === "sensitivity" && same(result.caseRef, caseRef) && result.requestDigest === digestSfValue(parsed.value)).map((result) => result.resultRef) : undefined)
        if (matched.status !== "ok" || matched.value?.length !== 1) return { status: "unavailable", reason: "sensitivity-result-selection-unavailable" }
        const resultRef = matched.value[0]!
        const binding = await sensitivity.bindings.read({ caseRef, resultRef }, call)
        const result = await input.business.results.read({ kind: "sensitivity", resultRef }, call)
        if (binding.status !== "ok" || result.status !== "ok" || result.value.kind !== "sensitivity" || !same(binding.value.request, parsed.value) || !same(binding.value.caseRef, caseRef) ||
          !await sensitivity.portfolioProof.verifySensitivity(binding.value, result.value, call) || !await host.revalidate(call)) return { status: "unavailable", reason: "sensitivity-proof-unavailable" }
        return { status: "ok", value: { binding: binding.value, result: result.value } }
      } }
  }
  if (input.materiality) {
    const materiality = input.materiality
    bindings.reevaluation = { selectedMaterialChanges: async (caseRef, call) => {
      const selected = await scoped.read(caseRef, "sf-reavaliar-compromissos", call)
      if (selected.status !== "ok") return selected
      const choice = object(selected.value.selection)
      const ids = choice.materialChangeIds
      if (typeof choice.choiceId !== "string" || !Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((id: unknown) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) return { status: "unavailable", reason: "material-change-selection-unavailable" }
      const access = createSfPlannerMaterialityAccess({ ...materiality, caseRef, host, cases: input.business.cases,
        authorizeEvidence: async (refs, current) => {
          if (!refs.length) return false
          const found = await input.business.context.context({ refs }, current)
          return found.length === refs.length && found.every((value, index) => value.state === "fresh" && !!value.authorizedProjection && !!value.currentRef && same(value.ref, refs[index]) && same(value.currentRef, value.ref)) && await host.revalidate(current)
        } })
      const values = await Promise.all((ids as string[]).map((id) => access(id, call)))
      if (values.some((value, index) => value.status !== "ok" || value.snapshot.condition.id !== ids[index] || value.snapshot.condition.choice.id !== choice.choiceId)) return { status: "unavailable", reason: "material-change-source-unavailable" }
      const again = await Promise.all((ids as string[]).map((id) => access(id, call)))
      if (!same(values, again) || !await host.revalidate(call)) return { status: "unavailable", reason: "material-change-source-changed" }
      return { status: "ok", value: values.flatMap((value) => value.status === "ok" ? [value.snapshot] : []) }
    } }
  }
  return { bindings, selectionScope: scoped.selectionScope, biArtifacts: bi.artifacts,
    limitations: { intentImport: "requires-host-preview-selection", historicalRecall: "unsupported-by-wp12", historicalCritique: "requires-author-history-and-answer-effect",
      preparedChanges: input.changeProposals ? "bound" : "requires-current-change-store", portfolio: input.portfolio ? "bound" : "requires-portfolio-proof-producers",
      sensitivity: input.sensitivity ? "bound" : "requires-criterion-bindings-units-and-proof", reevaluation: input.materiality ? "bound" : "requires-signal-registry-and-planner-materiality" } }
}

function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }

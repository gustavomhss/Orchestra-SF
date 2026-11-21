import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, ProjectionComponent, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { CostCoverageAssessment, ScenarioComparison, ScenarioResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { BiViewRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfStoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { sameBiProjection } from "../../../../modules/sucafina/Sucafinav1/product/analytics/projection.ts"
import { encodeCaseRef, parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfBiServices } from "./bi-services.ts"
import { sfExtendedSourceLinks } from "./extended-source-links.ts"
import { sfBiSourceNavigationKey } from "./extended-bi-navigation-view.ts"
import type { SfBiNavigation, SfBiNavigationDetail, SfBiNavigationKind } from "./extended-bi-navigation-view.ts"

type ResultKind = SfStoredDecisionResult["kind"]
type Target = { kind: "source"; source: SourceRef } | { kind: "evidence"; evidence: BusinessEvidenceRef } |
  { kind: "coverage" | "question" | "case"; reference: string } |
  { kind: "result"; reference: string; resultKind: ResultKind; expected?: SfStoredDecisionResult["result"] }
type Entry = { kind: SfBiNavigationKind; key: string; token: string; target: Target }
export type SfBiDecisionReaders = {
  results: Pick<ReturnType<typeof createSfBusinessServices>["results"], "read">
  plannerSources: Pick<ReturnType<typeof createSfBusinessServices>["plannerSources"], "resolveForecastCoverage">
  cases: Pick<ReturnType<typeof createSfBusinessServices>["cases"], "read">
  context: Pick<ReturnType<typeof createSfBusinessServices>["context"], "resolve">
  collaboration: Pick<ReturnType<typeof createSfBusinessServices>["collaboration"], "resolveQuestion">
  sourceLinks: (reference: BusinessEvidenceRef, call: TrustedDomainContext, url: URL) => Promise<readonly { label: string; url: string }[]>
}

/** Tokens describe membership in an exact projection, never permission to read it. */
export function sfBiDecisionNavigation(request: BiViewRequest, projection: DomainProjection): SfBiNavigation {
  const selected = navigation(request, projection)
  return { snapshot: selected.snapshot, entries: selected.entries.map(({ kind, key, token }) => ({ kind, key, token })) }
}

export function createSfBiDecisionNavigation(input: { business: ReturnType<typeof createSfBusinessServices>; bi: ReturnType<typeof createSfBiServices> }) {
  const { business, bi } = input
  const readers: SfBiDecisionReaders = { ...business, sourceLinks: (reference, call, url) => sfExtendedSourceLinks({ business, reference, call, url }) }
  return async (incoming: BiViewRequest, snapshot: string, token: string, call: TrustedDomainContext, url: URL): Promise<PortResult<SfBiNavigationDetail>> => {
    const request = structuredClone(incoming), binding = digestSfValue([call.kind, call.binding])
    if (call.kind !== "ui" || !["BI09", "BI10", "BI11"].includes(request.viewId) || !/^[a-f0-9]{64}$/.test(snapshot) || !/^[a-f0-9]{64}$/.test(token)) return { status: "needs-input", reason: "invalid-bi-decision-destination" }
    // A new C16 invocation consumes the fresh admission. Neither a prior BI
    // receipt nor a caller-supplied case grants navigation access.
    const presented = await bi.dispatchPresentation(request, call)
    if (presented.status !== "ok") return presented
    const projection = structuredClone(presented.value.projection)
    const selected = navigation(request, projection)
    const target = selected.entries.find((entry) => entry.token === token)?.target
    if (selected.snapshot !== snapshot || !target) return { status: "denied", reason: "destination-outside-current-bi-selection" }
    const source = business.host.requestFor(call), caseRef = await bi.caseFor(request.selectionRef, call)
    if (!source || source.signal.aborted || !caseRef || binding !== digestSfValue([call.kind, call.binding])) return { status: "denied", reason: "bi-destination-case-unavailable" }
    const read = async (): Promise<PortResult<SfBiNavigationDetail>> => {
      const detail = await readSfBiDecisionDestination(request, projection, snapshot, token, call, url, readers)
      if (detail.status !== "ok") return detail
      // Question text, coverage and authorized projections have their own
      // readers. Reopen them as well as the selected result before egress.
      const again = await readSfBiDecisionDestination(request, projection, snapshot, token, call, url, readers)
      if (again.status !== "ok") return again
      if (digestSfValue(again.value) !== digestSfValue(detail.value)) return { status: "stale", reason: "bi-destination-changed" }
      const current = await bi.source.read(request, call)
      if (current.status !== "ok") return current
      if (!sameBiProjection(current.value, projection) || navigation(request, current.value).snapshot !== snapshot) return { status: "stale", reason: "bi-decision-selection-changed" }
      const currentCase = await bi.caseFor(request.selectionRef, call)
      if (digestSfValue(currentCase) !== digestSfValue(caseRef) || !await business.host.revalidate(call) || business.host.requestFor(call) !== source || source.signal.aborted || binding !== digestSfValue([call.kind, call.binding])) return { status: "denied", reason: "bi-destination-authority-changed" }
      return detail
    }
    return business.withCase(call, caseRef, {}, read)
  }
}

/** Internal read adapter. Its caller owns C16 admission and the final case fence. */
export async function readSfBiDecisionDestination(request: BiViewRequest, projection: DomainProjection, snapshot: string, token: string, call: TrustedDomainContext, url: URL, readers: SfBiDecisionReaders): Promise<PortResult<SfBiNavigationDetail>> {
  const selected = navigation(request, projection)
  const target = selected.entries.find((entry) => entry.token === token)?.target
  if (snapshot !== selected.snapshot || !target) return { status: "denied", reason: "destination-outside-current-bi-selection" }
  return destination(target, projection, call, url, readers)
}

function navigation(request: BiViewRequest, projection: DomainProjection) {
  const components = (items: readonly ProjectionComponent[]) => items.map((item) => ({ ...item, sourceRefs: item.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) }))
  const decision = projection.decision
  const normalized = { ...projection, context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) }, components: components(projection.components),
    ...(projection.comparison ? { comparison: { ...projection.comparison, context: { ...projection.comparison.context, sourceRefs: projection.comparison.context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) } } } : {}),
    ...(decision?.kind === "scenario" ? { decision: { ...decision, scenario: { ...decision.scenario, components: components(decision.scenario.components) } } } :
      decision?.kind === "portfolio" ? { decision: { ...decision, portfolio: { ...decision.portfolio, combinations: decision.portfolio.combinations.map((item) => ({ ...item, components: components(item.components), ...(item.analysis ? { analysis: { ...item.analysis, scenario: { ...item.analysis.scenario, components: components(item.analysis.scenario.components) } } } : {}) })) } } } : {}) }
  const snapshot = digestSfValue({ request, projection: normalized })
  const targets: Target[] = []
  const evidence = (refs: readonly BusinessEvidenceRef[]) => { for (const ref of refs) targets.push({ kind: "evidence", evidence: ref }) }
  const coverage = (refs: readonly string[]) => { for (const reference of refs) targets.push({ kind: "coverage", reference }) }
  const sources = (items: readonly ProjectionComponent[]) => { for (const item of items) for (const source of item.sourceRefs) targets.push({ kind: "source", source: { ...source, observedAt: "" } }) }
  const scenario = (resultRef: string, result: ScenarioResult, comparisonRef: string, comparison: ScenarioComparison) => {
    targets.push({ kind: "result", reference: resultRef, resultKind: "scenario", expected: result }, { kind: "result", reference: comparisonRef, resultKind: "comparison", expected: comparison })
    sources(result.components); evidence(result.sourceRefs); evidence(result.costCoverage.evaluatedSourceRefs); coverage(comparison.costCoverageRefs)
    for (const entry of result.costCoverage.entries) {
      if (entry.status === "pending") { if (entry.questionRef) targets.push({ kind: "question", reference: entry.questionRef }); continue }
      evidence(entry.evidenceRefs)
    }
  }
  if (decision?.kind === "scenario") {
    scenario(decision.scenarioResultRef, decision.scenario, decision.comparisonRef, decision.comparison)
    if (decision.sensitivity && decision.sensitivityResultRef) {
      targets.push({ kind: "result", reference: decision.sensitivityResultRef, resultKind: "sensitivity", expected: decision.sensitivity })
      for (const point of decision.sensitivity.evaluated) targets.push({ kind: "result", reference: point.resultRef, resultKind: "scenario" })
      coverage(decision.sensitivity.costCoverageRefs); evidence(decision.sensitivity.evidenceRefs)
      if (decision.sensitivity.thresholdEvidence.state !== "unavailable") evidence(decision.sensitivity.thresholdEvidence.evidenceRefs)
      for (const condition of decision.sensitivity.unresolvedConditions) if (condition.questionRef) targets.push({ kind: "question", reference: condition.questionRef })
    }
  }
  if (decision?.kind === "portfolio") {
    targets.push({ kind: "result", reference: decision.portfolioResultRef, resultKind: "portfolio", expected: decision.portfolio })
    evidence(decision.portfolio.evidenceRefs)
    for (const item of decision.portfolio.combinations) {
      for (const reference of item.caseRefs) targets.push({ kind: "case", reference })
      sources(item.components); coverage(item.costCoverageRefs)
      if (item.analysis) scenario(item.analysis.scenarioResultRef, item.analysis.scenario, item.analysis.comparisonRef, item.analysis.comparison)
    }
  }
  // The optional advantage is the producer's separate persisted inverse pair.
  // Its reference and evidence are used verbatim; no arithmetic or reciprocal
  // result is synthesized by the host.
  if (decision?.kind === "scenario" && projection.comparison) {
    targets.push({ kind: "result", reference: projection.comparison.comparisonRef, resultKind: "comparison" })
    for (const value of projection.comparison.values) evidence([...value.sourceRefs, ...(value.drilldown ? [value.drilldown] : [])])
  }
  const canonical = targets.map((target) => target.kind === "result" && !target.expected ? targets.find((other) => other.kind === "result" && other.reference === target.reference && other.resultKind === target.resultKind && other.expected) ?? target : target)
  const all: Entry[] = canonical.map((target) => {
    const key = target.kind === "source" ? sfBiSourceNavigationKey(target.source) : target.kind === "evidence" ? target.evidence.refDigest : target.reference
    const expected = target.kind === "result" ? target.expected : undefined
    const identity = expected && "components" in expected ? { ...target, expected: { ...expected, components: components(expected.components) } } :
      expected && "combinations" in expected ? { ...target, expected: { ...expected, combinations: expected.combinations.map((item) => ({ ...item, components: components(item.components), ...(item.analysis ? { analysis: { ...item.analysis, scenario: { ...item.analysis.scenario, components: components(item.analysis.scenario.components) } } } : {}) })) } } : target
    return { kind: target.kind, key, token: digestSfValue({ snapshot, target: identity }), target }
  })
  // Conflicting identities under one renderer key are unavailable, never first-match.
  const entries = all.filter((entry, index) => all.findIndex((other) => other.token === entry.token) === index && !all.some((other) => other.kind === entry.kind && other.key === entry.key && other.token !== entry.token))
  return { snapshot, entries }
}

async function destination(target: Target, projection: DomainProjection, call: TrustedDomainContext, url: URL, business: SfBiDecisionReaders): Promise<PortResult<SfBiNavigationDetail>> {
  const facts: SfBiNavigationDetail["facts"][number][] = [], tables: SfBiNavigationDetail["tables"][number][] = [], links: SfBiNavigationDetail["links"][number][] = []
  const detail = (title: string, reference: string): PortResult<SfBiNavigationDetail> => ({ status: "ok", value: { title, reference, facts, tables, links } })
  const scalar = (value: string | number | boolean | null | undefined) => value === null || value === undefined ? "Indisponível" : String(value)
  const showCoverage = (value: CostCoverageAssessment) => {
    facts.push({ label: "Cobertura", value: value.coverageState }, { label: "Período", value: `${value.horizon.start} – ${value.horizon.end}` }, { label: "Moeda", value: value.currency })
    tables.push({ title: "Categorias e justificativas preservadas", columns: ["Categoria", "Situação", "Justificativa", "Evidências ou pergunta"], rows: value.entries.map((entry) => [entry.categoryId, entry.status, entry.status === "pending" ? entry.reason : entry.status === "included" ? entry.scopeNote : entry.justification, entry.status === "pending" ? entry.questionRef ?? "" : entry.evidenceRefs.map((ref) => ref.refId).join("; ")]) })
    if (value.issues.length) facts.push({ label: "Limitações", value: value.issues.join("; ") })
  }
  if (target.kind === "result") {
    const found = await business.results.read({ kind: target.resultKind, resultRef: target.reference }, call)
    if (found.status !== "ok") return found
    if (found.value.resultRef !== target.reference || found.value.kind !== target.resultKind || target.expected && digestSfValue(found.value.result) !== digestSfValue(target.expected)) return { status: "stale", reason: "bi-recorded-result-changed" }
    facts.push({ label: "Registrado em", value: found.value.createdAt }, { label: "Case", value: encodeCaseRef(found.value.caseRef) })
    if (found.value.kind === "scenario") {
      const result = found.value.result
      facts.push({ label: "Comparação", value: result.comparisonStatus }, { label: "Subtotal conhecido", value: scalar(result.knownSubtotal) }, { label: "Total completo", value: scalar(result.total) })
      showCoverage(result.costCoverage)
      tables.push({ title: "Componentes preservados", columns: ["Componente", "Valor", "Moeda", "Início", "Fim", "Evidência"], rows: result.components.map((item) => [item.id, scalar(item.amount), item.currency, item.period.start, item.period.end, item.evidenceState]) })
      facts.push({ label: "Restrições", value: result.restrictions.join("; ") }, { label: "Condições pendentes", value: result.unresolvedConditions.join("; ") })
    }
    if (found.value.kind === "comparison") {
      const result = found.value.result
      facts.push({ label: "Comparação", value: result.comparisonStatus }, { label: "Base", value: result.baselineResultRef }, { label: "Alternativa", value: result.alternativeResultRef }, { label: "Diferença conhecida", value: scalar(result.knownDifference) }, { label: "Diferença completa", value: scalar(result.completeDifference) }, { label: "Condições pendentes", value: result.unresolvedConditions.join("; ") })
      tables.push({ title: "Critérios preservados", columns: ["Critério", "Situação", "Razão"], rows: result.criterionResults.map((item) => [item.criterionId, item.state, item.reason]) })
    }
    if (found.value.kind === "sensitivity") {
      const result = found.value.result
      facts.push({ label: "Cenário", value: result.scenarioRef }, { label: "Parâmetro", value: result.parameterRef }, { label: "Comparação", value: result.comparisonStatus }, { label: "Unidade do parâmetro", value: result.parameterUnit ?? result.unit }, { label: "Unidade do resultado", value: result.resultUnit ?? result.unit }, { label: "Limiar", value: scalar(result.threshold) }, { label: "Prova do limiar", value: result.thresholdEvidence.state })
      tables.push({ title: "Pontos preservados", columns: ["Parâmetro", "Valor", "Resultado"], rows: result.evaluated.map((item) => [scalar(item.parameterValue), scalar(item.value), item.resultRef]) })
    }
    if (found.value.kind === "portfolio") {
      facts.push({ label: "Limitações", value: found.value.result.limitations.join("; ") })
      tables.push({ title: "Combinações preservadas", columns: ["Combinação", "Elegibilidade", "Comparação", "Cases", "Restrições"], rows: found.value.result.combinations.map((item) => [item.id, item.eligibility, item.comparisonStatus, item.caseRefs.join("; "), [...item.conflicts, ...item.restrictions].join("; ")]) })
    }
    return detail("Resultado preservado", target.reference)
  }
  if (target.kind === "coverage") {
    const found = await business.plannerSources.resolveForecastCoverage(target.reference, call)
    if (found.status !== "ok") return found
    if (found.value.coverageRef !== target.reference) return { status: "stale", reason: "bi-coverage-reference-changed" }
    facts.push({ label: "Base da cobertura", value: `${found.value.basis.id} · v${found.value.basis.version}` })
    showCoverage(found.value.assessment)
    return detail("Cobertura de custos", target.reference)
  }
  if (target.kind === "question") {
    const found = await business.collaboration.resolveQuestion(target.reference, call)
    if (found.status !== "ok") return found
    if (found.value.id !== target.reference) return { status: "stale", reason: "bi-question-reference-changed" }
    facts.push({ label: "Pergunta", value: found.value.text }, { label: "Evidências autorizadas", value: found.value.evidenceRefs.map((ref) => ref.refId).join("; ") })
    return detail("Pergunta vinculada à cobertura", target.reference)
  }
  if (target.kind === "case") {
    const parsed = parseCaseRef(target.reference)
    if (!parsed) return { status: "unavailable", reason: "bi-case-reference-unavailable" }
    const found = await business.cases.read({ caseRef: target.reference }, call)
    if (found.status !== "ok") return found
    if (encodeCaseRef(found.value.case) !== target.reference) return { status: "stale", reason: "bi-case-reference-changed" }
    // Workbench's returnTo is a contract-evidence route, not a generic BI
    // return URL. Browser Back restores the BI entry's reauthorized state.
    const destination = new URL(url); destination.search = new URLSearchParams({ sf: "workbench-case", caseRef: encodeCaseRef(found.value.case) }).toString(); destination.hash = ""
    facts.push({ label: "Objetivo", value: found.value.case.objective }, { label: "Estado", value: found.value.case.state }, { label: "Versão", value: String(found.value.case.version) })
    links.push({ label: "Abrir case autorizado", url: `${destination.pathname}${destination.search}` })
    return detail("Case da combinação", target.reference)
  }
  if (target.kind !== "source" && target.kind !== "evidence") return { status: "unavailable", reason: "bi-destination-kind-unavailable" }
  const refs = evidenceClosure(projection)
  if (!refs) return { status: "unavailable", reason: "bi-evidence-closure-too-large" }
  const candidates = target.kind === "evidence" ? refs.filter((ref) => digestSfValue(ref) === digestSfValue(target.evidence)) : refs.filter((ref) => matchesSource(ref, target.source))
  const unique = candidates.filter((ref, index) => candidates.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
  if (unique.length !== 1) return { status: "unavailable", reason: "bi-component-evidence-unavailable-or-ambiguous" }
  const reference = unique[0]!
  const resolved = await business.context.resolve(reference, call)
  if (resolved.state === "revoked") return { status: "denied", reason: "bi-evidence-revoked" }
  // This lane opens the current source. Historical C17 data grants no issue,
  // reclassification, application or replacement permission.
  if (resolved.state !== "fresh" || !resolved.authorizedProjection || !resolved.currentRef || digestSfValue(resolved.ref) !== digestSfValue(reference) || digestSfValue(resolved.currentRef) !== digestSfValue(reference) || resolved.accessRevision !== call.binding.accessRevision) return { status: "unavailable", reason: "bi-current-evidence-unavailable" }
  facts.push({ label: "Estado", value: resolved.state }, { label: "Tipo", value: reference.kind })
  if ("values" in resolved.authorizedProjection) {
    const current = resolved.authorizedProjection
    facts.push({ label: "Moeda", value: current.context.currency }, { label: "Período", value: `${current.context.period.start} – ${current.context.period.end}` })
    tables.push({ title: "Valores autorizados na origem", columns: ["Campo", "Valor", "Unidade", "Início", "Fim"], rows: current.values.map((value) => [value.id, scalar(value.value), value.unit ?? value.currency ?? "", value.period.start, value.period.end]) })
  } else if ("textRange" in resolved.authorizedProjection) {
    facts.push({ label: "Campo", value: resolved.authorizedProjection.fieldCandidate }, { label: "Valor", value: scalar(resolved.authorizedProjection.value) }, { label: "Estado da evidência", value: resolved.authorizedProjection.status })
  } else if ("rationale" in resolved.authorizedProjection) facts.push({ label: "Razão preservada", value: resolved.authorizedProjection.rationale })
  else if ("rule" in resolved.authorizedProjection) facts.push({ label: "Regra autorizada", value: resolved.authorizedProjection.rule }, { label: "Escopo", value: resolved.authorizedProjection.scope })
  links.push(...await business.sourceLinks(reference, call, url))
  return detail(target.kind === "source" ? "Origem do componente" : "Evidência da análise", reference.refId)
}

function evidenceClosure(projection: DomainProjection) {
  const refs: BusinessEvidenceRef[] = []
  let bounded = true, nodes = 0
  const walk = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || !bounded) return
    if (depth > 32 || refs.length > 4096 || ++nodes > 50_000) { bounded = false; return }
    if ("schema" in value && value.schema === "sf-evidence-v1" && "refDigest" in value) refs.push(value as BusinessEvidenceRef)
    for (const nested of Object.values(value)) walk(nested, depth + 1)
  }
  walk(projection.decision, 0)
  if (projection.decision?.kind === "scenario") walk(projection.comparison, 0)
  return bounded ? refs : undefined
}

function matchesSource(reference: BusinessEvidenceRef, source: SourceRef) {
  if (reference.kind !== "record") return false
  const target = reference.target
  return target.surface === source.surface && target.recordType === source.type && target.recordId === source.id && target.incarnation === source.incarnation && target.version === source.version &&
    source.fields.length > 0 && source.fields.every((field) => target.fields.includes(field)) && !!target.period && target.period.start <= source.period.start && target.period.end >= source.period.end
}

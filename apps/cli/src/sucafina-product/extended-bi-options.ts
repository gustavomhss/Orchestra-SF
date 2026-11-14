import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfStoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { resolveDashboardBiSelection } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/bi-metadata.ts"
import { createDashboardSourceIssuer } from "../../../../modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfBiServices } from "./bi-services.ts"
import { readSfDecisionBiSelection, sfDecisionBiSelection } from "./bi-selections.ts"
import { biViews } from "../../../../modules/sucafina/Sucafinav1/product/analytics/catalog.ts"

export type SfBiChoice = { label: string; selectionRef: string; caseRef?: { id: string; incarnation: string; version: number } }
export type SfBiOptions = { choices: SfBiChoice[]; versions: { ref: string; label: string; year: number }[]; links: { label: string; surface: "planner" | "procurement" | "dashboard"; page: string }[]; limitations: string[] }

/** Enumerates explicit human choices through existing readers. No latest-result or first-version selection. */
export function createSfExtendedBiOptions(input: { authority: ReturnType<typeof createSfProductAuthority>; business: ReturnType<typeof createSfBusinessServices>; bi: ReturnType<typeof createSfBiServices>; persistence: SfScopedSourcePort }) {
  const { authority, business } = input
  const issueDashboard = createDashboardSourceIssuer({ host: authority.host, scopedSources: input.persistence })
  const caseFor = async (selectionRef: string, call: TrustedDomainContext) => {
    const parsed = readSfDecisionBiSelection(selectionRef), request = authority.host.requestFor(call)
    if (!parsed || !request || !await authority.host.revalidate(call)) return undefined
    const reference = "scenarioResultRef" in parsed ? parsed.scenarioResultRef : parsed.portfolioResultRef
    const result = await authority.state.read(request, "cases", (state, actor) => {
      if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
      const result = state.decisionResults?.[reference]
      const current = result && state.cases[result.caseRef.id]
      return current && current.incarnation === result.caseRef.incarnation && current.participants.includes(actor.principalRef) ? { id: current.id, incarnation: current.incarnation, version: current.version } : undefined
    })
    return result.status === "ok" && await authority.host.revalidate(call) ? result.value : undefined
  }
  const read = async (viewId: string, period: Period, call: TrustedDomainContext): Promise<PortResult<SfBiOptions>> => {
    if (!biViews.some((view) => view.id === viewId)) return { status: "needs-input", reason: "unknown-bi-view" }
    const request = authority.host.requestFor(call)
    if (!request || !await authority.host.revalidate(call)) return { status: "denied", reason: "bi-options-authority-unavailable" }
    const value: SfBiOptions = { choices: [], versions: [], links: [], limitations: [] }
    const dashboard = resolveDashboardBiSelection(viewId, period)
    if (dashboard) {
      const current = await issueDashboard({ ...dashboard, period }, call)
      if (current.status === "ok") value.choices.push({ label: `Dashboard · ${dashboard.page} · ${period.start} – ${period.end}`, selectionRef: current.value.selectionRef })
      else value.limitations.push(current.reason)
    }
    if (["BI01", "BI02", "BI03", "BI04"].includes(viewId)) {
      value.links.push({ label: "Gerenciar versões do Planner", surface: "planner", page: "Versions" })
      const versions = await business.plannerProduct.versions.read(undefined, call)
      if (versions.status === "ok") for (const version of versions.value.versions) {
        if (period.start.slice(0, 4) !== String(version.year) || period.end.slice(0, 4) !== String(version.year)) continue
        const source = await business.plannerProduct.issueSource(version.id, call)
        if (source.status === "ok") value.versions.push({ ref: source.value.evidence.refId, label: `${version.name || "Forecast"} (${version.id}) · ${version.year} · ${version.state} · r${source.value.evidence.target.version}`, year: version.year })
      }
      else value.limitations.push(versions.reason)
      if (!value.versions.length) value.limitations.push("Nenhuma versão autorizada cobre o período selecionado.")
    }
    if (viewId === "BI05" || viewId === "BI06") {
      value.links.push({ label: "Abrir pedidos e suas aprovações", surface: "procurement", page: "Requests" })
      const admitted = await authority.ui.admit(request, "sf_work_list", digestSfValue({ purpose: "work-selection", period }))
      if (admitted.status !== "ok") return admitted
      try {
        const selection = await business.procurementSelections.create(admitted.value, period)
        if (selection.status !== "ok") return selection
        const current = await business.procurement.list(selection.value.selectionRef, admitted.value)
        if (current.status !== "ok") return current
        value.choices.push({ label: `Pedidos autorizados · ${period.start} – ${period.end} · ${current.value.queue.length} registros`, selectionRef: selection.value.selectionRef })
      } finally { authority.ui.finish(admitted.value) }
    }
    if (["BI09", "BI10", "BI11"].includes(viewId)) {
      value.links.push({ label: "Abrir cases e resultados preservados", surface: "dashboard", page: "Workbench" })
      const found = await authority.state.read(request, "cases", (state, actor) => {
        if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return []
        return Object.values(state.decisionResults ?? {}).filter((result) => {
          const current = state.cases[result.caseRef.id]
          return current?.incarnation === result.caseRef.incarnation && current.participants.includes(actor.principalRef)
        }).map((result) => ({ result, caseRef: { id: state.cases[result.caseRef.id]!.id, incarnation: state.cases[result.caseRef.id]!.incarnation, version: state.cases[result.caseRef.id]!.version } }))
      })
      if (found.status !== "ok") return { status: "unavailable", reason: "bi-result-options-unavailable" }
      if (found.value.length > 300) return { status: "needs-input", reason: "too-many-results-select-case-in-workbench" }
      const authorized: SfStoredDecisionResult[] = []
      for (const entry of found.value) {
        const result = await business.withCase(call, entry.caseRef, {}, () => business.results.read({ kind: entry.result.kind, resultRef: entry.result.resultRef }, call))
        if (result.status === "ok") authorized.push(result.value)
      }
      const choices = new Map<string, SfBiChoice>()
      for (const result of authorized) {
        if (result.kind === "comparison") {
          const scenario = authorized.find((entry) => entry.kind === "scenario" && entry.resultRef === result.result.alternativeResultRef && digestSfValue(entry.caseRef) === digestSfValue(result.caseRef))
          if (!scenario || scenario.kind !== "scenario" || scenario.result.horizon.start !== period.start || scenario.result.horizon.end !== period.end) continue
          const sensitivities = authorized.filter((entry) => entry.kind === "sensitivity" && entry.result.scenarioRef === scenario.resultRef && digestSfValue(entry.caseRef) === digestSfValue(scenario.caseRef))
          const selected = viewId === "BI11" ? sensitivities : [undefined, ...sensitivities]
          for (const sensitivity of selected) {
            const selectionRef = sfDecisionBiSelection({ scenarioResultRef: scenario.resultRef, comparisonRef: result.resultRef, ...(sensitivity ? { sensitivityResultRef: sensitivity.resultRef } : {}) })
            choices.set(selectionRef, { label: `Case ${result.caseRef.id} · cenário ${scenario.resultRef} · comparação ${result.resultRef}${sensitivity ? ` · sensibilidade ${sensitivity.resultRef}` : ""}`, selectionRef, caseRef: result.caseRef })
          }
        }
        if (viewId !== "BI11" && result.kind === "portfolio") for (const combination of result.result.combinations) {
          const reference = combination.analysis?.scenarioResultRef
          const scenario = reference && authorized.find((entry) => entry.kind === "scenario" && entry.resultRef === reference && digestSfValue(entry.caseRef) === digestSfValue(result.caseRef))
          if (!scenario || scenario.kind !== "scenario" || scenario.result.horizon.start !== period.start || scenario.result.horizon.end !== period.end) continue
          const selectionRef = sfDecisionBiSelection({ portfolioResultRef: result.resultRef, sourceScenarioRef: scenario.resultRef })
          choices.set(selectionRef, { label: `Case ${result.caseRef.id} · portfolio ${result.resultRef} · cenário ${scenario.resultRef}`, selectionRef, caseRef: result.caseRef })
        }
      }
      for (const choice of choices.values()) {
        const selected = { viewId, selectionRef: choice.selectionRef, period }
        const admitted = await authority.ui.admit(request, "sf_bi_view", digestSfValue(selected))
        if (admitted.status !== "ok") return admitted
        try {
          // The producer fixes a call to one exact selection; each candidate gets its own authenticated read.
          const current = await business.withCase(admitted.value, choice.caseRef!, {}, () => input.bi.source.read(selected, admitted.value))
          if (current.status === "ok") value.choices.push(choice)
        } finally { authority.ui.finish(admitted.value) }
      }
      if (!value.choices.length) value.limitations.push("Nenhum conjunto de resultados preservados, vinculados e autorizado cobre este período. Selecione ou produza os resultados no case.")
    }
    return await authority.host.revalidate(call) ? { status: "ok", value } : { status: "denied", reason: "bi-options-authority-changed" }
  }
  return { read, caseFor }
}

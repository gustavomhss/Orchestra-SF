import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { ContextualBIInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createContextualBiSelectionReader } from "../../../../modules/sucafina/Sucafinav1/product/analytics/contextual.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"
import { withoutObservationTimes } from "./analysis-verifier.ts"

type BiReader = ReturnType<typeof createContextualBiSelectionReader>
type BiRead = Awaited<ReturnType<BiReader>>
type BiValue = Extract<BiRead, { status: "ok" }>["value"]

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function humanBiSelection(value: unknown): { viewId: string; version: number; filters: readonly { field: string; values: readonly string[] }[]; dashboardSelection: ContextualBIInput["dashboardSelection"] } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 4 || entries.some(([key]) => key !== "viewId" && key !== "version" && key !== "filters" && key !== "dashboardSelection")) return undefined
  const viewId = entries.find(([key]) => key === "viewId")?.[1]
  const version = entries.find(([key]) => key === "version")?.[1]
  const filters = entries.find(([key]) => key === "filters")?.[1]
  const dashboard = decodeSfOperationInput("sf_dashboard_read", entries.find(([key]) => key === "dashboardSelection")?.[1])
  if (typeof viewId !== "string" || !viewId.trim() || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 || !Array.isArray(filters) || !dashboard.ok) return undefined
  if (filters.some((filter) => !filter || typeof filter !== "object" || Array.isArray(filter) || typeof filter.field !== "string" || !filter.field.trim() || !Array.isArray(filter.values) || !filter.values.length || filter.values.some((item) => typeof item !== "string" || !item.trim()) || new Set(filter.values).size !== filter.values.length)) return undefined
  if (new Set(filters.map((filter) => filter.field)).size !== filters.length) return undefined
  return { viewId, version, filters: filters.map((filter) => ({ field: filter.field, values: [...filter.values] })), dashboardSelection: dashboard.value }
}

async function readAuthorized(dependencies: SfAnalysisDependencies & { biSelection: BiReader }, requestCase: { id: string; incarnation: string; version: number }, call: TrustedDomainContext): Promise<BiValue | undefined> {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(requestCase) }, call)
  if (current.status !== "ok" || current.value.case.id !== requestCase.id || current.value.case.incarnation !== requestCase.incarnation || current.value.case.version !== requestCase.version) return undefined
  const selected = await dependencies.biSelection(requestCase, call)
  if (selected.status !== "ok" || !selected.value.tableRef.trim() || !selected.value.canonicalProjectionRefs.length) return undefined
  const sources = await dependencies.context.context({ refs: selected.value.projectionRefs }, call)
  if (sources.length !== selected.value.projectionRefs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, selected.value.projectionRefs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  return selected.value
}

export function createSfBiInputProducer(dependencies: SfAnalysisDependencies & { biSelection: BiReader }): SfInputProducer {
  return {
    skillIds: ["sf-produzir-bi-contextual"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanBiSelection(selection)
      if (!human || !request.objective.trim() || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const first = await readAuthorized(dependencies, request.caseRef, call)
      const second = await readAuthorized(dependencies, request.caseRef, call)
      if (!first || !second || !same(withoutObservationTimes(first), withoutObservationTimes(second))) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const view = first.approvedViews.find((item) => item.id === human.viewId && item.version === human.version)
      if (!view || first.viewId !== human.viewId || !same(first.authorizedFilters, human.filters) || !same(first.dashboardSelection, human.dashboardSelection) || human.filters.some((filter) => !view.allowedFilters.includes(filter.field))) return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
      const built: ContextualBIInput = { businessQuestion: request.objective, approvedViews: first.approvedViews, projectionRefs: first.projectionRefs, authorizedFilters: first.authorizedFilters, dashboardSelection: first.dashboardSelection }
      const decoded = decodeSfSkillInput("ContextualBIInput", built)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}

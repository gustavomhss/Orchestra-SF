import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { variance } from "../../src/planner-accounts.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ForecastCompareRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { plannerMonthlyPrefix } from "./bi.ts"
import { projectPlannerSource } from "./port.ts"
import { projectionDigest } from "./scenario-comparison-port.ts"

type InsightRefs = readonly BusinessEvidenceRef[]
type ForecastInsights = { budgetMargin: { value: number | null; currency: string; evidenceRefs: InsightRefs }; absentActual: readonly { valueId: string; evidenceRefs: InsightRefs }[]; inheritedBudget: readonly { valueId: string; evidenceRefs: InsightRefs }[]; responsibles: readonly { valueId: string; responsibleRef: string; evidenceRefs: InsightRefs }[] }

/** The margin is candidate outlook minus budget; a positive value means spending above budget. */
export function createPlannerForecastInsights(input: { host: DomainPortHost; planner: Pick<PlannerPort, "compareForecast">; sources: PlannerSourceHost }) {
  return async (request: ForecastCompareRequest, context: TrustedDomainContext): Promise<PortResult<ForecastInsights>> => {
    const http = input.host.requestFor(context)
    if (!http || http.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "insights-authority-unavailable" }
    const source = await input.sources.resolveForecastSource(request.candidateRef, context)
    if (source.status !== "ok") return source
    const compare = () => input.planner.compareForecast(request, context)
    const first = await compare()
    if (first.status !== "ok") return first
    if (!first.value.sourceRefs.some((ref) => ref.refDigest === source.value.evidence.refDigest)) return { status: "stale", reason: "insights-source-changed" }
    const projection = first.value.candidate
    const read = () => input.host.persistence.transaction("planner", async (snapshot) => {
      const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const current = projectPlannerSource(snapshot, actor, source.value.versionId)
      if (!current || digestSfValue({ versionId: source.value.versionId, projection: current }) !== source.value.evidence.target.projectionDigest) return { commit: false, value: undefined }
      return { commit: false, value: current }
    }, { signal: http.signal }).catch(() => undefined)
    const sourceProjection = await read()
    if (!sourceProjection) return { status: "stale", reason: "insights-source-changed" }
    const refs = [source.value.evidence]
    const prefix = plannerMonthlyPrefix(projection.components)
    const budgets = projection.values.filter((value) => value.id.startsWith(`${prefix}:`) && value.id.endsWith(":budget"))
    const outlooks = projection.values.filter((value) => value.id.startsWith(`${prefix}:`) && value.id.endsWith(":outlook"))
    const known = budgets.length > 0 && budgets.length === outlooks.length && [...budgets, ...outlooks].every((value) => value.evidenceState !== "absent" && value.currency === "USD" && typeof value.value === "number" && Number.isFinite(value.value))
    const delta = known ? variance(outlooks.reduce((sum, value) => sum + Number(value.value), 0), budgets.reduce((sum, value) => sum + Number(value.value), 0)).value : null
    const lines = rows(object(sourceProjection.summary).lines)
    const absentActual = projection.components.flatMap((component) => {
      const value = projection.values.find((entry) => entry.id === `${component.id}:actual`)
      return value?.evidenceState === "absent" ? [{ valueId: value.id, evidenceRefs: value.sourceRefs }] : []
    })
    const inheritedBudget = projection.components.flatMap((component) => {
      const forecast = projection.values.find((entry) => entry.id === `${component.id}:forecast`)
      const outlook = projection.values.find((entry) => entry.id === `${component.id}:outlook-usd`)
      return forecast?.evidenceState === "absent" && outlook?.evidenceState === "estimated" ? [{ valueId: outlook.id, evidenceRefs: outlook.sourceRefs }] : []
    })
    const responsibles = projection.components.flatMap((component) => {
      const split = component.id.lastIndexOf(":")
      const line = lines.find((entry) => entry.id === component.id.slice(0, split))
      const responsibleRef = text(line?.ownerId) || text(object(line?.owner).id)
      return responsibleRef ? [{ valueId: `${component.id}:outlook-usd`, responsibleRef, evidenceRefs: refs }] : []
    })
    const latest = await compare()
    const sourceAgain = await input.sources.resolveForecastSource(request.candidateRef, context)
    const after = await read()
    if (latest.status !== "ok" || projectionDigest(latest.value.candidate) !== projectionDigest(projection) || sourceAgain.status !== "ok" || sourceAgain.value.evidence.refDigest !== source.value.evidence.refDigest || !after || digestSfValue(after) !== digestSfValue(sourceProjection) || http.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "insights-source-or-authority-changed" }
    return { status: "ok", value: { budgetMargin: { value: delta !== null && Number.isFinite(delta) ? delta : null, currency: "USD", evidenceRefs: refs }, absentActual, inheritedBudget, responsibles } }
  }
}

import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { Period } from "../contracts/context.ts"
import type { DomainPortHost, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createPlannerSourceIssuer } from "./source-issuer.ts"
import type { createPlannerVersionsHost } from "./versions-host.ts"
import { plannerOverview } from "./overview.ts"

export type PlannerOverviewRequest = { baseVersionId: string; candidateVersionId: string; period: Period }

/** Resolve actual version selections, including the year's official, through the shared Planner port. */
export function createPlannerOverviewHost(input: { host: DomainPortHost; planner: Pick<PlannerPort, "compareForecast">; issueSource: ReturnType<typeof createPlannerSourceIssuer>; versions: Pick<ReturnType<typeof createPlannerVersionsHost>, "read"> }) {
  return async (incoming: PlannerOverviewRequest, context: TrustedDomainContext): Promise<PortResult<Extract<ReturnType<typeof plannerOverview>, { status: "ok" }>["value"]>> => {
    if (!incoming || Object.keys(incoming).length !== 3 || Object.keys(incoming).some((key) => !["baseVersionId", "candidateVersionId", "period"].includes(key)) || ![incoming.baseVersionId, incoming.candidateVersionId].every((value) => typeof value === "string" && value.trim()) || !isSfPeriod(incoming.period)) return { status: "needs-input", reason: "invalid-overview-request" }
    const request = structuredClone(incoming)
    const versions = await input.versions.read(request.candidateVersionId, context)
    if (versions.status !== "ok") return versions
    const candidate = versions.value.versions.find((version) => version.id === request.candidateVersionId)
    const baseline = versions.value.versions.find((version) => version.id === request.baseVersionId)
    if (!candidate || !baseline || candidate.year !== baseline.year || candidate.year !== Number(request.period.start.slice(0, 4)) || candidate.year !== Number(request.period.end.slice(0, 4))) return { status: "needs-input", reason: "overview-version-period-mismatch" }
    const officials = versions.value.versions.filter((version) => version.year === candidate.year && version.state === "official")
    if (officials.length > 1) return { status: "unavailable", reason: "ambiguous-official-version" }
    const ids = [...new Set([request.baseVersionId, request.candidateVersionId, ...officials.map((version) => version.id)])]
    const issued = await Promise.all(ids.map((id) => input.issueSource(id, context)))
    const failed = issued.find((source) => source.status !== "ok")
    if (failed && failed.status !== "ok") return failed
    const sources = new Map(issued.flatMap((source, index) => source.status === "ok" ? [[ids[index]!, source.value.evidence.refId] as const] : []))
    const compare = (baseId: string) => input.planner.compareForecast({ baseRef: sources.get(baseId)!, candidateRef: sources.get(request.candidateVersionId)!, period: request.period, currency: "USD" }, context)
    const analysis = await compare(request.baseVersionId)
    if (analysis.status !== "ok") return analysis
    const official = officials[0] ? await compare(officials[0].id) : undefined
    if (official && official.status !== "ok") return official
    const latest = await input.versions.read(request.candidateVersionId, context)
    if (latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(versions.value) || !await input.host.revalidate(context)) return { status: "stale", reason: "overview-version-or-authority-changed" }
    // Recheck all scoped sources after the optional official comparison crossed async boundaries.
    const refreshed = await Promise.all(ids.map((id) => input.issueSource(id, context)))
    if (refreshed.some((source, index) => {
      const previous = issued[index]
      return source.status !== "ok" || !previous || previous.status !== "ok" || source.value.evidence.refDigest !== previous.value.evidence.refDigest
    }) || !await input.host.revalidate(context)) return { status: "stale", reason: "overview-source-changed" }
    return plannerOverview(analysis.value, official?.status === "ok" ? official.value.baseline : undefined)
  }
}

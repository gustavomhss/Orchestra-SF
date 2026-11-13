import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { Period } from "../contracts/context.ts"
import type { DashboardPort, DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createDashboardRecordEvidenceHost } from "./sources.ts"
import type { DashboardSourceHost } from "./port.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import { projectDashboardScope } from "./scope.ts"

/** Selects authorized domain records for an agenda without recalculating partial aggregates. */
export function createDashboardAgendaSelector(input: { dashboard: DashboardPort; sources: DashboardSourceHost; recordEvidence: Pick<ReturnType<typeof createDashboardRecordEvidenceHost>, "issue" | "resolve">; host: DomainPortHost }) {
  return async (request: { selectionRef: string; topic: string; period: Period; recordRefs?: readonly string[] }, context: TrustedDomainContext) => {
    if (!request || !request.selectionRef || !isSfPeriod(request.period) || (request.recordRefs !== undefined && (!Array.isArray(request.recordRefs) || request.recordRefs.some((ref) => typeof ref !== "string" || !ref) || new Set(request.recordRefs).size !== request.recordRefs.length))) return { status: "needs-input" as const, reason: "invalid-agenda-selection" }
    const topic = request.topic === "budget" ? { page: "Budget Overview", collections: ["opexOwners", "capexProjects"], fields: ["opexOwners", "opexEntries", "capexProjects", "capexEntries", ...(request.period.start.endsWith("01-01") && request.period.end.endsWith("12-31") ? ["budgetMetrics"] : ["budgetSeries"])] } : request.topic === "projects" ? { page: "Portfolio Dashboard", collections: ["projects"], fields: ["projects", "milestoneDates"] } : request.topic === "hot-topics" ? { page: "Hot Topics & Actions", collections: ["hotTopics"], fields: ["hotTopics"] } : request.topic === "talent-review" ? { page: "Talent Review", collections: ["members"], fields: ["members", "leaders"] } : ({ "opex-detail": { page: "OPEX Detail", collections: ["opexOwners"], fields: ["opexOwners", "opexEntries"] }, "capex-projects": { page: "CAPEX Projects", collections: ["capexProjects"], fields: ["capexProjects", "capexEntries"] }, headcount: { page: "Headcount Overview", collections: ["members"], fields: ["members"] }, "team-structure": { page: "Team Structure", collections: ["leaders"], fields: ["leaders"] }, "all-projects": { page: "All Projects", collections: ["projects"], fields: ["projects", "milestoneDates"] }, "it-operations": { page: "IT Operations", collections: ["opsTickets"], fields: ["opsTickets"] }, "it-security": { page: "IT Security KPIs", collections: ["secKpi"], fields: ["secKpi"] }, "it-risks": { page: "IT Risks", collections: ["risks"], fields: ["risks"] }, "vendor-contracts": { page: "Vendor Contracts", collections: ["contracts"], fields: ["contracts"] }, stakeholders: { page: "Stakeholder Management", collections: ["stakeholders"], fields: ["stakeholders"] } } as Record<string, { page: string; collections: string[]; fields: string[] }>)[request.topic]
    if (["executive", "it-performance"].includes(request.topic)) return { status: "unavailable" as const, reason: "agenda-source-identity-unavailable" }
    if (!topic) return { status: "needs-input" as const, reason: "invalid-agenda-topic" }
    const http = input.host.requestFor(context)
    if (!http || !await input.host.revalidate(context)) return { status: "denied" as const, reason: "agenda-authority-unavailable" }
    const selected = await input.sources.resolveDashboardSource(request.selectionRef, context, { fields: topic.fields, period: request.period })
    if (selected.status !== "ok") return selected
    if (selected.value.page !== topic.page) return { status: "denied" as const, reason: "agenda-page-mismatch" }
    const result = await input.dashboard.read({ selectionRef: request.selectionRef, fields: topic.fields, period: request.period }, context)
    if (result.status !== "ok") return result
    if (request.recordRefs?.length !== 0 && (result.value.missing.some((entry) => topic.collections.some((collection) => entry.field === `${collection}:duplicate-id`)) || result.value.values.some((value) => topic.collections.some((collection) => value.id.startsWith(`${collection}[`) && new RegExp(`^${collection}\\[\\d+\\]`).test(value.id))))) return { status: "unavailable" as const, reason: "agenda-identity-ambiguous" }
    const environment = await input.host.environment(http)
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable" as const, reason: "agenda-observation-unavailable" }
    const day = new Date(environment.at).toISOString().slice(0, 10)
    const scoped = await input.host.persistence.transaction("dashboard", async (snapshot) => {
      const principal = await input.host.authenticate(http, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
      const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      return { commit: false, value: projectDashboardScope(snapshot, actor, { page: topic.page, fields: topic.fields, period: request.period }, environment.at) }
    })
    if (!scoped || digestSfValue(scoped) !== selected.value.evidence.target.projectionDigest) return { status: "stale" as const, reason: "agenda-source-changed" }
    if (request.recordRefs?.length !== 0 && topic.collections.some((collection) => !Array.isArray(scoped.selected[collection]) || rows(scoped.selected[collection]).length !== (scoped.selected[collection] as unknown[]).length || rows(scoped.selected[collection]).some((row) => (typeof row.id !== "string" && typeof row.id !== "number") || !String(row.id)))) return { status: "unavailable" as const, reason: "agenda-identity-ambiguous" }
    const identities = topic.collections.flatMap((collection) => rows(scoped.selected[collection]).map((row) => ({ type: collection, id: String(row.id) })))
    if (request.recordRefs?.length !== 0 && new Set(identities.map((item) => JSON.stringify([item.type, item.id]))).size !== identities.length) return { status: "unavailable" as const, reason: "agenda-identity-ambiguous" }
    const available = await Promise.all((request.recordRefs?.length === 0 ? [] : identities).map(async (item) => {
      const period = item.type === "hotTopics" ? { start: day, end: day } : ["opsTickets", "secKpi"].includes(item.type) ? request.period : { start: `${day.slice(0, 4)}-01-01`, end: `${day.slice(0, 4)}-12-31` }
      const evidence = await input.recordEvidence.issue({ page: topic.page, recordType: item.type, recordId: item.id, fields: ["id"], period }, context).catch(() => undefined)
      if (!evidence || evidence.status !== "ok" || evidence.value.refDigest !== digestSfEvidenceRef(evidence.value) || evidence.value.installationId !== context.binding.installationId || evidence.value.projectId !== context.binding.projectId || evidence.value.target.recordType !== item.type || evidence.value.target.recordId !== item.id || evidence.value.target.surface !== "dashboard") return undefined
      return { ...item, ref: evidence.value.refId, period }
    }))
    if (available.some((item) => !item)) return { status: "unavailable" as const, reason: "agenda-record-unavailable" }
    const all = available.filter((item): item is NonNullable<typeof item> => !!item)
    const explicit = request.recordRefs === undefined ? undefined : await Promise.all(request.recordRefs.map((ref) => input.recordEvidence.resolve(ref, context).catch(() => ({ status: "unavailable" as const, reason: "agenda-record-unavailable" }))))
    if (explicit?.some((item) => item.status !== "ok")) return { status: "denied" as const, reason: "agenda-record-unavailable" }
    const chosen = explicit === undefined ? all : explicit.flatMap((entry, index) => {
      if (entry.status !== "ok" || entry.value.refDigest !== digestSfEvidenceRef(entry.value) || entry.value.installationId !== context.binding.installationId || entry.value.projectId !== context.binding.projectId || entry.value.target.surface !== "dashboard") return []
      const match = all.find((item) => item.type === entry.value.target.recordType && item.id === entry.value.target.recordId && digestSfValue(item.period) === digestSfValue(entry.value.target.period))
      return match ? [{ ...match, ref: request.recordRefs![index]! }] : []
    })
    if (explicit && (chosen.length !== explicit.length || new Set(chosen.map((item) => JSON.stringify([item.type, item.id]))).size !== chosen.length)) return { status: "denied" as const, reason: "agenda-record-outside-selection" }
    const isSubset = request.recordRefs?.length === 0 || chosen.length !== all.length
    if (isSubset && chosen.length && request.topic === "it-operations") return { status: "unavailable" as const, reason: "agenda-record-projection-unavailable" }
    const childCollections = request.topic === "budget" ? ["opexEntries", "capexEntries"] : request.topic === "opex-detail" ? ["opexEntries"] : request.topic === "capex-projects" ? ["capexEntries"] : []
    if (isSubset && chosen.length && childCollections.some((collection) => !Array.isArray(scoped.selected[collection]) || rows(scoped.selected[collection]).length !== (scoped.selected[collection] as unknown[]).length || rows(scoped.selected[collection]).some((row) => (typeof row.id !== "string" && typeof row.id !== "number") || !String(row.id) || (typeof (collection === "opexEntries" ? row.ownerId : row.projId ?? row.projectId) !== "string" && typeof (collection === "opexEntries" ? row.ownerId : row.projId ?? row.projectId) !== "number")))) return { status: "unavailable" as const, reason: "agenda-child-identity-unavailable" }
    const has = (type: string, id: string) => chosen.some((item) => item.type === type && item.id === id)
    const parentIds = (collection: string, field: string, type: string) => new Set(result.value.values.flatMap((value) => {
      const match = new RegExp(`^${collection}\\[id:([^\\]]+)\\]\\.${field}$`).exec(value.id)
      return match && (typeof value.value === "string" || typeof value.value === "number") && has(type, String(value.value)) ? [match[1]!] : []
    }))
    const opex = isSubset && ["budget", "opex-detail"].includes(request.topic) ? parentIds("opexEntries", "ownerId", "opexOwners") : new Set<string>()
    const capex = isSubset && ["budget", "capex-projects"].includes(request.topic) ? new Set([...parentIds("capexEntries", "projId", "capexProjects"), ...parentIds("capexEntries", "projectId", "capexProjects")]) : new Set<string>()
    const values = !isSubset ? result.value.values : result.value.values.filter((value) => {
      if (request.recordRefs?.length === 0) return false
      if (request.topic === "budget" && /^(budgetMetrics\.|budget:)/.test(value.id)) return false
      if (request.topic === "talent-review" && value.id.startsWith("leaders[")) return true
      const row = /^([A-Za-z]+)\[id:([^\]]+)\]\./.exec(value.id)
      if (row) {
        if (row[1] === "opexEntries") return opex.has(row[2]!)
        if (row[1] === "capexEntries") return capex.has(row[2]!)
        return chosen.some((item) => item.type === row[1] && encodeURIComponent(item.id) === row[2])
      }
      if (["projects", "all-projects"].includes(request.topic) && value.id.startsWith("milestone:")) return chosen.some((item) => value.id.startsWith(`milestone:${encodeURIComponent(item.id)}:`))
      return false
    })
    const refreshed = await input.sources.resolveDashboardSource(request.selectionRef, context, { fields: topic.fields, period: request.period })
    if (refreshed.status !== "ok" || refreshed.value.evidence.refDigest !== selected.value.evidence.refDigest || !await input.host.revalidate(context)) return { status: "stale" as const, reason: "agenda-source-changed" }
    const current = await Promise.all(chosen.map((item) => input.recordEvidence.resolve(item.ref, context).catch(() => ({ status: "unavailable" as const, reason: "agenda-record-unavailable" }))))
    if (current.some((entry, index) => entry.status !== "ok" || entry.value.refDigest !== digestSfEvidenceRef(entry.value) || entry.value.target.recordType !== chosen[index]!.type || entry.value.target.recordId !== chosen[index]!.id || digestSfValue(entry.value.target.period) !== digestSfValue(chosen[index]!.period))) return { status: "stale" as const, reason: "agenda-record-changed" }
    return { status: "ok" as const, value: { projection: { ...result.value, values, components: isSubset ? [] : result.value.components, missing: isSubset ? result.value.missing.filter((entry) => values.some((value) => value.id === entry.field) || (chosen.length > 0 && entry.field === "milestoneDates:identity")) : result.value.missing }, recordRefs: chosen.map((item) => item.ref), recordCount: chosen.length } }
  }
}

import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Command, Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, SourceRef, StoredImportManifest } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { buildDashboardWorkbookCommand } from "./dashboard-command.ts"
import { createDashboardImportMutation, previewDashboardWorkbook } from "./dashboard.ts"
import { dashboardImportImpact, verifyDashboardImportEvidence } from "./dashboard.ts"
import { projectDashboardScope } from "../dashboard/scope.ts"
import { publicSfData } from "../integration/public-state.ts"
import { compareImportProjections } from "./changes.ts"
import { plannerImportDetail } from "./detail.ts"
import { dashboardImportLocations, dashboardImportUnchangedOutcomes } from "./dashboard-provenance.ts"
import type { ParsedImport } from "./files.ts"
import type { ImportTarget } from "./staged-files.ts"
import type { ImportDetail, ImportExecution } from "./store.ts"

type DashboardPreview = {
  format: Parameters<typeof previewDashboardWorkbook>[0]["format"]
  result: ReturnType<typeof previewDashboardWorkbook>
  impactDigest?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export function createSfDashboardImportPreview(input: {
  host: DomainPortHost
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  resolveTarget: (target: ImportTarget, context: TrustedDomainContext) => Promise<PortResult<{ page: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>>
  verifyScope: (snapshot: Snapshot, staged: Snapshot, target: ImportTarget, actor: Actor, command: Command, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>, context: TrustedDomainContext, at: string) => boolean
}) {
  return async (request: { parsed: ParsedImport; target: ImportTarget }, context: TrustedDomainContext): Promise<PortResult<{ manifest: StoredImportManifest; detail: ImportDetail; execution: ImportExecution }>> => {
    const http = input.host.requestFor(context)
    const operationId = input.operationIdentity(context)
    if (!http || !operationId || request.target.surface !== "dashboard" || (!request.parsed.sheets && !request.parsed.data) || !await input.host.revalidate(context)) return { status: "denied", reason: "import-access-unavailable" }
    const resolved = await input.resolveTarget(request.target, context)
    if (resolved.status !== "ok") return resolved
    const evidence = resolved.value.evidence
    if (evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.installationId !== context.binding.installationId || evidence.projectId !== context.binding.projectId || evidence.target.surface !== "dashboard" || evidence.target.incarnation !== request.target.incarnation || evidence.target.version !== request.target.version || (!request.parsed.data && !evidence.target.period) || (request.parsed.data && (evidence.target.recordType !== "dashboard-dataset" || evidence.target.recordId !== "all" || evidence.target.period !== undefined))) return { status: "denied", reason: "target-scope-mismatch" }
    const environment = await input.host.environment(http)
    const source: SourceRef = { surface: "dashboard", type: evidence.target.recordType, id: evidence.target.recordId, incarnation: evidence.target.incarnation, version: evidence.target.version, fields: evidence.target.fields, period: evidence.target.period ?? { start: "0001-01-01", end: "9999-12-31" }, observedAt: environment.at }
    const idempotencyKey = digestSfValue({ operationId, principal: context.binding.principalRef, target: request.target, file: request.parsed.sourceDigest })
    const preview = await input.host.persistence.transaction<DashboardPreview | undefined>("dashboard", async (snapshot) => {
      const principal = await input.host.authenticate(http, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || principal.id !== context.binding.principalRef || !principal.canWrite) return { commit: false, value: undefined }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const built = request.parsed.data ? { status: "ok" as const, value: { format: "backup" as const, command: { page: resolved.value.page, action: "backup-import", version: snapshot.versions.dataset?.version ?? 0, values: { data: request.parsed.data } } } } : buildDashboardWorkbookCommand({ parsed: request.parsed, target: request.target, source, snapshot })
      if (built.status !== "ok" || built.value.command.page !== resolved.value.page) return { commit: false, value: undefined }
      const result = previewDashboardWorkbook({ ...built.value, snapshot, actor, environment, operationId, idempotencyKey, target: source })
      if (result.status !== "preview") return { commit: false, value: { format: built.value.format, result } }
      const staged = structuredClone(snapshot)
      const mutation = createDashboardImportMutation({ format: built.value.format, command: result.command, actorId: actor.id, operationId, idempotencyKey, target: source, baseDigest: result.baseDigest, previewDigest: result.previewDigest, commandDigest: result.commandDigest, at: environment.at, verifyScope: (before, after, current) => verifyDashboardImportEvidence(before, after, current, result.command, evidence, environment.at) && input.verifyScope(before, after, request.target, current, result.command, evidence, context, environment.at) })
      if (!mutation?.execute(staged, actor, environment).commit) return { commit: false, value: undefined }
      const impact = dashboardImportImpact(snapshot, staged, result.command, source.period)
      if (!impact) return { commit: false, value: undefined }
      const selector = { page: result.command.page, fields: [...evidence.target.fields].sort(), period: source.period }
      const before = built.value.format === "backup" ? { selected: { data: publicSfData(snapshot.data) } } : projectDashboardScope(snapshot, actor, selector, environment.at)
      const after = built.value.format === "backup" ? { selected: { data: publicSfData(staged.data) } } : projectDashboardScope(staged, actor, selector, environment.at)
      if (!before || !after) return { commit: false, value: undefined }
      return { commit: false, value: { format: built.value.format, result, impactDigest: digestSfValue(impact), before: before.selected, after: after.selected } }
    }, { signal: http.signal })
    if (!preview) return { status: "stale", reason: "target-or-sheet-unavailable" }
    if (preview.result.status !== "preview") return { status: preview.result.status === "denied" ? "denied" : preview.result.status === "conflict" ? "stale" : "needs-input", reason: "dashboard-command-rejected" }
    if (!await input.host.revalidate(context)) return { status: "denied", reason: "import-access-unavailable" }
    if (!preview.impactDigest || !preview.before || !preview.after) return { status: "unavailable", reason: "mutation-scope-unavailable" }
    const productContext = { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "dashboard" as const, period: source.period, currency: "USD", sourceRefs: [source], capabilities: ["sf_import_preview"] }
    const changes = compareImportProjections(preview.before, preview.after)
    const values: DomainProjection["values"][number][] = []
    const missing: DomainProjection["missing"][number][] = []
    changes.forEach((change) => ([["before", change.before], ["after", change.after]] as const).forEach(([side, entry]) => {
      if (entry.state !== "present") { missing.push({ field: `${change.path}:${side}`, reason: "missing" }); return }
      if (entry.value !== null && typeof entry.value !== "string" && typeof entry.value !== "boolean" && !(typeof entry.value === "number" && Number.isFinite(entry.value))) return
      values.push({ id: `${change.path}:${change.kind}:${side}`, value: entry.value as string | number | boolean | null, period: source.period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: entry.value === null ? "absent" : "confirmed" })
    }))
    const projection: DomainProjection = { context: productContext, version: source.version, engineVersion: "dashboard-runtime-v1", components: [], values, missing }
    const id = digestSfValue({ operationId, sourceDigest: request.parsed.sourceDigest, target: request.target, principal: context.binding.principalRef })
    const manifest: StoredImportManifest = { id, version: 1, sourceDigest: request.parsed.sourceDigest, format: request.parsed.format, context: productContext, baseIdentity: [source], commands: [{ id: idempotencyKey, target: source, command: preview.result.command, idempotencyKey, commandDigest: preview.result.commandDigest, expectedVersion: preview.result.command.version, requiredAuthority: ["dashboard:write"], preview: projection }], issues: preview.result.warnings.map(() => ({ row: 0, field: "domain", reason: "The Dashboard reported a warning; review the source data." })), state: "preview", domainApplied: false, receipts: [] }
    return { status: "ok", value: { manifest, detail: plannerImportDetail({ manifestId: id, version: 1, sourceDigest: request.parsed.sourceDigest, domainReference: evidence.refId, changes, locations: dashboardImportLocations({ parsed: request.parsed, sheet: request.target.options.preview.sheet, after: preview.after, changes }), outcomes: dashboardImportUnchangedOutcomes({ parsed: request.parsed, sheet: request.target.options.preview.sheet, before: preview.before, after: preview.after }) }), execution: { kind: "dashboard", format: preview.format, baseDigest: preview.result.baseDigest, impactDigest: preview.impactDigest, evidence, operationId, previewDigest: preview.result.previewDigest, previewAt: environment.at, actorId: context.binding.principalRef, idempotencyKey, targetIncarnation: request.target.incarnation, commandDigest: preview.result.commandDigest } } }
  }
}

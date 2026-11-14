import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, SourceRef, StoredImportManifest } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { buildPlannerFinancialProjection, projectPlannerSource } from "../planner/port.ts"
import { plannerImportDetail } from "./detail.ts"
import { plannerUnchangedOutcomes } from "./planner-unchanged.ts"
import type { ParsedImport } from "./files.ts"
import { plannerWorkbookHasRoster, preparePlannerWorkbook } from "./planner.ts"
import type { ImportTarget } from "./staged-files.ts"
import type { ImportDetail, ImportExecution } from "./store.ts"

/** Uses the real Planner engine and its actor-filtered projection for the proposed command. */
export function createSfPlannerImportPreview(input: {
  host: DomainPortHost
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  resolveTarget: (target: ImportTarget, context: TrustedDomainContext) => Promise<PortResult<{ versionId: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>>
  verifyTarget: (snapshot: Snapshot, target: ImportTarget, actor: Actor, context: TrustedDomainContext) => boolean
  resolveRoster?: (target: ImportTarget, context: TrustedDomainContext) => Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>
  verifyRoster?: (snapshot: Snapshot, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>, actor: Actor, context: TrustedDomainContext) => boolean
}) {
  return async (request: { parsed: ParsedImport; target: ImportTarget }, context: TrustedDomainContext): Promise<PortResult<{ manifest: StoredImportManifest; detail: ImportDetail; execution: ImportExecution }>> => {
    const http = input.host.requestFor(context)
    const operationId = input.operationIdentity(context)
    if (!http || !operationId || request.target.surface !== "planner" || !request.parsed.sheets || !await input.host.revalidate(context)) return { status: "denied", reason: "import-access-unavailable" }
    const resolved = await input.resolveTarget(request.target, context)
    if (resolved.status !== "ok") return resolved
    const evidence = resolved.value.evidence
    if (evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.installationId !== context.binding.installationId || evidence.projectId !== context.binding.projectId || evidence.target.surface !== "planner" || evidence.target.recordType !== "planner-version" || evidence.target.recordId !== resolved.value.versionId || evidence.target.incarnation !== request.target.incarnation || evidence.target.version !== request.target.version || !evidence.target.period) return { status: "denied", reason: "target-scope-mismatch" }
    const start = /^(\d{4})-(\d{2})-01$/.exec(evidence.target.period.start)
    const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(evidence.target.period.end)
    if (!start || !end || start[1] !== end[1] || Number(start[2]) < 1 || Number(end[2]) > 12 || Number(start[2]) > Number(end[2]) || Number(end[3]) !== new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate()) return { status: "needs-input", reason: "period-must-cover-whole-months-in-one-year" }
    const environment = await input.host.environment(http)
    const hasRoster = plannerWorkbookHasRoster(request.parsed.sheets)
    const rosterResult = hasRoster ? await input.resolveRoster?.(request.target, context) : undefined
    if (hasRoster && (!rosterResult || rosterResult.status !== "ok" || !input.verifyRoster)) return { status: "unavailable", reason: "roster-source-unavailable" }
    const roster = rosterResult?.status === "ok" ? rosterResult.value : undefined
    if (roster && (roster.refDigest !== digestSfEvidenceRef(roster) || roster.installationId !== context.binding.installationId || roster.projectId !== context.binding.projectId || roster.target.surface !== "planner" || roster.target.recordType !== "planner-roster" || roster.target.recordId !== "file" || digestSfValue(roster.target.fields) !== digestSfValue(["end", "leader", "location", "name", "start", "status", "title", "type"]) || digestSfValue(roster.target.period) !== digestSfValue(evidence.target.period))) return { status: "denied", reason: "roster-scope-mismatch" }
    const source: SourceRef = { surface: "planner", type: evidence.target.recordType, id: evidence.target.recordId, incarnation: evidence.target.incarnation, version: evidence.target.version, fields: evidence.target.fields, period: evidence.target.period, observedAt: environment.at }
    const idempotencyKey = digestSfValue({ operationId, principal: context.binding.principalRef, target: request.target, file: request.parsed.sourceDigest })
    const preview = await input.host.persistence.transaction("planner", async (snapshot) => {
      const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || !principal.canWrite) return { commit: false, value: undefined }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === "planner").map((row) => row.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const base = projectPlannerSource(snapshot, actor, resolved.value.versionId)
      if (!base || !input.verifyTarget(snapshot, request.target, actor, context) || (roster && !input.verifyRoster?.(snapshot, roster, actor, context)) || digestSfValue(Object.keys(base).sort()) !== digestSfValue([...evidence.target.fields].sort()) || digestSfValue({ versionId: evidence.target.recordId, projection: base }) !== evidence.target.projectionDigest) return { commit: false, value: undefined }
      return { commit: false, value: preparePlannerWorkbook({ snapshot, actor, environment, versionId: resolved.value.versionId, sheets: request.parsed.sheets!, newVersion: request.target.options.newVersion, removeMissing: request.target.options.removeMissing, operationId, idempotencyKey, targetIncarnation: request.target.incarnation }) }
    }, { signal: http.signal })
    if (!preview) return { status: "stale", reason: "target-changed" }
    if (!preview.result.ok) return { status: preview.result.status === 403 ? "denied" : preview.result.status === 409 ? "stale" : "needs-input", reason: "planner-command-rejected" }
    const escape = (value: string) => value.replace(/~/g, "~0").replace(/\//g, "~1")
    const versionIds = [resolved.value.versionId, ...(typeof preview.result.value === "string" ? [preview.result.value] : [])].map((value) => `/versions/@id=${escape(value)}/`)
    if (preview.changes.some((change) => !versionIds.some((prefix) => change.path.startsWith(prefix)) && !(roster && /^\/roster\/(?:\d+|@id=[^/]+)\/(?:name|title|type|leader|location|start|end|status)$/.test(change.path)))) return { status: "unavailable", reason: "multi-source-preview-unavailable" }
    if (!await input.host.revalidate(context)) return { status: "denied", reason: "import-access-unavailable" }
    const rosterSource: SourceRef | undefined = roster ? { surface: "planner", type: "planner-roster", id: roster.target.recordId, incarnation: roster.target.incarnation, version: roster.target.version, fields: roster.target.fields, period: source.period, observedAt: environment.at } : undefined
    const productContext = { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "planner" as const, period: source.period, currency: "USD", sourceRefs: [source, ...(rosterSource ? [rosterSource] : [])], capabilities: ["sf_import_preview"] }
    const values: DomainProjection["values"][number][] = []
    const missing: DomainProjection["missing"][number][] = []
    preview.changes.forEach((change) => ([ ["before", change.before], ["after", change.after] ] as const).forEach(([side, entry]) => {
      if (entry.state !== "present") { missing.push({ field: `${change.path}:${side}`, reason: "missing" }); return }
      if (entry.value !== null && typeof entry.value !== "string" && typeof entry.value !== "boolean" && !(typeof entry.value === "number" && Number.isFinite(entry.value))) return
      const reference = change.path.startsWith("/roster/") && roster ? roster : evidence
      values.push({ id: `${change.path}:${change.kind}:${side}`, value: entry.value as string | number | boolean | null, period: source.period, granularity: "record", sourceRefs: [reference], drilldown: reference, evidenceState: entry.value === null ? "absent" : side === "after" ? "hypothetical" : "confirmed" })
    }))
    if (!preview.financialBefore || !preview.financialAfter) return { status: "unavailable", reason: "planner-impact-unavailable" }
    if (preview.financialBefore.year !== Number(start[1]) || preview.financialAfter.year !== Number(start[1])) return { status: "needs-input", reason: "period-version-mismatch" }
    const baseline = buildPlannerFinancialProjection({ projection: preview.financialBefore, ref: evidence, period: source.period, binding: context, at: environment.at })
    const candidate = buildPlannerFinancialProjection({ projection: preview.financialAfter, ref: evidence, period: source.period, binding: context, at: environment.at })
    // Components describe the candidate once; paired values preserve the domain's
    // baseline, missing inputs and monthly budget/actual/outlook without new formulas.
    const projection: DomainProjection = {
      context: productContext, version: source.version, engineVersion: candidate.engineVersion,
      components: candidate.components.map((component) => ({ ...component, evidenceState: component.evidenceState === "absent" ? "absent" as const : "hypothetical" as const })),
      values: [...values, ...baseline.values.map((value) => ({ ...value, id: `before:${value.id}` })), ...candidate.values.map((value) => ({ ...value, id: `after:${value.id}`, evidenceState: value.evidenceState === "absent" ? "absent" as const : "hypothetical" as const }))],
      missing: [...missing, ...baseline.missing.map((entry) => ({ ...entry, field: `before:${entry.field}` })), ...candidate.missing.map((entry) => ({ ...entry, field: `after:${entry.field}` }))],
    }
    if (new Set(projection.values.map((value) => value.id)).size !== projection.values.length) return { status: "unavailable", reason: "duplicate-projection-value-id" }
    const id = digestSfValue({ operationId, sourceDigest: request.parsed.sourceDigest, target: request.target, principal: context.binding.principalRef })
    const manifest: StoredImportManifest = { id, version: 1, sourceDigest: request.parsed.sourceDigest, format: request.parsed.format, context: productContext, baseIdentity: [source, ...(rosterSource ? [rosterSource] : [])], commands: [{ id: idempotencyKey, target: source, command: preview.command, idempotencyKey, commandDigest: preview.commandDigest, expectedVersion: preview.command.version, requiredAuthority: ["planner:write"], preview: projection }], issues: (preview.result.warnings ?? []).map((warning) => ({ row: 0, field: "domain", reason: plannerWarning(warning) })), state: "preview", domainApplied: false, receipts: [] }
    const indexed = new Map<string, NonNullable<ParsedImport["origins"]>>()
    for (const origin of request.parsed.origins ?? []) {
      if (!["OPEX", "CAPEX"].includes(origin.sheet)) continue
      const row = request.parsed.sheets?.[origin.sheet]?.[origin.recordIndex]
      if (!row || row["Line ID"] == null || typeof row.Measure !== "string") continue
      const key = JSON.stringify([String(row["Line ID"]), row.Measure.trim().toLowerCase(), origin.field])
      const matches = indexed.get(key)
      if (matches) matches.push(origin)
      if (!matches) indexed.set(key, [origin])
    }
    const locations = Object.fromEntries(preview.changes.flatMap((change) => {
      const match = change.path.match(/^\/versions\/@id=[^/]+\/lines\/@id=([^/]+)\/(b|a|f)\/(\d{1,2})$/)
      if (!match) return []
      const lineId = match[1]!.replace(/~1/g, "/").replace(/~0/g, "~")
      const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(match[3])]
      const measure = match[2] === "b" ? "budget" : match[2] === "a" ? "actual" : "forecast"
      if (!month || !measure) return []
      const matches = indexed.get(JSON.stringify([lineId, measure, month])) ?? []
      if (matches.length !== 1) return []
      const origin = matches[0]!
      return [[change.path, { sheet: origin.sheet, row: origin.row, column: origin.column, address: origin.address, field: origin.field }]]
    }))
    const outcomes = [...plannerUnchangedOutcomes({ parsed: request.parsed, before: preview.before, after: preview.after, versionId: resolved.value.versionId, afterVersionId: typeof preview.result.value === "string" ? preview.result.value : resolved.value.versionId }), ...(request.parsed.origins ?? []).filter((origin) => (["OPEX", "CAPEX"].includes(origin.sheet) && origin.field === "Total") || (origin.sheet === "Headcount" && origin.field === "FY cost USD (calculated)") || (!!roster && (origin.sheet === "Summary by Leader" || (origin.sheet === "All Members" && ["Classification", "Outlook", "Notes"].includes(origin.field))))).map((origin) => ({ kind: "ignored" as const, source: { sheet: origin.sheet, row: origin.row, column: origin.column, address: origin.address, field: origin.field }, reason: "not-consumed-by-import" as const }))]
    const detail = plannerImportDetail({ manifestId: id, version: 1, sourceDigest: request.parsed.sourceDigest, domainReference: evidence.refId, changes: preview.changes, locations, outcomes })
    if (roster) detail.changes = detail.changes.map((change) => change.path.startsWith("/roster/") && change.source.kind === "domain" ? { ...change, source: { kind: "domain", reference: roster.refId } } : change)
    return { status: "ok", value: { manifest, detail, execution: { operationId, previewDigest: preview.previewDigest, previewAt: environment.at, actorId: context.binding.principalRef, idempotencyKey, targetIncarnation: request.target.incarnation, commandDigest: preview.commandDigest, ...(roster ? { rosterEvidence: roster } : {}) } } }
  }
}

function plannerWarning(warning: string) {
  if (warning.startsWith("Unknown owner:")) return "Unknown owner; the existing reference is retained."
  if (warning.startsWith("Unknown entity:")) return "Unknown entity; the existing reference is retained."
  if (warning.startsWith("Unknown allocation:")) return "Unknown allocation; the existing reference is retained."
  if (warning.startsWith("Unknown rate card:")) return "Unknown rate card; the existing reference is retained."
  if (warning.startsWith("Unknown currency:")) return "Unknown currency; the existing currency is retained."
  if (warning.startsWith("Unknown project unchanged:")) return "Unknown project; the existing data is unchanged."
  if (warning.startsWith("Unknown line unchanged:")) return "Unknown line; the existing data is unchanged."
  if (warning.startsWith("Unknown classification:")) return "Unknown classification; review the source data."
  if (["Headcount unchanged: budget or role is read-only", "FX rates unchanged: budget or role is read-only", "Rate cards unchanged: budget or role is read-only", "Workbook was exported from another version; matching records are applied to the selected version"].includes(warning)) return warning
  return "The Planner reported a warning; review the source data."
}

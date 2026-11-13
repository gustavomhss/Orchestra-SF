import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/planner.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { StoredImportManifest } from "../contracts/context.ts"
import type { ImportPreviewRequest } from "../contracts/operations.ts"
import type { DomainPortHost, FinancialAnalysis, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { buildPlannerFinancialProjection, projectPlannerSource } from "./port.ts"
import type { createPlannerSourceIssuer } from "./source-issuer.ts"

type PlannerImportExecution = { operationId: string; previewDigest: string; previewAt: string; actorId: string; idempotencyKey: string; targetIncarnation: string; commandDigest: string }
type PlannerImportPreview = { manifest: StoredImportManifest; execution?: PlannerImportExecution; digest: string }

/** The private preview reader and snapshot fence are installation authorities; neither exposes workbook commands to clients. */
export function createPlannerImportAnalysis(input: {
  host: DomainPortHost
  issueSource: ReturnType<typeof createPlannerSourceIssuer>
  readPreview: (selection: { previewRef: string; request: ImportPreviewRequest }, context: TrustedDomainContext) => Promise<PortResult<PlannerImportPreview>>
  verifyTarget: (snapshot: Snapshot, manifest: StoredImportManifest, actor: Actor, context: TrustedDomainContext) => boolean
}) {
  return async (request: { previewRef: string; importRequest: ImportPreviewRequest; period: { start: string; end: string }; currency: string }, context: TrustedDomainContext): Promise<PortResult<FinancialAnalysis>> => {
    const http = input.host.requestFor(context)
    const start = /^(\d{4})-(\d{2})-01$/.exec(request.period.start)
    const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(request.period.end)
    if (!http || !await input.host.revalidate(context)) return { status: "denied", reason: "import-analysis-access-unavailable" }
    if (!request.previewRef.trim() || request.currency !== "USD" || !start || !end || start[1] !== end[1] || Number(start[2]) < 1 || Number(end[2]) > 12 || Number(start[2]) > Number(end[2]) || Number(end[3]) !== new Date(Date.UTC(Number(end[1]), Number(end[2]), 0)).getUTCDate()) return { status: "needs-input", reason: "invalid-import-analysis-scope" }
    const stored = await input.readPreview({ previewRef: request.previewRef, request: request.importRequest }, context)
    if (stored.status !== "ok") return stored
    const manifest = stored.value.manifest
    const execution = stored.value.execution
    const command = manifest.commands[0]
    const target = manifest.baseIdentity[0]
    if (!execution || manifest.id !== request.previewRef || manifest.state !== "preview" || manifest.domainApplied || manifest.receipts.length || manifest.commands.length !== 1 || manifest.baseIdentity.length !== 1 || !command || !target || target.surface !== "planner" || target.type !== "planner-version" || command.target.id !== target.id || command.target.incarnation !== target.incarnation || command.target.version !== target.version || command.command.action !== "import-workbook" || command.command.id !== target.id || command.command.values.versionId !== target.id || execution.actorId !== context.binding.principalRef || execution.targetIncarnation !== target.incarnation || execution.idempotencyKey !== command.idempotencyKey || execution.commandDigest !== command.commandDigest || !Number.isFinite(Date.parse(execution.previewAt)) || target.period.start > request.period.start || target.period.end < request.period.end) return { status: "needs-input", reason: "import-preview-scope-mismatch" }
    const source = await input.issueSource(target.id, context)
    if (source.status !== "ok") return source
    if (source.value.evidence.target.incarnation !== target.incarnation || source.value.evidence.target.version !== target.version || digestSfValue([...source.value.evidence.target.fields].sort()) !== digestSfValue([...target.fields].sort())) return { status: "stale", reason: "import-target-changed" }
    const environment = await input.host.environment(http)
    const read = () => input.host.persistence.transaction("planner", async (snapshot) => {
      const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const before = projectPlannerSource(snapshot, actor, target.id)
      if (!before || !input.verifyTarget(snapshot, manifest, actor, context) || digestSfValue({ versionId: target.id, projection: before }) !== source.value.evidence.target.projectionDigest) return { commit: false, value: undefined }
      const staged = structuredClone(snapshot)
      const sequence = { value: 0 }
      const applied = domain.execute(staged, actor, command.command, { ...environment, at: execution.previewAt, id: () => `import-${digestSfValue({ operationId: execution.operationId, index: sequence.value++ }).slice(0, 32)}` })
      if (!applied.ok || digestSfValue({ result: applied, audit: staged.audit.slice(snapshot.audit.length) }) !== execution.previewDigest || digestSfValue({ command: command.command, previewDigest: execution.previewDigest, principal: actor.id, operationId: execution.operationId, idempotencyKey: execution.idempotencyKey, targetIncarnation: execution.targetIncarnation, previewAt: execution.previewAt }) !== execution.commandDigest) return { commit: false, value: undefined }
      const candidateId = typeof applied.value === "string" ? applied.value : target.id
      const after = projectPlannerSource(staged, actor, candidateId)
      if (!after || before.year !== Number(start[1]) || after.year !== Number(start[1])) return { commit: false, value: undefined }
      return { commit: false, value: { before, after } }
    }, { signal: http.signal })
    const projected = await read().catch(() => undefined)
    if (!projected) return { status: "stale", reason: "import-preview-changed" }
    const baseline = buildPlannerFinancialProjection({ projection: projected.before, ref: source.value.evidence, period: request.period, binding: context, at: execution.previewAt })
    const staged = buildPlannerFinancialProjection({ projection: projected.after, ref: source.value.evidence, period: request.period, binding: context, at: execution.previewAt })
    const candidate = { ...staged, components: staged.components.map((component) => ({ ...component, evidenceState: component.evidenceState === "absent" ? "absent" as const : "hypothetical" as const })), values: staged.values.map((value) => ({ ...value, evidenceState: value.evidenceState === "absent" ? "absent" as const : "hypothetical" as const })) }
    if ([baseline, candidate].some((projection) => new Set(projection.values.map((value) => value.id)).size !== projection.values.length)) return { status: "unavailable", reason: "duplicate-projection-value-id" }
    const gaps = [...new Set([...baseline.missing, ...candidate.missing].map((entry) => `${entry.field}:${entry.reason}`)), "import-preview-not-applied", "import-preview-coverage-unresolved"]
    const total = (projection: typeof baseline) => projection.components.reduce((sum, component) => sum + (component.amount ?? 0), 0)
    const delta = baseline.missing.length || candidate.missing.length ? null : total(candidate) - total(baseline)
    const difference = delta !== null && Number.isFinite(delta) ? delta : null
    const refreshed = await input.readPreview({ previewRef: request.previewRef, request: request.importRequest }, context)
    const latest = await input.issueSource(target.id, context)
    const again = await read().catch(() => undefined)
    if (refreshed.status !== "ok" || refreshed.value.digest !== stored.value.digest || latest.status !== "ok" || latest.value.evidence.refDigest !== source.value.evidence.refDigest || digestSfValue(again) !== digestSfValue(projected) || http.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "import-preview-or-authority-changed" }
    return { status: "ok", value: { analysisBasis: "import-preview", importPreviewRef: request.previewRef, domainApplied: false, baseline, candidate, sourceRefs: [source.value.evidence], gaps, knownDifference: difference, completeDifference: null, comparison: { baselineResultRef: source.value.evidence.refId, alternativeResultRef: request.previewRef, costCoverageRefs: [], criterionResults: [], unresolvedConditions: gaps, comparisonStatus: "conditioned", knownDifference: difference, completeDifference: null }, explanation: "Forecast comparison uses the imported preview and remains conditional until applied and assessed." } }
  }
}

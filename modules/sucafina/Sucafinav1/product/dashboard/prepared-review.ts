import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { projectSfSourceScope } from "../integration/source-projections.ts"
import { simulateDashboardCommand } from "./commands.ts"
import type { createDashboardConfirmationIssuer } from "./confirmation-issuer.ts"

type Review = { fields: readonly { field: string; before: string | number | boolean | null; after: string | number | boolean | null }[]; source: Extract<BusinessEvidenceRef, { kind: "record" }>; originalTargetDigest: string; targetLabel?: string }
const editable = ["action", "owner", "due", "priority", "notes"]

/** Review the C12 Hot Topic command through the current actor's domain view, without exposing a command. */
export function createDashboardPreparedReview(input: {
  host: DomainPortHost
  issueSource: ReturnType<typeof createDashboardConfirmationIssuer>
  verifyPreparedBinding: (snapshot: Snapshot, command: PreparedCommand, context: TrustedDomainContext) => boolean | Promise<boolean>
}) {
  return async (incoming: PreparedCommand, context: TrustedDomainContext): Promise<PortResult<Review>> => {
    const operation = structuredClone(incoming)
    const request = input.host.requestFor(context)
    const transaction = input.host.persistence.transactionAll
    if (!request || request.signal.aborted || !transaction || typeof input.verifyPreparedBinding !== "function" || !await input.host.revalidate(context)) return { status: "denied", reason: "review-access-unavailable" }
    if (operation.target.surface !== "dashboard" || operation.target.type !== "hotTopics" || operation.command.page !== "Hot Topics & Actions" || operation.command.action !== "save" || operation.command.id !== operation.target.id || operation.command.confirmed === true || operation.command.version !== operation.expectedVersion || !Number.isSafeInteger(operation.expectedVersion) || operation.expectedVersion < 0 || Object.keys(operation.command.values).length !== editable.length || editable.some((field) => typeof operation.command.values[field] !== "string" || !operation.target.fields.includes(field))) return { status: "needs-input", reason: "review-command-invalid" }
    const references = operation.preview.values.flatMap((value) => value.sourceRefs)
    const original = references[0]
    if (!original || original.kind !== "record" || original.refDigest !== digestSfEvidenceRef(original) || original.installationId !== context.binding.installationId || original.projectId !== context.binding.projectId || original.target.surface !== "dashboard" || original.target.recordType !== operation.target.type || original.target.recordId !== operation.target.id || original.target.incarnation !== operation.target.incarnation || original.target.version !== operation.target.version || digestSfValue(original.target.fields) !== digestSfValue([...operation.target.fields].sort()) || digestSfValue(original.target.period) !== digestSfValue(operation.target.period) || references.some((ref) => digestSfValue(ref) !== digestSfValue(original))) return { status: "unavailable", reason: "prepared-source-unavailable" }
    const source = await input.issueSource({ recordType: operation.target.type, recordId: operation.target.id, fields: operation.target.fields, period: operation.target.period }, context)
    if (source.status !== "ok") return source
    const environment = await input.host.environment(request)
    const read = () => transaction(async (snapshots) => {
      const snapshot = snapshots.dashboard
      // The host resolves the protected C12 prepared record and current case/choice under this lock.
      if (!await input.verifyPreparedBinding(snapshot, operation, context)) return { commit: false, value: undefined }
      const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "dashboard").map((role) => role.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const entries = Object.values(snapshot.sfSources?.scopes ?? {})
      const originals = entries.filter((entry) => entry.alive && entry.incarnation === original.target.incarnation && entry.version === original.target.version && entry.inputDigest === original.target.projectionDigest && entry.scope.recordType === operation.target.type && entry.scope.recordId === operation.target.id)
      const current = entries.filter((entry) => entry.alive && entry.incarnation === source.value.target.incarnation && entry.version === source.value.target.version && entry.inputDigest === source.value.target.projectionDigest && entry.scope.recordType === operation.target.type && entry.scope.recordId === operation.target.id && entry.scope.principalRef === actor.id && entry.scope.accessRevision === context.binding.accessRevision && entry.scope.policyVersion === context.binding.policyVersion)
      const physical = snapshot.sfSources?.records[JSON.stringify([operation.target.type, operation.target.id])]
      if (originals.length !== 1 || current.length !== 1 || !physical?.alive || originals[0]!.sourceIncarnation !== physical.incarnation || current[0]!.sourceIncarnation !== physical.incarnation || (snapshot.versions[`hotTopics:${operation.target.id}`]?.version ?? 0) !== operation.expectedVersion || digestSfValue(projectSfSourceScope("dashboard", snapshot, current[0]!.scope, environment.at)) !== source.value.target.projectionDigest) return { commit: false, value: undefined }
      const preview = simulateDashboardCommand(snapshot, actor, operation.command, environment)
      if (preview.status !== "preview") return { commit: false, value: undefined }
      const before = rows(preview.before.hotTopics).filter((row) => String(row.id) === operation.target.id)
      const after = rows(preview.after.hotTopics).filter((row) => String(row.id) === operation.target.id)
      if (before.length !== 1 || after.length !== 1 || operation.preview.values.length !== editable.length) return { commit: false, value: undefined }
      const fields = editable.map((field) => {
        const id = `hotTopics:${encodeURIComponent(operation.target.id)}:${field}`
        const proposed = operation.preview.values.filter((value) => value.id === id && value.sourceRefs.length === 1 && digestSfValue(value.sourceRefs[0]) === digestSfValue(original) && digestSfValue(value.period) === digestSfValue(operation.target.period))
        const previous = before[0]![field] ?? null
        const next = after[0]![field] ?? null
        if ((previous !== null && typeof previous !== "string") || typeof next !== "string" || proposed.length !== 1 || proposed[0]!.value !== next) return undefined
        return { field, before: previous as string | null, after: next }
      })
      if (fields.some((field) => !field)) return { commit: false, value: undefined }
      return { commit: false, value: { fields: fields.filter((field): field is NonNullable<typeof field> => !!field), source: source.value, originalTargetDigest: digestSfValue(operation.target), ...(typeof before[0]!.action === "string" && before[0]!.action.trim() ? { targetLabel: before[0]!.action.trim() } : {}) } }
    }, { signal: request.signal })
    const first = await read().catch(() => undefined)
    if (!first) return { status: "stale", reason: "review-source-or-command-changed" }
    const latest = await input.issueSource({ recordType: operation.target.type, recordId: operation.target.id, fields: operation.target.fields, period: operation.target.period }, context)
    const again = await read().catch(() => undefined)
    if (latest.status !== "ok" || digestSfValue(latest.value) !== digestSfValue(source.value) || digestSfValue(again) !== digestSfValue(first) || request.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "review-source-or-authority-changed" }
    return { status: "ok", value: first }
  }
}

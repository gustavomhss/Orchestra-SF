import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { SourceRef } from "../contracts/context.ts"
import { applyDashboardImport, previewDashboardImport } from "../dashboard/imports.ts"
import type { DashboardImportFormat } from "../dashboard/imports.ts"
import type { DashboardBackupAdapter } from "../dashboard/imports.ts"
import { plannerImportEnvironment } from "./planner.ts"
import { executeDashboardBackupImport } from "../../runtime/dashboard-backup.ts"
import { publicSfData } from "../integration/public-state.ts"
import { dashboardMutationImpact } from "../dashboard/mutation-scope.ts"
import type { Period } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { projectDashboardScope } from "../dashboard/scope.ts"
import { compareImportProjections } from "./changes.ts"

type ImportFormat = DashboardImportFormat

export function dashboardImportImpact(snapshot: Snapshot, staged: Snapshot, command: Command, period: Period) {
  if (command.action !== "backup-import") return dashboardMutationImpact(snapshot, staged, command, period)
  const before = publicSfData(snapshot.data)
  const after = publicSfData(staged.data)
  return { before, after }
}


export function verifyDashboardImportEvidence(snapshot: Snapshot, staged: Snapshot, actor: Actor, command: Command, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>, at: string) {
  const target = evidence.target
  if (command.action === "backup-import") return target.surface === "dashboard" && target.recordType === "dashboard-dataset" && target.recordId === "all" && target.period === undefined && digestSfValue(target.fields) === digestSfValue(["data"]) && actor.canWrite && actor.roles.includes("admin") && digestSfValue({ data: publicSfData(snapshot.data) }) === target.projectionDigest
  if (target.surface !== "dashboard" || target.recordType !== "dashboard-page" || target.recordId !== command.page || !target.period) return false
  const scope = { page: command.page, fields: [...target.fields].sort(), period: target.period }
  const before = projectDashboardScope(snapshot, actor, scope, at)
  const after = projectDashboardScope(staged, actor, scope, at)
  if (!before || !after || digestSfValue(before) !== target.projectionDigest) return false
  const impact = dashboardImportImpact(snapshot, staged, command, target.period)
  if (!impact) return false
  if (Array.isArray(impact)) return impact.every((change) => target.fields.includes(change.type) && change.period.start >= target.period!.start && change.period.end <= target.period!.end)
  return Object.keys({ ...impact.before, ...impact.after }).every((key) => digestSfValue(impact.before[key]) === digestSfValue(impact.after[key]) || target.fields.includes(key))
}

function simulateBackup(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) {
  if (command.action !== "backup-import" || !actor.roles.includes("admin")) return { status: "denied" as const, reason: "backup-unavailable" }
  const before = publicSfData(snapshot.data)
  const staged = structuredClone(snapshot)
  const result = executeDashboardBackupImport(staged, actor, command, environment)
  if (!result.commit) return { status: result.status === 403 ? "denied" as const : result.status === 409 ? "conflict" as const : "invalid" as const, reason: "backup-rejected" }
  const after = publicSfData(staged.data)
  return { status: "preview" as const, before, after, baseDigest: digestSfValue({ before, dataset: snapshot.versions.dataset }), changedFields: [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().filter((key) => digestSfValue(before[key]) !== digestSfValue(after[key])), changes: [], warnings: [], summary: undefined, commandDigest: digestSfValue({ actor, command }) }
}

const backup: DashboardBackupAdapter = {
  preview: simulateBackup,
  apply: (snapshot, actor, command, environment, baseDigest, commandDigest) => {
    const preview = simulateBackup(snapshot, actor, command, environment)
    if (preview.status !== "preview" || preview.baseDigest !== baseDigest || preview.commandDigest !== commandDigest) return { ok: false, status: 409, errors: ["Preview is stale"] }
    const result = executeDashboardBackupImport(snapshot, actor, command, environment)
    if (!result.commit) return { ok: false, status: result.status === 403 ? 403 : result.status === 409 ? 409 : 422, errors: ["Backup was rejected"] }
    return { ok: true }
  },
}

/** Confirmation here is internal to the disposable simulation, never accepted from a request. */
export function previewDashboardWorkbook(input: { format: ImportFormat; snapshot: Snapshot; actor: Actor; command: Command; environment: Environment; operationId: string; idempotencyKey: string; target: SourceRef }) {
  if (input.command.confirmed !== undefined || Object.hasOwn(input.command.values, "confirmed") || !input.operationId || !input.idempotencyKey || input.target.surface !== "dashboard") return { status: "invalid" as const, reason: "invalid-import-command" }
  const command = structuredClone(input.command)
  const internal = { ...command, confirmed: true }
  const environment = plannerImportEnvironment(input.environment, input.operationId)
  const simulated = previewDashboardImport(input.format, input.snapshot, input.actor, internal, environment, backup)
  if (simulated.status !== "preview") return simulated
  const previewDigest = digestSfValue({ after: simulated.after, changes: simulated.changes, warnings: simulated.warnings, summary: simulated.summary })
  const identity = { format: input.format, command, actorId: input.actor.id, operationId: input.operationId, idempotencyKey: input.idempotencyKey, target: input.target, baseDigest: simulated.baseDigest, previewDigest, at: input.environment.at }
  return { ...simulated, command, previewDigest, commandDigest: digestSfValue(identity), requiresHumanConfirmation: true as const }
}

/** The host supplies the current complete source-scope fence and invokes this only after human grant. */
export function createDashboardImportMutation(input: { format: ImportFormat; command: Command; actorId: string; operationId: string; idempotencyKey: string; target: SourceRef; baseDigest: string; previewDigest: string; commandDigest: string; at: string; verifyScope: (snapshot: Snapshot, staged: Snapshot, actor: Actor) => boolean }) {
  if (input.command.confirmed !== undefined || Object.hasOwn(input.command.values, "confirmed") || !input.actorId || !input.operationId || !input.idempotencyKey || input.target.surface !== "dashboard" || !input.target.incarnation || !Number.isFinite(Date.parse(input.at))) return undefined
  const prepared = structuredClone({ format: input.format, command: input.command, actorId: input.actorId, operationId: input.operationId, idempotencyKey: input.idempotencyKey, target: input.target, baseDigest: input.baseDigest, previewDigest: input.previewDigest, at: input.at })
  if (digestSfValue(prepared) !== input.commandDigest) return undefined
  return {
    surface: "dashboard" as const, idempotencyKey: prepared.idempotencyKey, commandDigest: input.commandDigest, targetIncarnation: prepared.target.incarnation, expectedVersion: prepared.command.version,
    execute: (snapshot: Snapshot, actor: Actor, environment: Environment) => {
      if (actor.id !== prepared.actorId) return { commit: false, value: { status: "denied", reason: "source-access-unavailable" } }
      const staged = structuredClone(snapshot)
      const internal = { ...prepared.command, confirmed: true }
      const effective = plannerImportEnvironment({ ...environment, at: prepared.at }, prepared.operationId)
      const preview = previewDashboardImport(prepared.format, staged, actor, internal, effective, backup)
      if (preview.status !== "preview" || preview.baseDigest !== prepared.baseDigest || digestSfValue({ after: preview.after, changes: preview.changes, warnings: preview.warnings, summary: preview.summary }) !== prepared.previewDigest) return { commit: false, value: { status: "conflict", reason: "preview-changed" } }
      const applied = applyDashboardImport(prepared.format, staged, actor, internal, effective, preview.baseDigest, preview.commandDigest, backup)
      if (!applied.ok) return { commit: false, value: { status: "failed", reason: "command-rejected" } }
      if (!input.verifyScope(snapshot, staged, actor)) return { commit: false, value: { status: "denied", reason: "source-access-unavailable" } }
      const changedFields = compareImportProjections({ data: publicSfData(snapshot.data), sequences: snapshot.sequences }, { data: publicSfData(staged.data), sequences: staged.sequences }).length
      if (changedFields) Object.assign(snapshot, staged)
      return { commit: true, value: { status: changedFields ? "applied" as const : "unchanged" as const, changedFields, warnings: "warnings" in applied ? applied.warnings ?? [] : [] } }
    },
  }
}

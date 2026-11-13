import { domain } from "../../runtime/planner.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { PreparedDomainMutation } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfSourceScope } from "../integration/source-lifecycle.ts"
import { sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import { projectPlannerSource } from "./port.ts"

/** Prepare one existing Planner line's forecast edit; the caller retains the human approval boundary. */
export function preparePlannerMutation(input: { snapshot: Snapshot; actor: Actor; environment: Environment; context: TrustedDomainContext; target: SourceRef; evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; scope: SfSourceScope; command: Command; operationId: string; idempotencyKey: string }) {
  const prepared = structuredClone({ actor: input.actor, target: input.target, evidence: input.evidence, scope: input.scope, command: input.command, operationId: input.operationId, idempotencyKey: input.idempotencyKey, installationId: input.context.binding.installationId, projectId: input.context.binding.projectId, at: input.environment.at })
  const fields = Object.keys(prepared.command.values)
  if (!prepared.actor.id.trim() || !prepared.installationId.trim() || !prepared.projectId.trim() || !prepared.operationId.trim() || !prepared.idempotencyKey.trim() || !Number.isFinite(Date.parse(prepared.at))) return undefined
  if (prepared.target.surface !== "planner" || prepared.target.type !== "planner-version" || !prepared.target.id || !prepared.target.incarnation || !Number.isFinite(Date.parse(prepared.target.observedAt)) || !isSfPeriod(prepared.target.period) || !Array.isArray(prepared.target.fields) || prepared.target.fields.some((field) => typeof field !== "string")) return undefined
  if (prepared.evidence.schema !== "sf-evidence-v1" || prepared.evidence.kind !== "record" || prepared.evidence.installationId !== prepared.installationId || prepared.evidence.projectId !== prepared.projectId || prepared.evidence.refDigest !== digestSfEvidenceRef(prepared.evidence) || prepared.evidence.target.surface !== "planner" || prepared.evidence.target.recordType !== prepared.target.type || prepared.evidence.target.recordId !== prepared.target.id || prepared.evidence.target.incarnation !== prepared.target.incarnation || prepared.evidence.target.version !== prepared.target.version || !prepared.evidence.target.period || prepared.evidence.target.period.start > prepared.target.period.start || prepared.evidence.target.period.end < prepared.target.period.end || digestSfValue([...prepared.evidence.target.fields].sort()) !== digestSfValue([...prepared.target.fields].sort())) return undefined
  if (prepared.scope.principalRef !== prepared.actor.id || prepared.actor.id !== input.context.binding.principalRef || prepared.scope.accessRevision !== input.context.binding.accessRevision || prepared.scope.policyVersion !== input.context.binding.policyVersion || prepared.scope.recordType !== prepared.target.type || prepared.scope.recordId !== prepared.target.id) return undefined
  if (!["OPEX", "CAPEX"].includes(prepared.command.page) || prepared.command.action !== "save" || !prepared.command.id || prepared.command.id.startsWith("HR:") || prepared.command.confirmed === true || !Number.isSafeInteger(prepared.command.version) || prepared.command.version < 0 || prepared.command.values.versionId !== prepared.target.id) return undefined
  if (!fields.some((key) => /^f(?:[0-9]|1[01])$/.test(key)) || fields.some((key) => key !== "versionId" && !/^f(?:[0-9]|1[01])$/.test(key))) return undefined
  if (fields.some((key) => { const value = prepared.command.values[key]; return key !== "versionId" && value !== null && (typeof value !== "number" || !Number.isFinite(value)) })) return undefined
  if (!actorAccess(input.snapshot, prepared.actor)) return undefined
  const projection = projectPlannerSource(input.snapshot, prepared.actor, prepared.target.id)
  const identity = scopedIdentity(input.snapshot, prepared.scope)
  if (!projection || !identity || digestSfValue(prepared.scope.selector) !== digestSfValue(sfPlannerProjectionSelector(input.snapshot, prepared.actor)) || identity.incarnation !== prepared.target.incarnation || identity.version !== prepared.target.version || identity.inputDigest !== digestSfValue(projection) || digestSfValue(Object.keys(projection).sort()) !== digestSfValue([...prepared.target.fields].sort())) return undefined
  const year = projection.year
  if (typeof year !== "number" || !Number.isInteger(year) || year < 2001 || year > 2099 || prepared.target.period.start < `${year}-01-01` || prepared.target.period.end > `${year}-12-31` || prepared.target.period.start > prepared.target.period.end) return undefined
  if (fields.filter((key) => key !== "versionId").some((key) => {
    const month = Number(key.slice(1)) + 1
    const start = `${year}-${String(month).padStart(2, "0")}-01`
    const end = `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`
    return prepared.target.period.start > start || prepared.target.period.end < end
  })) return undefined
  if (rows(projection.lines).filter((line) => line.id === prepared.command.id && line.sec === (prepared.command.page === "OPEX" ? "opex" : "capex")).length !== 1) return undefined
  if (prepared.evidence.target.projectionDigest !== digestSfValue({ versionId: prepared.target.id, projection })) return undefined
  const baseDigest = digestSfValue(projection)
  const run = (snapshot: Snapshot, actor: Actor, environment: Environment) => {
    const ids = { next: 0 }
    const staged = structuredClone(snapshot)
    const result = domain.execute(staged, actor, prepared.command, { ...environment, at: prepared.at, id: () => `prepared-${digestSfValue({ operationId: prepared.operationId, index: ids.next++ }).slice(0, 32)}` })
    if (!result.ok) return { result }
    return { result, staged, digest: digestSfValue({ result, projection: projectPlannerSource(staged, actor, prepared.target.id), audit: staged.audit.slice(snapshot.audit.length), versions: staged.versions, sequences: staged.sequences }) }
  }
  const preview = run(input.snapshot, prepared.actor, input.environment)
  if (!preview.result.ok || !preview.staged || !preview.digest) return undefined
  const previewDigest = preview.digest
  const commandDigest = digestSfValue({ ...prepared, baseDigest, previewDigest })
  const mutation: PreparedDomainMutation = {
    surface: "planner", idempotencyKey: prepared.idempotencyKey, commandDigest, targetIncarnation: prepared.target.incarnation, expectedVersion: prepared.command.version,
    execute(snapshot, actor, environment) {
      if (!actorAccess(snapshot, actor) || digestSfValue(actor) !== digestSfValue(prepared.actor)) return { commit: false, value: { status: "denied", reason: "actor-changed" } }
      const identity = scopedIdentity(snapshot, prepared.scope)
      const current = projectPlannerSource(snapshot, actor, prepared.target.id)
      if (!identity || !current || digestSfValue(prepared.scope.selector) !== digestSfValue(sfPlannerProjectionSelector(snapshot, actor)) || identity.incarnation !== prepared.target.incarnation || identity.version !== prepared.target.version || identity.inputDigest !== digestSfValue(current) || digestSfValue(current) !== baseDigest) return { commit: false, value: { status: "conflict", reason: "source-replaced-or-changed" } }
      const applied = run(snapshot, actor, environment)
      if (!applied.result.ok) return { commit: false, value: { status: applied.result.status === 403 ? "denied" : applied.result.status === 409 ? "conflict" : "failed", reason: "command-rejected" } }
      if (!applied.staged || applied.digest !== previewDigest) return { commit: false, value: { status: "conflict", reason: "preview-changed" } }
      Object.assign(snapshot, applied.staged)
      return { commit: true, value: { status: "applied" } }
    },
  }
  return { mutation, command: prepared.command, target: prepared.target, baseDigest, previewDigest, preview: projectPlannerSource(preview.staged, prepared.actor, prepared.target.id) }
}

function actorAccess(snapshot: Snapshot, actor: Actor) {
  const access = object(object(snapshot.data.access)[actor.id])
  const assigned = Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : []
  const domains = Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : []
  return digestSfValue(actor.assigned ?? []) === digestSfValue(assigned) && digestSfValue(actor.domains ?? []) === digestSfValue(domains)
}

function scopedIdentity(snapshot: Snapshot, scope: SfSourceScope) {
  try { return sfScopedSourceIdentity(snapshot, scope) } catch { return undefined }
}

/** Read the domain row revision after an applied forecast command for its receipt. */
export function plannerPreparedRevision(snapshot: Snapshot, command: Command) {
  if (!["OPEX", "CAPEX"].includes(command.page) || command.action !== "save" || !command.id || command.id.startsWith("HR:") || typeof command.values.versionId !== "string") return undefined
  const version = snapshot.versions[`${command.values.versionId}:lines:${command.id}`]?.version
  return Number.isSafeInteger(version) && version === command.version + 1 ? version : undefined
}

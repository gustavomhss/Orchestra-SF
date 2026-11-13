import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand, SourceRef } from "../contracts/context.ts"
import type { PreparedDomainMutation } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { projectSfProcurementScope } from "../integration/procurement-projections.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfSourceScope } from "../integration/source-lifecycle.ts"
import { projectProcurementSource } from "./port.ts"

/** Prepare an existing requisition edit. The host retains scope and applies it only after human confirmation. */
export function prepareProcurementMutation(input: { snapshot: Snapshot; actor: Actor; environment: Environment; context: TrustedDomainContext; target: SourceRef; scope: SfSourceScope; evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; command: Command; operationId: string; idempotencyKey: string }) {
  const prepared = structuredClone({ actor: input.actor, target: input.target, scope: input.scope, evidence: input.evidence, command: input.command, operationId: input.operationId, idempotencyKey: input.idempotencyKey, at: input.target.observedAt })
  if (!prepared.actor.id.trim() || !prepared.operationId.trim() || !prepared.idempotencyKey.trim() || !Number.isFinite(Date.parse(prepared.at)) || !Number.isFinite(Date.parse(prepared.target.observedAt))) return undefined
  if (prepared.target.surface !== "procurement" || prepared.target.type !== "procurement-request" || !prepared.target.id || !prepared.target.incarnation || !isSfPeriod(prepared.target.period) || !Array.isArray(prepared.target.fields) || prepared.target.fields.some((field) => typeof field !== "string")) return undefined
  if (prepared.scope.principalRef !== prepared.actor.id || prepared.actor.id !== input.context.binding.principalRef || prepared.scope.accessRevision !== input.context.binding.accessRevision || prepared.scope.policyVersion !== input.context.binding.policyVersion || prepared.scope.recordType !== prepared.target.type || prepared.scope.recordId !== prepared.target.id) return undefined
  if (prepared.evidence.refDigest !== digestSfEvidenceRef(prepared.evidence) || prepared.evidence.installationId !== input.context.binding.installationId || prepared.evidence.projectId !== input.context.binding.projectId || prepared.evidence.evidenceLevel !== "observed" || prepared.evidence.target.surface !== prepared.target.surface || prepared.evidence.target.recordType !== prepared.target.type || prepared.evidence.target.recordId !== prepared.target.id || prepared.evidence.target.incarnation !== prepared.target.incarnation || prepared.evidence.target.version !== prepared.target.version || !prepared.evidence.target.period || digestSfValue(prepared.evidence.target.period) !== digestSfValue(prepared.target.period) || digestSfValue(prepared.target.fields) !== digestSfValue(prepared.evidence.target.fields)) return undefined
  if (prepared.command.page !== "Requests" || prepared.command.action !== "save" || prepared.command.id !== prepared.target.id || prepared.command.confirmed === true || !Number.isSafeInteger(prepared.command.version) || prepared.command.version < 0) return undefined
  const values = object(prepared.command.values.pr)
  const keys = Object.keys(values)
  if (Object.keys(prepared.command.values).length !== 1 || !keys.length || keys.some((key) => !["title", "justification", "estAmount"].includes(key))) return undefined
  if (keys.some((key) => key === "estAmount" ? typeof values[key] !== "number" || !Number.isFinite(values[key]) || Number(values[key]) < 0 : typeof values[key] !== "string")) return undefined
  if (keys.some((key) => !prepared.target.fields.includes(key === "title" ? "subject" : key === "justification" ? "reason" : "originalAmount"))) return undefined
  const selector = object(prepared.scope.selector)
  const valid = (snapshot: Snapshot, actor: Actor) => {
    if (actor.id !== prepared.actor.id || digestSfValue(actor) !== digestSfValue(prepared.actor) || selector.kind !== "procurement-record-v1" || digestSfValue(selector.roles) !== digestSfValue(actor.roles) || selector.canWrite !== actor.canWrite || selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "procurement"))) return false
    const identity = sfScopedSourceIdentity(snapshot, prepared.scope)
    const projection = projectSfProcurementScope("procurement", snapshot, prepared.scope)
    return !!identity && !!projection && identity.incarnation === prepared.target.incarnation && identity.version === prepared.target.version && identity.inputDigest === digestSfValue(projection) && object(projection).privateDependencyDigest === prepared.evidence.target.projectionDigest
  }
  if (!valid(input.snapshot, prepared.actor)) return undefined
  const baseDigest = digestSfValue(projectSfProcurementScope("procurement", input.snapshot, prepared.scope))
  const run = (snapshot: Snapshot, actor: Actor, environment: Environment, at: string) => {
    const staged = structuredClone(snapshot)
    const result = domain.execute(staged, actor, prepared.command, { ...environment, at, id: () => "" })
    if (!result.ok) return { result }
    const before = object(object(object(snapshot.data.store).requests)[prepared.target.id]).request
    const after = object(object(object(staged.data.store).requests)[prepared.target.id]).request
    const untouched = (value: unknown) => Object.fromEntries(Object.entries(object(value)).filter(([key]) => key !== "pr" && key !== "history"))
    const prUntouched = (value: unknown) => Object.fromEntries(Object.entries(object(object(value).pr)).filter(([key]) => !keys.includes(key)))
    const history = rows(object(after).history)
    const last = history.at(-1)
    if (digestSfValue(untouched(before)) !== digestSfValue(untouched(after)) || digestSfValue(prUntouched(before)) !== digestSfValue(prUntouched(after)) || digestSfValue(history.slice(0, -1)) !== digestSfValue(object(before).history ?? []) || !last || last.at !== at || last.by !== actor.id || last.action !== "Saved") return { result }
    const view = domain.view(staged, actor, { ...environment, at: prepared.at })
    const record = rows(view.data.requests).find((item) => item.number === prepared.target.id)
    const currency = text(object(view.data.formSettings).currency)
    if (!record || !currency) return { result }
    const context = { installationId: prepared.evidence.installationId, projectId: prepared.evidence.projectId, principalRef: actor.id, accessRevision: prepared.scope.accessRevision, policyVersion: prepared.scope.policyVersion, surface: "procurement" as const, period: prepared.target.period, currency, sourceRefs: [prepared.target], capabilities: [] }
    const projection = projectProcurementSource(record, context, prepared.evidence, prepared.at, view.data.formSettings)
    const preview = { ...projection, values: projection.values.map((value) => ({ ...value, evidenceState: value.value === null ? "absent" as const : "hypothetical" as const })) }
    return { result, staged, preview, digest: digestSfValue({ version: staged.versions[`requests:${prepared.target.id}`], preview }) }
  }
  const preview = run(input.snapshot, prepared.actor, input.environment, prepared.at)
  if (!preview.result.ok || !preview.staged || !preview.preview || !preview.digest) return undefined
  const previewDigest = preview.digest
  const commandDigest = digestSfValue({ ...prepared, baseDigest, previewDigest })
  const mutation: PreparedDomainMutation = {
    surface: "procurement", idempotencyKey: prepared.idempotencyKey, commandDigest, targetIncarnation: prepared.target.incarnation, expectedVersion: prepared.command.version,
    execute(snapshot, actor, environment) {
      if (digestSfValue(actor) !== digestSfValue(prepared.actor)) return { commit: false, value: { status: "denied", reason: "actor-changed" } }
      if (!valid(snapshot, actor) || digestSfValue(projectSfProcurementScope("procurement", snapshot, prepared.scope)) !== baseDigest) return { commit: false, value: { status: "conflict", reason: "source-replaced-or-changed" } }
      if (!Number.isFinite(Date.parse(environment.at))) return { commit: false, value: { status: "failed", reason: "observation-time-unavailable" } }
      const applied = run(snapshot, actor, environment, environment.at)
      if (!applied.result.ok) return { commit: false, value: { status: applied.result.status === 403 ? "denied" : applied.result.status === 409 ? "conflict" : "failed", reason: "command-rejected" } }
      if (!applied.staged || applied.digest !== previewDigest) return { commit: false, value: { status: "conflict", reason: "preview-changed" } }
      Object.assign(snapshot, applied.staged)
      return { commit: true, value: { status: "applied" } }
    },
  }
  const command: PreparedCommand = { id: prepared.operationId, target: prepared.target, command: prepared.command, expectedVersion: prepared.command.version, idempotencyKey: prepared.idempotencyKey, commandDigest, requiredAuthority: ["procurement:write"], preview: preview.preview }
  return { mutation, command, target: prepared.target, targetEvidence: prepared.evidence, baseDigest, previewDigest, preview: preview.preview }
}

/** Read the command CAS revision, which is independent from scoped evidence versions. */
export function procurementPreparedRevision(snapshot: Snapshot, command: Command) {
  if (command.page !== "Requests" || command.action !== "save" || !command.id) return undefined
  const version = snapshot.versions[`requests:${command.id}`]?.version ?? 0
  return Number.isSafeInteger(version) && version >= 0 ? version : undefined
}

/** Recover the persisted private scope inside the same domain transaction, including after restart. */
export function procurementPreparedScope(snapshot: Snapshot, target: SourceRef, context: TrustedDomainContext) {
  const matches = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === target.incarnation && entry.version === target.version && entry.scope.principalRef === context.binding.principalRef && entry.scope.policyVersion === context.binding.policyVersion && entry.scope.accessRevision === context.binding.accessRevision && entry.scope.recordType === "procurement-request" && entry.scope.recordId === target.id)
  if (target.surface !== "procurement" || target.type !== "procurement-request" || matches.length !== 1) return undefined
  const entry = matches[0]!
  const current = sfScopedSourceIdentity(snapshot, entry.scope)
  if (!current || current.incarnation !== target.incarnation || current.version !== target.version || digestSfValue(projectSfProcurementScope("procurement", snapshot, entry.scope)) !== current.inputDigest) return undefined
  return structuredClone(entry.scope)
}

/** Produce a conflict receipt only when the authorized current snapshot proves a stale revision. */
export function staleProcurementPreparedMutation(snapshot: Snapshot, actor: Actor, context: TrustedDomainContext, command: PreparedCommand): PreparedDomainMutation | undefined {
  const prepared = structuredClone(command)
  if (context.kind !== "ui" || actor.id !== context.binding.principalRef || !actor.canWrite || prepared.target.surface !== "procurement" || prepared.target.type !== "procurement-request" || !prepared.target.id || !prepared.target.incarnation || prepared.command.page !== "Requests" || prepared.command.action !== "save" || prepared.command.id !== prepared.target.id || prepared.command.confirmed === true || prepared.command.version !== prepared.expectedVersion || !Number.isSafeInteger(prepared.expectedVersion) || prepared.expectedVersion < 0 || !prepared.idempotencyKey.trim() || !/^[a-f0-9]{64}$/.test(prepared.commandDigest)) return undefined
  const stale = (state: Snapshot, currentActor: Actor) => {
    if (digestSfValue(actor) !== digestSfValue(currentActor)) return false
    const entries = Object.values(state.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === prepared.target.incarnation && entry.scope.recordType === "procurement-request" && entry.scope.recordId === prepared.target.id && entry.scope.principalRef === context.binding.principalRef && entry.scope.policyVersion === context.binding.policyVersion && entry.scope.accessRevision === context.binding.accessRevision)
    if (entries.length !== 1) return false
    const scope = entries[0]!.scope
    const selector = object(scope.selector)
    const projection = projectSfProcurementScope("procurement", state, scope)
    const identity = sfScopedSourceIdentity(state, scope)
    if (!identity || !projection || identity.incarnation !== prepared.target.incarnation || identity.inputDigest !== digestSfValue(projection) || digestSfValue(selector.roles) !== digestSfValue(currentActor.roles) || selector.canWrite !== currentActor.canWrite || selector.roleMapDigest !== digestSfValue(roleMap(state, "procurement"))) return false
    const revision = procurementPreparedRevision(state, prepared.command)
    return revision !== undefined && (identity.version !== prepared.target.version || revision !== prepared.expectedVersion)
  }
  if (!stale(snapshot, actor)) return undefined
  return {
    surface: "procurement", idempotencyKey: prepared.idempotencyKey, commandDigest: prepared.commandDigest, targetIncarnation: prepared.target.incarnation, expectedVersion: prepared.expectedVersion,
    execute(state, currentActor) {
      if (digestSfValue(actor) !== digestSfValue(currentActor)) return { commit: false, value: { status: "denied", reason: "actor-changed" } }
      if (!stale(state, currentActor)) return { commit: false, value: { status: "unavailable", reason: "stale-proof-unavailable" } }
      return { commit: false, value: { status: "conflict", reason: "source-replaced-or-changed" } }
    },
  }
}

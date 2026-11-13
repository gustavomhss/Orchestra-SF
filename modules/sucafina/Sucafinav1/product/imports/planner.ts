import { digestSfValue } from "../contracts/canonical.ts"
import { domain } from "../../runtime/planner.ts"
import { projectPlanner } from "../planner/adapter.ts"
import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { compareImportProjections } from "./changes.ts"
import { publicSfData } from "../integration/public-state.ts"

/** Build the exact Planner command whose simulation and transactional execution must match. */
export function preparePlannerWorkbook(input: {
  snapshot: Snapshot
  actor: Actor
  environment: Environment
  versionId: string
  sheets: Record<string, Record<string, unknown>[]>
  newVersion: boolean
  removeMissing: boolean
  operationId: string
  idempotencyKey: string
  targetIncarnation: string
}) {
  const versions = Object.fromEntries(Object.entries(input.snapshot.versions).map(([key, value]) => [key, value.version]))
  const command: Command = {
    page: "OPEX",
    action: "import-workbook",
    id: input.versionId,
    version: input.snapshot.versions[`versions:${input.versionId}`]?.version ?? 0,
    values: { versionId: input.versionId, sheets: structuredClone(input.sheets), newVersion: input.newVersion, removeMissing: input.removeMissing, versions },
  }
  const environment = plannerImportEnvironment(input.environment, input.operationId)
  const before = projectPlanner(input.snapshot, input.actor, environment)
  const staged = structuredClone(input.snapshot)
  const result = domain.execute(staged, input.actor, command, environment)
  const previewDigest = digestSfValue({ result, audit: staged.audit.slice(input.snapshot.audit.length) })
  const after = result.ok ? projectPlanner(staged, input.actor, environment) : before
  return { command, commandDigest: digestSfValue({ command, previewDigest, principal: input.actor.id, operationId: input.operationId, idempotencyKey: input.idempotencyKey, targetIncarnation: input.targetIncarnation, previewAt: input.environment.at }), previewDigest, result, before, after, changes: compareImportProjections(before.data, after.data) }
}

/** Recreate the same generated identities at preview and commit; never consume host ID state. */
export function plannerImportEnvironment(environment: Environment, operationId: string): Environment {
  const sequence = { value: 0 }
  return { ...environment, id: () => `import-${digestSfValue({ operationId, index: sequence.value++ }).slice(0, 32)}` }
}

/** The composition root persists the returned mutation and its receipt in the same
 * Planner transaction. Each affected record is rechecked by import-workbook itself. */
export function createPlannerImportMutation(input: {
  command: Command
  commandDigest: string
  previewDigest: string
  actorId: string
  operationId: string
  idempotencyKey: string
  targetIncarnation: string
  previewAt: string
  verifyTarget: (snapshot: Snapshot, versionId: string, incarnation: string, actor: Actor) => boolean
}) {
  if (!input.actorId || !input.operationId || !input.idempotencyKey || !input.targetIncarnation || !Number.isFinite(Date.parse(input.previewAt))) return undefined
  if (input.command.action !== "import-workbook" || input.command.page !== "OPEX" || input.command.confirmed === true || !input.command.id || input.command.values.versionId !== input.command.id || !Number.isSafeInteger(input.command.version) || input.command.version < 0) return undefined
  const prepared = structuredClone({ command: input.command, commandDigest: input.commandDigest, previewDigest: input.previewDigest, actorId: input.actorId, operationId: input.operationId, idempotencyKey: input.idempotencyKey, targetIncarnation: input.targetIncarnation, previewAt: input.previewAt })
  if (digestSfValue({ command: prepared.command, previewDigest: prepared.previewDigest, principal: prepared.actorId, operationId: prepared.operationId, idempotencyKey: prepared.idempotencyKey, targetIncarnation: prepared.targetIncarnation, previewAt: prepared.previewAt }) !== prepared.commandDigest) return undefined
  if (!/^[a-f0-9]{64}$/.test(prepared.previewDigest)) return undefined
  return {
    surface: "planner" as const,
    idempotencyKey: prepared.idempotencyKey,
    commandDigest: prepared.commandDigest,
    targetIncarnation: prepared.targetIncarnation,
    expectedVersion: prepared.command.version,
    execute: (snapshot: Snapshot, actor: Actor, environment: Environment) => {
      if (actor.id !== prepared.actorId) return { commit: false, value: { status: "denied", reason: "actor-changed" } }
      if (!input.verifyTarget(snapshot, prepared.command.id!, prepared.targetIncarnation, actor)) return { commit: false, value: { status: "conflict", reason: "target-changed" } }
      const staged = structuredClone(snapshot)
      const applied = domain.execute(staged, actor, prepared.command, plannerImportEnvironment({ ...environment, at: prepared.previewAt }, prepared.operationId))
      if (!applied.ok) return { commit: false, value: { status: applied.status === 403 ? "denied" : applied.status === 409 ? "conflict" : "failed", reason: "command-rejected" } }
      if (digestSfValue({ result: applied, audit: staged.audit.slice(snapshot.audit.length) }) !== prepared.previewDigest) return { commit: false, value: { status: "conflict", reason: "preview-changed" } }
      // The Planner returns without audit entries when a workbook has no domain changes;
      // its view normalization alone must not turn that no-op into a persisted mutation.
      const changedFields = staged.audit.length === snapshot.audit.length ? 0 : compareImportProjections({ data: publicSfData(snapshot.data), sequences: snapshot.sequences }, { data: publicSfData(staged.data), sequences: staged.sequences }).length
      if (changedFields) Object.assign(snapshot, staged)
      return { commit: true, value: { status: changedFields ? "applied" as const : "unchanged" as const, changedFields, warnings: applied.warnings ?? [] } }
    },
  }
}

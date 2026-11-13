import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { object } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { PreparedDomainMutation } from "../contracts/ports.ts"
import type { JsonValue } from "../contracts/operations.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfSourceScope } from "../integration/source-lifecycle.ts"
import { applyDashboardPreview } from "./commands.ts"
import { dashboardImpactCovered, dashboardMutationImpact } from "./mutation-scope.ts"
import type { DashboardMutationScope } from "./mutation-scope.ts"

// The host constructs the private scope from an authorized preview, reserves IDs,
// and persists it with the receipt. projectScope is a trusted host callback.
export function createDashboardPreparedMutation(input: { actorId: string; target: SourceRef; command: Command; baseDigest: string; previewDigest: string; idempotencyKey: string; mutationScope?: DashboardMutationScope; projectScope?: (snapshot: Snapshot, actor: Actor, scope: SfSourceScope) => unknown | undefined }): PreparedDomainMutation | undefined {
  if (!input.mutationScope || !input.projectScope) return undefined
  const projectScope = input.projectScope
  if (!input.actorId.trim() || !input.idempotencyKey.trim() || input.target.surface !== "dashboard" || !input.target.incarnation || input.command.id !== input.target.id || input.command.confirmed === true || !Number.isSafeInteger(input.command.version) || input.command.version < 0 || !/^[a-f0-9]{64}$/.test(input.baseDigest) || !/^[a-f0-9]{64}$/.test(input.previewDigest) || !/^[a-f0-9]{64}$/.test(input.mutationScope.impactDigest) || !Number.isFinite(Date.parse(input.mutationScope.observedAt))) return undefined
  const prepared = (() => {
    try { return structuredClone({ actorId: input.actorId, target: input.target, command: input.command, baseDigest: input.baseDigest, previewDigest: input.previewDigest, idempotencyKey: input.idempotencyKey, mutationScope: input.mutationScope }) } catch { return undefined }
  })()
  if (!prepared || new Set(prepared.mutationScope.reservedIds).size !== prepared.mutationScope.reservedIds.length || prepared.mutationScope.reservedIds.some((id) => !id) || !prepared.mutationScope.targets.some((entry) => digestSfValue(entry.source) === digestSfValue(prepared.target))) return undefined
  const digest = (() => {
    try { return digestSfValue(prepared) } catch { return undefined }
  })()
  if (!digest) return undefined
  return {
    surface: "dashboard", idempotencyKey: prepared.idempotencyKey, commandDigest: digest, targetIncarnation: prepared.target.incarnation, expectedVersion: prepared.command.version,
    execute: (snapshot: Snapshot, actor: Actor, environment: Environment): { commit: boolean; value: JsonValue } => {
      if (actor.id !== prepared.actorId) return { commit: false, value: { status: "denied", reason: "actor-changed" } }
      const valid = (() => {
        try { return prepared.mutationScope.targets.every((entry) => {
          if (entry.source.surface !== "dashboard" || entry.scope.principalRef !== actor.id || entry.scope.recordType !== entry.source.type || entry.scope.recordId !== entry.source.id) return false
          const selector = object(entry.scope.selector)
          if (digestSfValue(selector.actor) !== digestSfValue(actor) || digestSfValue(selector.fields) !== digestSfValue([...entry.source.fields].sort()) || digestSfValue(selector.period) !== digestSfValue(entry.source.period)) return false
          const identity = sfScopedSourceIdentity(snapshot, entry.scope)
          const projection = projectScope(snapshot, actor, entry.scope)
          return !!identity && projection !== undefined && identity.incarnation === entry.source.incarnation && identity.version === entry.source.version && identity.inputDigest === digestSfValue(projection)
        }) } catch { return false }
      })()
      if (!valid) return { commit: false, value: { status: "conflict", reason: "source-replaced-or-changed" } }
      const staged = structuredClone(snapshot)
      let used = 0
      const result = applyDashboardPreview(staged, actor, prepared.command, { ...environment, at: prepared.mutationScope.observedAt, id: () => prepared.mutationScope.reservedIds[used++] ?? "" }, prepared.baseDigest, prepared.previewDigest)
      if (!result.ok) return { commit: false, value: { status: result.status === 403 ? "denied" : result.status === 409 ? "conflict" : "failed", reason: "command-rejected" } }
      const impact = (() => {
        try { return dashboardMutationImpact(snapshot, staged, prepared.command, prepared.mutationScope.period) } catch { return undefined }
      })()
      if (!impact?.length || used !== prepared.mutationScope.reservedIds.length || digestSfValue(impact) !== prepared.mutationScope.impactDigest || !dashboardImpactCovered(impact, prepared.mutationScope)) return { commit: false, value: { status: "conflict", reason: "mutation-scope-mismatch" } }
      Object.assign(snapshot, staged)
      return { commit: true, value: { status: "applied" } }
    },
  }
}

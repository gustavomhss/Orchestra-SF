import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import { preparePlannerMutation } from "./prepared.ts"
import { projectPlannerSource } from "./port.ts"
import type { createPlannerSourceIssuer } from "./source-issuer.ts"

/** Privately review a prepared forecast using the current reviewer's authority and the real domain preview. */
export function createPlannerPreparedReview(input: { host: DomainPortHost; issueSource: ReturnType<typeof createPlannerSourceIssuer> }) {
  return async (operation: PreparedCommand, context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "review-access-unavailable" } as const
    if (operation.target.surface !== "planner" || operation.target.type !== "planner-version" || operation.command.version !== operation.expectedVersion) return { status: "needs-input", reason: "review-command-invalid" } as const
    const source = await input.issueSource(operation.target.id, context)
    if (source.status !== "ok") return source
    const environment = await input.host.environment(request)
    const read = () => input.host.persistence.transaction("planner", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const scope = { principalRef: principal.id, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "planner-version", recordId: operation.target.id, selector: sfPlannerProjectionSelector(snapshot, actor) }
      const identity = sfScopedSourceIdentity(snapshot, scope)
      const original = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === operation.target.incarnation && entry.version === operation.target.version && entry.scope.recordType === operation.target.type && entry.scope.recordId === operation.target.id)
      const reviewer = snapshot.sfSources?.scopes?.[digestSfValue(scope)]
      const physical = snapshot.sfSources?.records[JSON.stringify([operation.target.type, operation.target.id])]
      if (original.length !== 1 || !reviewer || !physical?.alive || original[0]!.sourceIncarnation !== physical.incarnation || reviewer.sourceIncarnation !== physical.incarnation || !identity || identity.incarnation !== source.value.evidence.target.incarnation || identity.version !== source.value.evidence.target.version) return { commit: false, value: undefined }
      const target = { ...operation.target, incarnation: identity.incarnation, version: identity.version, fields: source.value.evidence.target.fields }
      const prepared = preparePlannerMutation({ snapshot, actor, environment, context, target, evidence: source.value.evidence, scope, command: operation.command, operationId: operation.id, idempotencyKey: operation.idempotencyKey })
      const before = projectPlannerSource(snapshot, actor, operation.target.id)
      if (!prepared || !before || !prepared.preview) return { commit: false, value: undefined }
      const beforeLine = rows(before.lines).find((line) => line.id === operation.command.id)
      const afterLine = rows(prepared.preview.lines).find((line) => line.id === operation.command.id)
      if (!beforeLine || !afterLine || typeof beforeLine.cur !== "string" || !beforeLine.cur.trim() || beforeLine.cur !== afterLine.cur) return { commit: false, value: undefined }
      const fields = Object.keys(operation.command.values).filter((field) => /^f(?:[0-9]|1[01])$/.test(field)).map((field) => {
        const index = Number(field.slice(1))
        const beforeValue = Array.isArray(beforeLine.f) ? beforeLine.f[index] ?? null : null
        const afterValue = Array.isArray(afterLine.f) ? afterLine.f[index] ?? null : null
        const preview = operation.preview.values.filter((value) => value.id === `${operation.command.id}:${index + 1}:forecast` && value.currency === beforeLine.cur)
        if ((beforeValue !== null && (typeof beforeValue !== "number" || !Number.isFinite(beforeValue))) || (afterValue !== null && (typeof afterValue !== "number" || !Number.isFinite(afterValue))) || preview.length !== 1 || preview[0]!.value !== afterValue) return undefined
        return { field: `${operation.command.id}:${index + 1}:forecast`, before: beforeValue, after: afterValue, beforeCurrency: beforeLine.cur as string, afterCurrency: beforeLine.cur as string }
      })
      if (!fields.length || fields.some((field) => !field)) return { commit: false, value: undefined }
      return { commit: false, value: { fields: fields.filter((field): field is NonNullable<typeof field> => !!field), source: source.value.evidence, originalTargetDigest: digestSfValue(operation.target) } }
    }, { signal: request.signal })
    const first = await read().catch(() => undefined)
    if (!first) return { status: "stale", reason: "review-source-or-command-changed" } as const
    const latest = await input.issueSource(operation.target.id, context)
    const again = await read().catch(() => undefined)
    if (latest.status !== "ok" || latest.value.evidence.refDigest !== source.value.evidence.refDigest || digestSfValue(again) !== digestSfValue(first) || request.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "review-source-or-authority-changed" } as const
    return { status: "ok", value: first } as const
  }
}

import { roleMap } from "../../runtime/admin.ts"
import type { Actor } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { ChoiceRecord } from "../contracts/decisions.ts"
import type { ScenarioOperation } from "../contracts/operations.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createProcurementSourceResolver } from "./sources.ts"
import { prepareProcurementMutation } from "./prepared.ts"

/** Translate only an explicitly selected, evidenced PR amount replacement. */
export function createProcurementScenarioPreparation(input: { host: DomainPortHost; sources: ReturnType<typeof createProcurementSourceResolver> }) {
  return async (selection: { operation: ScenarioOperation; choice: ChoiceRecord; operationId: string; idempotencyKey: string }, binding: TrustedDomainContext) => {
    const operation = structuredClone(selection.operation)
    if (operation.kind !== "replace" || operation.replacementRef !== undefined || typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 || !operation.currency || !operation.period) return { status: "needs-input" as const, reason: "explicit-requisition-amount-required" }
    if (!selection.choice.scenario.operations.some((candidate) => digestSfValue(candidate) === digestSfValue(operation))) return { status: "denied" as const, reason: "operation-not-in-choice" }
    const request = input.host.requestFor(binding)
    if (!request || !await input.host.revalidate(binding)) return { status: "denied" as const, reason: "current-authority-unavailable" }
    const source = await input.sources.resolveForPreparation(operation.targetRef, binding)
    if (source.status !== "ok") return source
    const evidence = source.value.evidence
    const context = source.value.context
    if (evidence.target.recordType !== "procurement-request" || operation.currency !== context.currency || digestSfValue(operation.period) !== digestSfValue(context.period) || selection.choice.result.currency !== context.currency || digestSfValue(selection.choice.result.horizon) !== digestSfValue(context.period)) return { status: "needs-input" as const, reason: "requisition-basis-mismatch" }
    if (!selection.choice.result.sourceRefs.some((ref) => ref.kind === "record" && digestSfValue(ref) === digestSfValue(evidence))) return { status: "denied" as const, reason: "preview-source-unavailable" }
    const environment = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable" as const, reason: "observation-time-unavailable" }
    const target = { surface: "procurement" as const, type: evidence.target.recordType, id: evidence.target.recordId, incarnation: evidence.target.incarnation, version: evidence.target.version, fields: evidence.target.fields, period: context.period, observedAt: environment.at }
    const result = await input.host.persistence.transaction("procurement", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: [], domains: [] }
      const version = snapshot.versions[`requests:${target.id}`]?.version ?? 0
      const command = { page: "Requests", action: "save", id: target.id, version, values: { pr: { estAmount: operation.amount } } }
      return { commit: false, value: prepareProcurementMutation({ snapshot, actor, environment, context: binding, target, scope: source.value.scope, evidence, command, operationId: selection.operationId, idempotencyKey: selection.idempotencyKey }) }
    }, { signal: request.signal })
    if (!result) return { status: "unavailable" as const, reason: "requisition-preparation-unavailable" }
    const current = await input.sources.resolveForPreparation(operation.targetRef, binding)
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(source.value) || !await input.host.revalidate(binding)) return { status: "stale" as const, reason: "requisition-source-changed" }
    return { status: "ok" as const, value: { command: result.command, targetEvidence: result.targetEvidence, preview: selection.choice.result } }
  }
}

import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { ChoiceRecord } from "../contracts/decisions.ts"
import type { ScenarioOperation } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createProcurementSourceResolver } from "./sources.ts"
import { procurementPreparationIssue } from "./prepared.ts"
import { createProcurementReadonlySourceResolver } from "./scenario-producer.ts"
import { createProcurementApprovalLifecycle } from "./decision-preparation.ts"
import type { ProcurementApprovalPlan, ProcurementApprovalReview } from "./decision-preparation.ts"

/** A scenario choice cannot turn a draft edit into a financially approved command. */
export function createProcurementScenarioPreparation(input: { host: DomainPortHost; sources: ReturnType<typeof createProcurementSourceResolver> }) {
  const sourceReader = createProcurementReadonlySourceResolver({ host: input.host })
  return async (requestSelection: { operation: ScenarioOperation; choice: ChoiceRecord; operationId: string; idempotencyKey: string }, binding: TrustedDomainContext): Promise<PortResult<{ command: PreparedCommand; targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }>; preview: ChoiceRecord["result"] }>> => {
    const selection = structuredClone(requestSelection)
    const operation = selection.operation
    if (operation.kind !== "replace" || operation.replacementRef !== undefined || typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 || !operation.currency || !operation.period) return { status: "needs-input", reason: "explicit-requisition-amount-required" }
    if (!selection.choice.scenario.operations.some((candidate) => digestSfValue(candidate) === digestSfValue(operation))) return { status: "denied", reason: "operation-not-in-choice" }
    const request = input.host.requestFor(binding)
    if (!request || !await input.host.revalidate(binding)) return { status: "denied", reason: "current-authority-unavailable" }
    const source = await sourceReader.resolveSource(operation.targetRef, binding)
    if (source.status !== "ok") return source
    const evidence = source.value.evidence
    const context = source.value.context
    if (evidence.target.recordType !== "procurement-request" || operation.currency !== context.currency || digestSfValue(operation.period) !== digestSfValue(context.period) || selection.choice.result.currency !== context.currency || digestSfValue(selection.choice.result.horizon) !== digestSfValue(context.period)) return { status: "needs-input", reason: "requisition-basis-mismatch" }
    if (!selection.choice.result.sourceRefs.some((ref) => ref.kind === "record" && digestSfValue(ref) === digestSfValue(evidence))) return { status: "denied", reason: "preview-source-unavailable" }
    const environment = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable", reason: "observation-time-unavailable" }
    const result = await input.host.persistence.transaction<PortResult<never>>("procurement", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:") || !principal.canWrite || !principal.roles.some((role) => role.surface === "procurement" && role.role !== "viewer")) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
      const version = snapshot.versions[`requests:${evidence.target.recordId}`]?.version ?? 0
      const command = { page: "Requests", action: "save", id: evidence.target.recordId, version, values: { pr: { estAmount: operation.amount } } }
      const issue = procurementPreparationIssue(snapshot, command)
      if (issue) return { commit: false, value: { status: "needs-input", reason: issue } }
      // Canonical Approve requires a pending request and approves its submitted
      // amount. Final approval leaves the PR edit stages; saving that approved
      // amount again is either inadmissible or a no-op. No detached approval of
      // this unwritten proposal exists. Preserve that policy boundary.
      return { commit: false, value: { status: "needs-input", reason: "financial-approval-command-unavailable" } }
    }, { signal: request.signal })
    const current = await sourceReader.resolveSource(operation.targetRef, binding)
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(source.value) || !await input.host.revalidate(binding)) return { status: "stale", reason: "requisition-source-changed" }
    return result
  }
}

/** Offer an explicit draft edit separately from the still unsupported post-approval C12 replacement. */
export function createProcurementScenarioDraftPreparation(input: { host: DomainPortHost }) {
  const lifecycle = createProcurementApprovalLifecycle(input)
  return async (incoming: { operation: ScenarioOperation; choice: ChoiceRecord; review: ProcurementApprovalReview }, binding: TrustedDomainContext): Promise<PortResult<ProcurementApprovalPlan>> => {
    if (!plainDraftSelection(incoming) || digestSfValue(Object.keys(object(incoming)).sort()) !== digestSfValue(["choice", "operation", "review"])) return { status: "needs-input", reason: "explicit-requisition-amount-required" }
    const selected = structuredClone(incoming)
    const operation = selected.operation
    if (!operation || operation.kind !== "replace" || operation.replacementRef !== undefined || typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 || !operation.currency || !operation.period) return { status: "needs-input", reason: "explicit-requisition-amount-required" }
    if (!selected.choice?.scenario || !Array.isArray(selected.choice.scenario.operations) || !selected.choice.result || !Array.isArray(selected.choice.result.sourceRefs)) return { status: "needs-input", reason: "recorded-choice-required" }
    if (!selected.choice.scenario.operations.some((candidate) => digestSfValue(candidate) === digestSfValue(operation))) return { status: "denied", reason: "operation-not-in-choice" }
    const plan = await lifecycle.prepare({ review: selected.review, action: { kind: "save-estimate", amount: operation.amount } }, binding)
    if (plan.status !== "ok") return plan
    const review = plan.value.review
    const source = review.source
    if (operation.targetRef !== source.refId || operation.currency !== review.currency || digestSfValue(operation.period) !== digestSfValue(source.target.period) || selected.choice.result.currency !== review.currency || digestSfValue(selected.choice.result.horizon) !== digestSfValue(operation.period)) return { status: "needs-input", reason: "requisition-basis-mismatch" }
    if (!selected.choice.result.sourceRefs.some((ref) => ref?.kind === "record" && digestSfValue(ref) === digestSfValue(source))) return { status: "denied", reason: "preview-source-unavailable" }
    // Choice is provenance for the value, never approval or permission. The host
    // supplies its persisted C08 choice; the lifecycle re-reads the source and actor.
    return plan
  }
}

function plainDraftSelection(value: unknown, active = new WeakSet<object>(), depth = 0): boolean {
  if (depth > 24) return false
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (!value || typeof value !== "object" || active.has(value) || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) || Object.getOwnPropertySymbols(value).length) return false
  active.add(value)
  const valid = Object.values(Object.getOwnPropertyDescriptors(value)).every((entry) => "value" in entry && plainDraftSelection(entry.value, active, depth + 1))
  active.delete(value)
  return valid
}


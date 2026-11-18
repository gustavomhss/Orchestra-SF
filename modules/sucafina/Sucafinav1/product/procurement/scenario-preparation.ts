import { object } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { ChoiceRecord } from "../contracts/decisions.ts"
import type { ScenarioOperation } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createProcurementSourceResolver } from "./sources.ts"
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
    // The recorded human choice identifies a proposed DRAFT amount, not approval.
    // Canonical review/prepare checks the authenticated actor, PR stage, CAS,
    // source incarnation, policy and allowed save-estimate action.
    const lifecycle = createProcurementApprovalLifecycle({ host: input.host })
    const reviewed = await lifecycle.review(operation.targetRef, binding)
    if (reviewed.status !== "ok") return reviewed
    const selected = await lifecycle.prepare({ review: reviewed.value, action: { kind: "save-estimate", amount: operation.amount } }, binding)
    if (selected.status !== "ok") return selected
    const plan = selected.value
    if (plan.requiresExplicitAction !== true || plan.approvalGranted !== false || plan.receipt !== null || plan.command.action !== "save" || plan.command.confirmed !== false) return { status: "denied", reason: "explicit-draft-review-required" }
    // The current lifecycle reviews and binds a draft estimate, but grants no
    // financial approval command, so C12 replacement remains unavailable here.
    // The explicit draft edit is createProcurementScenarioDraftPreparation.
    return { status: "needs-input", reason: "financial-approval-command-unavailable" }
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


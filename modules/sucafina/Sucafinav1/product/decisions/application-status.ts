import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult, PreparedApplyPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { applicationAttempts } from "./application-attempt.ts"
import type { PreparedApplyRequest } from "./receipt-review-binding.ts"
import { reconcileDomainReceipt } from "./receipts.ts"

export type PreparedApplicationStatus = PreparedApplyRequest & {
  recordedState: PreparedChange["state"]
  status: "not-attempted" | "receipt-required" | "reconciled"
}

/** Private read projection: a durable reservation proves only that reconciliation is required.
 * This reader never dispatches a command or infers a domain effect from the reservation.
 */
export function createPreparedApplicationStatus(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  receipts: Pick<PreparedApplyPort, "readReceipt">
  authorizeCase: (decision: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (incoming: PreparedApplyRequest, context: TrustedDomainContext): Promise<PortResult<PreparedApplicationStatus>> => {
    try {
      const request = structuredClone(incoming)
      const source = input.host.requestFor(context)
      if (!source || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
      if (context.kind === "native" && (context.binding.caseId !== request.caseRef.id || context.binding.caseIncarnation !== request.caseRef.incarnation || context.binding.caseVersion !== request.caseRef.version)) return { status: "denied", reason: "case-access-unavailable" }
      const read = () => input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision
        ? { decision: state.cases[request.caseRef.id], attempts: applicationAttempts(state, request) } : undefined)
      const first = await read()
      if (first.status !== "ok" || !first.value) return { status: first.status === "denied" ? "denied" : "unavailable", reason: "application-status-unavailable" }
      const decision = first.value.decision
      if (!decision || decision.incarnation !== request.caseRef.incarnation || !decision.participants.includes(context.binding.principalRef) || !await input.authorizeCase(structuredClone(decision), context)) return { status: "denied", reason: "case-access-unavailable" }
      if (decision.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const changes = decision.preparedChanges.filter((change) => change.id === request.changeId && change.choiceId === request.choiceId && change.caseId === decision.id)
      if (changes.length !== 1 || decision.choices.filter((choice) => choice.id === request.choiceId).length !== 1) return { status: "unavailable", reason: "prepared-change-unavailable" }
      const change = changes[0]!
      const status = change.receipt ? "reconciled" : first.value.attempts.length ? "receipt-required" : "not-attempted"
      const lookup = { surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }
      if (change.receipt) {
        if (change.state === "planned") return { status: "unavailable", reason: "case-receipt-unavailable" }
        if (!decision.receipts.some((receipt) => digestSfValue(receipt) === digestSfValue(change.receipt)) || reconcileDomainReceipt({ change, receipt: change.receipt, principalRef: change.receipt.principalRef, state: change.state }).status !== "ok") return { status: "unavailable", reason: "case-receipt-unavailable" }
        const receipt = await input.receipts.readReceipt(lookup, context)
        if (receipt.status !== "ok") return { status: receipt.status === "denied" ? "denied" : "unavailable", reason: "receipt-access-unavailable" }
        if (receipt.value.state !== "found" || digestSfValue(receipt.value.receipt) !== digestSfValue(change.receipt)) return { status: "unavailable", reason: "case-receipt-unavailable" }
      }
      if (!change.receipt && change.state !== "planned" && change.state !== "cancelled") return { status: "unavailable", reason: "case-receipt-unavailable" }
      const again = await read()
      if (again.status !== "ok" || !again.value) return { status: again.status === "denied" ? "denied" : "unavailable", reason: "application-status-unavailable" }
      if (again.storageVersion !== first.storageVersion || digestSfValue(again.value) !== digestSfValue(first.value)) return { status: "stale", reason: "case-changed" }
      if (!again.value.decision || !await input.authorizeCase(structuredClone(again.value.decision), context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
      if (change.receipt) {
        const receipt = await input.receipts.readReceipt(lookup, context)
        if (receipt.status !== "ok") return { status: receipt.status === "denied" ? "denied" : "unavailable", reason: "receipt-access-unavailable" }
        if (receipt.value.state !== "found" || digestSfValue(receipt.value.receipt) !== digestSfValue(change.receipt)) return { status: "unavailable", reason: "case-receipt-unavailable" }
      }
      // Final observation follows both asynchronous authority checks. Concurrent case,
      // marker or receipt reconciliation cannot escape as a superseded status.
      const last = await read()
      if (last.status !== "ok" || !last.value) return { status: last.status === "denied" ? "denied" : "unavailable", reason: "application-status-unavailable" }
      if (last.storageVersion !== first.storageVersion || digestSfValue(last.value) !== digestSfValue(first.value)) return { status: "stale", reason: "case-changed" }
      if (source.signal.aborted) return { status: "denied", reason: "invalid-authority" }
      return { status: "ok", value: { ...request, recordedState: change.state, status } }
    } catch {
      return { status: "unavailable", reason: "application-status-unavailable" }
    }
  }
}

import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { Period } from "../contracts/context.ts"
import type { CaseReadRequest, WorkListRequest } from "../contracts/operations.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createCollaborationWorkPort } from "./work-port.ts"

export function createCollaborationCycleView(input: {
  cases: Pick<DecisionCasePort, "read">
  work: Pick<ReturnType<typeof createCollaborationWorkPort>, "list">
  host: Pick<DomainPortHost, "revalidate">
  resolveCase?: (selectionRef: string, period: Period, context: TrustedDomainContext) => Promise<{ status: "ok"; caseRef: { id: string; incarnation: string; version: number } } | { status: "unavailable" }>
}) {
  return {
    read: async (request: { caseRef: CaseReadRequest["caseRef"]; selection: WorkListRequest }, context: TrustedDomainContext): Promise<PortResult<{ caseRef: string; period: Period; participants: readonly string[]; questions: readonly AuthorizedCaseProjection["case"]["questions"][number][]; work: Awaited<ReturnType<typeof input.work.list>> extends PortResult<infer T> ? T : never; state: "empty" | "active" }>> => {
      if (!request || typeof request.caseRef !== "string" || !request.caseRef.trim() || !request.selection || typeof request.selection.selectionRef !== "string" || !request.selection.selectionRef.trim() || !isSfPeriod(request.selection.period)) return { status: "needs-input", reason: "invalid-cycle-selection" }
      const selected = structuredClone(request)
      const first = await input.cases.read({ caseRef: selected.caseRef }, context)
      if (first.status !== "ok") return first
      const version = first.value.case.version
      const identity = { id: first.value.case.id, incarnation: first.value.case.incarnation }
      const caseRef = selected.caseRef
      const digest = digestSfValue(first.value.case)
      if (selected.selection.selectionRef.startsWith("sf:case-work-selection:")) {
        const bound = await input.resolveCase?.(selected.selection.selectionRef, selected.selection.period, context)
        if (!bound || bound.status !== "ok" || digestSfValue(bound.caseRef) !== digestSfValue({ ...identity, version })) return { status: "unavailable", reason: "cycle-selection-unavailable" }
      }
      if (selected.selection.period.start < first.value.case.horizon.start || selected.selection.period.end > first.value.case.horizon.end) return { status: "needs-input", reason: "period-outside-case-horizon" }
      const listed = await input.work.list(selected.selection, context)
      if (listed.status !== "ok") return listed
      const current = await input.cases.read({ caseRef }, context)
      if (current.status !== "ok") return current
      if (current.value.case.id !== identity.id || current.value.case.incarnation !== identity.incarnation || current.value.case.version !== version || digestSfValue(current.value.case) !== digest) return { status: "stale", reason: "case-changed" }
      if (selected.selection.selectionRef.startsWith("sf:case-work-selection:")) {
        const bound = await input.resolveCase?.(selected.selection.selectionRef, selected.selection.period, context)
        if (!bound || bound.status !== "ok" || digestSfValue(bound.caseRef) !== digestSfValue({ ...identity, version })) return { status: "stale", reason: "cycle-selection-changed" }
      }
      if (!await input.host.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
      return {
        status: "ok",
        value: {
          caseRef,
          period: selected.selection.period,
          participants: current.value.case.participants,
          questions: current.value.case.questions,
          work: listed.value,
          state: current.value.case.questions.length === 0 && listed.value.items.length === 0 ? "empty" : "active",
        },
      }
    },
  }
}

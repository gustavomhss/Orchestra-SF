import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { encodeCaseRef } from "./case-port.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type ReviewFields = readonly { field: string; before: string | number | boolean | null; after: string | number | boolean | null; beforeCurrency?: string; afterCurrency?: string }[]

/** The domain owns the reviewed fields; executable commands never leave this boundary. */
export function createDecisionPreparedReview(input: {
  state: SfProductStatePort
  cases: DecisionCasePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  reviewDomain: (command: PreparedCommand, context: TrustedDomainContext) => Promise<PortResult<{ fields: ReviewFields; source: Extract<BusinessEvidenceRef, { kind: "record" }>; originalTargetDigest: string }>>
}) {
  return async (request: { caseRef: CaseRef; choiceId: string; changeId: string }, context: TrustedDomainContext) => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "review-access-unavailable" } as const
      const readCase = () => input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      const current = await readCase()
      if (current.status !== "ok") return current
      if (current.value.case.version !== request.caseRef.version || !current.value.case.choices.some((choice) => choice.id === request.choiceId)) return { status: "stale", reason: "review-case-changed" } as const
      const readChange = () => input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[request.caseRef.id]?.preparedChanges.filter((change) => change.id === request.changeId && change.choiceId === request.choiceId) : undefined)
      const changes = await readChange()
      if (changes.status !== "ok" || changes.value?.length !== 1) return { status: "unavailable", reason: "review-change-unavailable" } as const
      const change = changes.value[0]!
      const view = current.value.case.preparedChanges.filter((item) => item.id === change.id && item.choiceId === change.choiceId)
      if (view.length !== 1 || view[0]!.operationRef !== change.operation.id || change.caseId !== request.caseRef.id) return { status: "stale", reason: "review-change-changed" } as const
      const first = await input.reviewDomain(change.operation, context)
      if (first.status !== "ok") return first
      const evidence = first.value.source.target
      if (first.value.originalTargetDigest !== digestSfValue(change.target) || first.value.source.refDigest !== digestSfEvidenceRef(first.value.source) || first.value.source.installationId !== context.binding.installationId || first.value.source.projectId !== context.binding.projectId || evidence.surface !== change.target.surface || evidence.recordType !== change.target.type || evidence.recordId !== change.target.id || digestSfValue(evidence.fields) !== digestSfValue(change.target.fields) || digestSfValue(evidence.period) !== digestSfValue(change.target.period)) return { status: "stale", reason: "review-source-changed" } as const
      const again = await readCase()
      const changesAgain = await readChange()
      const second = await input.reviewDomain(change.operation, context)
      if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || changesAgain.status !== "ok" || changesAgain.value?.length !== 1 || digestSfValue(changesAgain.value[0]) !== digestSfValue(change) || second.status !== "ok" || digestSfValue(second.value) !== digestSfValue(first.value) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "review-changed" } as const
      const receipt = view[0]!.receiptRef ? current.value.case.receipts.find((item) => item.id === view[0]!.receiptRef) : undefined
      return { status: "ok", value: { changeId: change.id, choiceId: change.choiceId, surface: change.target.surface, target: { type: change.target.type, id: change.target.id }, expectedVersion: change.expectedVersion, state: change.state, fields: first.value.fields, ...(receipt ? { receipt } : {}) } } as const
    } catch { return { status: "unavailable", reason: "review-unavailable" } as const }
  }
}

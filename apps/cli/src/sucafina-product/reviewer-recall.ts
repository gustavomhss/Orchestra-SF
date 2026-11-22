import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessRecallRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedCallContext, TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { DecisionRecallInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { createSfCaseRecall, SfRecallCandidateAccess } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"

export const reviewerRecallSkill = "sf-consultar-memoria-decisoria"

export type SfReviewerRecallRun = {
  selection: DecisionRecallInput
  withSelection: <T>(read: (call: TrustedUiContext) => Promise<PortResult<T>>) => Promise<PortResult<T>>
}

function reviewer(call: TrustedDomainContext): call is TrustedCallContext {
  return call.kind === "native" && call.binding.profileId === "sf_reviewer" &&
    call.binding.skillReceipts.length === 1 && call.binding.skillReceipts[0]?.skillId === reviewerRecallSkill
}

export function createSfReviewerRecall(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  run: (runRef: string) => SfReviewerRecallRun | undefined
}) {
  const candidateAccess: SfRecallCandidateAccess = async (requested, call, read) => {
    if (!reviewer(call)) return undefined
    const run = input.run(call.binding.runId)
    const source = input.host.requestFor(call)
    const binding = digestSfValue(call.binding)
    if (!run) return undefined
    const selection = digestSfValue(run.selection)
    const current = () => !!source && !source.signal.aborted && input.host.requestFor(call) === source &&
      input.run(call.binding.runId) === run && digestSfValue(call.binding) === binding && digestSfValue(run.selection) === selection
    if (!current() || !same(run.selection.currentCase, { id: call.binding.caseId, incarnation: call.binding.caseIncarnation, version: call.binding.caseVersion }) ||
      !same(requested, { caseRef: run.selection.currentCase,
      scope: { query: run.selection.query, recallScope: run.selection.recallScope } }) ||
      !await input.host.revalidate(call) || !current()) return undefined
    const result = await run.withSelection(async (human) => {
      if (!current() || input.host.requestFor(human) !== source || !same(subject(human), subject(call)))
        return { status: "denied", reason: "recall-selection-authority-changed" }
      const recalled = await read(human)
      if (recalled.status !== "ok") return { status: "unavailable", reason: "recall-precedent-unavailable" }
      return { status: "ok", value: recalled }
    })
    return result.status === "ok" && current() && await input.host.revalidate(call) && current() ? result.value : undefined
  }

  const scopedRecall = (request: BusinessRecallRequest, call: TrustedDomainContext, recall: ReturnType<typeof createSfCaseRecall>) => {
    if (!reviewer(call)) return undefined
    const selected = input.run(call.binding.runId)?.selection
    if (!selected?.recallScope.cases.length) return undefined
    const allowed = selected.recallScope.cases.map(encodeCaseRef).sort()
    if (!same([...request.selectionRefs].sort(), allowed) || !same(request.period, selected.recallScope.period))
      return Promise.resolve({ status: "unavailable" as const })
    return recall({ caseRef: selected.currentCase, limit: request.limit, scope: { query: selected.query, recallScope: selected.recallScope } }, call)
  }
  return { candidateAccess, scopedRecall }
}

function subject(call: TrustedDomainContext) {
  const binding = call.binding
  return [binding.installationId, binding.projectId, binding.principalRef, binding.accessRevision, binding.policyVersion]
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }

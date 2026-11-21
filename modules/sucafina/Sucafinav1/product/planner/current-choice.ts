import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ChoiceRecord } from "../contracts/decisions.ts"
import type { DomainPortHost, PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { createPlannerResultPersistence } from "./persistence.ts"
import type { createPlannerSourceIssuer } from "./source-issuer.ts"
import type { Snapshot } from "../../runtime/contract.ts"

import { isCurrentChoiceFence, type CurrentChoiceFence } from "../decisions/current-choice-preview.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Re-simulate an authorized historic choice without modifying the recorded choice. */
export function createCurrentPlannerChoice(input: {
  fence?: CurrentChoiceFence
  host?: Pick<DomainPortHost, "requestFor" | "revalidate">
  planner: Pick<PlannerPort, "simulateScenario">
  issueSource: ReturnType<typeof createPlannerSourceIssuer>
  persist: ReturnType<typeof createPlannerResultPersistence>
  store: ReturnType<typeof createSfDecisionResultStore>
  authorizeChoice: (caseRef: CaseRef, choice: ChoiceRecord, context: TrustedDomainContext) => Promise<boolean>
  verifyContinuity: (original: RecordEvidence, current: RecordEvidence, context: TrustedDomainContext) => Promise<PortResult<{ fence: () => Promise<boolean>; fenceSnapshot: (snapshot: Snapshot) => boolean; revalidate: () => Promise<boolean> }>>
  operationIdentity: (context: TrustedDomainContext) => string | undefined
}) {
  const resimulate = async (request: { caseRef: CaseRef; choice: ChoiceRecord }, context: TrustedDomainContext) => {
    const choice = structuredClone(request.choice)
    const caseRef = structuredClone(request.caseRef)
    const source = input.host?.requestFor(context)
    const callId = input.operationIdentity(context)
    if (context.kind !== "ui" || !source || !callId || !await input.authorizeChoice(caseRef, choice, context)) return { status: "denied", reason: "choice-resimulation-unavailable" } as const
    const original = choice.result.sourceRefs.filter((ref): ref is RecordEvidence => ref.kind === "record" && ref.refId === choice.scenario.baseRef && ref.target.surface === "planner" && ref.target.recordType === "planner-version" && ref.refDigest === digestSfEvidenceRef(ref) && ref.installationId === context.binding.installationId && ref.projectId === context.binding.projectId)
    if (original.length !== 1) return { status: "unavailable", reason: "choice-source-unavailable" } as const
    const current = await input.issueSource(original[0]!.target.recordId, context)
    if (current.status !== "ok") return current
    const continuity = await input.verifyContinuity(original[0]!, current.value.evidence, context)
    if (continuity.status !== "ok" || !await continuity.value.revalidate()) return { status: "unavailable", reason: "choice-source-continuity-unavailable" } as const
    input.fence!.observe(context, (snapshots) => continuity.value.fenceSnapshot(snapshots.planner))
    const scenario = { ...choice.scenario, baseRef: current.value.evidence.refId }
    const simulated = await input.planner.simulateScenario(scenario, context)
    if (simulated.status !== "ok") return simulated
    if (!simulated.value.sourceRefs.some((ref) => ref.refDigest === current.value.evidence.refDigest) || !await continuity.value.revalidate() || !await input.authorizeChoice(caseRef, choice, context)) return { status: "stale", reason: "choice-or-source-changed" } as const
    const saved = await input.persist({ kind: "scenario", request: scenario, result: simulated.value }, callId, context, input.planner)
    if (saved.status !== "ok") return saved
    const stored = await input.store.read({ resultRef: saved.value.resultRef, kind: "scenario" }, context)
    if (stored.status !== "ok" || stored.value.kind !== "scenario" || stored.value.caseRef.id !== caseRef.id || stored.value.caseRef.incarnation !== caseRef.incarnation || stored.value.caseRef.version !== caseRef.version || stored.value.requestDigest !== digestSfValue(scenario) || stored.value.resultDigest !== digestSfValue(simulated.value)) return { status: "stale", reason: "choice-result-unavailable" } as const
    const again = await input.issueSource(original[0]!.target.recordId, context)
    if (again.status !== "ok" || again.value.evidence.refDigest !== current.value.evidence.refDigest || !await continuity.value.revalidate() || !await input.authorizeChoice(caseRef, choice, context)) return { status: "stale", reason: "choice-or-source-changed" } as const
    if (input.host?.requestFor(context) !== source || source.signal.aborted || !input.fence!.current(context)) return { status: "stale", reason: "choice-or-source-changed" } as const
    return { status: "ok", value: { resultRef: saved.value.resultRef, scenario, result: simulated.value, choiceDigest: digestSfValue(choice), requestDigest: digestSfValue(scenario), resultDigest: digestSfValue(simulated.value), originalSource: original[0]!, source: current.value.evidence, fenceSnapshot: continuity.value.fenceSnapshot } } as const
  }
  return async (request: { caseRef: CaseRef; choice: ChoiceRecord }, context: TrustedDomainContext): Promise<Awaited<ReturnType<typeof resimulate>>> => {
    if (!isCurrentChoiceFence(input.fence) || !input.host) return { status: "unavailable", reason: "choice-fence-unavailable" }
    try { return await input.fence.run(context, () => resimulate(request, context)) }
    catch { return { status: "unavailable", reason: "choice-resimulation-unavailable" } }
  }
}

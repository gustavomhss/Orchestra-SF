import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioOperation, ScenarioRequest } from "../contracts/operations.ts"
import type { PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

type OperationProof = { operationDigest: string; kind: "planner" } | { operationDigest: string; kind: "external"; sourceRefs: readonly BusinessEvidenceRef[]; condition: string }

/** Keep the full request while treating unsupported domain effects as unresolved, never zero. */
export function createCompositeDecisionPlanner(input: {
  planner: PlannerPort
  evidence: Pick<BusinessContextService, "context">
  resolveOperation: (operation: ScenarioOperation, context: TrustedDomainContext) => Promise<PortResult<OperationProof>>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
}): PlannerPort {
  return {
    ...input.planner,
    simulateScenario: async (incoming: ScenarioRequest, context: TrustedDomainContext) => {
      try {
        const request = structuredClone(incoming)
        if (!await input.revalidate(context)) return { status: "denied", reason: "scenario-authority-unavailable" }
        const resolve = () => Promise.all(request.operations.map((operation) => input.resolveOperation(operation, context)))
        const proofs = await resolve()
        const failure = proofs.find((item) => item.status !== "ok")
        if (failure && failure.status !== "ok") return failure
        if (proofs.some((item, index) => item.status !== "ok" || item.value.operationDigest !== digestSfValue(request.operations[index]) || item.value.kind === "external" && (!item.value.sourceRefs.length || !item.value.condition.trim()))) return { status: "unavailable", reason: "scenario-operation-proof-unavailable" }
        const plannerOperations = request.operations.filter((_operation, index) => { const proof = proofs[index]; return proof?.status === "ok" && proof.value.kind === "planner" })
        const external = proofs.flatMap((item) => item.status === "ok" && item.value.kind === "external" ? [item.value] : [])
        if (!external.length) return input.planner.simulateScenario(request, context)
        const refs = external.flatMap((item) => item.sourceRefs).filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
        if (refs.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref))) return { status: "denied", reason: "scenario-operation-evidence-unavailable" }
        const evidence = await input.evidence.context({ refs }, context)
        if (evidence.length !== refs.length || evidence.some((item, index) => item.state !== "fresh" || item.accessRevision !== context.binding.accessRevision || !item.authorizedProjection || digestSfValue(item.ref) !== digestSfValue(refs[index]) || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref))) return { status: "unavailable", reason: "scenario-operation-evidence-unavailable" }
        const simulated = await input.planner.simulateScenario({ ...request, operations: plannerOperations }, context)
        if (simulated.status !== "ok") return simulated
        const proofsAgain = await resolve()
        const evidenceAgain = await input.evidence.context({ refs }, context)
        if (digestSfValue(proofsAgain) !== digestSfValue(proofs) || evidenceAgain.length !== refs.length || evidenceAgain.some((item, index) => item.state !== "fresh" || item.accessRevision !== context.binding.accessRevision || !item.authorizedProjection || digestSfValue(item.ref) !== digestSfValue(refs[index]) || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await input.revalidate(context)) return { status: "stale", reason: "scenario-operation-changed" }
        const value = simulated.value
        const conditions = external.map((item) => `external-operation:${item.operationDigest}:${item.condition}`)
        const sourceRefs = [...value.sourceRefs, ...refs].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
        const costCoverage = { ...value.costCoverage, coverageState: value.costCoverage.coverageState === "unavailable" ? "unavailable" as const : "pending" as const, issues: [...new Set([...value.costCoverage.issues, "external-operation-cost-unresolved"])], evaluatedSourceRefs: [...value.costCoverage.evaluatedSourceRefs, ...refs].filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index) }
        return { status: "ok", value: { ...value, id: `composite:${digestSfValue({ request, planner: value, proofs })}`, sourceRefs, costCoverage, comparisonStatus: value.comparisonStatus === "incompatible" || value.comparisonStatus === "unavailable" ? value.comparisonStatus : "conditioned", total: null, unresolvedConditions: [...new Set([...value.unresolvedConditions, ...conditions])] } }
      } catch { return { status: "unavailable", reason: "scenario-composition-unavailable" } }
    },
  }
}

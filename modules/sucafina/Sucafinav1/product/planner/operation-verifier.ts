import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PlannerScenarioInputs } from "./scenario-port.ts"
import { projectionDigest } from "./scenario-comparison-port.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PortResult } from "../contracts/ports.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { decodeSfOperationInput } from "../contracts/schema-admission.ts"
import { projectPlannerSource } from "./port.ts"
import { simulatePlannerOperations } from "./scenario.ts"

/** Resolve a single operation only after the Planner has verified its target and replacement. */
export function createPlannerOperationResolver(input: { host: DomainPortHost; planner: Pick<PlannerPort, "compareForecast">; sources: PlannerSourceHost; scenarioInputs: PlannerScenarioInputs }) {
  const verify = createPlannerOperationVerifier(input)
  return async (incoming: { baseRef: string; operation: ScenarioRequest["operations"][number] }, context: TrustedDomainContext): Promise<PortResult<{ operationDigest: string; target: BusinessEvidenceRef; producer: "planner"; sourceVersion: number; replacement?: BusinessEvidenceRef }>> => {
    const request = structuredClone(incoming)
    if (!request?.baseRef || !request.operation || !await verify({ baseRef: request.baseRef, operations: [request.operation], assumptions: [] }, context)) return { status: "unavailable", reason: "planner-operation-unavailable" }
    const source = await input.sources.resolveForecastSource(request.baseRef, context)
    if (source.status !== "ok") return source
    const replacement = request.operation.replacementRef ? await input.scenarioInputs.resolveAmount(request.operation.replacementRef, context) : undefined
    if (replacement && replacement.status !== "ok") return replacement
    if (!await verify({ baseRef: request.baseRef, operations: [request.operation], assumptions: [] }, context)) return { status: "stale", reason: "planner-operation-changed" }
    const latest = await input.sources.resolveForecastSource(request.baseRef, context)
    const replacementAgain = request.operation.replacementRef ? await input.scenarioInputs.resolveAmount(request.operation.replacementRef, context) : undefined
    const stable = (entry: Awaited<ReturnType<PlannerScenarioInputs["resolveAmount"]>> | undefined) => entry?.status === "ok" ? digestSfValue({ ...entry.value, source: { ...entry.value.source, observedAt: "" } }) : digestSfValue(entry)
    if (latest.status !== "ok" || latest.value.evidence.refDigest !== source.value.evidence.refDigest || stable(replacementAgain) !== stable(replacement) || !await input.host.revalidate(context)) return { status: "stale", reason: "planner-operation-changed" }
    return { status: "ok", value: { operationDigest: digestSfValue(request.operation), target: source.value.evidence, producer: "planner", sourceVersion: source.value.evidence.target.version, ...(replacement?.status === "ok" ? { replacement: replacement.value.evidence } : {}) } }
  }
}

/** Verify all Planner targets and amount references under the current actor; mixed domains need their own verifier. */
export function createPlannerOperationVerifier(input: { host: DomainPortHost; planner: Pick<PlannerPort, "compareForecast">; sources: PlannerSourceHost; scenarioInputs: PlannerScenarioInputs }) {
  return async (incoming: ScenarioRequest, context: TrustedDomainContext) => {
    const parsed = decodeSfOperationInput("sf_scenario_simulate", incoming)
    if (!parsed.ok) return false
    const scenario = parsed.value
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context) || !scenario || !Array.isArray(scenario.operations)) return false
    const source = structuredClone(await input.sources.resolveForecastSource(scenario.baseRef, context))
    if (source.status !== "ok" || !source.value.evidence.target.period) return false
    const compare = () => input.planner.compareForecast({ baseRef: scenario.baseRef, candidateRef: scenario.baseRef, period: source.value.evidence.target.period!, currency: "USD" }, context)
    const projection = await compare()
    if (projection.status !== "ok" || !projection.value.sourceRefs.some((ref) => ref.refDigest === source.value.evidence.refDigest)) return false
    const values = projection.value.baseline
    const references = scenario.operations.flatMap((operation) => operation.replacementRef ? [operation.replacementRef] : [])
    const resolve = () => Promise.all(references.map((reference) => input.scenarioInputs.resolveAmount(reference, context)))
    const resolved = structuredClone(await resolve())
    if (resolved.some((entry) => entry.status !== "ok" || entry.value.evidence.refDigest !== digestSfEvidenceRef(entry.value.evidence) || entry.value.evidence.installationId !== context.binding.installationId || entry.value.evidence.projectId !== context.binding.projectId)) return false
    if (scenario.operations.some((operation) => {
      const targets = values.components.filter((component) => component.id === operation.targetRef)
      if (targets.length !== 1 || !["replace", "include", "exclude", "defer"].includes(operation.kind)) return true
      const forecast = values.values.filter((value) => value.id === `${operation.targetRef}:forecast`)
      if (forecast.length !== 1 || operation.currency && operation.currency !== forecast[0]!.currency) return true
      if (operation.kind === "defer") {
        if (!operation.period || operation.amount !== undefined || operation.replacementRef) return true
        const month = Number(operation.period.start.slice(5, 7))
        const line = operation.targetRef.slice(0, operation.targetRef.lastIndexOf(":"))
        const destination = values.components.filter((component) => component.id === `${line}:${month}` && component.period.start === operation.period!.start && component.period.end === operation.period!.end)
        return destination.length !== 1 || destination[0]!.id === operation.targetRef
      }
      if (operation.period && (operation.period.start !== targets[0]!.period.start || operation.period.end !== targets[0]!.period.end)) return true
      if (operation.kind === "exclude") return operation.amount !== undefined || !!operation.replacementRef
      if (operation.replacementRef) {
        const index = references.indexOf(operation.replacementRef)
        const entry = resolved[index]
        return operation.amount !== undefined || !entry || entry.status !== "ok" || entry.value.period.start !== targets[0]!.period.start || entry.value.period.end !== targets[0]!.period.end || operation.currency !== undefined && operation.currency !== entry.value.currency
      }
      return typeof operation.amount !== "number" || !Number.isFinite(operation.amount)
    })) return false
    const environment = await input.host.environment(request)
    const accepted = await input.host.persistence.transaction("planner", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: false }
      const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const current = projectPlannerSource(snapshot, actor, source.value.versionId)
      if (!current || digestSfValue({ versionId: source.value.versionId, projection: current }) !== source.value.evidence.target.projectionDigest) return { commit: false, value: false }
      const operations = scenario.operations.map((operation) => {
        const replacement = operation.replacementRef ? resolved[references.indexOf(operation.replacementRef)] : undefined
        return replacement?.status === "ok" ? { ...operation, replacementRef: undefined, amount: replacement.value.amount, currency: replacement.value.currency, period: replacement.value.period } : operation
      })
      return { commit: false, value: simulatePlannerOperations(snapshot, actor, environment, source.value.versionId, operations).status === "ok" }
    }, { signal: request.signal }).catch(() => false)
    if (!accepted) return false
    const again = await compare()
    const sourceAgain = await input.sources.resolveForecastSource(scenario.baseRef, context)
    const resolvedAgain = await resolve()
    const stable = (entry: typeof resolved[number]) => entry.status === "ok" ? digestSfValue({ ...entry.value, source: { ...entry.value.source, observedAt: "" } }) : digestSfValue(entry)
    return again.status === "ok" && projectionDigest(again.value.baseline) === projectionDigest(values) && sourceAgain.status === "ok" && sourceAgain.value.evidence.refDigest === source.value.evidence.refDigest && resolvedAgain.length === resolved.length && resolvedAgain.every((entry, index) => stable(entry) === stable(resolved[index]!)) && !request.signal.aborted && await input.host.revalidate(context)
  }
}

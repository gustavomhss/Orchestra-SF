import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { simulatePlannerOperations } from "./scenario.ts"

export async function simulateScenario(input: { host: DomainPortHost; sources: PlannerSourceHost; compare: PlannerPort["compareForecast"]; project: (snapshot: Snapshot, actor: Actor, versionId: string) => Record<string, unknown> | undefined }, request: ScenarioRequest, binding: TrustedDomainContext): ReturnType<PlannerPort["simulateScenario"]> {
  if (request.assumptions.length) return { status: "needs-input", reason: "assumptions-require-current-evidence-resolution" }
  const source = structuredClone(await input.sources.resolveForecastSource(request.baseRef, binding))
  if (source.status !== "ok") return source
  const coverage = structuredClone(await input.sources.resolveForecastCoverage(request.baseRef, binding))
  if (coverage.status !== "ok") return coverage
  if (coverage.value.assessment.basisId !== coverage.value.basis.id || coverage.value.assessment.basisVersion !== coverage.value.basis.version || !coverage.value.assessment.evaluatedSourceRefs.some((ref) => ref.kind === "record" && ref.refId === source.value.evidence.refId && ref.refDigest === source.value.evidence.refDigest && ref.target.incarnation === source.value.evidence.target.incarnation && ref.target.version === source.value.evidence.target.version && ref.target.projectionDigest === source.value.evidence.target.projectionDigest)) return { status: "needs-input", reason: "coverage-source-mismatch" }
  const period = coverage.value.assessment.horizon
  const currency = coverage.value.assessment.currency
  const current = await input.compare({ baseRef: request.baseRef, candidateRef: request.baseRef, period, currency }, binding)
  if (current.status !== "ok") return current
  if (current.value.sourceRefs.some((ref) => ref.refDigest !== source.value.evidence.refDigest)) return { status: "stale", reason: "source-changed" }
  const http = input.host.requestFor(binding)
  if (!http || !(await input.host.revalidate(binding))) return { status: "denied", reason: "invalid-binding" }
  const environment = await input.host.environment(http)
  const preview = await input.host.persistence.transaction<ReturnType<typeof simulatePlannerOperations> | { status: "stale" | "denied"; reason: string }>("planner", async (snapshot) => {
    const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied" as const, reason: "principal-unavailable" } }
    const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    const projection = input.project(snapshot, actor, source.value.versionId)
    if (!projection || digestSfValue({ versionId: source.value.versionId, projection }) !== source.value.evidence.target.projectionDigest) return { commit: false, value: { status: "stale" as const, reason: "source-changed" } }
    return { commit: false, value: simulatePlannerOperations(snapshot, actor, environment, source.value.versionId, request.operations) }
  })
  if (preview.status !== "ok") return preview
  const version = rows(preview.view.data.versions).find((item) => item.id === source.value.versionId)
  if (!version) return { status: "unavailable", reason: "preview-unavailable" }
  const lines = rows(object(version.summary).lines)
  const changed = new Set(request.operations.map((operation) => operation.targetRef))
  const components = current.value.baseline.components.map((component) => {
    const separator = component.id.lastIndexOf(":")
    const line = lines.find((item) => item.id === component.id.slice(0, separator))
    const month = Number(component.id.slice(separator + 1))
    const outlook = line?.outlook
    const value = Array.isArray(outlook) ? outlook[month - 1] : undefined
    return { ...component, amount: component.amount === null || typeof value !== "number" || !Number.isFinite(value) ? null : value, evidenceState: component.amount === null ? "absent" as const : changed.has(component.id) ? "hypothetical" as const : component.evidenceState }
  })
  const rechecked = await input.compare({ baseRef: request.baseRef, candidateRef: request.baseRef, period, currency }, binding)
  const coverageAgain = await input.sources.resolveForecastCoverage(request.baseRef, binding)
  if (rechecked.status !== "ok" || rechecked.value.sourceRefs.some((ref) => ref.refDigest !== source.value.evidence.refDigest) || digestSfValue(coverageAgain) !== digestSfValue(coverage) || !(await input.host.revalidate(binding))) return { status: "stale", reason: "source-or-authority-changed" }
  const unresolved = [...current.value.gaps, "scenario-is-hypothetical"]
  return { status: "ok", value: { id: `preview:${digestSfValue({ request, source: source.value.evidence.refDigest })}`, version: 0, components, knownSubtotal: components.some((component) => component.amount !== null) ? components.reduce((sum, component) => sum + (component.amount ?? 0), 0) : null, total: null, currency, horizon: period, sourceRefs: [source.value.evidence], costCoverage: coverage.value.assessment, comparisonStatus: "conditioned", unresolvedConditions: unresolved, restrictions: ["preview-not-applied"] } }
}

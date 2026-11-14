import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PlannerSourceHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfPlannerEvidenceRef, sfPlannerSourceSelector } from "../integration/planner-sources.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import { projectSfSourceScope, sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import { buildPlannerFinancialProjection } from "./port.ts"

/** Read one existing, actor-scoped source. A projection does not assert complete cost coverage. */
export function createSfPlannerEvidenceReader(input: {
  host: DomainPortHost
  sources: Pick<PlannerSourceHost, "resolveForecastCoverage">
  now: () => string
}) {
  return async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: input.now() })
    const request = input.host.requestFor(call)
    if (!request || request.signal.aborted || ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version" || !ref.target.period ||
      ref.refId !== sfPlannerSourceSelector(ref.target.recordId, ref.target.incarnation, ref.target.version) || !await input.host.revalidate(call)) return unavailable()
    const environment = await input.host.environment(request)
    const read = () => input.host.persistence.transaction("planner", async (snapshot) => {
      if (request.signal.aborted || !await input.host.revalidate(call)) return { commit: false, value: undefined }
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
      const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
        recordType: "planner-version", recordId: ref.target.recordId, selector: sfPlannerProjectionSelector(snapshot, actor) }
      const identity = sfScopedSourceIdentity(snapshot, scope)
      const projected = projectSfSourceScope("planner", snapshot, scope)
      if (!identity || projected === undefined || identity.incarnation !== ref.target.incarnation || identity.version !== ref.target.version ||
        identity.inputDigest !== digestSfValue(projected)) return { commit: false, value: undefined }
      const projection = object(projected)
      const currentRef = sfPlannerEvidenceRef({ versionId: ref.target.recordId, projection, identity }, call)
      // Compare the entire producer reference, including fields, period, evidence level and sealed digest.
      if (!currentRef || digestSfValue(currentRef) !== digestSfValue(ref) || !await input.host.revalidate(call)) return { commit: false, value: undefined }
      return { commit: false, value: { projection, ref: currentRef } }
    }, { signal: request.signal })
    const current = await read().catch(() => undefined)
    if (!current) return unavailable()
    const coverage = await input.sources.resolveForecastCoverage(ref.refId, call)
    if (coverage.status !== "ok" && coverage.status !== "unavailable" && coverage.status !== "needs-input") return unavailable()
    const coverageDigest = digestSfValue(coverage)
    const projection = buildPlannerFinancialProjection({ projection: current.projection, ref: current.ref, period: ref.target.period, binding: call, at: environment.at })
    if (new Set(projection.values.map((value) => value.id)).size !== projection.values.length) return unavailable()
    const latestCoverage = await input.sources.resolveForecastCoverage(ref.refId, call)
    if (digestSfValue(latestCoverage) !== coverageDigest) return unavailable()
    // Recheck after the asynchronous coverage boundary; no source identity is materialized by a read.
    const latest = await read().catch(() => undefined)
    if (!latest || digestSfValue(latest.projection) !== digestSfValue(current.projection) || request.signal.aborted || !await input.host.revalidate(call)) return unavailable()
    return { state: "fresh", ref, currentRef: latest.ref, authorizedProjection: projection, accessRevision: call.binding.accessRevision, checkedAt: input.now() }
  }
}

import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { ImportTarget } from "../../../../modules/sucafina/Sucafinav1/product/imports/staged-files.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { sfScopedSourceIdentity } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { projectSfSourceScope, sfPlannerRosterProjectionSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"

const fields = ["end", "leader", "location", "name", "start", "status", "title", "type"] as const

export function createSfRosterSources(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort; plannerSources: PlannerSourceHost }) {
  const verifyRoster = (snapshot: Snapshot, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>, actor: Actor, call: TrustedDomainContext) => {
    if (evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.installationId !== call.binding.installationId || evidence.projectId !== call.binding.projectId ||
      evidence.target.surface !== "planner" || evidence.target.recordType !== "planner-roster" || evidence.target.recordId !== "file" ||
      digestSfValue(evidence.target.fields) !== digestSfValue(fields) || !evidence.target.period || actor.id !== call.binding.principalRef ||
      !actor.canWrite || !actor.roles.some((role) => role === "admin" || role === "hr") ||
      evidence.refId !== `sf-roster:${encodeURIComponent(evidence.target.incarnation)}:${evidence.target.version}`) return false
    const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
      recordType: "planner-roster", recordId: "file", selector: sfPlannerRosterProjectionSelector(snapshot, actor, fields, evidence.target.period) }
    const identity = sfScopedSourceIdentity(snapshot, scope)
    const projection = projectSfSourceScope("planner", snapshot, scope)
    return !!identity && projection !== undefined && identity.incarnation === evidence.target.incarnation && identity.version === evidence.target.version &&
      identity.inputDigest === digestSfValue(projection) && evidence.target.projectionDigest === identity.inputDigest
  }
  const resolveRoster = async (target: ImportTarget, call: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
    const request = input.host.requestFor(call)
    if (!request || target.surface !== "planner" || !await input.host.revalidate(call)) return { status: "denied", reason: "roster-authority-unavailable" }
    const source = await input.plannerSources.resolveForecastSource(target.selectionRef, call)
    if (source.status !== "ok") return source
    if (source.value.evidence.target.incarnation !== target.incarnation || source.value.evidence.target.version !== target.version || !source.value.evidence.target.period)
      return { status: "stale", reason: "roster-target-changed" }
    const actorFor = async (snapshot: Snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return undefined
      const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
        assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
        domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      return actor.canWrite && roles.some((role) => role === "admin" || role === "hr") ? actor : undefined
    }
    const selected = await input.host.persistence.transaction("planner", async (snapshot) => {
      const actor = await actorFor(snapshot)
      return { commit: false, value: actor ? { actor, selector: sfPlannerRosterProjectionSelector(snapshot, actor, fields, source.value.evidence.target.period!) } : undefined }
    }, { signal: request.signal })
    if (!selected) return { status: "denied", reason: "roster-authority-unavailable" }
    const scope = { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
      recordType: "planner-roster", recordId: "file", selector: selected.selector }
    const current = await input.scopedSources.readScopedSource("planner", scope, async (snapshot) => {
      const actual = await actorFor(snapshot)
      return !!actual && digestSfValue(actual) === digestSfValue(selected.actor) && digestSfValue(sfPlannerRosterProjectionSelector(snapshot, actual, fields, source.value.evidence.target.period!)) === digestSfValue(scope.selector)
    })
    if (!current || !await input.host.revalidate(call)) return { status: "unavailable", reason: "roster-source-unavailable" }
    const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", evidenceLevel: "observed", installationId: call.binding.installationId,
      projectId: call.binding.projectId, refId: `sf-roster:${encodeURIComponent(current.incarnation)}:${current.version}`, refDigest: "", target: { surface: "planner",
        recordType: "planner-roster", recordId: "file", incarnation: current.incarnation, version: current.version, fields, period: source.value.evidence.target.period,
        projectionDigest: digestSfValue(current.projection) } }
    evidence.refDigest = digestSfEvidenceRef(evidence)
    const checked = await input.host.persistence.transaction("planner", async (snapshot) => {
      const actual = await actorFor(snapshot)
      return { commit: false, value: !!actual && verifyRoster(snapshot, evidence, actual, call) }
    }, { signal: request.signal })
    const again = await input.plannerSources.resolveForecastSource(target.selectionRef, call)
    return checked && again.status === "ok" && digestSfValue(again.value.evidence) === digestSfValue(source.value.evidence) && await input.host.revalidate(call)
      ? { status: "ok", value: evidence } : { status: "stale", reason: "roster-source-changed" }
  }
  return { resolveRoster, verifyRoster }
}

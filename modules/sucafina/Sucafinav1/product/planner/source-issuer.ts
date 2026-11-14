import { roleMap } from "../../runtime/admin.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PlannerSourceHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import { sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import { sfPlannerSourceSelector } from "../integration/planner-sources.ts"

/** Issue an actor-scoped selector from the current domain identity and authenticated request. */
export function createPlannerSourceIssuer(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort; sources: PlannerSourceHost }) {
  return async (versionId: string, context: TrustedDomainContext): ReturnType<PlannerSourceHost["resolveForecastSource"]> => {
    if (typeof versionId !== "string" || !versionId.trim()) return { status: "needs-input", reason: "invalid-version-id" }
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "source-authority-unavailable" }
    const selector = async (snapshot: Snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
      const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
      return sfPlannerProjectionSelector(snapshot, actor)
    }
    const selected = await input.host.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: await selector(snapshot) }), { signal: request.signal }).catch(() => undefined)
    if (!selected) return { status: "denied", reason: "source-authority-unavailable" }
    const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "planner-version", recordId: versionId, selector: selected }
    const current = await input.scopedSources.readScopedSource("planner", scope, async (snapshot) => !request.signal.aborted && digestSfValue(await selector(snapshot)) === digestSfValue(selected)).catch(() => undefined)
    if (!current || !await input.host.revalidate(context)) return { status: "denied", reason: "source-unavailable" }
    const resolved = await input.sources.resolveForecastSource(sfPlannerSourceSelector(versionId, current.incarnation, current.version), context)
    if (resolved.status !== "ok") return resolved
    if (resolved.value.evidence.target.projectionDigest !== digestSfValue({ versionId, projection: current.projection }) || !await input.host.revalidate(context)) return { status: "stale", reason: "source-or-authority-changed" }
    return resolved
  }
}

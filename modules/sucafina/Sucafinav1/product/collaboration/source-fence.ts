import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfPlannerProjectionSelector } from "../integration/source-projections.ts"
import type { SfScopedSourcePort, SfSourceScope } from "../integration/source-lifecycle.ts"

export type ScopedSourceFence = { surface: Surface; scope: SfSourceScope; expected: { incarnation: string; version: number; inputDigest: string } }
type ReadOnlyScopedSources = SfScopedSourcePort & { checkScopedSource?: (surface: Surface, scope: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>, expected: ScopedSourceFence["expected"]) => Promise<boolean> }

/** Checks a previously registered scoped projection without creating or refreshing a source. */
export function createCollaborationSourceFence(input: { host: DomainPortHost; scopedSources: ReadOnlyScopedSources }) {
  return async (proof: ScopedSourceFence, context: TrustedDomainContext): Promise<PortResult<true>> => {
    const selected = structuredClone(proof)
    const request = input.host.requestFor(context)
    if (!request || !input.scopedSources.checkScopedSource || !await input.host.revalidate(context)) return { status: "unavailable", reason: "source-fence-unavailable" }
    if (selected.scope.principalRef !== context.binding.principalRef || selected.scope.accessRevision !== context.binding.accessRevision || selected.scope.policyVersion !== context.binding.policyVersion || !selected.expected.incarnation || !Number.isSafeInteger(selected.expected.version) || selected.expected.version < 1 || !/^[a-f0-9]{64}$/.test(selected.expected.inputDigest)) return { status: "denied", reason: "source-fence-invalid" }
    const checked = await input.scopedSources.checkScopedSource(selected.surface, selected.scope, async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: selected.surface, roleMap: roleMap(snapshot, selected.surface) })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:") || request.signal.aborted) return false
      const roles = principal.roles.filter((entry) => entry.surface === selected.surface).map((entry) => entry.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const selector = object(selected.scope.selector)
      if (selected.surface === "dashboard") return digestSfValue(selector.actor) === digestSfValue(actor) && selector.roleMapDigest === digestSfValue(roleMap(snapshot, "dashboard"))
      if (selected.surface === "planner") return digestSfValue(selected.scope.selector) === digestSfValue(sfPlannerProjectionSelector(snapshot, { id: actor.id, roles: actor.roles, canWrite: actor.canWrite }))
      if (selector.kind !== "procurement-record-v1" || !Array.isArray(selector.fields) || !roles.length) return false
      return digestSfValue(selected.scope.selector) === digestSfValue({ kind: "procurement-record-v1", roles, canWrite: actor.canWrite, roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")), fields: selector.fields, ...(selector.period !== undefined ? { period: selector.period, currency: selector.currency } : {}) })
    }, selected.expected).catch(() => false)
    if (!checked || !await input.host.revalidate(context)) return { status: "stale", reason: "source-or-authority-changed" }
    return { status: "ok", value: true }
  }
}

import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { HotTopicHost } from "../dashboard/hot-topics.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"

/** Canonical action reads need read grants only and can never commit the callback's staging. */
export function createCollaborationHotTopicReadHost(input: { host: DomainPortHost; state: SfProductStatePort; evidence: BusinessContextService; mutationFence: CollaborationMutationFence }): HotTopicHost {
  const sources = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    const resolved = await input.evidence.context({ refs }, context).catch(() => [])
    return refs.length > 0 && resolved.length === refs.length && resolved.every((value, index) => value.state === "fresh" && digestSfValue(value.ref) === digestSfValue(refs[index]))
  }
  const granted = async (request: Request, context: TrustedDomainContext) => {
    const result = await input.state.read(request, "relations", (_state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision)
    return result.status === "ok" && result.value || result.status === "unavailable" && result.reason === "product-state-uninitialized"
  }
  return { transact: async <T>(context: TrustedDomainContext, sourceRefs: readonly BusinessEvidenceRef[], work: Parameters<HotTopicHost["transact"]>[2]): Promise<PortResult<T>> => {
    const refs = structuredClone(sourceRefs)
    const request = input.host.requestFor(context)
    if (!request || request.signal.aborted || !await input.host.revalidate(context) || !await granted(request, context) || !await sources(refs, context)) return { status: "denied", reason: "source-access-unavailable" }
    const fence = await input.mutationFence.prepare(() => sources(refs, context))
    if (!fence) return { status: "unavailable", reason: "source-fence-unavailable" }
    const environment = await input.host.environment(request)
    const result = await input.host.persistence.transaction<PortResult<T>>("dashboard", async (snapshot) => {
      if (!input.mutationFence.check(fence)) return { commit: false, value: { status: "unavailable", reason: "source-access-unavailable" } }
      const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:") || environment.directory.filter((person) => person.id === principal.id && !!person.name.trim()).length !== 1) return { commit: false, value: { status: "denied", reason: "authority-unavailable" } }
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles: principal.roles.filter((role) => role.surface === "dashboard").map((role) => role.role), canWrite: false, assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const outcome = work(structuredClone(snapshot), actor, environment, {})
      return { commit: false, value: outcome.commit ? { status: "denied", reason: "hot-topic-read-only" } : outcome.value as PortResult<T> }
    }, { signal: request.signal }).catch(() => ({ status: "unavailable" as const, reason: "action-read-unavailable" }))
    if (!await granted(request, context) || !await sources(refs, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "source-access-unavailable" }
    return result
  } }
}

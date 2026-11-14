import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { HotTopicHost } from "../dashboard/hot-topics.ts"

const prefix = "sf:hot-topic:"

/** C08 stages the producer's domain mutation and its correlations in one durable transaction. */
export function createCollaborationHotTopicHost(input: { host: DomainPortHost; state: SfProductStatePort; evidence: BusinessContextService; creationTarget: { ref: string; incarnation: string }; authorizeMutation: (context: TrustedDomainContext) => Promise<boolean>; mutationFence: CollaborationMutationFence }): HotTopicHost {
  const transact: HotTopicHost["transact"] = async (context, sourceRefs, work) => {
    const refs = structuredClone(sourceRefs)
    const request = input.host.requestFor(context)
    if (!request || !refs.length || !await input.host.revalidate(context) || !await sourcesAvailable(input.evidence, refs, context)) return { status: "denied", reason: "source-access-unavailable" }
    const fence = await input.mutationFence.prepare(() => sourcesAvailable(input.evidence, refs, context))
    if (!fence) return { status: "unavailable", reason: "source-fence-unavailable" }
    const before = await input.state.read(request, "relations", () => null)
    if (before.status !== "ok" && !(before.status === "unavailable" && before.reason === "product-state-uninitialized")) return { status: "unavailable", reason: "product-state-unavailable" }
    const environment = await input.host.environment(request)
    const transactionId = environment.id()
    if (!transactionId.trim() || !await input.host.revalidate(context)) return { status: "unavailable", reason: "authority-unavailable" }
    const commit = { requested: false }
    const saved = await input.state.transaction(request, {
      namespace: "relations", expectedStorageVersion: before.status === "ok" ? before.storageVersion : 0,
      targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation,
      idempotencyKey: `sf:hot-topic:transaction:${transactionId}`, commandDigest: digestSfValue({ refs, transactionId }),
    }, async (state, authority, snapshot) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !input.mutationFence.check(fence)) return { commit: false, value: { status: "denied" as const, reason: "source-access-unavailable" } }
      const principal = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      if (!principal || principal.id !== authority.principalRef || principal.id.startsWith("local:") || !environment.directory.some((person) => person.id === principal.id && !!person.name.trim())) return { commit: false, value: { status: "denied" as const, reason: "authority-unavailable" } }
      const roles = principal.roles.filter((role) => role.surface === "dashboard").map((role) => role.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((entry): entry is string => typeof entry === "string") : [] }
      const correlations = Object.fromEntries(Object.entries(state.relations).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), structuredClone(value)])) as Parameters<Parameters<HotTopicHost["transact"]>[2]>[3]
      if (Object.entries(correlations).some(([key, value]) => !/^[a-f0-9]{64}$/.test(key) || !value || typeof value.id !== "string" || !value.id.trim() || typeof value.digest !== "string" || !/^[a-f0-9]{64}$/.test(value.digest))) return { commit: false, value: { status: "unavailable" as const, reason: "invalid-correlations" } }
      const outcome = work(snapshot, actor, environment, correlations)
      if (!outcome.commit) return { commit: false, value: outcome.value }
      if (request.signal.aborted || !await input.authorizeMutation(context)) return { commit: false, value: { status: "denied" as const, reason: "source-access-unavailable" } }
      Object.entries(correlations).forEach(([key, value]) => { state.relations[`${prefix}${key}`] = value })
      commit.requested = true
      return { commit: true, value: outcome.value }
    }).catch(() => ({ status: "unavailable" as const, reason: "action-outcome-unknown-retry-same-correlation" }))
    if ("reason" in saved) return saved
    if (saved.status === "preview" && commit.requested) return { status: "unavailable", reason: "action-commit-unconfirmed" }
    if (!await input.host.revalidate(context) || !await sourcesAvailable(input.evidence, refs, context)) return { status: "denied", reason: "source-access-unavailable" }
    return saved.value
  }
  return { transact }
}

async function sourcesAvailable(evidence: BusinessContextService, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) {
  const resolutions = await evidence.context({ refs }, context).catch(() => [])
  return resolutions.length === refs.length && resolutions.every((entry, index) => entry.state === "fresh" && digestSfValue(entry.ref) === digestSfValue(refs[index]))
}


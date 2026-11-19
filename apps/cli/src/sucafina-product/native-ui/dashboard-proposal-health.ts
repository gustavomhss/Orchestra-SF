import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "dashboard.dashboard-workbench" | "dashboard.dashboard-draft-read" |
  "dashboard.dashboard-hot-topic-draft" | "dashboard.dashboard-hot-topic-draft-outcome" |
  "dashboard.dashboard-hot-topic-prepare" | "dashboard.dashboard-hot-topic-review" | "dashboard.dashboard-hot-topic-apply"

/** Installed infrastructure only; original draft/choice/source fences still authorize every selected record. */
export async function observeSfDashboardProposalHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  humanActions: (request: Request) => Promise<readonly string[]>
  source: (id: Operation) => { producer: object; dependencies: readonly object[] } | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const candidates = [
    // Review history is optional in discover(); its absence cannot remove the private proposal reader.
    { id: "dashboard.dashboard-workbench", query: "dashboard-workbench", human: null, namespaces: [["cases", "read"], ["preferences", "read"], ["receipts", "read"]] },
    { id: "dashboard.dashboard-draft-read", query: "dashboard-draft-read", human: null, namespaces: [["cases", "read"], ["preferences", "read"]] },
    { id: "dashboard.dashboard-hot-topic-draft", query: "dashboard-hot-topic-draft", human: "decisions.edit", namespaces: [["cases", "read"], ["preferences", "write"]] },
    { id: "dashboard.dashboard-hot-topic-draft-outcome", query: "dashboard-hot-topic-draft-outcome", human: "decisions.edit", namespaces: [["cases", "read"], ["preferences", "read"]] },
    { id: "dashboard.dashboard-hot-topic-prepare", query: "dashboard-hot-topic-prepare", human: "decisions.prepare-changes", namespaces: [["cases", "write"], ["preferences", "write"]] },
    { id: "dashboard.dashboard-hot-topic-review", query: "dashboard-hot-topic-review", human: null, namespaces: [["cases", "read"], ["preferences", "read"]] },
    { id: "dashboard.dashboard-hot-topic-apply", query: "dashboard-hot-topic-apply", human: "decisions.apply", namespaces: [["cases", "write"], ["preferences", "read"], ["receipts", "write"]] },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== "POST" ||
      metadata.pathTemplate !== "{mount}/dashboard" || metadata.fixedQuery.sf !== candidate.query ||
      metadata.responseMode !== "json") return []
    const source = sourceFor(candidate.id)
    if (!source || !source.dependencies.length) return []
    const installed = bindingFor(candidate.id, source.producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return []
    const current = () => {
      const next = sourceFor(candidate.id)
      return input.binding === bindingFor && input.source === sourceFor && input.ui === ui && input.state === state &&
        !!next && next.producer === source.producer && next.dependencies.length === source.dependencies.length &&
        next.dependencies.every((dependency, index) => dependency === source.dependencies[index]) &&
        bindingFor(candidate.id, source.producer) === installed && !request.signal.aborted
    }
    const digest = digestSfValue({ purpose: "dashboard-proposal-source-health", id: candidate.id })
    const admitted = await ui.admit(request, "sf_dashboard_read", digest)
    if (admitted.status !== "ok") return []
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, "sf_dashboard_read", digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.human && !(await input.humanActions(request)).includes(candidate.human)) return []
      let aggregate: { revision: number; incarnation: string } | undefined
      for (const [namespace, mode] of candidate.namespaces) {
        const read = () => state.read(request, namespace, selectSfNamespaceHealth(namespace, stamp, mode))
        const first = await read(), second = await read()
        if (first.status !== "ok" || second.status !== "ok" || !first.value || !second.value ||
          first.storageVersion !== first.value.storageVersion || first.aggregateRevision !== first.value.aggregateRevision ||
          first.incarnation !== first.value.incarnation || second.storageVersion !== second.value.storageVersion ||
          second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
          first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
          first.incarnation !== second.incarnation || !await ui.revalidate(admitted.value) ||
          ui.requestFor(admitted.value) !== request || !current()) return []
        if (aggregate && (aggregate.revision !== first.aggregateRevision || aggregate.incarnation !== first.incarnation)) return []
        aggregate = { revision: first.aggregateRevision, incarnation: first.incarnation }
      }
      if (candidate.human && !(await input.humanActions(request)).includes(candidate.human)) return []
      if (!await ui.revalidate(admitted.value) || !current()) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { ui.finish(admitted.value) }
  }))
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
}

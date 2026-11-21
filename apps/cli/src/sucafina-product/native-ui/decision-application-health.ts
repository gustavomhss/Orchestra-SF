import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "decisions.decision-prepare-changes" | "decisions.decision-review" | "decisions.decision-apply" | "decisions.decision-recover" | "decisions.procurement-proposal-review" | "decisions.procurement-proposal-advance"

/** Observe the installed C12 producers; selected case/target authorization stays in their original handlers. */
export async function observeSfDecisionApplicationHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  humanActions: (request: Request) => Promise<readonly string[]>
  source: (id: Operation) => { producer: object; dependencies: readonly object[] } | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const candidates = [
    { id: "decisions.decision-prepare-changes", query: "decision-prepare-changes", human: "decisions.prepare-changes", write: true },
    { id: "decisions.decision-review", query: "decision-review", human: "decisions.portfolio.read", write: false },
    { id: "decisions.decision-apply", query: "decision-apply", human: "decisions.apply", write: true },
    { id: "decisions.decision-recover", query: "decision-recover", human: "decisions.apply", write: true },
    { id: "decisions.procurement-proposal-review", query: "decision-proposal-review", human: "decisions.procurement-proposal.review", write: false },
    { id: "decisions.procurement-proposal-advance", query: "decision-proposal-advance", human: "decisions.procurement-proposal.advance", write: false },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (candidate.id === "decisions.decision-prepare-changes" && metadata.effect !== "prepare") return []
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== "POST" ||
      metadata.pathTemplate !== "{mount}/procurement" || metadata.fixedQuery.sf !== candidate.query ||
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
    const digest = digestSfValue({ purpose: "decision-application-source-health", id: candidate.id })
    const admitted = await ui.admit(request, "sf_case_read", digest)
    if (admitted.status !== "ok") return []
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, "sf_case_read", digest) ||
        ui.requestFor(admitted.value) !== request || !current() ||
        !(await input.humanActions(request)).includes(candidate.human)) return []
      // C12 links the case to an actual receipt. Infrastructure reads use the
      // original C08 selectors; no application, grant or receipt is manufactured.
      const namespaces = candidate.id === "decisions.decision-prepare-changes" ? ["cases", "preferences"] as const :
        candidate.query.startsWith("decision-proposal-") ? ["cases"] as const : ["cases", "receipts"] as const
      for (const namespace of namespaces) {
        const mode = namespace !== "receipts" && candidate.write ? "write" : "read"
        const read = () => state.read(request, namespace, selectSfNamespaceHealth(namespace, stamp, mode))
        const first = await read(), second = await read()
        if (first.status !== "ok" || second.status !== "ok" || !first.value || !second.value ||
          first.storageVersion !== first.value.storageVersion || first.aggregateRevision !== first.value.aggregateRevision ||
          first.incarnation !== first.value.incarnation || second.storageVersion !== second.value.storageVersion ||
          second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
          first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
          first.incarnation !== second.incarnation || !await ui.revalidate(admitted.value) ||
          ui.requestFor(admitted.value) !== request || !current()) return []
      }
      if (!(await input.humanActions(request)).includes(candidate.human) ||
        !await ui.revalidate(admitted.value) || !current()) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { ui.finish(admitted.value) }
  }))
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
}

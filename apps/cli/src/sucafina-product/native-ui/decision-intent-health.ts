import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "decisions.command.sf_case_draft" | "decisions.decision-edit" | "decisions.controls.read" |
  "bi.bi-options" | "bi.bi-data" | "bi.bi-source" | "bi.bi-decision"

/** Only installed infrastructure and current admission. Case/source access stays in each original producer. */
export async function observeSfDecisionIntentHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  humanActions: (request: Request) => Promise<readonly string[]>
  source: (id: Operation) => { producer: object; dependencies: readonly object[] } | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const candidates = [
    { id: "decisions.command.sf_case_draft", operation: "sf_case_draft", method: "POST", query: "workbench-command", path: "{mount}/dashboard", write: true, human: null },
    { id: "decisions.decision-edit", operation: "sf_case_read", method: "POST", query: "decision-edit", path: "{mount}/dashboard", write: true, human: "decisions.edit" },
    { id: "decisions.controls.read", operation: "sf_case_read", method: "GET", query: "decision-controls", path: "{mount}/dashboard", write: false, human: null },
    { id: "bi.bi-options", operation: "sf_dashboard_read", method: "GET", query: "bi-options", path: "{mount}/dashboard", write: false, human: null },
    { id: "bi.bi-data", operation: "sf_bi_view", method: "GET", query: "bi-data", path: "{mount}/dashboard", write: false, human: null },
    { id: "bi.bi-source", operation: "sf_bi_view", method: "GET", query: "bi-source", path: "{mount}/dashboard", write: false, human: null },
    { id: "bi.bi-decision", operation: "sf_bi_view", method: "GET", query: "bi-decision", path: "{mount}/dashboard", write: false, human: null },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method ||
      metadata.pathTemplate !== candidate.path || metadata.fixedQuery.sf !== candidate.query || metadata.responseMode !== "json") return []
    if (candidate.id === "decisions.command.sf_case_draft" && (!("fixedBodyDiscriminator" in metadata) ||
      metadata.fixedBodyDiscriminator.operation !== "sf_case_draft")) return []
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
    const digest = digestSfValue({ purpose: "decision-intent-source-health", operation: candidate.operation, id: candidate.id })
    const admitted = await ui.admit(request, candidate.operation, digest)
    if (admitted.status !== "ok") return []
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, candidate.operation, digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.human && !(await input.humanActions(request)).includes(candidate.human)) return []
      const read = () => state.read(request, "cases", selectSfNamespaceHealth("cases", stamp, candidate.write ? "write" : "read"))
      const first = await read(), second = await read()
      // The original draft writer initializes C08 atomically at version zero.
      const newCase = candidate.id === "decisions.command.sf_case_draft" &&
        first.status === "unavailable" && first.reason === "product-state-uninitialized" &&
        second.status === "unavailable" && second.reason === "product-state-uninitialized"
      if (!newCase && (first.status !== "ok" || second.status !== "ok" || !first.value || !second.value ||
        first.storageVersion !== first.value.storageVersion || first.aggregateRevision !== first.value.aggregateRevision ||
        first.incarnation !== first.value.incarnation || second.storageVersion !== second.value.storageVersion ||
        second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
        first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
        first.incarnation !== second.incarnation)) return []
      if (!await ui.revalidate(admitted.value) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.human && !(await input.humanActions(request)).includes(candidate.human)) return []
      if (!await ui.revalidate(admitted.value) || !current()) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { ui.finish(admitted.value) }
  }))
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
}

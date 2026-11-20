import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "views.list" | "views.open" | "views.save" | "views.remove"
type PersonalViews = NonNullable<SfHostServices["personalViews"]>

/** Installed V1 infrastructure and current private namespace access. Record access stays with the original producer. */
export async function observeSfPersonalViewsHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: () => PersonalViews | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const candidates = [
    { id: "views.list", action: "list", human: "views.read", write: false },
    { id: "views.open", action: "open", human: "views.read", write: false },
    { id: "views.save", action: "save", human: "views.save", write: true },
    { id: "views.remove", action: "remove", human: "views.remove", write: true },
  ] as const
  const observations = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== "POST" ||
      metadata.pathTemplate !== "{mount}/{surface}" || metadata.fixedQuery.sf !== "workbench-views" ||
      metadata.responseMode !== "json" || metadata.fixedBodyDiscriminator.action !== candidate.action ||
      metadata.effect !== (candidate.write ? "mutation" : "read")) return []
    const producer = sourceFor()
    if (!producer || typeof producer[candidate.action] !== "function") return []
    const installed = bindingFor(candidate.id, producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return []
    const dependencies = [producer.list, producer.open, producer.save, producer.remove]
    const current = () => input.ui === ui && input.state === state && input.binding === bindingFor &&
      input.source === sourceFor && sourceFor() === producer && !request.signal.aborted &&
      dependencies.every((value, index) => value === [producer.list, producer.open, producer.save, producer.remove][index]) &&
      bindingFor(candidate.id, producer) === installed
    const operation = "sf-human:" + candidate.human
    // This health admission never invokes a human command, creates a record or grants a destination.
    const digest = digestSfValue({ purpose: "personal-views-source-health", operation: candidate.id })
    const admitted = await ui.admit(request, operation, digest)
    if (admitted.status !== "ok") return []
    try {
      const authority = admitted.value.binding
      if (authority.installationId !== stamp.installationId || authority.projectId !== stamp.projectId ||
        authority.principalRef !== stamp.principalRef || authority.policyVersion !== stamp.policyVersion ||
        authority.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, operation, digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      const read = () => state.read(request, "preferences", selectSfNamespaceHealth("preferences", stamp, candidate.write ? "write" : "read"))
      const first = await read(), second = await read()
      if (first.status !== "ok" || second.status !== "ok" || !first.value || !second.value ||
        first.storageVersion !== first.value.storageVersion || first.aggregateRevision !== first.value.aggregateRevision ||
        first.incarnation !== first.value.incarnation || second.storageVersion !== second.value.storageVersion ||
        second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
        first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
        first.incarnation !== second.incarnation || !await ui.revalidate(admitted.value) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      return [{ operationId: candidate.id satisfies Operation, state: "ready" as const, reason: null, operational: true as const }]
    } finally { ui.finish(admitted.value) }
  }))
  return observations.flatMap((item) => item.status === "fulfilled" ? item.value : [])
}

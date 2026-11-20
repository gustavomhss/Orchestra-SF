import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { createSfDashboardHttp } from "../dashboard-http.ts"
import type { createSfDashboardServices } from "../dashboard-services.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Source = Readonly<{
  producer: object
  handler: ReturnType<typeof createSfDashboardHttp>
  dashboard: Pick<ReturnType<typeof createSfDashboardServices>, "agenda" | "preserveReview">
  dependencies: readonly object[]
}>

/** Installed Dashboard review infrastructure only; selected sources remain with the original handlers. */
export async function observeSfReviewAgendaHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  humanActions: (request: Request) => Promise<readonly string[]>
  source: () => Source | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const humanActions = input.humanActions
  const methods = { admit: ui.admit, validate: ui.validate, requestFor: ui.requestFor, revalidate: ui.revalidate,
    finish: ui.finish, read: state.read }
  const candidates = [
    { id: "dashboard.dashboard-agenda", query: "dashboard-agenda", method: "agenda", effect: "read", write: false },
    { id: "dashboard.dashboard-review-preserve", query: "dashboard-review-preserve", method: "preserveReview", effect: "mutation", write: true },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== "POST" || metadata.pathTemplate !== "{mount}/dashboard" ||
      metadata.fixedQuery.sf !== candidate.query || metadata.effect !== candidate.effect || metadata.responseMode !== "json") return []
    const source = sourceFor()
    if (!source || typeof source.handler !== "function" || !source.dependencies.length) return []
    const producer = source.producer, handler = source.handler, dashboard = source.dashboard
    const operation = dashboard[candidate.method], dependencies = [...source.dependencies]
    if (typeof operation !== "function") return []
    // This existing binding identifies the same mounted product router, not an operation grant.
    // The two POST contracts and their specific live Dashboard methods are checked independently.
    const installed = bindingFor("dashboard.dashboard-review", producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return []
    const current = () => {
      const next = sourceFor()
      return input.binding === bindingFor && input.source === sourceFor && input.ui === ui && input.state === state &&
        input.humanActions === humanActions && ui.admit === methods.admit && ui.validate === methods.validate &&
        ui.requestFor === methods.requestFor && ui.revalidate === methods.revalidate && ui.finish === methods.finish && state.read === methods.read &&
        !!next && next.producer === producer && next.handler === handler && next.dashboard === dashboard &&
        next.dashboard[candidate.method] === operation && next.dependencies.length === dependencies.length &&
        next.dependencies.every((dependency, index) => dependency === dependencies[index]) &&
        bindingFor("dashboard.dashboard-review", producer) === installed && !request.signal.aborted
    }
    const digest = digestSfValue({ purpose: "review-agenda-source-health", operation: candidate.id })
    // dashboard-http admits agenda with sf_dashboard_read. Preservation keeps its original
    // human POST admission; this read observes the current action and C08 write grant only.
    const admitted = await ui.admit(request, "sf_dashboard_read", digest)
    if (admitted.status !== "ok") return []
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, "sf_dashboard_read", digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.write && !(await humanActions(request)).includes("reviews.preserve")) return []
      if (!current()) return []
      const read = () => state.read(request, "reviews", selectSfNamespaceHealth("reviews", stamp, candidate.write ? "write" : "read"))
      const first = await read()
      if (first.status !== "ok" || !first.value || first.storageVersion !== first.value.storageVersion ||
        first.aggregateRevision !== first.value.aggregateRevision || first.incarnation !== first.value.incarnation || !current()) return []
      const second = await read()
      if (second.status !== "ok" || !second.value || second.storageVersion !== second.value.storageVersion ||
        second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
        first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
        first.incarnation !== second.incarnation || !await ui.revalidate(admitted.value) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.write && !(await humanActions(request)).includes("reviews.preserve")) return []
      if (!await ui.revalidate(admitted.value) || ui.requestFor(admitted.value) !== request || !current()) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { methods.finish(admitted.value) }
  }))
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
}

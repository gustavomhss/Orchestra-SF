import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { createSfDashboardHttp } from "../dashboard-http.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "dashboard.dashboard-workbench" | "dashboard.dashboard-hot-topic-source" |
  "dashboard.dashboard-draft-read" | "dashboard.dashboard-hot-topic-draft" |
  "dashboard.dashboard-hot-topic-drafts" | "dashboard.dashboard-hot-topic-draft-outcome" | "dashboard.dashboard-capture"

type Source = Readonly<{
  producer: object
  handler: ReturnType<typeof createSfDashboardHttp>
  operation: object
  dependencies: readonly object[]
}>

/** Observe installed private-draft infrastructure; each original request still authorizes its own selected case/source. */
export async function observeSfDashboardDraftHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  humanActions: (request: Request) => Promise<readonly string[]>
  source: (id: Operation) => Source | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const humanActions = input.humanActions
  const methods = { admit: ui.admit, validate: ui.validate, requestFor: ui.requestFor,
    revalidate: ui.revalidate, finish: ui.finish, read: state.read }
  const candidates = [
    { id: "dashboard.dashboard-workbench", query: "dashboard-workbench", method: "POST", effect: "read", write: false, human: null },
    { id: "dashboard.dashboard-hot-topic-source", query: "dashboard-hot-topic-source", method: "POST", effect: "read", write: false, human: null },
    { id: "dashboard.dashboard-draft-read", query: "dashboard-draft-read", method: "POST", effect: "read", write: false, human: null },
    { id: "dashboard.dashboard-hot-topic-draft", query: "dashboard-hot-topic-draft", method: "POST", effect: "mutation", write: true, human: "decisions.edit" },
    { id: "dashboard.dashboard-hot-topic-drafts", query: "dashboard-hot-topic-drafts", method: "GET", effect: "read", write: false, human: null },
    { id: "dashboard.dashboard-hot-topic-draft-outcome", query: "dashboard-hot-topic-draft-outcome", method: "POST", effect: "read", write: false, human: "decisions.edit" },
    { id: "dashboard.dashboard-capture", query: "dashboard-capture", method: "POST", effect: "mutation", write: true, human: "reviews.preserve" },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method ||
      metadata.pathTemplate !== "{mount}/dashboard" || metadata.fixedQuery.sf !== candidate.query ||
      metadata.effect !== candidate.effect || metadata.responseMode !== "json") return []
    const source = sourceFor(candidate.id)
    if (!source || typeof source.handler !== "function" || typeof source.operation !== "function" ||
      !source.dependencies.length || source.dependencies.some((dependency) =>
        !dependency || typeof dependency !== "object" && typeof dependency !== "function")) return []
    const producer = source.producer, handler = source.handler, operation = source.operation
    const dependencies = [...source.dependencies]
    const installed = bindingFor(candidate.id, producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return []
    const current = () => {
      const next = sourceFor(candidate.id)
      return input.binding === bindingFor && input.source === sourceFor && input.ui === ui && input.state === state &&
        input.humanActions === humanActions && ui.admit === methods.admit && ui.validate === methods.validate &&
        ui.requestFor === methods.requestFor && ui.revalidate === methods.revalidate && ui.finish === methods.finish && state.read === methods.read &&
        !!next && next.producer === producer && next.handler === handler && next.operation === operation &&
        next.dependencies.length === dependencies.length && next.dependencies.every((dependency, index) => dependency === dependencies[index]) &&
        bindingFor(candidate.id, producer) === installed && !request.signal.aborted
    }
    const digest = digestSfValue({ purpose: "dashboard-draft-source-health", operation: candidate.id })
    const admitted = await ui.admit(request, "sf_dashboard_read", digest)
    if (admitted.status !== "ok") return []
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, "sf_dashboard_read", digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.human && !(await humanActions(request)).includes(candidate.human)) return []
      // The editor composes the private case and proposal namespaces. A draft save
      // uses preferences plus the cases CAS. Capture writes only preferences;
      // first-save recovery remains read-only and retains its original action.
      const read = async () => {
        const entries = await Promise.all((candidate.id === "dashboard.dashboard-capture" ? ["preferences"] as const : ["cases", "preferences"] as const).map(async (namespace) => {
          const result = await state.read(request, namespace, selectSfNamespaceHealth(namespace, stamp, candidate.write ? "write" : "read"))
          if (result.status !== "ok" || !result.value || result.storageVersion !== result.value.storageVersion ||
            result.aggregateRevision !== result.value.aggregateRevision || result.incarnation !== result.value.incarnation || !current()) return undefined
          return result.value
        }))
        const first = entries[0]
        return first && entries.every((entry) => !!entry && entry.aggregateRevision === first.aggregateRevision &&
          entry.incarnation === first.incarnation) ? entries : undefined
      }
      const first = await read(), second = await read()
      if (!first || !second || digestSfValue(first) !== digestSfValue(second) || !current()) return []
      if (candidate.human && !(await humanActions(request)).includes(candidate.human)) return []
      if (!await ui.revalidate(admitted.value) || ui.requestFor(admitted.value) !== request || !current()) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { methods.finish(admitted.value) }
  }))
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
}

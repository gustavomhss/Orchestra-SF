import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
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
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
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
  type Candidate = typeof candidates[number]
  type Lease = { context: Parameters<typeof methods.finish>[0]; finished: boolean }
  type Observation = { candidate: Candidate; lease: Lease; current: () => boolean; active: boolean; first?: string }
  type Namespace = "cases" | "preferences"
  type Mode = "read" | "write"
  const leases: Lease[] = []
  let observations: Observation[] = []
  try {
    // Preserve each original action admission. Only namespace metadata is shared.
    const admitted = await Promise.allSettled(candidates.map(async (candidate): Promise<Observation | undefined> => {
      const metadata = SfOperationRegistry[candidate.id]
      if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method ||
        metadata.pathTemplate !== "{mount}/dashboard" || metadata.fixedQuery.sf !== candidate.query ||
        metadata.effect !== candidate.effect || metadata.responseMode !== "json") return undefined
      const source = sourceFor(candidate.id)
      if (!source || typeof source.handler !== "function" || typeof source.operation !== "function" ||
        !source.dependencies.length || source.dependencies.some((dependency) =>
          !dependency || typeof dependency !== "object" && typeof dependency !== "function")) return undefined
      const producer = source.producer, handler = source.handler, operation = source.operation
      const dependencies = [...source.dependencies]
      const installed = bindingFor(candidate.id, producer)
      if (!installed || typeof installed !== "object" && typeof installed !== "function") return undefined
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
      const result = await ui.admit(request, "sf_dashboard_read", digest)
      if (result.status !== "ok") return undefined
      const lease: Lease = { context: result.value, finished: false }
      leases.push(lease)
      const actor = lease.context.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(lease.context, "sf_dashboard_read", digest) ||
        ui.requestFor(lease.context) !== request || !current()) return undefined
      if (candidate.human && !(await humanActions(request)).includes(candidate.human)) return undefined
      return { candidate, lease, current, active: true }
    }))
    observations = admitted.flatMap((entry) => entry.status === "fulfilled" && entry.value ? [entry.value] : [])
    const read = (namespace: Namespace, mode: Mode) => methods.read(request, namespace,
      selectSfNamespaceHealth(namespace, stamp, mode))
    for (const phase of [0, 1]) {
      // No promise survives a phase or invocation. Read and write authority
      // remain distinct even when both observations address the same namespace.
      const reads = new Map<string, ReturnType<typeof read>>()
      const readNamespace = (namespace: Namespace, mode: Mode) => {
        const key = namespace + ":" + mode
        let pending = reads.get(key)
        if (!pending) {
          pending = Promise.resolve().then(() => read(namespace, mode))
          reads.set(key, pending)
        }
        return pending
      }
      const active = observations.filter((entry) => entry.active)
      const proofs = await Promise.allSettled(active.map(async (entry) => {
        if (!entry.current()) return undefined
        // Capture needs preferences only. Draft save still proves cases CAS
        // and preferences, while first-save recovery retains its read mode.
        const namespaces = entry.candidate.id === "dashboard.dashboard-capture"
          ? ["preferences"] as const : ["cases", "preferences"] as const
        const values = await Promise.all(namespaces.map(async (namespace) => {
          const result = await readNamespace(namespace, entry.candidate.write ? "write" : "read")
          if (result.status !== "ok" || !result.value || result.storageVersion !== result.value.storageVersion ||
            result.aggregateRevision !== result.value.aggregateRevision || result.incarnation !== result.value.incarnation ||
            !entry.current()) return undefined
          return result.value
        }))
        const first = values[0]
        return first && values.every((value) => !!value && value.aggregateRevision === first.aggregateRevision &&
          value.incarnation === first.incarnation) ? digestSfValue(values) : undefined
      }))
      for (const [index, proof] of proofs.entries()) {
        const entry = active[index]!
        if (proof.status !== "fulfilled" || !proof.value) entry.active = false
        else if (phase === 0) entry.first = proof.value
        else if (entry.first !== proof.value) entry.active = false
      }
    }
    const active = observations.filter((entry) => entry.active)
    const final = await Promise.allSettled(active.map(async (entry) => {
      if (!entry.current()) return false
      if (entry.candidate.human && !(await humanActions(request)).includes(entry.candidate.human)) return false
      return await ui.revalidate(entry.lease.context) && ui.requestFor(entry.lease.context) === request && entry.current()
    }))
    for (const [index, result] of final.entries())
      if (result.status !== "fulfilled" || !result.value) active[index]!.active = false
  } finally {
    for (const lease of leases) {
      try { methods.finish(lease.context); lease.finished = true }
      catch { lease.finished = false }
    }
  }
  return observations.flatMap((entry) => {
    try {
      return entry.active && entry.lease.finished && entry.current()
        ? [{ operationId: entry.candidate.id, state: "ready" as const, reason: null, operational: true as const }] : []
    } catch { return [] }
  })
}

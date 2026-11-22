import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
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
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const humanActions = input.humanActions
  const methods = { admit: ui.admit, validate: ui.validate, requestFor: ui.requestFor,
    revalidate: ui.revalidate, finish: ui.finish, read: state.read }
  const candidates = [
    { id: "decisions.command.sf_case_draft", operation: "sf_case_draft", method: "POST", query: "workbench-command", path: "{mount}/dashboard", write: true, human: null },
    { id: "decisions.decision-edit", operation: "sf_case_read", method: "POST", query: "decision-edit", path: "{mount}/dashboard", write: true, human: "decisions.edit" },
    { id: "decisions.controls.read", operation: "sf_case_read", method: "GET", query: "decision-controls", path: "{mount}/dashboard", write: false, human: null },
    { id: "bi.bi-options", operation: "sf_dashboard_read", method: "GET", query: "bi-options", path: "{mount}/dashboard", write: false, human: null },
    { id: "bi.bi-data", operation: "sf_bi_view", method: "GET", query: "bi-data", path: "{mount}/dashboard", write: false, human: null },
    { id: "bi.bi-source", operation: "sf_bi_view", method: "GET", query: "bi-source", path: "{mount}/dashboard", write: false, human: null },
    { id: "bi.bi-decision", operation: "sf_bi_view", method: "GET", query: "bi-decision", path: "{mount}/dashboard", write: false, human: null },
  ] as const
  type Candidate = typeof candidates[number]
  type Lease = { context: Parameters<typeof methods.finish>[0]; finished: boolean }
  type Observation = { candidate: Candidate; lease: Lease; current: () => boolean; active: boolean; first?: string }
  type Mode = "read" | "write"
  const leases: Lease[] = []
  let observations: Observation[] = []
  try {
    const admitted = await Promise.allSettled(candidates.map(async (candidate): Promise<Observation | undefined> => {
      const metadata = SfOperationRegistry[candidate.id]
      if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method ||
        metadata.pathTemplate !== candidate.path || metadata.fixedQuery.sf !== candidate.query || metadata.responseMode !== "json") return undefined
      if (candidate.id === "decisions.command.sf_case_draft" && (!("fixedBodyDiscriminator" in metadata) ||
        metadata.fixedBodyDiscriminator.operation !== "sf_case_draft")) return undefined
      const source = sourceFor(candidate.id)
      if (!source || !source.dependencies.length) return undefined
      const producer = source.producer, dependencies = [...source.dependencies]
      const installed = bindingFor(candidate.id, producer)
      if (!installed || typeof installed !== "object" && typeof installed !== "function") return undefined
      const current = () => {
        const next = sourceFor(candidate.id)
        return input.binding === bindingFor && input.source === sourceFor && input.ui === ui && input.state === state &&
          input.humanActions === humanActions && ui.admit === methods.admit && ui.validate === methods.validate &&
          ui.requestFor === methods.requestFor && ui.revalidate === methods.revalidate && ui.finish === methods.finish && state.read === methods.read &&
          !!next && next.producer === producer && next.dependencies.length === dependencies.length &&
          next.dependencies.every((dependency, index) => dependency === dependencies[index]) &&
          bindingFor(candidate.id, producer) === installed && !request.signal.aborted
      }
      const digest = digestSfValue({ purpose: "decision-intent-source-health", operation: candidate.operation, id: candidate.id })
      const result = await ui.admit(request, candidate.operation, digest)
      if (result.status !== "ok") return undefined
      const lease: Lease = { context: result.value, finished: false }
      leases.push(lease)
      const actor = lease.context.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(lease.context, candidate.operation, digest) ||
        ui.requestFor(lease.context) !== request || !current()) return undefined
      if (candidate.human && !(await humanActions(request)).includes(candidate.human)) return undefined
      return { candidate, lease, current, active: true }
    }))
    observations = admitted.flatMap((entry) => entry.status === "fulfilled" && entry.value ? [entry.value] : [])
    const read = (mode: Mode) => methods.read(request, "cases", selectSfNamespaceHealth("cases", stamp, mode))
    for (const phase of [0, 1]) {
      // Separate promises for the original read/write grants, and a new map
      // only after every candidate's preceding observation has settled.
      const reads = new Map<Mode, ReturnType<typeof read>>()
      const readCases = (mode: Mode) => {
        let pending = reads.get(mode)
        if (!pending) {
          pending = Promise.resolve().then(() => read(mode))
          reads.set(mode, pending)
        }
        return pending
      }
      const active = observations.filter((entry) => entry.active)
      const proofs = await Promise.allSettled(active.map(async (entry) => {
        if (!entry.current()) return undefined
        const result = await readCases(entry.candidate.write ? "write" : "read")
        if (result.status !== "ok" || !result.value || result.storageVersion !== result.value.storageVersion ||
          result.aggregateRevision !== result.value.aggregateRevision || result.incarnation !== result.value.incarnation ||
          !entry.current()) return undefined
        return digestSfValue({ storageVersion: result.storageVersion,
          aggregateRevision: result.aggregateRevision, incarnation: result.incarnation })
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
      // Preserve both original lease revalidations, with the second original
      // human-action observation between them.
      if (!await ui.revalidate(entry.lease.context) || ui.requestFor(entry.lease.context) !== request || !entry.current()) return false
      if (entry.candidate.human && !(await humanActions(request)).includes(entry.candidate.human)) return false
      return await ui.revalidate(entry.lease.context) && entry.current()
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

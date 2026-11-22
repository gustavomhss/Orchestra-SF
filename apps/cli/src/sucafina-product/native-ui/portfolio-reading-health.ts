import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { isInstalledSfStateTransaction, isSfProductStateReader, selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

const candidates = [
  { id: "portfolio.decision-portfolio-results", human: "decisions.portfolio.read", write: false },
  { id: "portfolio.decision-portfolio-read", human: "decisions.portfolio.read", write: false },
  { id: "portfolio.decision-portfolio-preview", human: "decisions.portfolio.read", write: false },
  { id: "portfolio.decision-portfolio-evaluate", human: "decisions.portfolio.evaluate", write: true },
  { id: "portfolio.decision-sensitivity-units", human: "decisions.portfolio.read", write: false },
  { id: "portfolio.decision-sensitivity-read", human: "decisions.portfolio.read", write: false },
  { id: "portfolio.decision-sensitivity-evaluate", human: "decisions.sensitivity.evaluate", write: true },
] as const
type Operation = typeof candidates[number]["id"]
type Source = Readonly<{ producer: object; dependencies: readonly object[] }>

/**
 * Observe the installed portfolio boundary and original case/result metadata.
 * No scenario, evaluation, unit binding, selection, receipt or write is produced.
 * Case access, source evidence and durable result checks stay in the original handlers.
 */
export async function observeSfPortfolioReadingHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  persistence: SfHostServices["host"]["persistence"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: (id: Operation) => Source | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source, bindingFor = input.binding, ui = input.ui, state = input.state
  const persistence = input.persistence, finish = ui.finish, readState = state.read
  if (!bindingFor || request.signal.aborted || !isSfProductStateReader(state, persistence)) return []
  const expected = Object.freeze({ ...stamp }), stampDigest = digestSfValue(expected)
  type Candidate = typeof candidates[number]
  const namespaces = ["cases", "preferences"] as const
  type Namespace = typeof namespaces[number]
  type Mode = "read" | "write"
  type Metadata = { storageVersion: number; aggregateRevision: number; incarnation: string }
  type Lease = { context: Parameters<typeof finish>[0]; finished: boolean }
  type Observation = {
    candidate: Candidate
    lease: Lease
    current: () => boolean
    valid: () => Promise<boolean>
    active: boolean
    first?: string
  }
  const leases: Lease[] = []
  let observations: Observation[] = []
  try {
    // Admit every original action before sharing any namespace observation.
    // Each action keeps its own lease, exact installed source and revalidation.
    const admitted = await Promise.allSettled(candidates.map(async (candidate): Promise<Observation | undefined> => {
      const metadata = SfOperationRegistry[candidate.id]
      if (!sfHasOperationalResource(candidate.id) || metadata.method !== "POST" ||
        metadata.pathTemplate !== "{mount}/{surface}" || metadata.responseMode !== "json" ||
        metadata.fixedQuery.sf !== candidate.id.replace("portfolio.", "") ||
        metadata.effect !== (candidate.write ? "prepare" : "read") ||
        candidate.write && !isInstalledSfStateTransaction(state.read, state.transaction)) return undefined
      const source = sourceFor(candidate.id)
      if (!source || typeof source.producer !== "function" || !source.dependencies.length ||
        source.dependencies.some((value) => !value || typeof value !== "object" && typeof value !== "function")) return undefined
      const dependencies = [...source.dependencies]
      const installed = bindingFor(candidate.id, source.producer)
      if (!installed || typeof installed !== "object" && typeof installed !== "function") return undefined
      const ownDependencies = () => [ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish,
        state.read, state.transaction, persistence.transaction]
      const own = ownDependencies()
      const current = () => {
        const next = sourceFor(candidate.id)
        return !request.signal.aborted && input.source === sourceFor && input.binding === bindingFor &&
          input.ui === ui && input.state === state && input.persistence === persistence &&
          isSfProductStateReader(state, persistence) && digestSfValue(stamp) === stampDigest &&
          (!candidate.write || isInstalledSfStateTransaction(state.read, state.transaction)) &&
          next?.producer === source.producer && next.dependencies.length === dependencies.length &&
          dependencies.every((value, index) => next.dependencies[index] === value) &&
          bindingFor(candidate.id, source.producer) === installed &&
          own.every((value, index) => ownDependencies()[index] === value)
      }
      if (!current()) return undefined
      const operation = "sf-human:" + candidate.human
      const digest = digestSfValue({ purpose: "native-portfolio-source-health", operation: candidate.id })
      // The original authorizer still requires this exact human action and,
      // for persisted evaluations, canWrite. The original metadata reader
      // separately checks each namespace with its original read/write mode.
      const result = await ui.admit(request, operation, digest)
      if (result.status !== "ok") return undefined
      const lease: Lease = { context: result.value, finished: false }
      leases.push(lease)
      const actor = lease.context.binding
      if (actor.installationId !== expected.installationId || actor.projectId !== expected.projectId ||
        actor.principalRef !== expected.principalRef || actor.policyVersion !== expected.policyVersion ||
        actor.accessRevision !== expected.accessRevision || !await ui.validate(lease.context, operation, digest) ||
        ui.requestFor(lease.context) !== request || !current()) return undefined
      const valid = async () => current() && await ui.revalidate(lease.context) &&
        ui.requestFor(lease.context) === request && current()
      return { candidate, lease, current, valid, active: true }
    }))
    observations = admitted.flatMap((entry) =>
      entry.status === "fulfilled" && entry.value ? [entry.value] : [])

    const read = (namespace: Namespace, mode: Mode) => readState(request, namespace,
      selectSfNamespaceHealth(namespace, expected, mode))

    for (const phase of [0, 1]) {
      // Share only the same namespace and original authorization mode in this
      // phase. The next phase creates new promises after every first proof
      // revalidates; no metadata or authority result survives this invocation.
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
        const values: Metadata[] = []
        for (const namespace of namespaces) {
          if (!entry.current()) return undefined
          const result = await readNamespace(namespace, entry.candidate.write ? "write" : "read")
          if (result.status !== "ok" || !result.value || !Number.isSafeInteger(result.value.storageVersion) ||
            result.value.storageVersion < 0 || !Number.isSafeInteger(result.value.aggregateRevision) ||
            result.value.aggregateRevision < 0 || !result.value.incarnation ||
            result.storageVersion !== result.value.storageVersion || result.aggregateRevision !== result.value.aggregateRevision ||
            result.incarnation !== result.value.incarnation || !await entry.valid()) return undefined
          values.push(result.value)
        }
        return values.every((value) => value.aggregateRevision === values[0]!.aggregateRevision &&
          value.incarnation === values[0]!.incarnation) ? digestSfValue(values) : undefined
      }))
      for (const [index, proof] of proofs.entries()) {
        const entry = active[index]!
        if (proof.status !== "fulfilled" || !proof.value) entry.active = false
        else if (phase === 0) entry.first = proof.value
        else if (entry.first !== proof.value) entry.active = false
      }
    }

    const active = observations.filter((entry) => entry.active)
    const final = await Promise.allSettled(active.map((entry) => entry.valid()))
    for (const [index, result] of final.entries())
      if (result.status !== "fulfilled" || !result.value) active[index]!.active = false
  } finally {
    // Close every original admission once, including validation/read failures.
    // One failing finish hook must not prevent the other leases from closing.
    for (const lease of leases) {
      try { finish(lease.context); lease.finished = true }
      catch { lease.finished = false }
    }
  }
  // A finish hook may dispose the installation. Check after all leases close.
  return observations.flatMap((entry) => {
    try {
      return entry.active && entry.lease.finished && entry.current()
        ? [{ operationId: entry.candidate.id, state: "ready" as const, reason: null, operational: true as const }] : []
    } catch { return [] }
  })
}

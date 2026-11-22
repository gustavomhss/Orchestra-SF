import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { isInstalledSfStateTransaction, isSfProductStateReader } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

const candidates = [
  { id: "collaboration.relation-read", human: "collaboration.relation.read", write: false, namespaces: ["relations"] },
  { id: "collaboration.relation-create", human: "collaboration.relation.confirm", write: true, namespaces: ["relations"] },
  { id: "collaboration.relation-remove", human: "collaboration.relation.confirm", write: true, namespaces: ["relations"] },
  { id: "collaboration.thread-read", human: "collaboration.thread.read", write: false, namespaces: ["threads"] },
  { id: "collaboration.thread-reply", human: "collaboration.thread.reply", write: true, namespaces: ["threads"] },
  { id: "collaboration.confirmation-prepare", human: "collaboration.confirmation.prepare", write: false, namespaces: ["confirmations"] },
  { id: "collaboration.confirmation-project", human: "collaboration.confirmation.project", write: false, namespaces: ["confirmations"] },
  { id: "collaboration.confirmation-confirm", human: "collaboration.confirmation.confirm", write: true, namespaces: ["confirmations"] },
  { id: "collaboration.storage-version", human: "collaboration.storage.version", write: false, namespaces: ["relations", "threads", "confirmations"] },
] as const
type Operation = typeof candidates[number]["id"]
type Source = Readonly<{ producer: object; dependencies: readonly object[] }>

/**
 * Observe the installed collaboration HTTP boundary and current original C08
 * metadata. No relation, thread, selection, receipt or mutation is produced.
 * Record evidence, selected scope, recipient and CAS checks stay in the handlers.
 */
export async function observeSfCollaborationReadingHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  persistence: SfHostServices["host"]["persistence"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: (id: Operation) => Source | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source, bindingFor = input.binding, ui = input.ui, state = input.state
  const persistence = input.persistence, finish = ui.finish
  if (!bindingFor || request.signal.aborted || !isSfProductStateReader(state, persistence)) return []
  const expected = Object.freeze({ ...stamp }), stampDigest = digestSfValue(expected)
  const observations = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== "POST" ||
      metadata.pathTemplate !== "{mount}/dashboard" || metadata.responseMode !== "json" ||
      metadata.fixedQuery.sf !== candidate.id.replace("collaboration.", "collaboration-") ||
      metadata.effect !== (candidate.write ? "mutation" : "read") ||
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
    const digest = digestSfValue({ purpose: "native-collaboration-source-health", operation: candidate.id })
    // The original product authorizer requires the exact human action grant.
    // For mutations it also requires canWrite. Namespace membership is checked
    // below by the original state reader; no health-only grant is introduced.
    const admitted = await ui.admit(request, operation, digest)
    if (admitted.status !== "ok") return undefined
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== expected.installationId || actor.projectId !== expected.projectId ||
        actor.principalRef !== expected.principalRef || actor.policyVersion !== expected.policyVersion ||
        actor.accessRevision !== expected.accessRevision || !await ui.validate(admitted.value, operation, digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return undefined
      const readHealth = async () => {
        const values: { storageVersion: number; aggregateRevision: number; incarnation: string }[] = []
        for (const namespace of candidate.namespaces) {
          // These namespaces intentionally have no optimized health selector.
          // Return only metadata from the canonical, request-authorized reader.
          const result = await state.read(request, namespace, (stored, authority) =>
            authority.principalRef === expected.principalRef && authority.policyVersion === expected.policyVersion &&
            authority.accessRevision === expected.accessRevision
              ? { storageVersion: stored.versions[namespace], aggregateRevision: stored.revision, incarnation: stored.incarnation }
              : undefined)
          if (result.status !== "ok" || !result.value || !Number.isSafeInteger(result.value.storageVersion) ||
            result.value.storageVersion < 0 || !Number.isSafeInteger(result.value.aggregateRevision) ||
            result.value.aggregateRevision < 0 || !result.value.incarnation ||
            result.storageVersion !== result.value.storageVersion || result.aggregateRevision !== result.value.aggregateRevision ||
            result.incarnation !== result.value.incarnation || !current() || !await ui.revalidate(admitted.value) ||
            ui.requestFor(admitted.value) !== request || !current()) return undefined
          values.push(result.value)
        }
        return values.every((value) => value.aggregateRevision === values[0]!.aggregateRevision &&
          value.incarnation === values[0]!.incarnation) ? digestSfValue(values) : undefined
      }
      const first = await readHealth(), second = first ? await readHealth() : undefined
      if (!first || first !== second || !current() || !await ui.revalidate(admitted.value) ||
        ui.requestFor(admitted.value) !== request || !current()) return undefined
    } finally { finish(admitted.value) }
    return { current, value: { operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const } }
  }))
  // A finish hook may dispose the installation. Check after all leases close.
  return observations.flatMap((entry) => {
    try { return entry.status === "fulfilled" && entry.value?.current() ? [entry.value.value] : [] }
    catch { return [] }
  })
}

import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { isSfProductStateReader, selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { PlannerScenarioHost } from "../../../../../modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts"
import type { createSfMemoryServices } from "../memory-services.ts"
import { sfHasOperationalResource } from "./live-context.ts"

export type SfMemoryReadOperation = "intelligence.memory-catalog" | "intelligence.memory-conditions" |
  "intelligence.memory-signals" | "intelligence.memory-materiality" | "intelligence.memory-outcome"
type Memory = ReturnType<typeof createSfMemoryServices>
type Source = Readonly<{
  producer: object
  handler: object
  memory: Pick<Memory, "catalog" | "conditions" | "signals" | "materiality" | "outcomes"> & {
    registry: Pick<Memory["registry"], "list">
    outcomeSelections: Pick<Memory["outcomeSelections"], "select" | "readReference">
  }
  scenarios: PlannerScenarioHost | undefined
  dependencies: readonly object[]
}>

/**
 * The mounted original A14 reader, original UI lease and C08 observations prove
 * read infrastructure only. No condition, signal reconciliation, outcome
 * selection or comparison is executed. Per-case ACL, evidence, coverage and
 * numeric availability remain the original reader's responsibility.
 */
export async function observeSfMemoryReadingHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  persistence: SfHostServices["host"]["persistence"]
  binding?: (id: SfMemoryReadOperation, producer: object) => object | undefined
  source: (id: SfMemoryReadOperation) => Source | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source, bindingFor = input.binding, ui = input.ui, state = input.state
  const persistence = input.persistence, finish = ui.finish
  if (!bindingFor || request.signal.aborted || !isSfProductStateReader(state, persistence)) return []
  const expected = Object.freeze({ ...stamp }), stampDigest = digestSfValue(expected)
  const candidates = [
    { id: "intelligence.memory-catalog", query: "memory-catalog", needsScenarios: false },
    { id: "intelligence.memory-conditions", query: "memory-conditions", needsScenarios: true },
    { id: "intelligence.memory-signals", query: "memory-signals", needsScenarios: true },
    { id: "intelligence.memory-materiality", query: "memory-materiality", needsScenarios: true },
    { id: "intelligence.memory-outcome", query: "memory-outcome", needsScenarios: false },
  ] as const
  const observed = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== "GET" || metadata.effect !== "read" ||
      metadata.pathTemplate !== "{mount}/dashboard" || metadata.fixedQuery.sf !== candidate.query ||
      metadata.responseMode !== "json") return undefined
    const source = sourceFor(candidate.id)
    if (!source || typeof source.producer !== "function" || typeof source.handler !== "function" ||
      !source.dependencies.length || source.dependencies.some((entry) => !entry ||
        typeof entry !== "object" && typeof entry !== "function") ||
      candidate.needsScenarios && !source.scenarios) return undefined
    const memory = source.memory, scenarios = source.scenarios, dependencies = [...source.dependencies]
    if (!memory || !Array.isArray(memory.catalog) || !memory.registry || !memory.outcomeSelections) return undefined
    const catalog = digestSfValue([...(scenarios ? ["planner-conditions", "planner-materiality", "planner-signals"] : []),
      "planner-closed-month-outcomes"])
    if (digestSfValue(memory.catalog) !== catalog) return undefined
    const installed = bindingFor(candidate.id, source.producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return undefined
    const ownDependencies = () => [ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish, state.read,
      persistence.transaction, memory.conditions, memory.signals, memory.materiality, memory.outcomes,
      memory.registry, memory.registry?.list, memory.outcomeSelections,
      memory.outcomeSelections?.select, memory.outcomeSelections?.readReference,
      ...(scenarios ? [scenarios.resolve, ...(scenarios.resolveMany ? [scenarios.resolveMany] : [])] : [])]
    const own = ownDependencies()
    if (own.some((entry) => !entry || typeof entry !== "object" && typeof entry !== "function")) return undefined
    const current = () => {
      const next = sourceFor(candidate.id), now = ownDependencies()
      return !request.signal.aborted && input.source === sourceFor && input.binding === bindingFor &&
        input.ui === ui && input.state === state && input.persistence === persistence &&
        isSfProductStateReader(state, persistence) && digestSfValue(stamp) === stampDigest &&
        next?.producer === source.producer && next.handler === source.handler && next.memory === memory &&
        next.scenarios === scenarios && digestSfValue(memory.catalog) === catalog &&
        next.dependencies.length === dependencies.length && dependencies.every((entry, index) => next.dependencies[index] === entry) &&
        bindingFor(candidate.id, source.producer) === installed && now.length === own.length &&
        own.every((entry, index) => now[index] === entry)
    }
    const operation = "sf-human:analysis.read"
    const digest = digestSfValue({ purpose: "native-memory-reading-health", operationId: candidate.id })
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
        for (const namespace of ["cases", "preferences"] as const) {
          const result = await state.read(request, namespace, selectSfNamespaceHealth(namespace, expected))
          if (result.status !== "ok" || !result.value || result.storageVersion !== result.value.storageVersion ||
            result.aggregateRevision !== result.value.aggregateRevision || result.incarnation !== result.value.incarnation ||
            !current() || !await ui.revalidate(admitted.value) || ui.requestFor(admitted.value) !== request || !current()) return undefined
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
  return observed.flatMap((entry) => entry.status === "fulfilled" && entry.value?.current() ? [entry.value.value] : [])
}

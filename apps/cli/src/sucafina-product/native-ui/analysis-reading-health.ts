import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { isSfProductStateReader, selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "intelligence.analysis.choices" | "intelligence.analysis.list"

/** Original read infrastructure only. Empty models remain an actual catalog result, never a health failure or a fabricated model. */
export async function observeSfAnalysisReadingHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  persistence: SfHostServices["host"]["persistence"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: (id: Operation) => Readonly<{ producer: object; dependencies: readonly object[] }> | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source, bindingFor = input.binding, ui = input.ui, state = input.state
  const persistence = input.persistence, finish = ui.finish
  if (!bindingFor || request.signal.aborted || !isSfProductStateReader(state, persistence)) return []
  const expected = Object.freeze({ ...stamp }), stampDigest = digestSfValue(expected)
  const candidates = [
    { id: "intelligence.analysis.choices", action: "choices", operation: "sf-human:analysis.prepare", namespaces: ["cases"] },
    { id: "intelligence.analysis.list", action: "list", operation: "sf-human:analysis.read", namespaces: ["cases", "contributions"] },
  ] as const
  const observed = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== "POST" || metadata.effect !== "read" ||
      metadata.pathTemplate !== "{mount}/dashboard" || metadata.fixedQuery.sf !== "workbench-analysis" ||
      metadata.responseMode !== "json" || metadata.fixedBodyDiscriminator.action !== candidate.action) return undefined
    const source = sourceFor(candidate.id)
    if (!source || typeof source.producer !== "function" || !source.dependencies.length ||
      source.dependencies.some((entry) => !entry || typeof entry !== "object" && typeof entry !== "function")) return undefined
    const dependencies = [...source.dependencies]
    const installed = bindingFor(candidate.id, source.producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return undefined
    const ownDependencies = () => [ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish, state.read, persistence.transaction]
    const own = ownDependencies()
    const current = () => {
      const next = sourceFor(candidate.id)
      return !request.signal.aborted && input.source === sourceFor && input.binding === bindingFor &&
        input.ui === ui && input.state === state && input.persistence === persistence &&
        isSfProductStateReader(state, persistence) && digestSfValue(stamp) === stampDigest &&
        next?.producer === source.producer && next.dependencies.length === dependencies.length &&
        dependencies.every((entry, index) => next.dependencies[index] === entry) &&
        bindingFor(candidate.id, source.producer) === installed && own.every((entry, index) => ownDependencies()[index] === entry)
    }
    // Use the same private action as each original HTTP read, without making a synthetic POST or running its producer.
    const digest = digestSfValue({ purpose: "native-analysis-reading-health", operation: candidate.operation })
    const admitted = await ui.admit(request, candidate.operation, digest)
    if (admitted.status !== "ok") return undefined
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== expected.installationId || actor.projectId !== expected.projectId ||
        actor.principalRef !== expected.principalRef || actor.policyVersion !== expected.policyVersion ||
        actor.accessRevision !== expected.accessRevision || !await ui.validate(admitted.value, candidate.operation, digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return undefined
      const readHealth = async () => {
        const values: { storageVersion: number; aggregateRevision: number; incarnation: string }[] = []
        for (const namespace of candidate.namespaces) {
          // The original Contributions reader checks namespace access; this callback exposes no run or output.
          const result = namespace === "contributions"
            ? await state.read(request, "contributions", (value, authority) =>
              authority.principalRef === expected.principalRef && authority.policyVersion === expected.policyVersion &&
              authority.accessRevision === expected.accessRevision
                ? { storageVersion: value.versions.contributions, aggregateRevision: value.revision, incarnation: value.incarnation }
                : undefined)
            : await state.read(request, namespace, selectSfNamespaceHealth(namespace, expected))
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

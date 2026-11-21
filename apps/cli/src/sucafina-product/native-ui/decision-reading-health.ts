import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfOperationInputSchemas } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { CapabilityDescriptor } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { isCurrentChoiceFence, type CurrentChoiceFence } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts"
import { isSfProductStateReader, selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "decisions.choice.read" | "decisions.command.sf_question_prepare"
type Source = Readonly<{
  producer: object
  /** Original installed services and methods, freshly selected by the composition owner. */
  dependencies: readonly object[]
  choice?: Readonly<{ fence: CurrentChoiceFence; options: object }>
  question?: Readonly<{
    catalog: readonly CapabilityDescriptor[]
    capabilities: readonly CapabilityDescriptor[]
    dispatch: SfHostServices["dispatch"]
  }>
}>

/** Infrastructure and original admission only; never list cases, prepare a question or issue a receipt. */
export async function observeSfDecisionReadingHealth(input: {
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
  const candidates = [
    { id: "decisions.choice.read", operation: "sf_case_read", method: "GET", query: "current-choice", path: "{mount}/{surface}", namespaces: ["cases", "preferences"] },
    { id: "decisions.command.sf_question_prepare", operation: "sf_question_prepare", method: "POST", query: "workbench-command", path: "{mount}/dashboard", namespaces: ["cases", "threads"] },
  ] as const
  const observed = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method ||
      metadata.pathTemplate !== candidate.path || metadata.fixedQuery.sf !== candidate.query ||
      metadata.responseMode !== "json") return undefined
    if (candidate.id === "decisions.choice.read" && (metadata.effect !== "read" ||
      !("format" in metadata.fixedQuery) || metadata.fixedQuery.format !== "json")) return undefined
    if (candidate.id === "decisions.command.sf_question_prepare" && (!("fixedBodyDiscriminator" in metadata) ||
      metadata.fixedBodyDiscriminator.operation !== "sf_question_prepare")) return undefined
    const source = sourceFor(candidate.id)
    if (!source || typeof source.producer !== "function" || !source.dependencies.length ||
      source.dependencies.some((item) => !item || typeof item !== "object" && typeof item !== "function")) return undefined
    const dependencies = [...source.dependencies]
    const choice = source.choice, question = source.question
    let descriptor: CapabilityDescriptor | undefined
    if (candidate.id === "decisions.choice.read") {
      if (!choice || !isCurrentChoiceFence(choice.fence) || typeof choice.options !== "function") return undefined
    } else {
      if (!question || typeof question.dispatch !== "function") return undefined
      const selected = question.capabilities.filter((entry) => entry.id === "sf_question_prepare")
      descriptor = selected[0]
      if (selected.length !== 1 || !descriptor || !question.catalog.includes(descriptor) ||
        question.catalog.filter((entry) => entry.id === descriptor!.id).length !== 1 ||
        descriptor.pack !== "collaboration" || descriptor.mode !== "prepare" ||
        descriptor.handlerExport !== "prepareQuestion" || descriptor.producerTask !== "WP08.T06" ||
        descriptor.inputSchema !== sfOperationInputSchemas.sf_question_prepare ||
        descriptor.outputSchema !== sfOperationOutputSchemas.sf_question_prepare ||
        typeof descriptor.handler !== "function" ||
        digestSfValue(descriptor.requiredAuthority) !== digestSfValue(["threads:read", "cases:read"])) return undefined
    }
    const installed = bindingFor(candidate.id, source.producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return undefined
    const descriptorValue = () => descriptor && digestSfValue({
      id: descriptor.id, pack: descriptor.pack, mode: descriptor.mode, handlerExport: descriptor.handlerExport,
      producerTask: descriptor.producerTask, grantProfiles: descriptor.grantProfiles, requiredAuthority: descriptor.requiredAuthority,
    })
    const descriptorDigest = descriptorValue(), descriptorHandler = descriptor?.handler
    const ownDependencies = () => [
      ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish, state.read, persistence.transaction,
      choice?.fence.persistence, choice?.fence.run, choice?.fence.observe, choice?.fence.check, choice?.fence.current,
      descriptor?.inputSchema, descriptor?.outputSchema,
    ]
    const own = ownDependencies()
    const current = () => {
      const next = sourceFor(candidate.id)
      return !request.signal.aborted && input.source === sourceFor && input.binding === bindingFor &&
        input.ui === ui && input.state === state && input.persistence === persistence &&
        isSfProductStateReader(state, persistence) && digestSfValue(stamp) === stampDigest &&
        next?.producer === source.producer && next.dependencies.length === dependencies.length &&
        dependencies.every((entry, index) => next.dependencies[index] === entry) &&
        bindingFor(candidate.id, source.producer) === installed && own.every((entry, index) => ownDependencies()[index] === entry) &&
        (candidate.id !== "decisions.choice.read" || !!choice && next.choice?.fence === choice.fence &&
          next.choice.options === choice.options && isCurrentChoiceFence(choice.fence)) &&
        (candidate.id !== "decisions.command.sf_question_prepare" || !!question && !!descriptor &&
          next.question?.catalog === question.catalog && next.question.capabilities === question.capabilities &&
          next.question.dispatch === question.dispatch && descriptor.handler === descriptorHandler &&
          descriptorValue() === descriptorDigest && question.capabilities.includes(descriptor) &&
          question.capabilities.filter((entry) => entry.id === "sf_question_prepare").length === 1 &&
          question.catalog.includes(descriptor) && question.catalog.filter((entry) => entry.id === "sf_question_prepare").length === 1)
    }
    const digest = digestSfValue({ purpose: "native-decision-reading-health", operation: candidate.operation })
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
          // Threads has no optimized health selector. Its original C08 reader still
          // checks namespace authority and returns only metadata through this callback.
          const result = namespace === "threads"
            ? await state.read(request, "threads", (value, authority) =>
              authority.principalRef === expected.principalRef && authority.policyVersion === expected.policyVersion &&
              authority.accessRevision === expected.accessRevision
                ? { storageVersion: value.versions.threads, aggregateRevision: value.revision, incarnation: value.incarnation }
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
  // Finish can dispose an installation; never publish an observation captured before it.
  return observed.flatMap((entry) => entry.status === "fulfilled" && entry.value?.current() ? [entry.value.value] : [])
}

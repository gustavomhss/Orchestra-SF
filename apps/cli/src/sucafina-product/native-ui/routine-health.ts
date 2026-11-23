import { Effect } from "effect"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { TrustedUiContext } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { isSfProductStateReader, selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { RoutinePublicationHost } from "../../../../../modules/sucafina/Sucafinav1/product/routines/publication.ts"
import type { SfRoutineNativeRuntimeResources } from "../routine-native-runtime.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "routines.read-admission" | "routines.read-run" | "projection.routine"
type Source = Readonly<{
  producer: object
  dependencies: readonly object[]
  publication: RoutinePublicationHost
  resources: () => SfRoutineNativeRuntimeResources | undefined
}>

/** A live original publication, native Location and C08 reader prove historical
 * read infrastructure. Catalog is deliberately absent: a fresh case can activate
 * Maestro planning before reading publications, and no original side-effect-free
 * observer proves its runner fence, engine and scope prerequisites. Publication
 * metadata must not advertise routines.catalog as operational.
 * No preparation, run, approval, Task, Schedule or receipt is issued. Historical
 * references still pass their original producer and source-specific admission.
 */
export async function observeSfRoutineReadingHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  persistence: SfHostServices["host"]["persistence"]
  binding?: (id: Operation, producer: object) => object | undefined
  source: (id: Operation) => Source | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source, bindingFor = input.binding, ui = input.ui, state = input.state
  const persistence = input.persistence, finish = ui.finish
  if (!bindingFor || request.signal.aborted || !isSfProductStateReader(state, persistence)) return []
  const expected = Object.freeze({ ...stamp }), stampDigest = digestSfValue(expected)
  const candidates = [
    { id: "routines.read-admission", operation: "sf_routine_status", path: "routines/read-admission", method: "POST" },
    { id: "routines.read-run", operation: "sf_routine_status", path: "routines/read-run", method: "POST" },
    { id: "projection.routine", operation: "sf_routine_status", path: "projections/routine", method: "GET" },
  ] as const
  const observed = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method || metadata.effect !== "read" ||
      metadata.pathTemplate !== "{mount}/api/ui/" + candidate.path || metadata.responseMode !== "json") return undefined
    const source = sourceFor(candidate.id)
    if (!source || !source.dependencies.length || source.dependencies.some((entry) => !entry ||
      typeof entry !== "object" && typeof entry !== "function") ||
      source.publication.publication.projectID !== expected.projectId) return undefined
    const dependencies = [...source.dependencies], publication = source.publication, resourcesFor = source.resources
    const installed = bindingFor(candidate.id, source.producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return undefined
    const own = () => [ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish, state.read, persistence.transaction,
      publication.authorize, publication.publication, publication.publication.use]
    const original = own()
    const current = () => {
      const next = sourceFor(candidate.id)
      return !request.signal.aborted && input.source === sourceFor && input.binding === bindingFor &&
        input.ui === ui && input.state === state && input.persistence === persistence &&
        isSfProductStateReader(state, persistence) && digestSfValue(stamp) === stampDigest &&
        next?.producer === source.producer && next.publication === publication && next.resources === resourcesFor &&
        publication.publication.projectID === expected.projectId && next.dependencies.length === dependencies.length &&
        dependencies.every((entry, index) => next.dependencies[index] === entry) &&
        bindingFor(candidate.id, source.producer) === installed && original.every((entry, index) => own()[index] === entry)
    }
    const digest = digestSfValue({ purpose: "native-routine-reading-health", operation: candidate.operation })
    const admitted = await ui.admit(request, candidate.operation, digest)
    if (admitted.status !== "ok") return undefined
    const read = async () => {
      if (!matches(admitted.value, expected) || !await ui.validate(admitted.value, candidate.operation, digest) ||
        ui.requestFor(admitted.value) !== request || !current() ||
        !await publication.authorize(admitted.value) || !current()) return undefined
      // authorize acquires the actual Location before its already-installed native
      // resources are inspected; no native owner is inferred from these resources.
      const resources = resourcesFor()
      if (!resources?.current() || !resources.sessions || !resources.originDirectory ||
        resources.identity.installationId !== expected.installationId || resources.identity.projectId !== expected.projectId ||
        resources.identity.hostId !== expected.hostId || !resources.taskRegistration || !resources.governanceInstallation) return undefined
      const nativeCurrent = () => current() && resourcesFor() === resources && resources.current() &&
        resources.identity.installationId === expected.installationId && resources.identity.projectId === expected.projectId &&
        resources.identity.hostId === expected.hostId
      const observe = async () => {
        if (!nativeCurrent() || !await publication.authorize(admitted.value) || !nativeCurrent()) return undefined
        const listed = await Effect.runPromise(publication.publication.use((store) => store.documents()))
        if (!nativeCurrent() || !Array.isArray(listed)) return undefined
        const health = await state.read(request, "cases", selectSfNamespaceHealth("cases", expected))
        if (health.status !== "ok" || !health.value || health.storageVersion !== health.value.storageVersion ||
          health.aggregateRevision !== health.value.aggregateRevision || health.incarnation !== health.value.incarnation ||
          !await ui.revalidate(admitted.value) || ui.requestFor(admitted.value) !== request ||
          !await publication.authorize(admitted.value) || !nativeCurrent()) return undefined
        return digestSfValue({ publications: listed, cases: health.value })
      }
      const first = await observe(), second = first ? await observe() : undefined
      if (!first || first !== second || !nativeCurrent() || !await ui.revalidate(admitted.value) ||
        ui.requestFor(admitted.value) !== request || !nativeCurrent()) return undefined
      return { current: nativeCurrent, value: { operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const } }
    }
    try { return await read() }
    finally { finish(admitted.value) }
  }))
  return observed.flatMap((entry) => entry.status === "fulfilled" && entry.value?.current() ? [entry.value.value] : [])
}

function matches(context: TrustedUiContext, stamp: SfContextStamp) {
  const binding = context.binding
  return binding.installationId === stamp.installationId && binding.projectId === stamp.projectId &&
    binding.principalRef === stamp.principalRef && binding.policyVersion === stamp.policyVersion &&
    binding.accessRevision === stamp.accessRevision
}

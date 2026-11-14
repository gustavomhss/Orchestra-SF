import { Context, Effect, Layer, Option } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { Config } from "@orchestra/core/config"
import { Database } from "@orchestra/core/database/database"
import { makeGlobalNode, makeLocationNode } from "@orchestra/core/effect/app-node"
import { EventV2 } from "@orchestra/core/event"
import type { Host } from "@orchestra/core/host"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { Relay } from "@orchestra/core/relay"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionStore } from "@orchestra/core/session/store"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { TaskTool } from "@orchestra/core/tool/task"
import { TaskGovernance } from "@orchestra/core/tool/task-governance"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import type { createSfRoutineNativeGovernance, SfRoutineNativeGovernanceInstallation } from "./routine-native-governance.ts"
import { createSfRoutineNativeRecords } from "./routine-native-records.ts"

/** The same object returned by the private host identity getter, never a model argument. */
export type SfRoutineNativeRuntimeIdentity = {
  readonly installationId: string
  readonly hostId: string
  readonly projectId: string
  readonly location: Location.Ref
}

export type SfRoutineNativeRuntimeResources = {
  readonly identity: SfRoutineNativeRuntimeIdentity
  readonly database: Database.Interface
  readonly store: SessionStore.Interface
  readonly agents: AgentV2.Interface
  readonly governance: TaskGovernance.Interface
  readonly safety: ToolSafety.Interface
  readonly registry: ToolRegistry.Interface
  readonly relay: Relay.Interface
  readonly location: Location.Interface
  readonly execution: SessionExecution.Interface
  readonly events: EventV2.Interface
  readonly config: Config.Interface
  readonly records: ReturnType<typeof createSfRoutineNativeRecords>
  /** Actual scoped Task registration metadata; it is necessary but never sufficient authorization. */
  readonly taskRegistration: object
  readonly governanceInstallation: SfRoutineNativeGovernanceInstallation
  readonly current: () => boolean
}

type NativeCapture = Omit<SfRoutineNativeRuntimeResources,
  "identity" | "records" | "current" | "taskRegistration" | "governanceInstallation"> & {
  readonly taskRegistration: object | undefined
  readonly governanceInstallation: SfRoutineNativeGovernanceInstallation | undefined
  readonly locations: Context.Service.Shape<typeof LocationServiceMap.Service>
  readonly views: WeakMap<SfRoutineNativeRuntimeIdentity, SfRoutineNativeRuntimeResources>
  active: boolean
  release: (() => void) | undefined
}

/**
 * Acquires existing application services in their real Location scope. It neither starts a Session nor creates a
 * coordinator. Its public getter is stable for the exact host identity, service scope and Task registration.
 * Owner-to-Maestro capability is a separate private host resource; capturing these services does not invent it.
 */
export function createSfRoutineNativeRuntime(input: {
  readonly installationId: string
  readonly identity: () => SfRoutineNativeRuntimeIdentity | undefined
  readonly governance: Pick<ReturnType<typeof createSfRoutineNativeGovernance>, "installed" | "installation" | "guardsInstalled">
  /** Runs in the Location dependency before product tools register; returns removal of these descriptors. */
  readonly onReady?: (resources: SfRoutineNativeRuntimeResources) => void | (() => void)
}) {
  const captures = new Set<NativeCapture>()

  const live = (capture: NativeCapture) => {
    if (!capture.active || !capture.taskRegistration || !capture.governanceInstallation) return false
    if (capture.registry.currentRegistrationIdentity(TaskTool.name) !== capture.taskRegistration ||
      !input.governance.installed(capture.governance) ||
      input.governance.installation(capture.governance) !== capture.governanceInstallation ||
      !input.governance.guardsInstalled(capture.safety, capture.relay)) {
      close(capture)
      return false
    }
    return true
  }

  const forIdentity = (identity: SfRoutineNativeRuntimeIdentity, ref: Location.Ref, projectId: string): SfRoutineNativeRuntimeResources | undefined => {
    if (input.identity() !== identity || identity.installationId !== input.installationId || identity.projectId !== projectId)
      return undefined
    const found = [...captures].filter((capture) => capture.location.project.id === projectId && sameLocation(capture.location, ref) && live(capture))
    // Ambiguous service graphs cannot authorize a call by choosing the first matching object.
    if (found.length !== 1) return undefined
    const capture = found[0]!
    const previous = capture.views.get(identity)
    if (previous) return previous
    const current = () => input.identity() === identity && captures.has(capture) && live(capture)
    const records = createSfRoutineNativeRecords({
      database: capture.database,
      store: capture.store,
      relayFor: async (location) => {
        if (!current()) return undefined
        // Historical children may live in another native worktree. Acquire through the one existing Location map.
        const relay = await Effect.runPromise(Effect.gen(function* () {
          const selected = yield* Location.Service
          if (selected.project.id !== projectId || !sameLocation(selected, location)) return undefined
          return yield* Relay.Service
        }).pipe(Effect.provide(capture.locations.get(location)))).catch(() => undefined)
        const resources = forIdentity(identity, location, projectId)
        return current() && relay && resources?.current() && resources.relay === relay ? relay : undefined
      },
    })
    const resources: SfRoutineNativeRuntimeResources = Object.freeze({
      identity,
      database: capture.database,
      store: capture.store,
      agents: capture.agents,
      governance: capture.governance,
      safety: capture.safety,
      registry: capture.registry,
      relay: capture.relay,
      location: capture.location,
      execution: capture.execution,
      events: capture.events,
      config: capture.config,
      records,
      taskRegistration: capture.taskRegistration!,
      governanceInstallation: capture.governanceInstallation!,
      current,
    })
    capture.views.set(identity, resources)
    return resources
  }

  const resources = (): SfRoutineNativeRuntimeResources | undefined => {
    const identity = input.identity()
    return identity ? forIdentity(identity, identity.location, identity.projectId) : undefined
  }

  const node = makeLocationNode({
    name: "sucafina/routine-native-runtime",
    deps: [Database.node, SessionStore.node, AgentV2.node, TaskGovernance.node, ToolSafety.node, ToolRegistry.node,
      Relay.node, Location.node, EventV2.node, Config.node, TaskTool.node, existingExecution, existingLocations],
    layer: Layer.effectDiscard(Effect.gen(function* () {
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const agents = yield* AgentV2.Service
      const governance = yield* TaskGovernance.Service
      const safety = yield* ToolSafety.Service
      const registry = yield* ToolRegistry.Service
      const relay = yield* Relay.Service
      const location = yield* Location.Service
      const events = yield* EventV2.Service
      const config = yield* Config.Service
      const execution = yield* SessionExecution.Service
      const locations = yield* LocationServiceMap.Service
      const capture: NativeCapture = {
        database, store, agents, governance, safety, registry, relay, location, events, config, execution, locations,
        taskRegistration: registry.currentRegistrationIdentity(TaskTool.name),
        governanceInstallation: input.governance.installation(governance),
        views: new WeakMap(), active: true, release: undefined,
      }
      captures.add(capture)
      yield* Effect.addFinalizer(() => Effect.sync(() => close(capture)))
      const identity = input.identity()
      if (identity && sameLocation(identity.location, location) && identity.projectId === location.project.id) {
        const ready = forIdentity(identity, identity.location, identity.projectId)
        if (ready) {
          const release = input.onReady?.(ready)
          if (typeof release === "function") capture.release = release
        }
      }
    })),
  })
  const contribution: Host.Contribution = { id: "sucafina/routine-native-runtime", locationNodes: [node] }

  function close(capture: NativeCapture) {
    if (!capture.active) return
    capture.active = false
    captures.delete(capture)
    const release = capture.release
    capture.release = undefined
    release?.()
  }

  return {
    contribution,
    node,
    resources,
    forLocation: (location: Location.Ref, projectId: string): SfRoutineNativeRuntimeResources | undefined => {
      const identity = input.identity()
      return identity ? forIdentity(identity, location, projectId) : undefined
    },
    /** Dependency order, not array order: registration must observe the descriptors installed by onReady. */
    mount: (product: Host.Contribution): Host.Contribution => ({
      ...product,
      locationNodes: product.locationNodes?.map((productNode) => ({
        ...productNode,
        dependencies: productNode.dependencies.some((dependency) => dependency === node)
          ? productNode.dependencies : [...productNode.dependencies, node],
      })),
    }),
    dispose: () => { for (const capture of [...captures]) close(capture) },
  }
}

function sameLocation(left: Location.Ref, right: Location.Ref) {
  return left.directory === right.directory && left.workspaceID === right.workspaceID
}

// Exactly the TaskTool capture pattern: require the completed application's exports, never rebuild their nodes.
function captureExisting<I, A extends object>(service: Context.Key<I, A>) {
  return makeGlobalNode({
    name: `sucafina/routine-native-runtime/existing/${service.key}`,
    layer: Layer.effect(service, Effect.serviceOption(service).pipe(Effect.flatMap((found) =>
      Option.isSome(found) ? Effect.succeed(found.value)
        : Effect.die(`SF routines require an exported application service: ${service.key}`)))),
    deps: [],
  })
}

const existingExecution = captureExisting(SessionExecution.Service)
const existingLocations = captureExisting(LocationServiceMap.Service)

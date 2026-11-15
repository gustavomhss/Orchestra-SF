import { AgentV2 } from "@orchestra/core/agent"
import { Catalog } from "@orchestra/core/catalog"
import { makeGlobalNode, makeLocationNode } from "@orchestra/core/effect/app-node"
import type { Node } from "@orchestra/core/effect/app-node"
import { LayerNodePlatform } from "@orchestra/core/effect/app-node-platform"
import type { Host } from "@orchestra/core/host"
import { Integration } from "@orchestra/core/integration"
import { Location } from "@orchestra/core/location"
import type { ModelV2 } from "@orchestra/core/model"
import { SessionRunnerModel } from "@orchestra/core/session/runner/model"
import { ExecutionHost } from "@orchestra/core/session/runner"
import { SessionSchema } from "@orchestra/core/session/schema"
import type { SessionScope } from "@orchestra/core/session/scope"
import type { SfNativeChildBound, SfNativeChildTicket } from "./native-child-admission.ts"
import { SessionStore } from "@orchestra/core/session/store"
import { SessionSubagentModels } from "@orchestra/core/session/subagent-models"
import { InvalidRequestReason, LLMError, LLMRequest, Model } from "@orchestra/llm"
import { LLMClient, RequestExecutor } from "@orchestra/llm/route"
import { Context, Effect, Exit, Layer, Stream } from "effect"
import { HttpClient, HttpClientError } from "effect/unstable/http"
import normative from "../../../../modules/sucafina/Sucafinav1/product/contracts/normative-contracts.json"
import freeze from "../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfNativeAdmission } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"
import type { TrustedExecutionBinding } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { sameNativeProject } from "./native-host.ts"
import { sfNativeLocationRef, sfNativeModelRef } from "./native-identity.ts"
import { enforceSfResponseTokenBudget } from "./token-count.ts"
import type { SfTokenCountReceipt } from "./token-count.ts"

const ticketBrand: unique symbol = Symbol("sf-token-ticket")
export type SfTokenGateTicket = { readonly [ticketBrand]: true }
type RecordState = {
  binding: TrustedExecutionBinding
  admission: SfNativeAdmission
  model: ModelV2.Ref
  location: Location.Ref
  modelMount: object
  hostMount: object
  budget: number
  revalidate: () => Effect.Effect<boolean, unknown>
  persistReceipt: (receipt: SfTokenCountReceipt) => Effect.Effect<void, unknown>
  active: boolean
}

/** A native Maestro budget is never minted from the SF resident profile or a caller's session ID.
 * The caller must already possess the authenticated human Request and persisted SF origin.
 */
export type SfMaestroGateAdmission = Readonly<{
  sessionID: SessionSchema.ID
  request: Request
  model: ModelV2.Ref
  location: Location.Ref
  projectId: string
  expiresAt: string
  scope: SessionScope.Scope
  contextBudgetTokens: number
  revalidate: () => Effect.Effect<boolean, unknown>
  persistReceipt: (receipt: SfTokenCountReceipt) => Effect.Effect<void, unknown>
}>

const maestroBrand: unique symbol = Symbol("sf-native-maestro-c15-ticket")
export type SfMaestroGateTicket = { readonly [maestroBrand]: true }
type MaestroRecord = SfMaestroGateAdmission & {
  modelMount: object
  hostMount: object
  active: boolean
}

/** Owned by this process's real Maestro C15 ticket; never registered by a fixture ID. */
type ChildRecord = {
  root: MaestroRecord
  bound: SfNativeChildBound
  models: Set<Model>
  active: boolean
  onAbort?: () => void
}

export type SfTokenGateStorage = {
  isSfOwned: (sessionID: SessionSchema.ID) => Effect.Effect<boolean, unknown>
}

/** One instance belongs to the product composition root and never accepts model-supplied authority. */
export function createSfTokenGate(input: SfTokenGateStorage & { upstream: Node.LocationNode<ExecutionHost.Service> }) {
  const upstream = input.upstream
  if (!upstream.implementation || upstream.kind !== "layer") throw new Error("execution-host-upstream-unavailable")
  const upstreamLayer = upstream.implementation as Layer.Layer<ExecutionHost.Service>
  const owned = new Set<SessionSchema.ID>()
  const maestro = new Map<SessionSchema.ID, MaestroRecord>()
  const maestroModels = new WeakMap<Model, MaestroRecord>()
  const maestroTickets = new WeakMap<SfMaestroGateTicket, MaestroRecord>()
  const children = new Map<SessionSchema.ID, ChildRecord>()
  // A Catalog Model may be shared: the actual core Session header and an active
  // private child binding are BOTH required to match a provider request.
  const childModels = new WeakMap<Model, Map<string, ChildRecord>>()
  const skillIDs = new Set(normative.resident.skills.map((skill) => skill.id))
  const operationIDs = new Set(freeze.operations.map((operation) => operation.operation))
  const sfLineage = (store: SessionStore.Interface, sessionID: SessionSchema.ID) => Effect.gen(function* () {
    const seen = new Set<SessionSchema.ID>()
    let current: SessionSchema.ID | undefined = sessionID
    while (current) {
      if (seen.has(current) || seen.size >= 64 || owned.has(current)) return true
      if (yield* input.isSfOwned(current).pipe(Effect.catch(() => Effect.succeed(true)))) return true
      seen.add(current)
      const row: SessionSchema.Info | undefined = yield* store.get(current)
      if (!row) return true
      if (row.agent?.startsWith("sf_")) return true
      const scope = yield* store.scope(current)
      if (scope && (skillIDs.has(scope.scope.skills.entry) || scope.scope.skills.allow.some((skill) => skillIDs.has(skill)) ||
        scope.scope.tools.some((operation) => operationIDs.has(operation)))) return true
      current = row.parentID
    }
    return false
  })
  const sessions = new Map<SessionSchema.ID, RecordState>()
  const models = new WeakMap<Model, RecordState>()
  const tickets = new WeakMap<SfTokenGateTicket, RecordState>()
  const mount = { current: false }
  const locations = new Map<string, { models: Set<object>; hosts: Set<object> }>()
  const keyOf = (location: Location.Ref) => digestSfValue(sfNativeLocationRef(location))
  const attach = (location: Location.Ref, kind: "models" | "hosts") => {
    const key = keyOf(location)
    const item = locations.get(key) ?? { models: new Set<object>(), hosts: new Set<object>() }
    const token = Object.freeze({})
    locations.set(key, item)
    item[kind].add(token)
    return () => { item[kind].delete(token); if (!item.models.size && !item.hosts.size) locations.delete(key) }
  }
  const maestroSame = (session: SessionSchema.Info | undefined, record: MaestroRecord) => !!session &&
    session.id === record.sessionID && !session.parentID && !session.time.archived &&
    session.agent === AgentV2.defaultID && session.projectID === record.projectId &&
    !!session.model && digestSfValue(sfNativeModelRef(session.model)) === digestSfValue(sfNativeModelRef(record.model)) &&
    keyOf(session.location) === keyOf(record.location)
  const maestroAlive = (record: MaestroRecord) => record.active && mount.current &&
    maestro.get(record.sessionID) === record && !record.request.signal.aborted &&
    Number.isFinite(Date.parse(record.expiresAt)) && Date.now() < Date.parse(record.expiresAt) &&
    !!locations.get(keyOf(record.location))?.models.has(record.modelMount) &&
    !!locations.get(keyOf(record.location))?.hosts.has(record.hostMount)
  const maestroCheck = (record: MaestroRecord) => Effect.suspend(() => {
    if (!maestroAlive(record)) return Effect.succeed(false)
    return record.revalidate().pipe(Effect.catch(() => Effect.succeed(false)), Effect.map((ok) => ok === true && maestroAlive(record)))
  })
  const closeChild = (record: ChildRecord) => {
    if (!record.active) return
    record.active = false
    record.bound.signal.removeEventListener("abort", record.onAbort ?? (() => {}))
    if (children.get(record.bound.childSessionID) === record) children.delete(record.bound.childSessionID)
    for (const model of record.models) childModels.get(model)?.delete(record.bound.childSessionID)
    record.models.clear()
  }
  const childSame = (row: SessionSchema.Info | undefined, record: ChildRecord) => !!row &&
    row.id === record.bound.childSessionID &&
    row.parentID === record.bound.parentSessionID && !row.time.archived &&
    row.projectID === record.root.projectId && row.agent === record.bound.targetAgentID &&
    !!row.model && digestSfValue(sfNativeModelRef(row.model)) === digestSfValue(sfNativeModelRef(record.root.model)) &&
    keyOf(row.location) === keyOf(record.root.location)
  const childCheck = (store: SessionStore.Interface, record: ChildRecord) => Effect.gen(function* () {
    if (!record.active || children.get(record.bound.childSessionID) !== record ||
      !maestroAlive(record.root) || record.bound.signal !== record.root.request.signal ||
      record.bound.expiresAt !== record.root.expiresAt ||
      record.bound.contextBudgetTokens !== record.root.contextBudgetTokens ||
      !(yield* maestroCheck(record.root))) return false
    const parent = yield* store.get(record.bound.parentSessionID)
    const child = yield* store.get(record.bound.childSessionID)
    const scope = yield* store.scope(record.bound.childSessionID)
    if (!parent || !maestroSame(parent, record.root) || !childSame(child, record) ||
      !scope || digestSfValue(scope.scope) !== digestSfValue(record.bound.scope)) return false
    if (!(yield* record.bound.current().pipe(Effect.catch(() => Effect.succeed(false))))) return false
    return childSame(yield* store.get(record.bound.childSessionID), record) &&
      maestroAlive(record.root) && (yield* maestroCheck(record.root))
  })
  const alive = (record: RecordState) => record.active && mount.current && sessions.get(record.admission.sessionID) === record &&
    !record.admission.request.signal.aborted && Date.now() < Date.parse(record.binding.expiresAt) &&
    !!locations.get(keyOf(record.location))?.models.has(record.modelMount) &&
    !!locations.get(keyOf(record.location))?.hosts.has(record.hostMount)
  const check = (record: RecordState) => Effect.suspend(() => {
    if (!alive(record)) return Effect.succeed(false)
    return record.revalidate().pipe(Effect.catch(() => Effect.succeed(false)), Effect.map((ok) => ok === true && alive(record)))
  })
  const same = (session: SessionSchema.Info | undefined, record: RecordState) => !!session && session.id === record.admission.sessionID &&
    sameNativeProject(session, record.binding) &&
    session.agent === record.admission.profile.id && !!session.model && digestSfValue(sfNativeModelRef(session.model)) === digestSfValue(sfNativeModelRef(record.model)) &&
    keyOf(session.location) === keyOf(record.location)
  const refusal = (reason: string) => new LLMError({ module: "SucafinaTokenGate", method: "admit", reason: new InvalidRequestReason({ message: reason }) })
  const unavailable = (session: SessionSchema.Info) => session.model ? new SessionRunnerModel.ModelUnavailableError({
    providerID: session.model.providerID, modelID: session.model.id, cause: "sf-token-gate-unavailable",
  }) : new SessionRunnerModel.ModelNotSelectedError({ sessionID: session.id })
  const modelNode = makeLocationNode({
    service: SessionRunnerModel.Service,
    deps: [Catalog.node, Integration.node, SessionSubagentModels.node, SessionStore.node, Location.node],
    layer: Layer.effect(SessionRunnerModel.Service, Effect.gen(function* () {
      const store = yield* SessionStore.Service
      const location = yield* Location.Service
      const detach = attach(Location.Ref.make({ directory: location.directory, ...(location.workspaceID ? { workspaceID: location.workspaceID } : {}) }), "models")
      yield* Effect.addFinalizer(() => Effect.sync(detach))
      const context = yield* Layer.build(SessionRunnerModel.locationLayer)
      const original = Context.get(context, SessionRunnerModel.Service)
      return SessionRunnerModel.Service.of({ resolve: (session) => Effect.gen(function* () {
        const native = maestro.get(session.id)
        if (native) {
          if (!maestroSame(session, native) || !maestroSame(yield* store.get(session.id), native) ||
            !(yield* maestroCheck(native))) return yield* unavailable(session)
          const observed = yield* store.scope(session.id)
          if (!observed || digestSfValue(observed.scope) !== digestSfValue(native.scope)) return yield* unavailable(session)
          const model = yield* original.resolve(session)
          if (!maestroSame(yield* store.get(session.id), native) || !(yield* maestroCheck(native))) return yield* unavailable(session)
          const previous = maestroModels.get(model)
          if (previous && previous !== native && maestroAlive(previous)) return yield* unavailable(session)
          // Prior Request was revoked/expired. A fresh, separately authenticated
          // human continuation may replace its stale Model association only then.
          maestroModels.set(model, native)
          return model
        }
        const descendant = children.get(session.id)
        if (descendant) {
          if (!childSame(session, descendant) || !(yield* childCheck(store, descendant)))
            return yield* unavailable(session)
          const model = yield* original.resolve(session)
          if (!(yield* childCheck(store, descendant))) return yield* unavailable(session)
          const bound = childModels.get(model) ?? new Map<string, ChildRecord>()
          const previous = bound.get(session.id)
          if (previous && previous !== descendant && previous.active) return yield* unavailable(session)
          bound.set(session.id, descendant)
          childModels.set(model, bound)
          descendant.models.add(model)
          return model
        }
        const record = sessions.get(session.id)
        if (!record && !session.agent?.startsWith("sf_") && !(yield* sfLineage(store, session.id))) return yield* original.resolve(session)
        if (!record || !session.model || !same(session, record) || !same(yield* store.get(session.id), record) ||
          !(yield* check(record))) return yield* unavailable(session)
        const model = yield* original.resolve(session)
        if (!same(yield* store.get(session.id), record) || !(yield* check(record)) || !same(yield* store.get(session.id), record)) return yield* unavailable(session)
        const existing = models.get(model)
        if (existing && existing !== record) return yield* unavailable(session)
        models.set(model, record)
        return model
      }) })
    })),
  })
  const clientNode = makeGlobalNode({
    service: LLMClient.Service,
    deps: [LayerNodePlatform.requestExecutor, LayerNodePlatform.httpClient, SessionStore.node],
    layer: Layer.effect(LLMClient.Service, Effect.gen(function* () {
      const store = yield* SessionStore.Service
      const base = yield* HttpClient.HttpClient
      const context = yield* Layer.build(LLMClient.layer)
      const original = Context.get(context, LLMClient.Service)
      mount.current = true
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        mount.current = false
        sessions.forEach((record) => { record.active = false })
        sessions.clear()
        for (const descendant of [...children.values()]) closeChild(descendant)
        maestro.forEach((record) => { record.active = false })
        maestro.clear()
      }))
      const classify = (request: LLMRequest) => Effect.gen(function* () {
        const header = Object.entries(request.http?.headers ?? {}).find(([name]) => name.toLowerCase() === "x-session-id")?.[1]
        const descendant = childModels.get(request.model)?.get(header ?? "")
        if (descendant) return { kind: "child" as const, record: descendant }
        const record = models.get(request.model)
        if (record) return { kind: "sf" as const, record }
        const native = maestroModels.get(request.model)
        // A shared Catalog Model object is not a session owner. Only the core-issued
        // Session header may route into this private C15 capability.
        if (native && header === native.sessionID) return { kind: "maestro" as const, record: native }
        if (!header?.startsWith("ses_")) return { kind: "other" as const }
        if (yield* sfLineage(store, SessionSchema.ID.make(header))) return { kind: "denied" as const }
        return { kind: "other" as const }
      })
      const readyMaestro = (record: MaestroRecord) => Effect.gen(function* () {
        if (!maestroSame(yield* store.get(record.sessionID), record) || !(yield* maestroCheck(record))) return false
        const scope = yield* store.scope(record.sessionID)
        return !!scope && digestSfValue(scope.scope) === digestSfValue(record.scope) &&
          maestroSame(yield* store.get(record.sessionID), record) && maestroAlive(record)
      })
      const readyChild = (record: ChildRecord) => childCheck(store, record)
      const ready = (record: RecordState) => Effect.gen(function* () {
        if (!same(yield* store.get(record.admission.sessionID), record) || !(yield* check(record))) return false
        return same(yield* store.get(record.admission.sessionID), record) && alive(record)
      })
      return LLMClient.Service.of({
        prepare: <Body>(request: LLMRequest) => Effect.gen(function* () {
          const route = yield* classify(request)
          if (route.kind !== "other") return yield* Effect.fail(refusal("sf-prepare-unavailable"))
          return yield* original.prepare<Body>(request)
        }),
        generate: (request) => Effect.gen(function* () {
          const route = yield* classify(request)
          if (route.kind !== "other") return yield* Effect.fail(refusal("sf-generate-unavailable"))
          return yield* original.generate(request)
        }),
        stream: (request) => Stream.unwrap(Effect.gen(function* () {
          const route = yield* classify(request)
          if (route.kind === "other") return original.stream(request)
          if (route.kind === "denied") return Stream.fail(refusal("sf-model-unbound"))
          const valid = () => route.kind === "maestro" ? readyMaestro(route.record) :
            route.kind === "child" ? readyChild(route.record) : ready(route.record)
          if (!(yield* valid()) || request.model.route.protocol !== "openai-responses" || request.model.route.transport.id !== "http-json")
            return Stream.fail(refusal("sf-route-unavailable"))
          const originalRoute = request.model.route
          const transportRoute = { ...originalRoute, streamPrepared: (prepared: Parameters<typeof originalRoute.streamPrepared>[0],
            compiled: Parameters<typeof originalRoute.streamPrepared>[1], runtime: Parameters<typeof originalRoute.streamPrepared>[2]) =>
            Stream.unwrap(Effect.gen(function* () {
              if (!(yield* valid())) return Stream.fail(refusal("sf-authority-unavailable"))
              const guarded = HttpClient.mapRequestEffect(base, (httpRequest) =>
                enforceSfResponseTokenBudget(httpRequest, runtime.http, {
                  model: request.model.id,
                  contextBudgetTokens: route.kind === "child" ? route.record.root.contextBudgetTokens :
                    route.kind === "maestro" ? route.record.contextBudgetTokens : route.record.budget,
                  revalidate: valid,
                  // Every child receipt is fenced by the *original* parent C09 writer,
                  // Request and real token-count oracle; child IDs are not credentials.
                  persistReceipt: route.kind === "child" ? route.record.root.persistReceipt : route.record.persistReceipt,
                }).pipe(
                  Effect.mapError(() => new HttpClientError.HttpClientError({ reason: new HttpClientError.TransportError({
                    request: httpRequest, description: "SF budget gate denied request",
                  }) })),
                ))
              const scoped = yield* Layer.build(RequestExecutor.layer.pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, guarded))))
              return originalRoute.streamPrepared(prepared, compiled, { ...runtime, http: Context.get(scoped, RequestExecutor.Service) })
            })) }
          return original.stream(LLMRequest.update(request, { model: Model.update(request.model, { route: transportRoute }) }))
        })),
      })
    })),
  })
  const hostNode: Node.LocationNode<ExecutionHost.Service> = {
    ...upstream,
    dependencies: [...upstream.dependencies, SessionStore.node, Location.node],
    implementation: Layer.effect(ExecutionHost.Service, Effect.gen(function* () {
      const store = yield* SessionStore.Service
      const location = yield* Location.Service
      const detach = attach(Location.Ref.make({ directory: location.directory, ...(location.workspaceID ? { workspaceID: location.workspaceID } : {}) }), "hosts")
      yield* Effect.addFinalizer(() => Effect.sync(detach))
      const original = Context.get(yield* Layer.build(upstreamLayer), ExecutionHost.Service)
      return ExecutionHost.Service.of({ get: (engine) => {
        const host = original.get(engine)
        if (!host) return undefined
        return { ...host, stream: (turn) => Stream.unwrap(Effect.gen(function* () {
          if (turn.session.agent?.startsWith("sf_") || (yield* sfLineage(store, turn.session.id)))
            return Stream.fail(refusal("sf-execution-host-unavailable"))
          return host.stream(turn)
        })) }
      } })
    })),
  }
  const contribution: Host.Contribution = { id: "sucafina-token-gate", replacements: [[SessionRunnerModel.node, modelNode], [LayerNodePlatform.llmClient, clientNode], [ExecutionHost.node, hostNode]] }
  return {
    contribution,
    hostNode,
    /** Register only after the native host created/scoped an authentic Maestro Session and the
     * SF authority durably reserved its provenance. Children of this root are fail-closed, not
     * silently downgraded to unguarded provider calls. New requests require a new ticket.
     */
    registerMaestro: (input: SfMaestroGateAdmission) => Effect.gen(function* () {
      const store = yield* SessionStore.Service
      const parent = yield* store.get(input.sessionID)
      const scope = yield* store.scope(input.sessionID)
      const registered = locations.get(keyOf(input.location))
      const modelMount = registered?.models.values().next().value
      const hostMount = registered?.hosts.values().next().value
      if (!mount.current || !parent || !scope || !modelMount || !hostMount ||
        registered?.models.size !== 1 || registered.hosts.size !== 1 || maestro.has(input.sessionID) ||
        !maestroSame(parent, { ...input, modelMount, hostMount, active: true }) ||
        digestSfValue(scope.scope) !== digestSfValue(input.scope) ||
        !Number.isSafeInteger(input.contextBudgetTokens) || input.contextBudgetTokens < 1 ||
        input.request.signal.aborted || Date.now() >= Date.parse(input.expiresAt)) return undefined
      const record: MaestroRecord = { ...input, modelMount, hostMount, active: true }
      owned.add(input.sessionID)
      maestro.set(input.sessionID, record)
      if (!(yield* maestroCheck(record)) || !maestroSame(yield* store.get(input.sessionID), record)) {
        record.active = false
        if (maestro.get(input.sessionID) === record) maestro.delete(input.sessionID)
        return undefined
      }
      const ticket: SfMaestroGateTicket = Object.freeze({ [maestroBrand]: true })
      maestroTickets.set(ticket, record)
      return ticket
    }),
    validMaestro: (ticket: SfMaestroGateTicket) => Effect.gen(function* () {
      const record = maestroTickets.get(ticket)
      if (!record || !(yield* maestroCheck(record))) return false
      const store = yield* SessionStore.Service
      const scope = yield* store.scope(record.sessionID)
      return !!scope && digestSfValue(scope.scope) === digestSfValue(record.scope) &&
        maestroSame(yield* store.get(record.sessionID), record) && maestroAlive(record)
    }),
    revokeMaestro: (ticket: SfMaestroGateTicket) => {
      const record = maestroTickets.get(ticket)
      if (!record) return
      for (const child of [...children.values()]) if (child.root === record) closeChild(child)
      record.active = false
      if (maestro.get(record.sessionID) === record) maestro.delete(record.sessionID)
      maestroTickets.delete(ticket)
    },
    /**
     * Only the private root ticket classifies SF lineage. An absent/revoked SF root
     * is blocked, never "outside"; no caller-supplied parent ID creates a grant.
     */
    traceChildRoot: (parentSessionID: SessionSchema.ID) => Effect.gen(function* () {
      const store = yield* SessionStore.Service
      const root = maestro.get(parentSessionID)
      if (!root || !(yield* maestroCheck(root))) {
        return (yield* sfLineage(store, parentSessionID))
          ? { kind: "blocked" as const } : { kind: "outside" as const }
      }
      const row = yield* store.get(parentSessionID)
      const scoped = yield* store.scope(parentSessionID)
      if (!maestroSame(row, root) || !scoped ||
        digestSfValue(scoped.scope) !== digestSfValue(root.scope))
        return { kind: "blocked" as const }
      const policyVersion = digestSfValue({ scope: root.scope, model: sfNativeModelRef(root.model),
        contextBudgetTokens: root.contextBudgetTokens, projectId: root.projectId })
      return {
        kind: "native-root" as const, rootSessionID: root.sessionID,
        model: root.model, location: root.location,
        contextBudgetTokens: root.contextBudgetTokens, policyVersion,
        expiresAt: root.expiresAt, signal: root.request.signal,
        current: () => Effect.gen(function* () {
          const parent = yield* store.get(root.sessionID)
          const scope = yield* store.scope(root.sessionID)
          return maestroSame(parent, root) && !!scope &&
            digestSfValue(scope.scope) === digestSfValue(root.scope) &&
            (yield* maestroCheck(root))
        }),
      }
    }),
    /**
     * Executed only after core TaskGovernance validated the original issued
     * frame, Task running part, actual Permission and child Session. The gate
     * independently re-reads source and owns the provider ticket + lifecycle.
     */
    registerChild: (binding: SfNativeChildBound) => Effect.gen(function* () {
      const store = yield* SessionStore.Service
      const root = maestro.get(binding.rootSessionID)
      const parent = yield* store.get(binding.parentSessionID)
      const child = yield* store.get(binding.childSessionID)
      const scoped = yield* store.scope(binding.childSessionID)
      const message = yield* store.message(binding.invocation.assistantMessageID)
      const matching = message?.message.type === "assistant" ? message.message.content.filter((part) =>
        part.type === "tool" && part.id === binding.invocation.toolCallID && part.name === "task") : []
      const part = matching[0]
      const granted = child ? yield* store.permissions(child.id) : []
      if (!root || !maestroAlive(root) || children.has(binding.childSessionID) ||
        !parent || !maestroSame(parent, root) || !child ||
        child.parentID !== root.sessionID || !childSame(child, { root, bound: binding, active: true, models: new Set() }) ||
        !scoped || digestSfValue(scoped.scope) !== digestSfValue(binding.scope) ||
        !binding.scope.skills.entry.startsWith("sf-native-child-c15-provenance-") ||
        binding.scope.skills.allow.length !== 0 || binding.scope.budgets.loads !== 0 ||
        binding.scope.budgets.toolCalls > 4 || binding.scope.budgets.toolCalls < 1 ||
        binding.scope.tools.some((tool) => !["read", "grep", "glob", "list"].includes(tool) ||
          !root.scope.tools.includes(tool)) ||
        binding.signal !== root.request.signal ||
        binding.expiresAt !== root.expiresAt ||
        binding.contextBudgetTokens !== root.contextBudgetTokens ||
        digestSfValue(sfNativeModelRef(binding.model)) !== digestSfValue(sfNativeModelRef(root.model)) ||
        !granted.some((rule) => rule.action === "task" && rule.resource === "*" && rule.effect === "deny") ||
        !granted.some((rule) => rule.action === "external_directory" && rule.resource === "*" && rule.effect === "deny") ||
        !message || message.sessionID !== root.sessionID || message.message.type !== "assistant" ||
        message.message.agent !== AgentV2.defaultID ||
        !message.message.model ||
        digestSfValue(sfNativeModelRef(message.message.model)) !== digestSfValue(sfNativeModelRef(root.model)) ||
        matching.length !== 1 || !part || part.type !== "tool" || part.provider?.executed ||
        part.state.status !== "running" ||
        part.state.input.subagent_type !== binding.targetAgentID ||
        !(yield* binding.current().pipe(Effect.catch(() => Effect.succeed(false)))) ||
        !(yield* maestroCheck(root))) return undefined
      const record: ChildRecord = { root, bound: binding, models: new Set(), active: true }
      record.onAbort = () => closeChild(record)
      children.set(binding.childSessionID, record)
      binding.signal.addEventListener("abort", record.onAbort, { once: true })
      if (!(yield* childCheck(store, record))) {
        closeChild(record)
        return undefined
      }
      const ticket: SfNativeChildTicket = Object.freeze({
        current: () => childCheck(store, record),
        revoke: () => closeChild(record),
      })
      return ticket
    }),
    reserveSession: (sessionID: SessionSchema.ID) => { owned.add(sessionID) },
    register: (input: { admission: SfNativeAdmission; binding: TrustedExecutionBinding; model: ModelV2.Ref; location: Location.Ref;
      revalidate: () => Effect.Effect<boolean, unknown>; persistReceipt: (receipt: SfTokenCountReceipt) => Effect.Effect<void, unknown> }) => Effect.gen(function* () {
      const store = yield* SessionStore.Service
      const skills = input.admission.selected.skills.filter((item) => input.admission.skillReceipts.some((receipt) => receipt.skillId === item.id))
      const budget = skills.length === input.admission.skillReceipts.length && skills.length > 0
        ? Math.min(input.admission.profile.contextBudgetTokens, ...skills.map((skill) => skill.limits.contextBudgetTokens)) : 0
      const facts = structuredClone({ ...input.admission, request: undefined })
      const admission = Object.freeze({ ...freezeGateFacts(facts), request: input.admission.request })
      const registered = locations.get(keyOf(input.location))
      if (!registered || registered.models.size !== 1 || registered.hosts.size !== 1) return undefined
      const modelMount = registered.models.values().next().value
      const hostMount = registered.hosts.values().next().value
      if (!modelMount || !hostMount) return undefined
      const record: RecordState = { ...input, admission, model: Object.freeze(structuredClone(input.model)),
        location: Object.freeze(structuredClone(input.location)), modelMount, hostMount, budget, active: true }
      if (!mount.current || sessions.has(admission.sessionID) || !Number.isSafeInteger(budget) || budget < 1 ||
        record.binding.nativeSessionId !== admission.sessionID || record.binding.manifestDigest !== admission.manifestDigest ||
        record.binding.runId !== admission.runId || record.binding.profileId !== admission.profile.id ||
        record.binding.caseId !== admission.caseRef.id || record.binding.caseVersion !== admission.caseRef.version ||
        record.binding.caseIncarnation !== admission.caseRef.incarnation ||
        !same(yield* store.get(admission.sessionID), record)) return undefined
      owned.add(admission.sessionID)
      sessions.set(admission.sessionID, record)
      return yield* Effect.gen(function* () {
        if (!(yield* check(record)) || !same(yield* store.get(admission.sessionID), record)) return undefined
        const ticket: SfTokenGateTicket = Object.freeze({ [ticketBrand]: true })
        tickets.set(ticket, record)
        return ticket
      }).pipe(Effect.onExit((exit) => Effect.sync(() => {
        if (Exit.isSuccess(exit) && exit.value !== undefined) return
        record.active = false
        if (sessions.get(admission.sessionID) === record) sessions.delete(admission.sessionID)
      })))
    }),
    revokeSession: (sessionID: SessionSchema.ID) => {
      const record = sessions.get(sessionID)
      if (!record) return
      record.active = false
      if (sessions.get(sessionID) === record) sessions.delete(sessionID)
    },
    valid: (ticket: SfTokenGateTicket, store: SessionStore.Interface) => Effect.gen(function* () {
      const record = tickets.get(ticket)
      if (!record || !same(yield* store.get(record.admission.sessionID), record) || !(yield* check(record))) return false
      return same(yield* store.get(record.admission.sessionID), record) && alive(record)
    }),
    revoke: (ticket: SfTokenGateTicket) => {
      const record = tickets.get(ticket)
      if (!record) return
      record.active = false
      if (sessions.get(record.admission.sessionID) === record) sessions.delete(record.admission.sessionID)
      tickets.delete(ticket)
    },
  }
}

function freezeGateFacts<T>(value: T): T {
  if (!value || typeof value !== "object") return value
  Object.values(value).forEach(freezeGateFacts)
  return Object.freeze(value)
}

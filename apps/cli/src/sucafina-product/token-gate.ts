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
import { SessionStore } from "@orchestra/core/session/store"
import { SessionSubagentModels } from "@orchestra/core/session/subagent-models"
import { InvalidRequestReason, LLMError, LLMRequest, Model } from "@orchestra/llm"
import { LLMClient, RequestExecutor } from "@orchestra/llm/route"
import { Context, Effect, Layer, Stream } from "effect"
import { HttpClient, HttpClientError } from "effect/unstable/http"
import normative from "../../../../modules/sucafina/Sucafinav1/product/contracts/normative-contracts.json"
import freeze from "../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfNativeAdmission } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"
import type { TrustedExecutionBinding } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
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

export type SfTokenGateStorage = {
  isSfOwned: (sessionID: SessionSchema.ID) => Effect.Effect<boolean, unknown>
}

/** One instance belongs to the product composition root and never accepts model-supplied authority. */
export function createSfTokenGate(input: SfTokenGateStorage & { upstream: Node.LocationNode<ExecutionHost.Service> }) {
  const upstream = input.upstream
  if (!upstream.implementation || upstream.kind !== "layer") throw new Error("execution-host-upstream-unavailable")
  const upstreamLayer = upstream.implementation as Layer.Layer<ExecutionHost.Service>
  const owned = new Set<SessionSchema.ID>()
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
  const keyOf = (location: Location.Ref) => digestSfValue(location)
  const attach = (location: Location.Ref, kind: "models" | "hosts") => {
    const key = keyOf(location)
    const item = locations.get(key) ?? { models: new Set<object>(), hosts: new Set<object>() }
    const token = Object.freeze({})
    locations.set(key, item)
    item[kind].add(token)
    return () => { item[kind].delete(token); if (!item.models.size && !item.hosts.size) locations.delete(key) }
  }
  const alive = (record: RecordState) => record.active && mount.current && sessions.get(record.admission.sessionID) === record &&
    !record.admission.request.signal.aborted && Date.now() < Date.parse(record.binding.expiresAt) &&
    !!locations.get(keyOf(record.location))?.models.has(record.modelMount) &&
    !!locations.get(keyOf(record.location))?.hosts.has(record.hostMount)
  const check = (record: RecordState) => Effect.suspend(() => {
    if (!alive(record)) return Effect.succeed(false)
    return record.revalidate().pipe(Effect.catch(() => Effect.succeed(false)), Effect.map((ok) => ok === true && alive(record)))
  })
  const same = (session: SessionSchema.Info | undefined, record: RecordState) => !!session && session.id === record.admission.sessionID &&
    session.agent === record.admission.profile.id && !!session.model && digestSfValue(session.model) === digestSfValue(record.model) &&
    digestSfValue(session.location) === digestSfValue(record.location)
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
      }))
      const classify = (request: LLMRequest) => Effect.gen(function* () {
        const record = models.get(request.model)
        if (record) return { kind: "sf" as const, record }
        const header = Object.entries(request.http?.headers ?? {}).find(([name]) => name.toLowerCase() === "x-session-id")?.[1]
        if (!header?.startsWith("ses_")) return { kind: "other" as const }
        if (yield* sfLineage(store, SessionSchema.ID.make(header))) return { kind: "denied" as const }
        return { kind: "other" as const }
      })
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
          const record = route.record
          if (!(yield* ready(record)) || request.model.route.protocol !== "openai-responses" || request.model.route.transport.id !== "http-json")
            return Stream.fail(refusal("sf-route-unavailable"))
          const originalRoute = request.model.route
          const transportRoute = { ...originalRoute, streamPrepared: (prepared: Parameters<typeof originalRoute.streamPrepared>[0],
            compiled: Parameters<typeof originalRoute.streamPrepared>[1], runtime: Parameters<typeof originalRoute.streamPrepared>[2]) =>
            Stream.unwrap(Effect.gen(function* () {
              if (!(yield* ready(record))) return Stream.fail(refusal("sf-authority-unavailable"))
              const guarded = HttpClient.mapRequestEffect(base, (httpRequest) =>
                enforceSfResponseTokenBudget(httpRequest, runtime.http, { model: request.model.id, contextBudgetTokens: record.budget,
                  revalidate: () => ready(record), persistReceipt: record.persistReceipt }).pipe(
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
      if (!(yield* check(record)) || !same(yield* store.get(admission.sessionID), record)) {
        if (sessions.get(admission.sessionID) === record) sessions.delete(admission.sessionID)
        return undefined
      }
      const ticket: SfTokenGateTicket = Object.freeze({ [ticketBrand]: true })
      tickets.set(ticket, record)
      return ticket
    }),
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

export * as PrivateProvider from "./private"

import { AuthenticationReason, LLMClient, LLMError, LLMRequest } from "@orchestra/llm"
import { OpenAICompatibleChat } from "@orchestra/llm/protocols/openai-compatible-chat"
import { Auth } from "@orchestra/llm/route"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { Model } from "@orchestra/schema/model"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { Effect, Layer, Schema, Scope, Stream } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http"
import { SessionOwner } from "../session/owner"
import { SessionSchema } from "../session/schema"

type NativeModel = ReturnType<typeof OpenAICompatibleChat.route.model>
const issued = new WeakMap<NativeModel, () => Effect.Effect<void, LLMError>>()
const unavailable = () => new LLMError({
  module: "PrivateProvider", method: "authorize",
  reason: new AuthenticationReason({ kind: "insufficient-permissions",
    message: "The private provider is unavailable in the current profile." }),
})
const KeyValue = Schema.Struct({ type: Schema.Literal("key"), key: ConnectionAccess.ApiKey })
  .annotate({ parseOptions: { onExcessProperty: "error" } })

/**
 * Resolve an explicitly declared native provider from this exact server lease.
 * The returned Model is a process-local capability; copying its route or a wire
 * declaration does not register another Model. The credential is opened only at dispatch.
 */
export function resolve(scope: SessionOwner.Scope, input: Readonly<{
  sessionID: SessionSchema.ID
  parentID?: SessionSchema.ID
  model: Model.Ref
}>) {
  const sessionID = Schema.decodeUnknownSync(SessionSchema.ID)(input.sessionID)
  const parentID = input.parentID === undefined ? undefined : Schema.decodeUnknownSync(SessionSchema.ID)(input.parentID)
  const selected = Object.freeze({ ...Schema.decodeUnknownSync(Model.Ref)(input.model) })
  return Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const http = yield* HttpClient.HttpClient
    yield* owners.assertCurrent(scope)
    yield* owners.assert(scope, sessionID, "model")
    yield* owners.authorize(scope, "run", sessionID)
    if (parentID) yield* owners.assert(scope, parentID, "read")
    if (selected.variant !== undefined && selected.variant !== "default") return yield* unavailable()
    const providers = yield* owners.providers(scope)
    if (!providers) return yield* unavailable()
    const bindings = yield* providers.list()
    const binding = bindings.find((value) => value.providerId === selected.providerID)
    const definition = binding?.models.find((value) => value.id === selected.id)
    if (!binding || !definition || !Schema.is(ProviderAccess.Binding)(binding)) return yield* unavailable()
    const vault = yield* owners.connections(scope)
    if (!vault) return yield* unavailable()
    const metadata = yield* vault.inspect(binding.connection)
    if (!metadata || metadata.state !== "active") return yield* unavailable()
    const revision = metadata.revision
    const expectedURL = binding.endpoint.replace(/\/+$/, "") + "/chat/completions"
    const verify = () => Effect.gen(function* () {
      yield* owners.assertCurrent(scope)
      yield* owners.assert(scope, sessionID, "model")
      yield* owners.authorize(scope, "run", sessionID)
      yield* providers.verify(binding)
      const current = yield* vault.inspect(binding.connection)
      if (!current || current.state !== "active" || current.revision !== revision) return yield* unavailable()
      yield* owners.assertCurrent(scope)
    }).pipe(Effect.mapError(() => unavailable()))
    const original = OpenAICompatibleChat.route.transport
    type Prepared = Parameters<typeof original.frames>[0]
    const preparedValues = new WeakMap<object, Readonly<{
      request: LLMRequest; privateValue: Prepared; signature: string
    }>>()
    const bodyCodec = OpenAICompatibleChat.route.body.schema.annotate({ parseOptions: { onExcessProperty: "error" } })
    const encodeBody = Schema.encodeSync(Schema.fromJsonString(bodyCodec))
    const signature = (value: Prepared) => {
      const outgoing = value.request
      if (outgoing.body._tag !== "Uint8Array") return undefined
      return JSON.stringify([outgoing.method, outgoing.url, outgoing.urlParams.params, outgoing.hash, outgoing.headers,
        outgoing.body.contentType, Buffer.from(outgoing.body.body).toString("base64")])
    }
    const expectedHeaders: Readonly<Record<string, string>> = Object.freeze({
      "x-session-affinity": sessionID, "x-session-id": sessionID,
      ...(parentID ? { "x-parent-session-id": parentID } : {}),
    })
    const transport: typeof original = Object.freeze({
      id: "private-openai-chat",
      prepare: (input: Parameters<typeof original.prepare>[0]) => Effect.gen(function* () {
        // Copy the provider body before the first external await; caller-owned objects never become transport state.
        const supplied = yield* Effect.try({
          try: () => encodeBody(Schema.decodeUnknownSync(bodyCodec)(input.body)), catch: () => unavailable(),
        })
        yield* verify()
        if (input.request.model !== model || input.request.model.route !== route ||
          input.request.http?.query && Object.keys(input.request.http.query).length > 0 ||
          input.request.http?.body && Object.keys(input.request.http.body).length > 0 ||
          Object.entries(input.request.http?.headers ?? {}).some(([name, value]) => expectedHeaders[name.toLowerCase()] !== value) ||
          !definition.tools && input.request.tools.length > 0 ||
          input.request.generation?.maxTokens !== undefined && (!Number.isSafeInteger(input.request.generation.maxTokens) ||
            input.request.generation.maxTokens < 1 || input.request.generation.maxTokens > definition.limit.output))
          return yield* unavailable()
        const canonical = LLMRequest.update(input.request, {
          generation: { ...input.request.generation, maxTokens: input.request.generation?.maxTokens ?? definition.limit.output },
        })
        const body = yield* route.body.from(canonical).pipe(Effect.flatMap(Schema.decodeUnknownEffect(bodyCodec)))
        const encoded = encodeBody(body)
        if (encoded !== supplied || Buffer.byteLength(encoded, "utf8") > 8 * 1024 * 1024)
          return yield* unavailable()
        // Only the retained native protocol supplies codecs, endpoint, auth and framing.
        const value = yield* original.prepare({
          body, request: canonical, endpoint: route.endpoint, auth: Auth.none, encodeBody,
          headers: () => ({ ...expectedHeaders }),
        })
        if (value.request.method !== "POST" || value.request.url !== expectedURL ||
          value.request.urlParams.params.length !== 0 || value.request.hash._tag !== "None")
          return yield* unavailable()
        const fingerprint = signature(value)
        if (fingerprint === undefined) return yield* unavailable()
        const privateRequest = HttpClientRequest.post(expectedURL).pipe(
          HttpClientRequest.setHeaders({ ...value.request.headers }),
          HttpClientRequest.setUrlParams([]),
          HttpClientRequest.bodyText(encoded, "application/json"),
        )
        const framing = Object.freeze({ ...value.framing })
        const exposed = Object.freeze({ request: value.request, framing })
        preparedValues.set(exposed, Object.freeze({
          request: input.request, privateValue: Object.freeze({ request: privateRequest, framing }), signature: fingerprint,
        }))
        return exposed
      }).pipe(Effect.mapError(() => unavailable())),
      frames: (prepared: Parameters<typeof original.frames>[0], request: Parameters<typeof original.frames>[1]) => {
        const retained = preparedValues.get(prepared)
        if (!retained || retained.request !== request || signature(prepared) !== retained.signature ||
          prepared.framing !== retained.privateValue.framing || request.model !== model || request.model.route !== route)
          return Stream.fail(unavailable())
        return Stream.unwrap(Effect.gen(function* () {
          const lifetime = yield* Scope.Scope
          const execute = (outgoing: HttpClientRequest.HttpClientRequest) => Effect.gen(function* () {
            yield* verify()
            if (outgoing !== retained.privateValue.request || outgoing.method !== "POST" || outgoing.url !== expectedURL ||
              Object.keys(outgoing.headers).some((name) => !["content-type", "accept", ...Object.keys(expectedHeaders)].includes(name.toLowerCase())))
              return yield* unavailable()
            const stored = yield* vault.read(binding.connection)
            if (!stored?.encodedValue || stored.metadata.state !== "active" || stored.metadata.revision !== revision)
              return yield* unavailable()
            const credential = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(KeyValue))(stored.encodedValue)
              .pipe(Effect.mapError(() => unavailable()))
            yield* verify()
            if (signature(prepared) !== retained.signature || prepared.framing !== retained.privateValue.framing ||
              request.model !== model || request.model.route !== route) return yield* unavailable()
            const secured = HttpClientRequest.setHeader(outgoing, "authorization", "Bearer " + credential.key)
            // Corporate provider calls make exactly one attempt. The response lives only as long as this stream.
            const response = yield* HttpClient.withScope(http).execute(secured).pipe(
              Effect.provideService(Scope.Scope, lifetime),
              Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual", credentials: "omit", cache: "no-store" }),
              Effect.mapError(() => unavailable()),
            )
            if (response.status < 200 || response.status >= 300) return yield* unavailable()
            yield* verify()
            return response
          }).pipe(Effect.mapError(() => unavailable()))
          return original.frames(retained.privateValue, request, { http: { execute } }).pipe(
            Stream.mapEffect((frame) => verify().pipe(Effect.as(frame))),
            // Provider error bodies and headers are not part of this public failure surface.
            Stream.mapError(() => unavailable()),
          )
        }))
      },
    })
    const route = OpenAICompatibleChat.route.with({
      provider: binding.providerId, endpoint: { baseURL: binding.endpoint }, auth: Auth.none, transport,
      limits: { context: definition.limit.context, output: definition.limit.output },
      generation: { maxTokens: definition.limit.output },
    })
    Object.assign(route, { body: Object.freeze({ ...route.body }) })
    Object.freeze(route.endpoint)
    Object.freeze(route.defaults.limits)
    Object.freeze(route.defaults.generation)
    Object.freeze(route.defaults)
    Object.freeze(route)
    const model = Object.freeze(route.model({ id: definition.id }))
    yield* verify()
    issued.set(model, verify)
    return model
  }).pipe(Effect.mapError(() => unavailable()))
}

/** Guards the actual shared native client, including callers outside SessionRunner. */
export const llmLayer = Layer.effect(LLMClient.Service, Effect.gen(function* () {
  const native = yield* LLMClient.Service
  const owners = yield* SessionOwner.Service
  const verify = (model: NativeModel) => Effect.gen(function* () {
    const registered = issued.get(model)
    if (registered) return yield* registered()
    const scope = yield* owners.open()
    if (owners.owner(scope)) return yield* unavailable()
    // Only an observed technical store may use unregistered native models.
    yield* owners.verify(scope)
  }).pipe(Effect.mapError(() => unavailable()))
  return LLMClient.Service.of({
    prepare: <Body = unknown>(request: LLMRequest) => verify(request.model).pipe(
      Effect.andThen(native.prepare<Body>(request)), Effect.tap(() => verify(request.model))),
    stream: (request) => Stream.unwrap(verify(request.model).pipe(Effect.as(
      issued.has(request.model) ? native.stream(request).pipe(Stream.mapError(() => unavailable())) : native.stream(request),
    ))),
    generate: (request) => verify(request.model).pipe(
      Effect.andThen(issued.has(request.model)
        ? native.generate(request).pipe(Effect.mapError(() => unavailable())) : native.generate(request)),
      Effect.tap(() => verify(request.model))),
  })
})).pipe(Layer.provide(LLMClient.layer))

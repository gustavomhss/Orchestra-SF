import { expect, test } from "bun:test"
import path from "node:path"
import { Effect, Exit, Layer, Schema, Stream } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { LLM, LLMClient, Model } from "@orchestra/llm"
import { OpenAICompatibleChat } from "@orchestra/llm/protocols/openai-compatible-chat"
import { Auth, RequestExecutor } from "@orchestra/llm/route"
import { ClaudeCodeHost } from "../../../modules/engine-adapters/claude-code/src/v2/host"
import { createSfTokenGate } from "../../../apps/cli/src/sucafina-product/token-gate"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { SessionAccess } from "@orchestra/schema/session-access"
import { Catalog } from "../src/catalog"
import { LayerNodePlatform } from "../src/effect/app-node-platform"
import { AppNodeBuilder } from "../src/effect/app-node-builder"
import { LayerNode } from "../src/effect/layer-node"
import { Database } from "../src/database/database"
import { LocationServiceMap } from "../src/location-service-map"
import { ModelV2 } from "../src/model"
import { SessionV2 } from "../src/session"
import { SessionOwner } from "../src/session/owner"
import { SessionExecution } from "../src/session/execution"
import { SessionRunnerModel } from "../src/session/runner/model"
import { createTeamProfileHttp } from "../../../modules/sucafina/Sucafinav1/runtime/team-profile-http"
import { productGrant } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/product-fixture"
import type { SfProductGrant } from "../../../modules/sucafina/Sucafinav1/product/integration/product-authority"
import { teamSessionFixture, profileA, profileB, oid, other } from "./fixture/team-session"

const secret = "synthetic-personal-provider-key"
const key = Schema.decodeUnknownSync(ConnectionAccess.PersonalKey)({
  category: "integration", resourceId: "approved-provider", id: "primary",
})
const selected = Schema.decodeUnknownSync(ModelV2.Ref)({ providerID: "approved-provider", id: "approved-model" })
const data = (text: string, finish = false) => "data: " + JSON.stringify({
  id: "fixture-turn", choices: [{ index: 0, delta: { content: text }, finish_reason: finish ? "stop" : null }],
}) + "\n\n" + (finish ? "data: [DONE]\n\n" : "")

/** Real HTTPS and native OpenAI protocol. SessionExecution itself remains the fixture's explicitly recording-only service. */
async function fixture(options: { bindings?: boolean; key?: boolean; tokenGate?: boolean } = {}) {
  const certificate = await Bun.file(new URL("./fixture/pinned-example-cert.pem", import.meta.url)).text()
  const tlsKey = await Bun.file(new URL("./fixture/pinned-example-key.pem", import.meta.url)).text()
  const seen: { authorization: string | null; path: string; body: unknown }[] = []
  const cancelled = Promise.withResolvers<void>()
  const hooks: { mode: "ok" | "rate" | "redirect" | "held"; release?: () => void } = { mode: "ok" }
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, tls: { cert: certificate, key: tlsKey },
    async fetch(request) {
      seen.push({ authorization: request.headers.get("authorization"), path: new URL(request.url).pathname,
        body: await request.json() })
      if (hooks.mode === "rate") return Response.json({ error: { message: secret } }, { status: 429 })
      if (hooks.mode === "redirect") return new Response("", { status: 307,
        headers: { location: new URL(request.url).origin + "/must-not-follow" } })
      if (hooks.mode === "held") {
        let open = true
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(data("first-owned-frame")))
            hooks.release = () => {
              if (!open) return
              open = false
              controller.enqueue(new TextEncoder().encode(data("late-denied-frame", true)))
              controller.close()
            }
          },
          cancel() { open = false; hooks.release = undefined; cancelled.resolve() },
        })
        return new Response(body, { headers: { "content-type": "text/event-stream" } })
      }
      return new Response(data("approved-native-response", true), { headers: { "content-type": "text/event-stream" } })
    },
  })
  const endpoint = `https://pinned.example:${server.port}/v1`
  const bindings = [profileA, profileB].map((profile) => Schema.decodeUnknownSync(ProviderAccess.Binding)({
    profile, providerId: selected.providerID, name: "Explicit private provider", protocol: "openai-chat-completions",
    endpoint, connection: key, models: [{ id: selected.id, name: "Approved model",
      limit: { context: 8192, output: 512 }, tools: false }],
  }))
  const grants: readonly SfProductGrant[] = [oid, other].map((principalRef) => ({
    ...productGrant(principalRef), sessionActions: SessionAccess.Actions, connectionActions: ConnectionAccess.Actions,
    connectionResources: [{ category: "integration", resourceId: key.resourceId }],
    providerBindings: options.bindings === false ? [] : bindings,
  }))
  // The fixture's DNS route is explicit and only accepts this one origin. TLS still verifies the pinned certificate.
  const tlsFetch = Object.assign((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    if (url.origin !== new URL(endpoint).origin) return Promise.reject(new Error("Unexpected provider fixture origin"))
    url.hostname = "127.0.0.1"
    return fetch(url, { ...init, tls: { ca: certificate, serverName: "pinned.example", rejectUnauthorized: true } })
  }, { preconnect: fetch.preconnect })
  const gate = options.tokenGate ? createSfTokenGate({
    upstream: ClaudeCodeHost.node,
    // This negative takes the no-SF-header branch. Unexpected lineage reads fail closed.
    isSfOwned: () => Effect.die("The unclassified native model must not request SF lineage"),
  }) : undefined
  const f = await teamSessionFixture({
    grants, extraNodes: [LayerNodePlatform.llmClient, LayerNodePlatform.requestExecutor, LocationServiceMap.node, SessionExecution.node],
    replacements: [[LayerNodePlatform.httpClient,
      FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, tlsFetch)))],
      ...gate?.contribution.replacements ?? []],
  }).catch(async (error) => { await server.stop(true); throw error })
  try {
    const admin = createTeamProfileHttp({ ...f.binding, resolver: f.resolver })
    for (const profile of [profileA, profileB]) {
      const query = new URLSearchParams({ contractRevision: "sf-team-profile/1",
        installationId: f.binding.installationId, tenantId: f.binding.tenantId })
      const request = f.request("/api/ui/team-profiles/configuration?" + query, f.cookie, {
        method: "POST", headers: { origin: f.binding.origin, "content-type": "application/json" },
        body: JSON.stringify({ profile, expectedRevision: (await f.profiles.read()).configRevision,
          document: { version: 1, settings: { model: "approved-provider/approved-model" } } }),
      })
      await f.identity.prepare(request)
      const response = await admin(request)
      if (!response || response.status !== 200) throw new Error("Actual private configuration admission required")
    }
  } catch (error) {
    await f[Symbol.asyncDispose]()
    await server.stop(true)
    throw error
  }
  const seed = (id: string) => Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const vault = yield* owners.connections(yield* owners.open())
    if (!vault) throw new Error("Actual private vault required")
    if (options.key !== false) yield* vault.write({
      key, label: "Personal key", action: "create", expectedRevision: 0,
      encodedValue: JSON.stringify({ type: "key", key: secret }),
    })
    const sessions = yield* SessionV2.Service
    return yield* sessions.create({ id: SessionV2.ID.make(id), location: f.location, model: selected })
  })
  return { ...f, endpoint, grants, bindings, seen, hooks, seed, tlsFetch, cancelled: cancelled.promise,
    async [Symbol.asyncDispose]() {
      hooks.release?.()
      await f[Symbol.asyncDispose]()
      await server.stop(true)
    },
  }
}

test("private-provider-01: actual Microsoft Owner and native Session model/client send one personal credential to the declared HTTPS provider", async () => {
  await using f = await fixture()
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const session = yield* f.seed("ses_private_provider_positive")
    const llm = yield* LLMClient.Service
    yield* Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const available = yield* catalog.model.available()
      expect(available.map((model) => String(model.id))).toEqual(["approved-model"])
      expect(JSON.stringify(available)).not.toContain(f.endpoint)
      expect(JSON.stringify(available)).not.toContain(secret)
      const resolver = yield* SessionRunnerModel.Service
      const model = yield* resolver.resolve(session)
      const result = yield* llm.stream(LLM.request({ model, prompt: "Approved native request" })).pipe(Stream.runCollect)
      expect(result.filter((event) => event.type === "text-delta").map((event) => event.text).join(""))
        .toBe("approved-native-response")
    }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
  })))
  expect(f.seen).toHaveLength(1)
  expect(f.seen[0].path).toBe("/v1/chat/completions")
  expect(f.seen[0].authorization).toBe("Bearer " + secret)
  expect(JSON.stringify(f.seen[0].body)).not.toContain(secret)
  expect(f.seen[0].body).toMatchObject({ model: "approved-model", max_tokens: 512, stream: true })
}, 30000)

test("private-provider-02: shared configuration, an environment key and an inline native route cannot replace a missing private binding", async () => {
  await using f = await fixture({ bindings: false })
  const before = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "synthetic-environment-key"
  try {
    await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const session = yield* f.seed("ses_private_provider_unbound")
      const llm = yield* LLMClient.Service
      const forged = OpenAICompatibleChat.route.with({ provider: "approved-provider",
        endpoint: { baseURL: f.endpoint }, auth: Auth.bearer(Auth.value("synthetic-inline-key")) }).model({ id: selected.id })
      expect(Exit.isFailure(yield* llm.stream(LLM.request({ model: forged, prompt: "Must not send" })).pipe(Stream.runCollect, Effect.exit))).toBe(true)
      yield* Effect.gen(function* () {
        const resolver = yield* SessionRunnerModel.Service
        expect(Exit.isFailure(yield* resolver.resolve(session).pipe(Effect.exit))).toBe(true)
        const catalog = yield* Catalog.Service
        expect(yield* catalog.model.available()).toEqual([])
      }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
    })))
    expect(f.seen).toHaveLength(0)
  } finally {
    if (before === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = before
  }
}, 30000)

test("private-provider-03: missing personal key denies the real resolver even when policy and shared model selection exist", async () => {
  await using f = await fixture({ key: false })
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const catalog = yield* owners.providerCatalog(yield* owners.open())
    expect(catalog.providers.map((value) => value.connection)).toEqual([key])
    expect(JSON.stringify(catalog)).not.toContain(f.endpoint)
    expect(JSON.stringify(catalog)).not.toContain(secret)
    const session = yield* f.seed("ses_private_provider_no_key")
    yield* Effect.gen(function* () {
      const resolver = yield* SessionRunnerModel.Service
      expect(Exit.isFailure(yield* resolver.resolve(session).pipe(Effect.exit))).toBe(true)
    }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
  })))
  expect(f.seen).toHaveLength(0)
}, 30000)

test("private-provider-04: copied models and a different current Team lease cannot use a still-valid private native model", async () => {
  await using f = await fixture()
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const session = yield* f.seed("ses_private_provider_borrowed")
    const llm = yield* LLMClient.Service
    const model = yield* Effect.gen(function* () {
      const resolver = yield* SessionRunnerModel.Service
      return yield* resolver.resolve(session)
    }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
    const clone = Model.make(Model.input(model))
    expect(Exit.isFailure(yield* llm.stream(LLM.request({ model: clone, prompt: "No clone" })).pipe(Stream.runCollect, Effect.exit))).toBe(true)
    const sameOwnerLease = yield* f.capture(f.businessRequest())
    expect(Exit.isFailure(yield* SessionOwner.withLease(sameOwnerLease,
      llm.stream(LLM.request({ model, prompt: "No borrowed request" })).pipe(Stream.runCollect, Effect.exit)))).toBe(true)
    const otherLease = yield* f.capture(f.businessRequest(profileB))
    expect(Exit.isFailure(yield* SessionOwner.withLease(otherLease,
      llm.stream(LLM.request({ model, prompt: "No borrowed lease" })).pipe(Stream.runCollect, Effect.exit)))).toBe(true)
    expect(f.seen).toHaveLength(0)
    yield* llm.stream(LLM.request({ model, prompt: "Original admitted lease" })).pipe(Stream.runCollect)
    expect(f.seen).toHaveLength(1)
  })))
}, 30000)

for (const mode of ["rate", "redirect"] as const) {
  test("private-provider-05: " + mode + " has one attempt, no redirect and no credential in errors", async () => {
    await using f = await fixture()
    f.hooks.mode = mode
    await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const session = yield* f.seed("ses_private_provider_" + mode)
      const llm = yield* LLMClient.Service
      const model = yield* Effect.gen(function* () {
        const resolver = yield* SessionRunnerModel.Service
        return yield* resolver.resolve(session)
      }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
      const result = yield* llm.stream(LLM.request({ model, prompt: "One uncertain effect" })).pipe(Stream.runCollect, Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
      expect(JSON.stringify(result)).not.toContain(secret)
      expect(f.seen).toHaveLength(1)
    })))
  }, 30000)
}

test("private-provider-06: request overlays cannot retarget the private endpoint, authentication, body or output budget", async () => {
  await using f = await fixture()
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const session = yield* f.seed("ses_private_provider_overlays")
    const llm = yield* LLMClient.Service
    const model = yield* Effect.gen(function* () {
      const resolver = yield* SessionRunnerModel.Service
      return yield* resolver.resolve(session)
    }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
    const requests = [
      LLM.request({ model, prompt: "No query", http: { query: { api_key: "NO" } } }),
      LLM.request({ model, prompt: "No header", http: { headers: { authorization: "Bearer NO" } } }),
      LLM.request({ model, prompt: "No extension", http: { body: { apiKey: "NO" } } }),
      LLM.request({ model, prompt: "No unlimited output", generation: { maxTokens: 513 } }),
    ]
    for (const request of requests)
      expect(Exit.isFailure(yield* llm.stream(request).pipe(Stream.runCollect, Effect.exit))).toBe(true)
    expect(f.seen).toHaveLength(0)
  })))
}, 30000)

for (const revocation of ["provider", "key", "resource", "generation"] as const) {
  test("private-provider-07: " + revocation + " revocation between actual HTTPS frames prevents late egress", async () => {
    await using f = await fixture()
    f.hooks.mode = "held"
    await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const session = yield* f.seed("ses_private_provider_revoke_" + revocation)
      const resource = yield* Effect.promise(() => f.linkCaseResource(session.id))
      const llm = yield* LLMClient.Service
      const model = yield* Effect.gen(function* () {
        const resolver = yield* SessionRunnerModel.Service
        return yield* resolver.resolve(session)
      }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
      const pull = yield* Stream.toPull(llm.stream(LLM.request({ model, prompt: "Bound stream" })))
      let received = ""
      while (!received.includes("first-owned-frame")) {
        const values = yield* pull
        received += values.filter((event) => event.type === "text-delta").map((event) => event.text).join("")
      }
      if (revocation === "provider")
        yield* Effect.promise(() => f.writeGrants(f.grants.map((grant) => ({ ...grant, providerBindings: [] }))))
      if (revocation === "resource") yield* Effect.promise(() => resource.participants([]))
      if (revocation === "generation") yield* Effect.sync(f.advance)
      if (revocation === "key") {
        const owners = yield* SessionOwner.Service
        const vault = yield* owners.connections(yield* owners.open())
        if (!vault) throw new Error("Actual vault required")
        yield* vault.write({ key, label: "Rotated", expectedRevision: 1, action: "update",
          encodedValue: JSON.stringify({ type: "key", key: "new-synthetic-key" }) })
      }
      if (!f.hooks.release) throw new Error("Actual provider frame boundary required")
      f.hooks.release()
      f.hooks.release = undefined
      const late = yield* pull.pipe(Effect.exit)
      expect(Exit.isFailure(late)).toBe(true)
      expect(received).not.toContain("late-denied-frame")
      expect(f.seen).toHaveLength(1)
    })))
  }, 30000)
}

test("private-provider-08: closing the native stream aborts its real HTTPS response without a second attempt", async () => {
  await using f = await fixture()
  f.hooks.mode = "held"
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const session = yield* f.seed("ses_private_provider_cancel")
    const llm = yield* LLMClient.Service
    const model = yield* Effect.gen(function* () {
      const resolver = yield* SessionRunnerModel.Service
      return yield* resolver.resolve(session)
    }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
    yield* Effect.scoped(Effect.gen(function* () {
      const pull = yield* Stream.toPull(llm.stream(LLM.request({ model, prompt: "Close after first frame" })))
      let received = ""
      while (!received.includes("first-owned-frame")) {
        const values = yield* pull
        received += values.filter((event) => event.type === "text-delta").map((event) => event.text).join("")
      }
      expect(received).toContain("first-owned-frame")
    }))
    yield* Effect.promise(() => f.cancelled).pipe(Effect.timeout(1000))
    expect(f.seen).toHaveLength(1)
    expect(f.hooks.release).toBeUndefined()
  })))
}, 30000)

test("private-provider-09: direct Route preparation cannot replace the canonical model/body/budget or mutate a retained request", async () => {
  await using f = await fixture()
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const session = yield* f.seed("ses_private_provider_route")
    const executor = yield* RequestExecutor.Service
    const model = yield* Effect.gen(function* () {
      const resolver = yield* SessionRunnerModel.Service
      return yield* resolver.resolve(session)
    }).pipe(Effect.provide(LocationServiceMap.Service.get(f.location)))
    const route: typeof OpenAICompatibleChat.route = model.route
    const request = LLM.request({ model, prompt: "Only this body", generation: { maxTokens: 512 } })
    const body = yield* OpenAICompatibleChat.route.body.from(request)
    for (const substituted of [
      { ...body, model: "another-model" },
      { ...body, max_tokens: 513 },
      { ...body, messages: [{ role: "user" as const, content: "A substituted request" }] },
    ]) {
      const result = yield* route.prepareTransport(substituted, request).pipe(Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
    }
    const prepared = yield* route.prepareTransport(body, request)
    const otherRequest = LLM.request({ model, prompt: "Only this body", generation: { maxTokens: 512 } })
    expect(Exit.isFailure(yield* route.streamPrepared(prepared, otherRequest, { http: executor }).pipe(
      Stream.runCollect, Effect.exit,
    ))).toBe(true)
    if (prepared.request.body._tag !== "Uint8Array") throw new Error("Actual native HTTP body required")
    prepared.request.body.body[0] = 0
    expect(Exit.isFailure(yield* route.streamPrepared(prepared, request, { http: executor }).pipe(
      Stream.runCollect, Effect.exit,
    ))).toBe(true)
    expect(f.seen).toHaveLength(0)
  })))
}, 30000)

test("private-provider-10: the installed C15 token-gate replacement cannot send an inline model without an SF header through its other branch", async () => {
  await using f = await fixture({ tokenGate: true })
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    yield* f.seed("ses_private_provider_gate")
    const llm = yield* LLMClient.Service
    const forged = OpenAICompatibleChat.route.with({
      provider: "approved-provider", endpoint: { baseURL: f.endpoint },
      auth: Auth.bearer(Auth.value("synthetic-inline-must-not-dispatch")),
    }).model({ id: selected.id })
    const request = LLM.request({ model: forged, prompt: "No SF header is no bypass" })
    expect(request.http?.headers).toBeUndefined()
    const result = yield* llm.stream(request).pipe(Stream.runCollect, Effect.exit)
    expect(Exit.isFailure(result)).toBe(true)
    expect(f.seen).toHaveLength(0)
  })))
}, 30000)

test("private-provider-11: the same C15 client keeps explicit native HTTPS calls on an observed technical database", async () => {
  await using f = await fixture()
  const gate = createSfTokenGate({ upstream: ClaudeCodeHost.node,
    isSfOwned: () => Effect.die("The technical unclassified model must not request SF lineage") })
  // This is a separate technical database, not another graph over the corporate store.
  const layer = AppNodeBuilder.build(LayerNode.group([LayerNodePlatform.llmClient, SessionOwner.node]), [
    [Database.node, Database.layerFromPath(path.join(f.directory, "technical-provider.sqlite"))],
    [LayerNodePlatform.httpClient, FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, f.tlsFetch)))],
    ...gate.contribution.replacements ?? [],
  ])
  await Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const scope = yield* owners.open()
    expect(owners.owner(scope)).toBeUndefined()
    expect(owners.generation(scope)).toBeUndefined()
    const llm = yield* LLMClient.Service
    const model = OpenAICompatibleChat.route.with({
      provider: "explicit-technical-provider", endpoint: { baseURL: f.endpoint },
      auth: Auth.bearer(Auth.value("synthetic-technical-key")),
    }).model({ id: "technical-model" })
    const events = yield* llm.stream(LLM.request({ model, prompt: "Explicit technical request" })).pipe(Stream.runCollect)
    expect(events.filter((event) => event.type === "text-delta").map((event) => event.text).join(""))
      .toBe("approved-native-response")
  }).pipe(Effect.provide(layer), Effect.scoped, Effect.runPromise)
  expect(f.seen).toHaveLength(1)
  expect(f.seen[0].authorization).toBe("Bearer synthetic-technical-key")
}, 30000)

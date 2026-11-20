import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Schema, Stream } from "effect"
import { FetchHttpClient, HttpClient, HttpClientError } from "effect/unstable/http"
import { compile, compileImported, emitEffect, emitEffectImported, emitPromise } from "@orchestra/httpapi-codegen"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Api, Frame, Namespace, ResponseBody } from "./team-profile-codegen.fixture"

const namespace = Schema.decodeUnknownSync(Namespace)({
  version: 1,
  owner: {
    profile: { installationId: "codegen-installation", tenantId: "11111111-1111-4111-8111-111111111111", teamObjectId: "22222222-2222-4222-8222-222222222222" },
    principal: { tenantId: "11111111-1111-4111-8111-111111111111", principalObjectId: "33333333-3333-4333-8333-333333333333" },
  },
  authorityGeneration: 1,
})
const mismatch: TeamProfile.SessionNamespace = {
  ...namespace,
  owner: { ...namespace.owner, principal: { ...namespace.owner.principal, tenantId: TeamProfile.TenantId.make("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") } },
}
const source = { module: "../team-profile-codegen.fixture", api: "Api" }
type ClientError = { readonly _tag: "ClientError"; readonly cause: unknown }
type Client = {
  readonly probe: {
    readonly read: () => Effect.Effect<typeof ResponseBody.Type, ClientError>
    readonly write: (input: { readonly namespace: TeamProfile.SessionNamespace }) => Effect.Effect<boolean, ClientError>
    readonly events: () => Stream.Stream<typeof Frame.Type, ClientError>
  }
}

function decodeFailure(error: ClientError) {
  expect(error._tag).toBe("ClientError")
  expect(Schema.isSchemaError(error.cause) ||
    (HttpClientError.isHttpClientError(error.cause) && error.cause.reason._tag === "DecodeError")).toBe(true)
}

test("the generated imported client executes the canonical Owner refinement on responses and before input dispatch", async () => {
  expect(() => compile(Api)).toThrow("Unportable schema: probe.read.success")
  const contract = compileImported(Api, source)
  expect(() => emitEffect(contract)).toThrow("Effect schema requires its bound authoritative API import")
  expect(emitPromise(contract).operations).toEqual(emitEffectImported(contract, source).operations)
  await withClient((client, state) => Effect.gen(function* () {
    expect(yield* client.probe.read()).toEqual({ namespace, data: [] })
    expect(yield* client.probe.write({ namespace })).toBe(true)
    const before = state.requests.length
    decodeFailure(yield* client.probe.write({ namespace: mismatch }).pipe(Effect.flip))
    expect(state.requests).toHaveLength(before)
    for (const invalid of [
      mismatch,
      { ...namespace, authorityGeneration: 0 },
      { ...namespace, owner: { ...namespace.owner, profile: { tenantId: namespace.owner.profile.tenantId } } },
      { ...namespace, unexpected: "not accepted" },
    ]) {
      state.namespace = invalid
      decodeFailure(yield* client.probe.read().pipe(Effect.flip))
    }
    expect(state.requests).toHaveLength(before + 4)
  }))
})

test("the generated imported SSE client validates the canonical namespace before exposing any payload", async () => {
  await withClient((client, state) => Effect.gen(function* () {
    expect(yield* client.probe.events().pipe(Stream.take(1), Stream.runCollect)).toEqual([{ namespace, event: { type: "probe" } }])
    const exposed: unknown[] = []
    state.namespace = mismatch
    const failure = yield* client.probe.events().pipe(
      Stream.tap((frame) => Effect.sync(() => { exposed.push(frame) })),
      Stream.runCollect,
      Effect.flip,
    )
    decodeFailure(failure)
    expect(exposed).toEqual([])
    expect(state.requests).toEqual(["/event", "/event"])
  }))
})

async function withClient<E>(
  run: (client: Client, state: { namespace: unknown; requests: string[] }) => Effect.Effect<void, E>,
) {
  const directory = await mkdtemp(join(fileURLToPath(new URL(".", import.meta.url)), ".team-profile-codegen-"))
  const state: { namespace: unknown; requests: string[] } = { namespace, requests: [] }
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname
      state.requests.push(path)
      if (path === "/event") return new Response("data: " + JSON.stringify({ namespace: state.namespace, event: { type: "probe" } }) + "\n\n", {
        headers: { "content-type": "text/event-stream" },
      })
      if (path === "/write") return Response.json(true)
      return Response.json({ namespace: state.namespace, data: [] })
    },
  })
  try {
    const output = emitEffectImported(compileImported(Api, source), source)
    await Promise.all(output.files.map((file) => Bun.write(join(directory, file.path), file.content)))
    const generated: { make: (options: { baseUrl: URL }) => Effect.Effect<Client, never, HttpClient.HttpClient> } =
      await import(join(directory, "client.ts"))
    await Effect.runPromise(Effect.gen(function* () {
      const client = yield* generated.make({ baseUrl: server.url })
      yield* run(client, state)
    }).pipe(Effect.provide(FetchHttpClient.layer)))
  } finally {
    server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}

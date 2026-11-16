/**
 * F02 contract regressions. Author-owned source tests; they are NOT CI proof.
 * Only 120 dispatches the installed Actions selection once I00 has composed
 * the real registry/codecs and F01 context types on a material C.
 */
import { expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { mountSfNativeProjections } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import { createSfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"
import type { SfDesktopCapability } from "../../../../../packages/client/src/sucafina/transport.ts"
import type { SfInstallationDescriptor } from "../../../../../packages/schema/src/sucafina/context.ts"

const installation: SfInstallationDescriptor = {
  installationId: "installation-synthetic-a",
  projectId: "project-synthetic-a",
  hostId: "host-synthetic-current",
  publicOrigin: "https://sf.example.test",
  mount: "/sucafina",
  authMode: "microsoft",
  contractRevision: "sf-native-ui/1",
}
const contextOperation = {
  operationId: "ctx.context",
  input: Schema.Struct({
    installationId: Schema.String,
    projectId: Schema.String,
    hostId: Schema.String,
  }),
  output: Schema.Struct({ status: Schema.Literal("denied") }),
} as const

function forbiddenDesktop(onInvoke: () => void): SfDesktopCapability {
  return {
    registerConnection: async () => ({ status: "cancelled" }),
    bind: async () => ({ status: "denied" }),
    async invoke() { onInvoke(); throw new Error("desktop request must not be invoked") },
    abort: async () => {},
    login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }),
    release: async () => {},
  }
}

test("no real codec: known context ID does not imply an admitted producer", async () => {
  let invoked = 0
  const transport = createSfTransport({
    binding: installation,
    generation: 1,
    currentGeneration: () => 1,
    fetch: Object.assign(async () => { throw new Error("browser must not be used under desktop binding") }, { preconnect: fetch.preconnect }),
    operations: {},
    desktop: forbiddenDesktop(() => invoked++),
    desktopBinding: { descriptor: installation, bindingHandle: "opaque-main-owned-handle", generation: 1 },
  })
  const result = await transport.execute(contextOperation, {
    installationId: installation.installationId,
    projectId: installation.projectId,
    hostId: installation.hostId,
  }, { signal: new AbortController().signal })
  expect(result).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
  expect(invoked).toBe(0)
})

test("stale owner generation blocks before any IPC or network", async () => {
  let invoked = 0
  const transport = createSfTransport({
    binding: installation,
    generation: 2,
    currentGeneration: () => 3,
    fetch: Object.assign(async () => { throw new Error("must not fetch") }, { preconnect: fetch.preconnect }),
    operations: {},
    desktop: forbiddenDesktop(() => invoked++),
    desktopBinding: { descriptor: installation, bindingHandle: "opaque-main-owned-handle", generation: 2 },
  })
  const result = await transport.execute(contextOperation, {
    installationId: installation.installationId,
    projectId: installation.projectId,
    hostId: installation.hostId,
  }, { signal: new AbortController().signal })
  expect(result).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(invoked).toBe(0)
})

test("desktop descriptor change is not resolved by selection from another project", async () => {
  let invoked = 0
  const transport = createSfTransport({
    binding: installation,
    generation: 3,
    currentGeneration: () => 3,
    fetch: Object.assign(async () => { throw new Error("must not fetch") }, { preconnect: fetch.preconnect }),
    operations: {},
    desktop: forbiddenDesktop(() => invoked++),
    desktopBinding: {
      descriptor: { ...installation, projectId: "project-synthetic-b" },
      bindingHandle: "opaque-main-owned-handle",
      generation: 3,
    },
  })
  const result = await transport.execute(contextOperation, {
    installationId: installation.installationId,
    projectId: installation.projectId,
    hostId: installation.hostId,
  }, { signal: new AbortController().signal })
  expect(result).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(invoked).toBe(0)
})

test("aborted signal does not enter the producer", async () => {
  let invoked = 0
  const controller = new AbortController()
  controller.abort()
  const transport = createSfTransport({
    binding: installation,
    generation: 4,
    currentGeneration: () => 4,
    fetch: Object.assign(async () => { throw new Error("must not fetch") }, { preconnect: fetch.preconnect }),
    operations: {},
    desktop: forbiddenDesktop(() => invoked++),
    desktopBinding: { descriptor: installation, bindingHandle: "opaque-main-owned-handle", generation: 4 },
  })
  const result = await transport.execute(contextOperation, {
    installationId: installation.installationId,
    projectId: installation.projectId,
    hostId: installation.hostId,
  }, { signal: controller.signal })
  expect(result).toEqual({ kind: "transport-error", reason: "aborted" })
  expect(invoked).toBe(0)
})

test("ctx.context refuses a denied payload with a success HTTP status", async () => {
  const transport = createSfTransport({
    binding: installation,
    generation: 5,
    currentGeneration: () => 5,
    fetch: Object.assign(async () => { throw new Error("web request forbidden in desktop test") }, { preconnect: fetch.preconnect }),
    operations: {
      "ctx.context": {
        decodeInput: (value) => {
          const parsed = Schema.decodeUnknownOption(contextOperation.input)(value)
          return Option.isNone(parsed) ? { status: "invalid" } : { status: "ok", value: parsed.value }
        },
        decodeOutput: (value) => {
          const parsed = Schema.decodeUnknownOption(contextOperation.output)(value)
          return Option.isNone(parsed) ? { status: "invalid" } : { status: "ok", value: parsed.value }
        },
      },
    },
    desktop: {
      ...forbiddenDesktop(() => {}),
      invoke: async () => ({ kind: "json-response", status: 200, headers: { "content-type": "application/json" }, body: { status: "denied" } }),
    },
    desktopBinding: { descriptor: installation, bindingHandle: "opaque-main-owned-handle", generation: 5 },
  })
  expect(await transport.execute(contextOperation, {
    installationId: installation.installationId,
    projectId: installation.projectId,
    hostId: installation.hostId,
  }, { signal: new AbortController().signal })).toEqual({ kind: "transport-error", reason: "invalid-response" })
})

test("lost mutation outcome cannot dispatch again with the same key", async () => {
  const contextSuccess = {
    status: "ok" as const,
    value: {
      stamp: {
        installationId: installation.installationId, projectId: installation.projectId,
        hostId: installation.hostId, principalRef: "synthetic-current-principal",
        policyVersion: "synthetic-policy-v1", accessRevision: "synthetic-access-v1",
      },
      contractRevision: "sf-native-ui/1" as const,
      authMode: "microsoft" as const,
      destinations: [],
      availability: [],
    },
  }
  const contextSuccessSchema = Schema.Struct({
    status: Schema.Literal("ok"),
    value: Schema.Struct({
      stamp: Schema.Struct({
        installationId: Schema.String, projectId: Schema.String, hostId: Schema.String,
        principalRef: Schema.String, policyVersion: Schema.String, accessRevision: Schema.String,
      }),
      contractRevision: Schema.Literal("sf-native-ui/1"),
      authMode: Schema.Literal("microsoft"),
      destinations: Schema.Array(Schema.Never),
      availability: Schema.Array(Schema.Never),
    }),
  })
  const successContextOperation = { ...contextOperation, output: contextSuccessSchema }
  const command = {
    operationId: "domain.command.CAP01.save-users" as const,
    input: Schema.Struct({ payload: Schema.String }),
    output: Schema.Struct({ ok: Schema.Boolean }),
  }
  let writes = 0
  const transport = createSfTransport({
    binding: installation,
    generation: 6,
    currentGeneration: () => 6,
    fetch: Object.assign(async () => { throw new Error("web request forbidden in desktop test") }, { preconnect: fetch.preconnect }),
    operations: {
      "ctx.context": {
        decodeInput(value) {
          const parsed = Schema.decodeUnknownOption(successContextOperation.input)(value)
          return Option.isNone(parsed) ? { status: "invalid" } : { status: "ok", value: parsed.value }
        },
        decodeOutput(value) {
          const parsed = Schema.decodeUnknownOption(contextSuccessSchema)(value)
          return Option.isNone(parsed) ? { status: "invalid" } : { status: "ok", value: parsed.value }
        },
      },
      "domain.command.CAP01.save-users": {
        decodeInput(value) {
          const parsed = Schema.decodeUnknownOption(command.input)(value)
          return Option.isNone(parsed) ? { status: "invalid" } : { status: "ok", value: parsed.value }
        },
        decodeOutput(value) {
          const parsed = Schema.decodeUnknownOption(command.output)(value)
          return Option.isNone(parsed) ? { status: "invalid" } : { status: "ok", value: parsed.value }
        },
      },
    },
    desktop: {
      ...forbiddenDesktop(() => {}),
      async invoke(request) {
        if (request.kind === "request" && request.operationId === "ctx.context") {
          return { kind: "json-response", status: 200, headers: { "content-type": "application/json" }, body: contextSuccess }
        }
        writes++
        throw new Error("network lost after dispatch")
      },
    },
    desktopBinding: { descriptor: installation, bindingHandle: "opaque-main-owned-handle", generation: 6 },
  })
  const context = await transport.execute(successContextOperation, {
    installationId: installation.installationId, projectId: installation.projectId, hostId: installation.hostId,
  }, { signal: new AbortController().signal })
  expect(context.kind).toBe("response")
  const call = { signal: new AbortController().signal, idempotencyKey: "synthetic-key-00001" }
  expect(await transport.execute(command, { payload: "first" }, call)).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
  expect(await transport.execute(command, { payload: "first" }, call)).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
  expect(await transport.execute(command, { payload: "different" }, call)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(writes).toBe(1)
})

test("the projection router retains original Request identity and rejects duplicate query keys", async () => {
  let received: Request | undefined
  const route = mountSfNativeProjections({
    mount: "/sucafina",
    context: {
      readContext: async () => ({ status: "denied" }),
      handle: async (request) => {
        received = request
        return Response.json({ status: "denied" }, { status: 403 })
      },
    },
    handlers: [],
  })
  const request = new Request("https://sf.example.test/sucafina/api/ui/context?installationId=a&projectId=b&hostId=c")
  expect((await route(request))?.status).toBe(403)
  expect(received).toBe(request)
  const repeated = new Request("https://sf.example.test/sucafina/api/ui/context?installationId=a&installationId=b&projectId=b&hostId=c")
  expect((await route(repeated))?.status).toBe(400)
  expect(received).toBe(request)
})

test("projection POST enforces the catalog byte cap before invoking the original handler", async () => {
  let called = 0
  let received: Request | undefined
  const route = mountSfNativeProjections({
    mount: "/sucafina",
    context: {
      readContext: async () => ({ status: "denied" }),
      handle: async () => Response.json({ status: "denied" }, { status: 403 }),
    },
    handlers: [{
      operationId: "routines.catalog",
      handle: async (request) => {
        called++
        received = request
        return Response.json({ status: "ok" })
      },
    }],
  })
  const url = "https://sf.example.test/sucafina/api/ui/routines/catalog"

  const oversized = new Request(url, { method: "POST", headers: { "content-length": "65537" } })
  expect((await route(oversized))?.status).toBe(413)
  expect(called).toBe(0)

  const malformed = new Request(url, { method: "POST", headers: { "content-length": "0001" } })
  expect((await route(malformed))?.status).toBe(400)
  expect(called).toBe(0)

  const atLimit = new Request(url, { method: "POST", headers: { "content-length": "65536" } })
  expect((await route(atLimit))?.status).toBe(200)
  expect(called).toBe(1)
  expect(received).toBe(atLimit)
})

test("NAV-01: search accepts bounded private POST only, preserving the original Request", async () => {
  let received: Request | undefined
  let called = 0
  const route = mountSfNativeProjections({
    mount: "/sucafina",
    context: {
      readContext: async () => ({ status: "denied" }),
      handle: async () => Response.json({ status: "denied" }, { status: 403 }),
    },
    handlers: [{
      operationId: "projection.search",
      handle: async (request) => {
        called++
        received = request
        return Response.json({ status: "ok" })
      },
    }],
  })
  const url = "https://sf.example.test/sucafina/api/ui/projections/search"
  const privateBody = JSON.stringify({ q: "sensitive search text" })
  const request = new Request(url, {
    method: "POST", headers: { "content-type": "application/json" }, body: privateBody,
  })
  expect((await route(request))?.status).toBe(200)
  expect(received).toBe(request)
  expect(called).toBe(1)
  expect(new URL(request.url).search).toBe("")
  // The router has not consumed or cloned the Request. The producer owns the body.
  expect(await request.text()).toBe(privateBody)

  const legacyGet = new Request(url + "?q=sensitive")
  expect((await route(legacyGet))?.status).toBe(405)
  const leakedQuery = new Request(url + "?q=sensitive", { method: "POST", body: privateBody })
  expect((await route(leakedQuery))?.status).toBe(400)
  const oversized = new Request(url, {
    method: "POST", headers: { "content-length": "4097" }, body: privateBody,
  })
  expect((await route(oversized))?.status).toBe(413)
  const malformed = new Request(url, {
    method: "POST", headers: { "content-length": "0001" }, body: privateBody,
  })
  expect((await route(malformed))?.status).toBe(400)
  expect(called).toBe(1)
  expect(received).toBe(request)
})

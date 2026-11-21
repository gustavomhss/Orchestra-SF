import { expect, test } from "bun:test"
import { SfNativeOperationBindings } from "../../../src/sucafina/bindings"
import { createSfContextClient } from "../../../src/sucafina/context"
import { createSfFilesClient } from "../../../src/sucafina/files"
import { createSfTransport, type SfDesktopCapability, type SfDesktopInvocation } from "../../../src/sucafina/transport"

test("members export uses the installed byte codec and bounded desktop chunks", async () => {
  const descriptor = {
    installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
  }
  const stamp = { installationId: descriptor.installationId, projectId: descriptor.projectId,
    hostId: descriptor.hostId, principalRef: "principal", policyVersion: "policy", accessRevision: "revision" }
  const calls: SfDesktopInvocation[] = []
  const desktop: SfDesktopCapability = {
    registerConnection: async () => ({ status: "cancelled" }),
    bind: async () => ({ status: "denied" }),
    abort: async () => {},
    login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }),
    release: async () => {},
    invoke: async (request) => {
      calls.push(request)
      if (request.kind === "response-chunk") return request.sequence === 0
        ? { kind: "byte-chunk", sequence: 0, bytes: new Uint8Array([80, 75, 3, 4]), done: false }
        : { kind: "byte-chunk", sequence: 1, bytes: new Uint8Array(), done: true }
      if (request.operationId === "ctx.context") return {
        kind: "json-response", status: 200, headers: { "content-type": "application/json" },
        body: { status: "ok", value: { stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
          destinations: [], availability: [] } },
      }
      return { kind: "byte-response", status: 200, responseHandle: "handle", headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } }
    },
  }
  const transport = createSfTransport({ binding: descriptor, generation: 1, currentGeneration: () => 1,
    fetch: async () => { throw new Error("desktop must not fetch in renderer") }, operations: SfNativeOperationBindings,
    desktop, desktopBinding: { bindingHandle: "binding-1", descriptor, generation: 1 },
  })
  const options = { signal: new AbortController().signal }
  const context = await createSfContextClient(transport)["ctx.context"]({
    installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
  }, options)
  expect(context.kind).toBe("response")
  const result = await createSfFilesClient(transport)["files.export.members"]({ surface: "dashboard" }, options)
  expect(result.kind).toBe("response")
  if (result.kind !== "response") throw new Error("Members bytes unavailable")
  expect(result.body).toEqual(new Uint8Array([80, 75, 3, 4]))
  expect(calls.filter((call) => call.kind === "request").map((call) => call.operationId))
    .toEqual(["ctx.context", "files.export.members"])
  expect(calls.filter((call) => call.kind === "response-chunk").map((call) => call.sequence)).toEqual([0, 1])
})

test("document actions retain their distinct mounted request bodies", async () => {
  const descriptor = { installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina", authMode: "microsoft" as const,
    contractRevision: "sf-native-ui/1" as const }
  const stamp = { installationId: "installation", projectId: "project", hostId: "host", principalRef: "person",
    policyVersion: "policy", accessRevision: "revision" }
  const ref = { schema: "sf-evidence-v1" as const, kind: "document" as const, refId: "ref",
    installationId: "installation", projectId: "project", refDigest: "digest", evidenceLevel: "claim" as const,
    target: { documentId: "doc", incarnation: "inc", revision: 1,
      blobDigest: { algorithm: "sha256" as const, value: "digest" },
      segment: { start: 0, end: 2, unit: "utf16" as const, textDigest: { algorithm: "sha256" as const, value: "digest" } },
      fieldCandidateId: "candidate", confirmationVersion: 1 } }
  const evidence = { id: "candidate", fileRef: "doc", version: 1, location: "page 1",
    textRange: { start: 0, end: 2, unit: "utf16" as const }, fieldCandidate: "amount",
    value: 42, status: "extracted" as const, ref }
  const context = { status: "ok", value: { stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
    destinations: [], availability: [{ family: "files", resource: "documents", state: "ready",
      operations: [{ operationId: "files.document-confirm", state: "ready", reason: null, operational: true }] }] } }
  const bodies: unknown[] = []
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: descriptor.publicOrigin } } })
  try {
    const transport = createSfTransport({ binding: descriptor, generation: 1, currentGeneration: () => 1,
      operations: SfNativeOperationBindings,
      fetch: async (url, init) => {
        if (init?.method === "POST") {
          expect(String(url)).toBe("https://installation.example/sucafina/dashboard?sf=document-confirm")
          bodies.push(JSON.parse(String(init.body)))
          return Response.json({ status: "ok", value: evidence })
        }
        return Response.json(context)
      },
    })
    const signal = new AbortController().signal
    expect((await createSfContextClient(transport)["ctx.context"]({
      installationId: "installation", projectId: "project", hostId: "host",
    }, { signal })).kind).toBe("response")
    const client = createSfFilesClient(transport)
    const reject = { action: "reject" as const, evidence, reason: "Incorrect value", page: 1 }
    const link = { action: "link" as const, documentRef: ref, baseRef: "base", targetRef: "target:1",
      period: { start: "2026-01-01", end: "2026-12-31" } }
    await client["files.document-confirm"]({ surface: "dashboard", evidence }, { signal, idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" })
    await client["files.document-confirm"]({ surface: "dashboard", ...reject }, { signal, idempotencyKey: "123e4567-e89b-42d3-a456-426614174001" })
    await client["files.document-confirm"]({ surface: "dashboard", ...link }, { signal, idempotencyKey: "123e4567-e89b-42d3-a456-426614174002" })
    expect(bodies).toEqual([evidence, reject, link])
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

test("a web Files download cannot adopt an access revision established during its request", async () => {
  const descriptor = { installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina", authMode: "microsoft" as const,
    contractRevision: "sf-native-ui/1" as const }
  const expectedContext = { installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId }
  const stamp = { ...expectedContext, principalRef: "owner", policyVersion: "policy", accessRevision: "initial" }
  const downloadStarted = Promise.withResolvers<void>()
  const downloadRelease = Promise.withResolvers<void>()
  const operation = { signal: new AbortController().signal }
  const contextRead = { signal: new AbortController().signal }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: descriptor.publicOrigin } } })
  try {
    const transport = createSfTransport({ binding: descriptor, generation: 1, currentGeneration: () => 1,
      operations: SfNativeOperationBindings,
      fetch: async (input, init) => {
        const url = new URL(String(input))
        if (url.searchParams.has("asset")) {
          expect(init?.signal).toBe(operation.signal)
          downloadStarted.resolve()
          await downloadRelease.promise
          return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/octet-stream" } })
        }
        expect(url.pathname).toBe("/sucafina/api/ui/context")
        expect([operation.signal, contextRead.signal]).toContain(init?.signal)
        return Response.json({ status: "ok", value: {
          stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [],
          availability: [{ family: "files", resource: "evidence", state: "ready",
            operations: [{ operationId: "files.asset.download", state: "ready", reason: null, operational: true }] }],
        } })
      },
    })
    const client = createSfContextClient(transport)
    expect((await client["ctx.context"](expectedContext, contextRead)).kind).toBe("response")
    const download = createSfFilesClient(transport)["files.asset.download"]({
      surface: "procurement", assetId: "asset", expires: 100, signature: "a".repeat(64),
    }, operation)
    await Promise.race([downloadStarted.promise, download.then(() => { throw new Error("The genuine byte route did not start") })])
    stamp.accessRevision = "changed"
    expect((await client["ctx.context"](expectedContext, contextRead)).kind).toBe("response")
    downloadRelease.resolve()
    expect((await download).kind).toBe("transport-error")
  } finally {
    downloadRelease.resolve()
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

test("a rejected Files read preserves HTTP 403 after clearing its owner stamp", async () => {
  const descriptor = { installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina", authMode: "microsoft" as const,
    contractRevision: "sf-native-ui/1" as const }
  const expectation = { installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId }
  const stamp = { ...expectation, principalRef: "owner", policyVersion: "policy", accessRevision: "revision" }
  const options = { signal: new AbortController().signal }
  const routes: string[] = []
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: descriptor.publicOrigin } } })
  try {
    const transport = createSfTransport({ binding: descriptor, generation: 1, currentGeneration: () => 1,
      operations: SfNativeOperationBindings,
      fetch: async (input) => {
        const url = new URL(String(input))
        routes.push(url.pathname + (url.searchParams.has("sf") ? "?sf=" + url.searchParams.get("sf") : ""))
        if (url.searchParams.get("sf") === "document-sources")
          return Response.json({ status: "denied" }, { status: 403 })
        return Response.json({ status: "ok", value: {
          stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [],
          availability: [{ family: "files", resource: "documents", state: "ready",
            operations: [{ operationId: "files.document-sources", state: "ready", reason: null, operational: true }] }],
        } })
      },
    })
    expect((await createSfContextClient(transport)["ctx.context"](expectation, options)).kind).toBe("response")
    const documents = createSfFilesClient(transport)
    const result = await documents["files.document-sources"]({ surface: "procurement" }, options)
    expect(result).toMatchObject({ kind: "response", status: 403, body: { status: "denied" } })
    expect((await documents["files.document-sources"]({ surface: "procurement" }, options)).kind).toBe("transport-error")
    expect(routes).toEqual(["/sucafina/api/ui/context", "/sucafina/api/ui/context", "/sucafina/procurement?sf=document-sources"])
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

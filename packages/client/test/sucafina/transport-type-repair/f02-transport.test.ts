/**
 * Mission 203: consumer-observed F02 regression tests.
 * Synthetic host responses are contract probes, never installed/native proof.
 * The CI dispatcher alone executes this suite on the integrated tree.
 */
import { expect, test } from "bun:test"
import { SfWork } from "@orchestra/schema/sucafina/work"
import type { SfContextResult, SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { SfNativeOperationBindings } from "../../../src/sucafina/bindings"
import { createSfPeopleClient } from "../../../src/sucafina/people"
import { createSfTransport, type SfDesktopCapability, type SfDesktopInvocation } from "../../../src/sucafina/transport"
import type { SfTransportResult } from "../../../src/sucafina/transport"

const installation: SfInstallationDescriptor = {
  installationId: "installation-test-203",
  projectId: "project-test-203",
  hostId: "host-test-203",
  publicOrigin: "https://sf.example.test",
  mount: "/sucafina",
  authMode: "microsoft",
  contractRevision: "sf-native-ui/1",
}

function desktopCapability(invoke: SfDesktopCapability["invoke"]): SfDesktopCapability {
  return {
    registerConnection: async () => ({ status: "cancelled" }),
    bind: async () => ({ status: "denied" }),
    invoke,
    abort: async () => {},
    login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }),
    release: async () => {},
  }
}

function desktopTransport(invoke: SfDesktopCapability["invoke"]) {
  return createSfTransport({
    binding: installation,
    generation: 203,
    currentGeneration: () => 203,
    fetch: async () => { throw new Error("desktop must not use renderer fetch") },
    operations: SfNativeOperationBindings,
    desktop: desktopCapability(invoke),
    desktopBinding: { bindingHandle: "test-main-owned-handle", descriptor: installation, generation: 203 },
  })
}

test("public Client transport result is the canonical context result union", () => {
  const result: SfTransportResult<SfContextResult> = {
    kind: "transport-error", reason: "contract-unavailable",
  }
  expect(result).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
})

test("NAV-01: private search uses only bounded same-origin POST JSON, never a q URL", async () => {
  // Only the browser origin is supplied here; the public transport still
  // constructs its own URL, method, headers, body and credentials.
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", {
    configurable: true, value: { location: { origin: installation.publicOrigin } },
  })
  const calls: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = []
  const privateText = "supplier internal compensation reference"
  try {
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ input, init })
      return Response.json({ status: "unavailable" }, { status: 503, headers: { "content-type": "application/json" } })
    }
    const transport = createSfTransport({
      binding: installation,
      generation: 203,
      currentGeneration: () => 203,
      fetch: fetcher,
      operations: SfNativeOperationBindings,
    })
    const result = await transport.execute(
      SfWork.operations["projection.search"],
      { q: privateText },
      { signal: new AbortController().signal },
    )
    expect(result).toEqual({
      kind: "response", status: 503,
      headers: { "content-type": "application/json" },
      body: { status: "unavailable" },
    })
    expect(calls).toHaveLength(1)
    const call = calls[0]
    if (!call) throw new Error("search request missing")
    const url = new URL(String(call.input))
    expect(url.href).toBe("https://sf.example.test/sucafina/api/ui/projections/search")
    expect(url.search).toBe("")
    expect(url.href).not.toContain(privateText)
    expect(url.searchParams.has("q")).toBe(false)
    expect(call.init?.method).toBe("POST")
    expect(call.init?.credentials).toBe("same-origin")
    expect(call.init?.cache).toBe("no-store")
    expect(call.init?.redirect).toBe("error")
    expect(call.init?.headers).toEqual(expect.objectContaining({
      "Content-Type": "application/json",
      Accept: "application/json",
    }))
    expect(typeof call.init?.body).toBe("string")
    if (typeof call.init?.body !== "string") throw new Error("POST JSON body missing")
    expect(JSON.parse(call.init.body)).toEqual({ q: privateText })
    expect(new TextEncoder().encode(call.init.body).byteLength).toBeLessThanOrEqual(4096)
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

test("NAV-01: UTF-8 request limit and unknown input fields deny before desktop IPC", async () => {
  const sent: SfDesktopInvocation[] = []
  const transport = desktopTransport(async (request) => {
    sent.push(request)
    return { kind: "json-response", status: 200, headers: { "content-type": "application/json" }, body: { status: "unavailable" } }
  })
  const options = { signal: new AbortController().signal }
  expect(await transport.execute(
    SfWork.operations["projection.search"], { q: "é".repeat(2100) }, options,
  )).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  const unknownField = { q: "single token", privateExtra: "no server access" }
  expect(await transport.execute(
    SfWork.operations["projection.search"], unknownField, options,
  )).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(sent).toHaveLength(0)
})

test("F02: producer unknown fields and invalid content type remain closed, not display data", async () => {
  const options = { signal: new AbortController().signal }
  const withExtra = desktopTransport(async () => ({
    kind: "json-response", status: 200, headers: { "content-type": "application/json" },
    body: { status: "unavailable", privateSource: "must not enter UI" },
  }))
  expect(await withExtra.execute(
    SfWork.operations["projection.search"], { q: "open" }, options,
  )).toEqual({ kind: "transport-error", reason: "invalid-response" })

  const withHtml = desktopTransport(async () => ({
    kind: "json-response", status: 200, headers: { "content-type": "text/html" },
    body: { status: "unavailable" },
  }))
  expect(await withHtml.execute(
    SfWork.operations["projection.search"], { q: "open" }, options,
  )).toEqual({ kind: "transport-error", reason: "invalid-response" })
})

test("F02: current abort wins over a late desktop response, with no automatic replay", async () => {
  const abort = new AbortController()
  const sent: SfDesktopInvocation[] = []
  const transport = desktopTransport(async (request) => {
    sent.push(request)
    abort.abort()
    return { kind: "json-response", status: 200, headers: { "content-type": "application/json" }, body: { status: "unavailable" } }
  })
  expect(await transport.execute(
    SfWork.operations["projection.search"], { q: "open" }, { signal: abort.signal },
  )).toEqual({ kind: "transport-error", reason: "aborted" })
  expect(sent).toHaveLength(1)
})

test("A10: an excess field is refused at the typed People facade before transport", async () => {
  const calls: SfDesktopInvocation[] = []
  const transport = desktopTransport(async (request) => {
    calls.push(request)
    return { kind: "transport-error", reason: "contract-unavailable" }
  })
  const people = createSfPeopleClient(transport)
  // This is a public page selection with an extra value: even when the
  // operation schema would otherwise project known fields, the facade rejects.
  const input = { year: 2026, injected: "internal-notes" }
  const result = await people["domain.page.CAP02"](input, { signal: new AbortController().signal })
  expect(result).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  expect(calls).toHaveLength(0)
})

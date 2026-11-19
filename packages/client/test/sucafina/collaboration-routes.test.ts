import { expect, test } from "bun:test"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { createSfCollaborationClient } from "../../src/sucafina/collaboration"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import { createSfTransport, type SfTransport, type SfTransportResult } from "../../src/sucafina/transport"

// Adapter/codec boundary only. Real recipient admission and C08 effects are
// qualified by the installed producer tests; unavailable probes grant nothing.
test("all 29 published Collaboration envelopes target the original JSON adapter", () => {
  const ids = Object.keys(SfCollaboration.operations) as Array<keyof typeof SfCollaboration.operations>
  expect(ids).toHaveLength(29)
  for (const id of ids) {
    expect(SfOperationRegistry[id]).toMatchObject({
      method: "POST", pathTemplate: "{mount}/dashboard", responseMode: "json",
      fixedQuery: { sf: "collaboration-" + id.slice("collaboration.".length) },
    })
  }
})

const probes: ReadonlyArray<{
  mode: string; payload: Record<string, unknown>
  invoke: (transport: SfTransport) => Promise<SfTransportResult<unknown>>
}> = [
  { mode: "thread-read", payload: { id: "thread" },
    invoke: (t) => createSfCollaborationClient(t)["collaboration.thread-read"]({ id: "thread" }, { signal: new AbortController().signal }) },
  { mode: "thread-history", payload: { id: "thread", messageId: "message", incarnation: "incarnation", version: 2 },
    invoke: (t) => createSfCollaborationClient(t)["collaboration.thread-history"]({ id: "thread", messageId: "message", incarnation: "incarnation", version: 2 }, { signal: new AbortController().signal }) },
  { mode: "storage-version", payload: { namespace: "threads" },
    invoke: (t) => createSfCollaborationClient(t)["collaboration.storage-version"]({ namespace: "threads" }, { signal: new AbortController().signal }) },
  { mode: "recipients", payload: {},
    invoke: (t) => createSfCollaborationClient(t)["collaboration.recipients"]({}, { signal: new AbortController().signal }) },
  { mode: "answer-read", payload: { questionId: "question" },
    invoke: (t) => createSfCollaborationClient(t)["collaboration.answer-read"]({ questionId: "question" }, { signal: new AbortController().signal }) },
  { mode: "answer-prepare-message", payload: { questionId: "question", messageId: "message", incarnation: "incarnation", version: 2 },
    invoke: (t) => createSfCollaborationClient(t)["collaboration.answer-prepare-message"]({ questionId: "question", messageId: "message", incarnation: "incarnation", version: 2 }, { signal: new AbortController().signal }) },
]

test("C05 reads send their exact closed body to dashboard without a surface field", async () => {
  const binding = { installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: binding.publicOrigin } } })
  try {
    for (const probe of probes) {
      const calls: Array<{ url: string; init: RequestInit | undefined }> = []
      const transport = createSfTransport({
        binding, generation: 1, currentGeneration: () => 1, operations: SfNativeOperationBindings,
        fetch: async (url, init) => {
          calls.push({ url: String(url), init })
          return Response.json({ status: "unavailable", reason: "source-probe" },
            { status: 503, headers: { "content-type": "application/json" } })
        },
      })
      expect(await probe.invoke(transport)).toEqual({
        kind: "response", status: 503, headers: { "content-type": "application/json" },
        body: { status: "unavailable", reason: "source-probe" },
      })
      expect(calls).toHaveLength(1)
      const request = calls[0]
      if (!request || typeof request.init?.body !== "string") throw new Error("One JSON request required")
      expect(request.url).toBe(binding.publicOrigin + "/sucafina/dashboard?sf=collaboration-" + probe.mode)
      expect(request.init.method).toBe("POST")
      expect(JSON.parse(request.init.body)).toEqual(probe.payload)
      expect(Object.hasOwn(JSON.parse(request.init.body), "surface")).toBe(false)
      expect(request.init.credentials).toBe("same-origin")
      expect(request.init.cache).toBe("no-store")
      expect(request.init.redirect).toBe("error")
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

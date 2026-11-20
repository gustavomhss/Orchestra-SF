import { expect, test } from "bun:test"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { createSfContextClient } from "../../src/sucafina/context"
import { createSfDecisionsClient } from "../../src/sucafina/decisions"
import { createSfDomainClient } from "../../src/sucafina/domain"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import { createSfTransport } from "../../src/sucafina/transport"

// Codec/HTTP boundary only. Probe responses are not installed C08 receipts,
// authority, a draft, or evidence that the producer committed a first save.
const binding = {
  installationId: "installation", projectId: "project", hostId: "host",
  publicOrigin: "https://installation.example", mount: "/sucafina",
  authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
}
const stamp = {
  installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
  principalRef: "person", policyVersion: "policy", accessRevision: "revision",
}
const caseRef = { id: "case", incarnation: "incarnation", version: 2 }
const originalKey = "original-first-save-0001"
const signal = () => new AbortController().signal
const mismatch = { kind: "transport-error", reason: "contract-mismatch" } as const
const unavailable = { kind: "transport-error", reason: "contract-unavailable" } as const

test("the two original private draft reads remain closed POST reads", () => {
  for (const id of ["dashboard.dashboard-draft-read", "dashboard.dashboard-hot-topic-draft-outcome"] as const)
    expect(SfOperationRegistry[id]).toEqual({
      method: "POST", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json",
      fixedQuery: { sf: id.slice("dashboard.".length) },
    })
})

test("only the admitted first-save outcome read carries its original command key", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", {
    configurable: true, value: { location: { origin: binding.publicOrigin } },
  })
  try {
    let generation = 1
    let denied = false
    const calls: Array<{ url: string; init: RequestInit | undefined }> = []
    const transport = createSfTransport({
      binding, generation: 1, currentGeneration: () => generation,
      operations: SfNativeOperationBindings,
      fetch: async (url, init) => {
        if (new URL(String(url)).pathname === "/sucafina/api/ui/context")
          return Response.json(denied ? { status: "denied" } : { status: "ok", value: {
            stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [],
          } }, { status: denied ? 403 : 200 })
        calls.push({ url: String(url), init })
        return Response.json({ status: "needs-input", reason: "read-only-probe" }, { status: 400 })
      },
    })
    const read = createSfDomainClient(transport)["dashboard.dashboard-hot-topic-draft-outcome"]
    const options = () => ({ signal: signal(), idempotencyKey: originalKey })
    const refresh = () => createSfContextClient(transport)["ctx.context"]({
      installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    }, { signal: signal() })

    expect(await read({ caseRef }, options())).toEqual(unavailable)
    expect(calls).toHaveLength(0)
    expect((await refresh()).kind).toBe("response")
    expect(await read({ caseRef }, { signal: signal() })).toEqual(mismatch)
    expect(await read({ caseRef }, { ...options(), idempotencyKey: "short" })).toEqual(mismatch)
    expect(await read({ caseRef }, { ...options(), retry: "same-intent" })).toEqual(mismatch)
    expect(calls).toHaveLength(0)

    for (let index = 0; index < 2; index++) {
      const result = await read({ caseRef }, options())
      expect(result).toMatchObject({
        kind: "response", status: 400, body: { status: "needs-input", reason: "read-only-probe" },
      })
    }
    expect(calls).toHaveLength(2)
    for (const request of calls) {
      expect(request.url).toBe(binding.publicOrigin + "/sucafina/dashboard?sf=dashboard-hot-topic-draft-outcome")
      expect(request.init?.method).toBe("POST")
      expect(request.init?.credentials).toBe("same-origin")
      expect(request.init?.cache).toBe("no-store")
      expect(request.init?.redirect).toBe("error")
      const headers = new Headers(request.init?.headers)
      expect(headers.get("Idempotency-Key")).toBe(originalKey)
      expect(headers.get("Content-Type")).toBe("application/json")
      if (typeof request.init?.body !== "string") throw new Error("Original JSON read body required")
      expect(JSON.parse(request.init.body)).toEqual({ caseRef })
    }
    expect(calls[0]?.init?.body).toBe(calls[1]?.init?.body)

    // Other original POST reads still reject caller-supplied identities.
    const review = createSfDecisionsClient(transport)["decisions.decision-review"]
    const selected = { caseRef, choiceId: "choice", changeId: "change" }
    expect(await review(selected, options())).toEqual(mismatch)
    expect(calls).toHaveLength(2)
    expect((await review(selected, { signal: signal() })).kind).toBe("response")
    expect(calls).toHaveLength(3)
    const generatedKey = new Headers(calls[2]?.init?.headers).get("Idempotency-Key")
    expect(generatedKey).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
    expect(generatedKey).not.toBe(originalKey)

    denied = true
    expect((await refresh()).kind).toBe("response")
    expect(await read({ caseRef }, options())).toEqual(unavailable)
    expect(calls).toHaveLength(3)
    denied = false
    expect((await refresh()).kind).toBe("response")
    generation = 2
    expect(await read({ caseRef }, options())).toEqual(mismatch)
    expect(calls).toHaveLength(3)
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

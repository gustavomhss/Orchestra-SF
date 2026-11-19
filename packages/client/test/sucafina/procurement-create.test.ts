import { expect, test } from "bun:test"
import { createSfContextClient } from "../../src/sucafina/context"
import { createSfProcurementClient } from "../../src/sucafina/procurement"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import { createSfTransport, type SfCallOptions, type SfTransport } from "../../src/sucafina/transport"

// F02/codec boundary only. These fixed form payloads exercise dispatch, not an
// installed actor, stored Procurement records, or producer success.
const pr = { page: "Requests" as const, action: "create" as const, version: 0, values: { pr: {
  title: "Operations EUR snapshot probe", type: "service",
  description: "Isolated Operations sourcing scope", estAmount: "100",
  costCenter: "Synthetic IT", needBy: "2026-12-01", justification: "Operations fixture only",
} } }
const supplier = { page: "Suppliers" as const, action: "create" as const, version: 0, values: { supplier: {
  legalName: "Operations document probe", country: "France", address: "Isolated E2E supplier",
  taxId: "original-test-id", contactEmail: "operations@example.invalid", paymentTerms: "Net 45",
  currency: "USD", riskRating: "Low",
} } }
const probes = [
  { id: "domain.command.CAP25.create" as const, body: pr,
    invoke: (transport: SfTransport, options: SfCallOptions) =>
      createSfProcurementClient(transport)["domain.command.CAP25.create"](pr, options) },
  { id: "domain.command.CAP27.create" as const, body: supplier,
    invoke: (transport: SfTransport, options: SfCallOptions) =>
      createSfProcurementClient(transport)["domain.command.CAP27.create"](supplier, options) },
]
for (const probe of probes) test("original native creation reaches the admitted HTTP boundary: " + probe.id, async () => {
  const decoded = SfNativeOperationBindings[probe.id]?.decodeInput(probe.body)
  expect(decoded).toEqual({ status: "ok", value: probe.body })
  const binding = { installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "http://127.0.0.1:3000", mount: "/sucafina", authMode: "local-operator" as const,
    contractRevision: "sf-native-ui/1" as const }
  const stamp = { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    principalRef: "person", accessRevision: "revision", policyVersion: "policy" }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: binding.publicOrigin } } })
  try {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = []
    const transport = createSfTransport({
      binding, generation: 1, currentGeneration: () => 1, operations: SfNativeOperationBindings,
      fetch: async (url, init) => {
        if (new URL(String(url)).pathname === "/sucafina/api/ui/context")
          return Response.json({ status: "ok", value: {
            stamp, contractRevision: "sf-native-ui/1", authMode: "local-operator", destinations: [], availability: [],
          } })
        calls.push({ url: String(url), init })
        return Response.json({ ok: false, status: 422, errors: ["Synthetic boundary refusal"] }, { status: 422 })
      },
    })
    const signal = new AbortController().signal
    expect((await createSfContextClient(transport)["ctx.context"]({
      installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    }, { signal })).kind).toBe("response")
    expect(await probe.invoke(transport, { signal, idempotencyKey: "original-created-intent" })).toMatchObject({
      kind: "response", status: 422, body: { ok: false, status: 422 },
    })
    expect(calls).toHaveLength(1)
    const request = calls[0]!
    expect(request.url).toBe(binding.publicOrigin + "/sucafina/procurement?page=" + probe.body.page)
    expect(request.init?.method).toBe("POST")
    expect(request.init?.credentials).toBe("same-origin")
    const headers = new Headers(request.init?.headers)
    expect(headers.get("Idempotency-Key")).toBe("original-created-intent")
    expect(headers.get("X-SF-Native-Owner")).toMatch(/^[A-Za-z0-9_-]+$/)
    if (typeof request.init?.body !== "string") throw new Error("Original command JSON required")
    expect(JSON.parse(request.init.body)).toEqual(probe.body)
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

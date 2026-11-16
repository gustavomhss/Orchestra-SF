import { expect, test } from "bun:test"
import { SfNativeOperationBindings } from "../../../src/sucafina/bindings"
import { createSfContextClient } from "../../../src/sucafina/context"
import { createSfReviewsClient } from "../../../src/sucafina/reviews"
import { createSfTransport, type SfDesktopCapability, type SfDesktopInvocation } from "../../../src/sucafina/transport"

// Synthetic desktop response boundary, not an installed producer witness.
test("submitted report 503 stays unknown; only an exact nonconcurrent retry reaches the source", async () => {
  const descriptor = { installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina", authMode: "microsoft" as const,
    contractRevision: "sf-native-ui/1" as const }
  const stamp = { installationId: "installation", projectId: "project", hostId: "host", principalRef: "person",
    policyVersion: "policy", accessRevision: "revision" }
  const calls: SfDesktopInvocation[] = []
  let release!: () => void
  let retryStarted!: () => void
  const started = new Promise<void>((resolve) => { retryStarted = resolve })
  const held = new Promise<void>((resolve) => { release = resolve })
  const desktop: SfDesktopCapability = {
    registerConnection: async () => ({ status: "cancelled" }), bind: async () => ({ status: "denied" }),
    abort: async () => {}, login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }), release: async () => {},
    invoke: async (request) => {
      calls.push(request)
      if (request.kind !== "request") throw new Error("unexpected chunk")
      if (request.operationId === "ctx.context") return { kind: "json-response", status: 200,
        headers: { "content-type": "application/json" }, body: { status: "ok", value: { stamp,
          contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [] } } }
      if (calls.filter((item) => item.kind === "request" && item.operationId === "reviews.report.prepare").length === 2) {
        retryStarted()
        await held
      }
      return { kind: "json-response", status: 503, headers: { "content-type": "application/json" },
        body: { status: "unavailable", reason: "after-artifact-storage" } }
    },
  }
  const transport = createSfTransport({ binding: descriptor, generation: 1, currentGeneration: () => 1,
    fetch: async () => { throw new Error("desktop only") }, operations: SfNativeOperationBindings, desktop,
    desktopBinding: { bindingHandle: "binding", descriptor, generation: 1 } })
  const signal = new AbortController().signal
  await createSfContextClient(transport)["ctx.context"]({ installationId: "installation", projectId: "project", hostId: "host" }, { signal })
  const client = createSfReviewsClient(transport)
  const payload = { reviewRef: "review-1", sectionRefs: ["section-1"], format: "docx" as const }
  const options = { signal, idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" }
  expect(await client["reviews.report.prepare"](payload, options)).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
  expect(await client["reviews.report.prepare"]({ ...payload, sectionRefs: ["section-2"] }, options))
    .toEqual({ kind: "transport-error", reason: "contract-mismatch" })
  const retry = client["reviews.report.prepare"](payload, options)
  await started
  expect(await client["reviews.report.prepare"](payload, options)).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
  release()
  expect(await retry).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
  const requests = calls.filter((item) => item.kind === "request" && item.operationId === "reviews.report.prepare")
  expect(requests).toHaveLength(2)
  for (const request of requests) {
    if (request.kind !== "request") throw new Error("request missing")
    expect(request.input).toEqual(payload)
    expect(request.idempotencyKey).toBe(options.idempotencyKey)
  }
})
